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

/** PDB 详情获取并发数 */
const PDB_CONCURRENCY = 6;

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
            attribute:
              'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession',
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
 * 获取 PDB 条目详情（并发控制 + entity 级并行）
 */
export async function getPdbStructures(
  pdbIds: string[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<PdbStructure[]> {
  const total = pdbIds.length;
  let completed = 0;

  const results: PdbStructure[] = [];
  const errors: string[] = [];

  await concurrentMap(PDB_CONCURRENCY, pdbIds, async (pdbId) => {
    if (signal?.aborted) return;

    try {
      const structure = await getSinglePdbStructure(pdbId, signal);
      results.push(structure);
    } catch {
      errors.push(pdbId);
    }

    completed++;
    onProgress?.(completed, total);
  });

  if (errors.length > 0) {
    console.warn(`[rcsbService] ${errors.length} PDB 获取失败: ${errors.join(', ')}`);
  }

  return results;
}

/**
 * 获取单个 PDB 结构详情
 * Entry → 并行获取 polymer entities + nonpolymer entities
 */
async function getSinglePdbStructure(
  pdbId: string,
  signal?: AbortSignal,
): Promise<PdbStructure> {
  // 1. 先获取 entry 元数据
  const entry = await apiFetch<RcsbEntryResponse>(
    `${RCSB_DATA}/entry/${pdbId}`,
    { signal },
  );

  const polymerCount =
    entry.rcsb_entry_info?.deposited_polymer_entity_instance_count || 0;
  const nonpolymerCount =
    entry.rcsb_entry_info?.deposited_nonpolymer_entity_instance_count || 0;

  // 2. 并行获取所有 polymer entities
  const polymerIds = Array.from({ length: polymerCount }, (_, i) => i + 1);
  const polymerResults = await Promise.all(
    polymerIds.map((e) =>
      apiFetch<RcsbPolymerEntityResponse>(
        `${RCSB_DATA}/polymer_entity/${pdbId}/${e}`,
        { signal },
      ).catch(() => null),
    ),
  );

  const coverages: EntityCoverage[] = [];
  for (const poly of polymerResults) {
    if (poly) coverages.push(parsePolymerEntity(poly));
  }

  // 3. 并行获取所有 nonpolymer entities
  const nonpolymerIds = Array.from(
    { length: nonpolymerCount },
    (_, i) => polymerCount + i + 1,
  );
  const nonpolymerResults = await Promise.all(
    nonpolymerIds.map((e) =>
      apiFetch<RcsbNonpolymerEntityResponse>(
        `${RCSB_DATA}/nonpolymer_entity/${pdbId}/${e}`,
        { signal },
      ).catch(() => null),
    ),
  );

  const ligands: LigandSummary[] = [];
  for (const nonpoly of nonpolymerResults) {
    if (nonpoly?.nonpolymer_comp?.comp_id) {
      ligands.push({
        entityId:
          nonpoly.rcsb_nonpolymer_entity_container_identifiers?.entity_id || 0,
        compId: nonpoly.nonpolymer_comp.comp_id,
        name: nonpoly.nonpolymer_comp.name || nonpoly.nonpolymer_comp.comp_id,
        classification: 'unknown',
      });
    }
  }

  return {
    pdbId,
    method: entry.exptl?.[0]?.method || 'Unknown',
    resolution: entry.rcsb_entry_info?.resolution_combined?.[0] ?? null,
    depositedDate: entry.rcsb_accession_info?.initial_release_date || '-',
    chainIds: coverages.map((c) => c.chainId),
    coverage: coverages,
    ligands,
    doi: entry.rcsb_primary_citation?.pdbx_database_id_DOI || null,
    organism:
      entry.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || '-',
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

  let coverageRatio = 0;
  if (alignments.length > 0) {
    const fp = alignments[0].feature_positions || [];
    if (fp.length > 0) {
      const seqLen =
        poly.entity_poly?.rcsb_seq_one_letter_code?.length || 1;
      const covered = fp.reduce(
        (sum, f) => sum + ((f.end_seq_id || 0) - (f.beg_seq_id || 0) + 1),
        0,
      );
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

/**
 * 受控并发映射 — 同时最多运行 poolSize 个异步任务
 */
async function concurrentMap<T, R>(
  poolSize: number,
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(poolSize, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results.filter((_, i) => i < items.length);
}
