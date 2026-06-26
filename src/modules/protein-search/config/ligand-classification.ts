import type { CofactorRef, LigandClass, LigandSummary } from '../../shared/types';

/**
 * 配体分类规则
 *
 * 分类优先级:
 * 1. 结晶/缓冲液成分 → crystal (排序忽略)
 * 2. 金属离子 → metal
 * 3. 辅因子 (硬编码集合 OR UniProt cofactor 交叉比对) → cofactor
 * 4. 抑制剂 (RCSB binding affinity 有数据 OR 名称含 inhibitor) → inhibitor
 * 5. 其余 → unknown
 */

// 常见结晶/缓冲液成分 comp_id 列表
const CRYSTAL_BUFFER_IDS = new Set([
  'NHE', 'EDO', 'PEG', 'PG4', 'PGE', 'SO4', 'PO4', 'ACT', 'CIT',
  'GOL', 'MPD', 'BME', 'DMS', 'FMT', 'EPE', 'TRS', 'TLA', 'PGO',
  'BCT', 'BTB', 'NO3', 'SCN', 'MPO', 'MES', 'HEPES', 'TRIS', 'BIS',
  'BIC', 'ACY', 'NH4', 'AZI', 'B3P', 'BE7', 'BO3', 'CAC', 'CDL',
  'CO3', 'CSS', 'DIO', 'DTV', 'FLC', 'FMT', 'GAI',
]);

// 金属离子 comp_id 列表
const METAL_IDS = new Set([
  'ZN', 'MG', 'MN', 'CA', 'FE', 'FE2', 'FE3', 'CU', 'CU1',
  'NA', 'K', 'CO', 'NI', 'CD', 'HG', 'MO', 'W', 'SR',
  'RB', 'CS', 'BA', 'LI', 'BE', 'AL',
]);

// 硬编码已知辅因子 comp_id 集合（不依赖 UniProt cofactor 数据即可命中）
const KNOWN_COFACTOR_IDS = new Set([
  'HEM', 'HEA', 'HEB', 'HEC',  // heme variants
  'FAD', 'FAS', 'FMN',          // flavins
  'NAD', 'NAP', 'NDP', 'NAI', 'NAJ',  // nicotinamide
  'COA', 'COB',                  // coenzyme A
  'PLP', 'TPP',                  // pyridoxal / thiamine
  'SAM', 'SAH',                  // S-adenosyl
  'ATP', 'ADP', 'AMP',           // adenosine
  'GTP', 'GDP', 'GMP',           // guanosine
  'UDP', 'UTP', 'CDP', 'CTP',   // pyrimidine
]);

// 常见抑制剂关键词 (名称中包含)
const INHIBITOR_KEYWORDS = [
  'inhibitor', 'inhibit',
];

/**
 * 批量分类配体
 *
 * @param ligands        待分类的配体列表
 * @param uniprotCofactors  UniProt 辅因子交叉引用（可选）
 * @param bindingAffinityCompIds  有 RCSB binding affinity 数据的 comp_id 集合（可选）
 */
export function classifyLigands(
  ligands: { entityId: number; compId: string; name: string }[],
  uniprotCofactors: CofactorRef[],
  bindingAffinityCompIds?: Set<string>,
): LigandSummary[] {
  return ligands.map((lig) => {
    const compUpper = lig.compId.toUpperCase();

    // 1. 结晶/缓冲液
    if (CRYSTAL_BUFFER_IDS.has(compUpper)) {
      return { ...lig, classification: 'crystal' as LigandClass };
    }

    // 2. 金属离子
    if (METAL_IDS.has(compUpper)) {
      return { ...lig, classification: 'metal' as LigandClass };
    }

    // 3. 辅因子: 硬编码集合兜底
    if (KNOWN_COFACTOR_IDS.has(compUpper)) {
      return { ...lig, classification: 'cofactor' as LigandClass };
    }

    // 4. 辅因子: UniProt cofactor 名称双向匹配
    if (uniprotCofactors.length > 0) {
      const cid = lig.compId.toLowerCase();
      const nm = lig.name.toLowerCase();
      for (const cf of uniprotCofactors) {
        const cfName = cf.name.toLowerCase();
        if (
          cid.includes(cfName) || cfName.includes(cid) ||
          nm.includes(cfName) || cfName.includes(nm)
        ) {
          return { ...lig, classification: 'cofactor' as LigandClass };
        }
      }
    }

    // 5. 抑制剂: RCSB binding affinity 中有该 comp_id
    if (bindingAffinityCompIds?.has(compUpper)) {
      return { ...lig, classification: 'inhibitor' as LigandClass };
    }

    // 6. 抑制剂: 名称关键词匹配
    for (const kw of INHIBITOR_KEYWORDS) {
      if (lig.name.toLowerCase().includes(kw)) {
        return { ...lig, classification: 'inhibitor' as LigandClass };
      }
    }

    return { ...lig, classification: 'unknown' as LigandClass };
  });
}
