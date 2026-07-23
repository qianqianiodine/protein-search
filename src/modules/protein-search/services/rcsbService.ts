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
  PolymerBindingPartner,
} from '../../shared/types';

const RCSB_SEARCH = 'https://search.rcsb.org/rcsbsearch/v2/query';
const RCSB_DATA = 'https://data.rcsb.org/rest/v1/core';

/** PDB 详情获取并发数 (HTTP/2 复用，可以开到 12) */
const PDB_CONCURRENCY = 12;

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
    request_options: {
      paginate: {
        start: 0,
        rows: 1000,
      },
    },
  };

  const data = await apiFetch<RcsbSearchResponse>(RCSB_SEARCH, {
    method: 'POST',
    body,
    signal,
  });

  return data.result_set.map((r) => r.identifier);
}

/**
 * 获取 PDB 条目详情（12 并发 + entity 全并行）
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
    console.warn(
      `[rcsbService] ${errors.length} PDB 获取失败: ${errors.join(', ')}`,
    );
  }

  return results;
}

/**
 * 获取单个 PDB 结构详情
 * Entry + binding affinity (并行) → 一次性并行获取所有 entities (polymer + nonpolymer)
 */
async function getSinglePdbStructure(
  pdbId: string,
  signal?: AbortSignal,
): Promise<PdbStructure> {
  // 1. 并行获取 entry 元数据 + binding affinity
  const [entry, bindingAffinityCompIds] = await Promise.all([
    apiFetch<RcsbEntryResponse>(
      `${RCSB_DATA}/entry/${pdbId}`,
      { signal },
    ),
    fetchBindingAffinity(pdbId, signal).catch(() => new Set<string>()),
  ]);

  const polymerIds =
    entry.rcsb_entry_container_identifiers?.polymer_entity_ids || [];
  const nonPolymerIds =
    entry.rcsb_entry_container_identifiers?.non_polymer_entity_ids || [];

  // 2. 构建所有 entity 请求，一次性全并行发出
  const entityFetches: Promise<unknown>[] = [];
  const polymerIndices: number[] = [];
  const nonpolymerIndices: number[] = [];

  for (const eid of polymerIds) {
    polymerIndices.push(entityFetches.length);
    entityFetches.push(
      apiFetch<RcsbPolymerEntityResponse>(
        `${RCSB_DATA}/polymer_entity/${pdbId}/${eid}`,
        { signal },
      ).catch(() => null),
    );
  }

  for (const eid of nonPolymerIds) {
    nonpolymerIndices.push(entityFetches.length);
    entityFetches.push(
      apiFetch<RcsbNonpolymerEntityResponse>(
        `${RCSB_DATA}/nonpolymer_entity/${pdbId}/${eid}`,
        { signal },
      ).catch(() => null),
    );
  }

  // 全部 entity 请求同时发出
  const allResults = await Promise.all(entityFetches);

  // 3. 解析 polymer entities
  const coverages: EntityCoverage[] = [];
  const polymerMeta: { entityId: number; chainId: string; seqLen: number; polymerType: string; uniprotAccession: string | null }[] = [];

  for (const idx of polymerIndices) {
    const poly = allResults[idx] as RcsbPolymerEntityResponse | null;
    if (!poly) continue;
    const cov = parsePolymerEntity(poly);
    coverages.push(cov);
    polymerMeta.push({
      entityId: cov.entityId,
      chainId: cov.chainId,
      seqLen: cov.sequence.length,
      polymerType: poly.entity_poly?.rcsb_entity_polymer_type || 'Protein',
      uniprotAccession: cov.uniprotAccession,
    });
  }

  // 3a. 识别共晶聚合物配体（非主体蛋白的 peptide/DNA/RNA/其他蛋白）
  const bindingPartners = detectBindingPartners(polymerMeta);

  // 4. 解析 nonpolymer entities
  const ligands: LigandSummary[] = [];
  for (const idx of nonpolymerIndices) {
    const nonpoly = allResults[idx] as RcsbNonpolymerEntityResponse | null;
    if (nonpoly?.pdbx_entity_nonpoly?.comp_id) {
      ligands.push({
        entityId:
          nonpoly.rcsb_nonpolymer_entity_container_identifiers?.entity_id || 0,
        compId: nonpoly.pdbx_entity_nonpoly.comp_id,
        name: nonpoly.pdbx_entity_nonpoly.name || nonpoly.pdbx_entity_nonpoly.comp_id,
        classification: 'inhibitor',
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
    citationTitle: entry.rcsb_primary_citation?.title || null,
    organism:
      entry.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || '-',
    bindingAffinityCompIds: bindingAffinityCompIds.size > 0
      ? [...bindingAffinityCompIds]
      : undefined,
    bindingPartners: bindingPartners.length > 0 ? bindingPartners : undefined,
  };
}

function parsePolymerEntity(poly: RcsbPolymerEntityResponse): EntityCoverage {
  // 找 UniProt 比对（SIFTS 来源）
  const uniprotAlign = (poly.rcsb_polymer_entity_align || []).find(
    (a) => a.reference_database_name === 'UniProt',
  );

  // UniProt accession
  const uniprotAccession =
    uniprotAlign?.reference_database_accession || null;

  // 残基范围：取第一个 aligned_region 的 UniProt 坐标
  let uniprotStart: number | null = null;
  let uniprotEnd: number | null = null;
  if (uniprotAlign?.aligned_regions?.length) {
    const region = uniprotAlign.aligned_regions[0];
    uniprotStart = region.ref_beg_seq_id ?? null;
    if (uniprotStart != null) {
      uniprotEnd =
        region.ref_end_seq_id ??
        uniprotStart + (region.length ?? 0) - 1;
    }
  }

  // 特征区域 (Pfam 等，来自 rcsb_polymer_entity_feature)
  const features: StructureFeature[] = [];
  for (const feat of poly.rcsb_polymer_entity_feature || []) {
    if (feat.type && feat.name) {
      for (const fp of feat.feature_positions || []) {
        features.push({
          type: feat.type,
          name: feat.name,
          start: fp.beg_seq_id || 0,
          end: fp.end_seq_id || 0,
        });
      }
    }
  }

  // 序列覆盖比例（优先用 Pfam 特征区域计算）
  let coverageRatio = 0;
  const seqLen =
    poly.entity_poly?.pdbx_seq_one_letter_code?.length ||
    poly.entity_poly?.pdbx_seq_one_letter_code_can?.length ||
    1;
  const pfamFeatures = (poly.rcsb_polymer_entity_feature || []).filter(
    (f) => f.type === 'Pfam',
  );
  if (pfamFeatures.length > 0) {
    let covered = 0;
    for (const pf of pfamFeatures) {
      for (const fp of pf.feature_positions || []) {
        covered += (fp.end_seq_id || 0) - (fp.beg_seq_id || 0) + 1;
      }
    }
    coverageRatio = Math.min(1, Math.max(0, covered / seqLen));
  }

  return {
    entityId:
      poly.rcsb_polymer_entity_container_identifiers?.entity_id || 0,
    chainId: poly.entity_poly?.pdbx_strand_id || '-',
    uniprotAccession,
    organism:
      poly.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || '-',
    sequence:
      poly.entity_poly?.pdbx_seq_one_letter_code ||
      poly.entity_poly?.pdbx_seq_one_letter_code_can ||
      '',
    uniprotStart,
    uniprotEnd,
    features,
    coverageRatio,
  };
}

/**
 * 识别共晶聚合物配体 — 非主体蛋白的 polymer entity
 *
 * 以最长 polypeptide 为主体，其余 polymer entity 分类为：
 * - Protein < 50 aa → peptide (短肽配体)
 * - Protein ≥ 50 aa → protein (蛋白结合伴侣)
 * - DNA / RNA → dna / rna (寡核苷酸)
 * - 只有 1 个 polymer entity 时返回空数组
 */
function detectBindingPartners(
  polymers: { entityId: number; chainId: string; seqLen: number; polymerType: string; uniprotAccession: string | null }[],
): PolymerBindingPartner[] {
  if (polymers.length <= 1) return [];

  // 找最长 polypeptide 作为主体（忽略 DNA/RNA 当主体的边缘情况）
  let mainIdx = 0;
  let maxLen = 0;
  for (let i = 0; i < polymers.length; i++) {
    const p = polymers[i];
    const isProtein = p.polymerType === 'Protein' || !p.polymerType;
    const len = isProtein ? p.seqLen : 0;
    if (len > maxLen) {
      maxLen = len;
      mainIdx = i;
    }
  }

  // 如果主体是 DNA/RNA（即所有 entity 都是 DNA/RNA），则不产生 binding partner
  if (maxLen === 0) return [];

  const partners: PolymerBindingPartner[] = [];

  for (let i = 0; i < polymers.length; i++) {
    if (i === mainIdx) continue;
    const p = polymers[i];

    let type: PolymerBindingPartner['type'];
    let desc: string;

    if (p.polymerType === 'DNA') {
      type = 'dna';
      desc = `DNA (${p.seqLen} nt)`;
    } else if (p.polymerType === 'RNA') {
      type = 'rna';
      desc = `RNA (${p.seqLen} nt)`;
    } else if (p.seqLen < 50) {
      type = 'peptide';
      const gene = p.uniprotAccession ? ` ${p.uniprotAccession}` : '';
      desc = `Peptide${gene} (${p.seqLen} aa)`;
    } else {
      type = 'protein';
      const gene = p.uniprotAccession ? ` ${p.uniprotAccession}` : '';
      desc = `Protein${gene} (${p.seqLen} aa)`;
    }

    partners.push({
      entityId: p.entityId,
      chainId: p.chainId,
      type,
      description: desc,
      uniprotAccession: p.uniprotAccession,
    });
  }

  return partners;
}

/**
 * 查询 RCSB GraphQL 获取 binding affinity 数据
 * 返回有 Ki/Kd/IC50/EC50 数据的 comp_id 集合
 */
async function fetchBindingAffinity(
  pdbId: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const body = {
    query: `query{entry(entry_id:"${pdbId}"){rcsb_binding_affinity{comp_id}}}`,
  };
  const data = await apiFetch<{
    data: { entry: { rcsb_binding_affinity?: Array<{ comp_id: string }> } };
  }>('https://data.rcsb.org/graphql', {
    method: 'POST',
    body,
    signal,
  });
  return new Set(
    data.data.entry.rcsb_binding_affinity?.map((b) => b.comp_id) ?? [],
  );
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
