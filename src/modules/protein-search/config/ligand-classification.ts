import type { CofactorRef, LigandClass, LigandSummary } from '../../shared/types';

/**
 * 配体分类规则
 *
 * 分类优先级:
 * 1. 先检查是否晶体/缓冲液成分 → crystal (排序忽略)
 * 2. 再检查是否金属离子 → metal
 * 3. 再检查是否已知抑制剂 → inhibitor
 * 4. UniProt cofactor 交叉比对 → cofactor
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

// 常见抑制剂关键词 (comp_id 或名称中包含)
const INHIBITOR_KEYWORDS = [
  'inhibitor', 'inhibit',
];

// 抑制剂黑名单: 辅因子可能被关键词误匹配
const COFACTOR_BLACKLIST = new Set([
  'HEM', 'HEA', 'HEB', 'HEC', 'FAD', 'FAS', 'FMN', 'NAD', 'NAP',
  'NDP', 'NAI', 'NAJ', 'COA', 'COB', 'PLP', 'TPP', 'SAM', 'SAH',
  'ADE', 'AMP', 'ADP', 'ATP', 'GMP', 'GDP', 'GTP', 'UDP', 'UTP',
]);

/**
 * 分类单个配体
 */
export function classifyOneLigand(
  compId: string,
  name: string,
  uniprotCofactors: CofactorRef[],
): LigandClass {
  const compUpper = compId.toUpperCase();
  const nameLower = name.toLowerCase();

  // 1. 结晶/缓冲液
  if (CRYSTAL_BUFFER_IDS.has(compUpper)) return 'crystal';

  // 2. 金属离子
  if (METAL_IDS.has(compUpper)) return 'metal';

  // 3. 已知辅因子 (UniProt cofactorCrossReference 交叉比对)
  if (uniprotCofactors.length > 0 && !COFACTOR_BLACKLIST.has(compUpper)) {
    // 暂不在此做交叉比对 — 留给 classifyLigands 批量处理
  }

  // 4. 抑制剂关键词匹配 (排除已知辅因子)
  if (!COFACTOR_BLACKLIST.has(compUpper)) {
    for (const kw of INHIBITOR_KEYWORDS) {
      if (nameLower.includes(kw) || compUpper.toLowerCase().includes(kw)) {
        return 'inhibitor';
      }
    }
  }

  return 'unknown';
}

/**
 * 批量分类配体 (含 UniProt 辅因子交叉比对)
 */
export function classifyLigands(
  ligands: { entityId: number; compId: string; name: string }[],
  uniprotCofactors: CofactorRef[],
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

    // 3. 辅因子交叉比对
    if (uniprotCofactors.length > 0) {
      // 简单名称匹配: 检查 compId/name 是否匹配 cofactor name
      for (const cf of uniprotCofactors) {
        const cfName = cf.name.toLowerCase();
        if (
          lig.compId.toLowerCase().includes(cfName) ||
          lig.name.toLowerCase().includes(cfName)
        ) {
          return { ...lig, classification: 'cofactor' as LigandClass };
        }
      }
    }

    // 4. 抑制剂关键词
    for (const kw of INHIBITOR_KEYWORDS) {
      if (lig.name.toLowerCase().includes(kw)) {
        return { ...lig, classification: 'inhibitor' as LigandClass };
      }
    }

    return { ...lig, classification: 'unknown' as LigandClass };
  });
}
