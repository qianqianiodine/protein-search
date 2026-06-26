import { apiFetch } from '../../shared/services/api';
import type {
  RcsbSearchResponse,
  RcsbEntryResponse,
  RcsbPolymerEntityResponse,
  RcsbNonpolymerEntityResponse,
  PdbStructure,
  EntityCoverage,
  StructureFeature,
  LigandSummary,
} from '../../shared/types';

const RCSB_SEARCH = 'https://search.rcsb.org/rcsbsearch/v2/query';
const RCSB_DATA = 'https://data.rcsb.org/rest/v1/core';

/**
 * 通过 UniProt accession 搜索 PDB 条目 (仅 X-ray)
 */
export async function searchPdbByUniprot(
  uniprotAccession: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const body = {
    query: {
      type: 'group',
      logical_operator: 'and',
      nodes: [
        {
          type: 'terminal',
          service: 'text',
          parameters: {
            attribute: 'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession',
            operator: 'exact_match',
            value: uniprotAccession,
          },
        },
        {
          type: 'terminal',
          service: 'text',
          parameters: {
            attribute: 'exptl.method',
            operator: 'exact_match',
            value: 'X-RAY DIFFRACTION',
          },
        },
      ],
    },
    return_type: 'entry',
  };

  const data = await apiFetch<RcsbSearchResponse>(RCSB_SEARCH, {
    method: 'POST',
    body,
    signal,
  });

  return data.result_set.map((r) => r.identifier);
}

/**
 * 获取 PDB 条目详情 + 所有 polymer/nonpolymer entity 信息
 */
export async function getPdbStructures(
  pdbIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PdbStructure[]> {
  const results: PdbStructure[] = [];

  for (let i = 0; i < pdbIds.length; i++) {
    if (signal?.aborted) break;

    try {
      const structure = await getSinglePdbStructure(pdbIds[i], signal);
      results.push(structure);
    } catch {
      // 单个 PDB 失败不影响整体
    }
    onProgress?.(i + 1, pdbIds.length);
  }

  return results;
}

async function getSinglePdbStructure(
  pdbId: string,
  signal?: AbortSignal,
): Promise<PdbStructure> {
  const entry = await apiFetch<RcsbEntryResponse>(
    `${RCSB_DATA}/entry/${pdbId}`,
    { signal },
  );

  const polymerCount =
    entry.rcsb_entry_info?.deposited_polymer_entity_instance_count || 0;
  const nonpolymerCount =
    entry.rcsb_entry_info?.deposited_nonpolymer_entity_instance_count || 0;

  // 并行获取所有 polymer entities
  const coverage: EntityCoverage[] = [];
  for (let e = 1; e <= polymerCount; e++) {
    if (signal?.aborted) break;
    try {
      const poly = await apiFetch<RcsbPolymerEntityResponse>(
        `${RCSB_DATA}/polymer_entity/${pdbId}/${e}`,
        { signal },
      );
      coverage.push(parsePolymerEntity(poly));
    } catch {
      // skip failed entity
    }
  }

  // 获取所有 nonpolymer entities (ID 从 polymer_count+1 开始)
  const ligands: LigandSummary[] = [];
  for (let e = polymerCount + 1; e <= polymerCount + nonpolymerCount; e++) {
    if (signal?.aborted) break;
    try {
      const nonpoly = await apiFetch<RcsbNonpolymerEntityResponse>(
        `${RCSB_DATA}/nonpolymer_entity/${pdbId}/${e}`,
        { signal },
      );
      if (nonpoly.nonpolymer_comp?.comp_id) {
        ligands.push({
          entityId: nonpoly.rcsb_nonpolymer_entity_container_identifiers?.entity_id || e,
          compId: nonpoly.nonpolymer_comp.comp_id,
          name: nonpoly.nonpolymer_comp.name || nonpoly.nonpolymer_comp.comp_id,
          classification: 'unknown',
        });
      }
    } catch {
      // skip failed entity
    }
  }

  return {
    pdbId,
    method: entry.exptl?.[0]?.method || 'Unknown',
    resolution: entry.rcsb_entry_info?.resolution_combined?.[0] ?? null,
    depositedDate: entry.rcsb_accession_info?.initial_release_date || '-',
    chainIds: coverage.map((c) => c.chainId),
    coverage,
    ligands,
    doi: entry.rcsb_primary_citation?.pdbx_database_id_DOI || null,
    organism: entry.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || '-',
  };
}

function parsePolymerEntity(poly: RcsbPolymerEntityResponse): EntityCoverage {
  const alignments = poly.entity_poly?.rcsb_uniprot_alignments || [];
  const features: StructureFeature[] = [];

  for (const align of alignments) {
    for (const fp of align.feature_positions || []) {
      if (fp.type && fp.name) {
        features.push({
          type: fp.type,
          name: fp.name,
          start: fp.beg_seq_id || 0,
          end: fp.end_seq_id || 0,
        });
      }
    }
  }

  // 计算结构覆盖比例：取第一个 alignment 的覆盖范围
  let coverageRatio = 0;
  if (alignments.length > 0) {
    const fp = alignments[0].feature_positions || [];
    if (fp.length > 0) {
      const seqLen = poly.entity_poly?.rcsb_seq_one_letter_code?.length || 1;
      const covered = fp.reduce((sum, f) => sum + ((f.end_seq_id || 0) - (f.beg_seq_id || 0) + 1), 0);
      coverageRatio = Math.min(1, Math.max(0, covered / seqLen));
    }
  }

  return {
    entityId: poly.rcsb_polymer_entity_container_identifiers?.entity_id || 0,
    chainId: poly.entity_poly?.pdbx_strand_id || '-',
    uniprotAccession:
      poly.entity_poly?.rcsb_uniprot_accession?.[0]?.rcbs_id || null,
    organism:
      poly.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || '-',
    sequence: poly.entity_poly?.rcsb_seq_one_letter_code || '',
    features,
    coverageRatio,
  };
}
