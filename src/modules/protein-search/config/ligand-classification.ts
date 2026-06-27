import type { LigandSummary } from '../../shared/types';

/**
 * 配体分类规则 — 白名单排除法
 *
 * 分类优先级:
 * 1. NATIVE_LIGANDS 命中 → cofactor（天然辅因子/辅基/核苷酸）
 * 2. BACKGROUND_LIGANDS 命中 → crystal（结晶/缓冲液/纯化引入）
 * 3. bindingAffinityCompIds 命中 → inhibitor（实验确证抑制剂）
 * 4. 其余不在白名单中 → inhibitor（排除法推断为外来小分子）
 *
 * 核心理念：无法枚举所有小分子化合物，只要不在"安全名单"上的统统视为外来配体。
 */

// ── 背景配体 — 结晶/纯化引入，应排除 ──
const BACKGROUND_LIGANDS = new Set([
  // 缓冲剂
  'TRS', 'MES', 'HEP', 'EPE', 'PIN', 'IMD', 'CAC', 'ACT', 'FLC', 'BIC', 'TRA',
  // 盐类与离子
  'NA', 'CL', 'K', 'CA', 'MG', 'ZN', 'MN', 'CO', 'NI',
  'SO4', 'PO4', 'NH4', 'LI', 'HG', 'CD', 'PT',
  // 沉淀剂与有机溶剂
  'PEG', 'PGE', 'PG4', 'PG5', 'PG6', 'PE7', 'PEU',
  'MPD', 'MRD', 'IPA', 'EOH', 'MOH', '1BO',
  // 冷冻保护剂
  'GOL', 'CRY', 'EDO', 'PGO', 'PDO', 'BU1', 'BU2', 'BU3',
  // 去垢剂与添加剂
  'LMT', 'DDM', 'BOG', 'LDA', 'TAM', 'CHL', 'BE7', 'TFP',
  // 水
  'HOH', 'DOD',
  // 其它结晶添加剂（含稀有金属离子）
  'DMS', 'BME', 'FMT', 'SCN', 'BR', 'I', 'CS', 'RB',
  'AU', 'AG', 'AL', 'BA', 'BE', 'BI', 'CR', 'CU', 'ER', 'EU',
  'FE', 'GA', 'GD', 'GE', 'IN', 'IR', 'LA', 'LU', 'MO', 'ND',
  'OS', 'PB', 'PD', 'PR', 'RA', 'RH', 'RU', 'SB', 'SE', 'SM',
  'SN', 'SR', 'TB', 'TC', 'TH', 'TI', 'TL', 'TM', 'U', 'V', 'W', 'Y', 'YB',
]);

// ── 天然功能配体 — 辅因子、辅基、核苷酸等（数据来源：PDBe API /pdb/compound/cofactors）──
const NATIVE_LIGANDS = new Set([
  // 天然功能金属离子
  'CA', 'ZN', 'MG', 'MN', 'FE', 'CU', 'NI', 'MO',
  // 血红素 (Heme)
  'HEM', 'HEA', 'HEB', 'HEC', 'HDE', 'HDD', 'CCH', 'COH', 'DDH', 'DHE',
  'FDE', 'FMI', 'HAS', 'HIF', 'ISW', 'MH0', 'MNH', 'MNR', 'PP9', 'SH0',
  'SRM', 'ZEM', 'ZNH', '6HE', '7HE',
  // FAD
  'FAD', 'FA8', 'FAA', 'FAB', 'FAE', 'FAO', 'FAS', 'FCG', 'FDA', 'FED',
  'FSH', 'P5F', 'RFL', 'SFD', '6FA',
  // FMN
  'FMN', 'FNR', 'FNS', 'IRF', 'RBF', '4LS', '4LU',
  // NAD/NADP
  'NAD', 'NAI', 'NAP', 'NDP', 'NAX', 'NBD', 'NBP', 'NDC', 'NDE', 'NDO',
  'NHD', 'NPW', 'ODP', 'P1H', 'PAD', 'SAD', 'SAE', 'SND', 'TAD', 'TAP',
  'TDT', 'TXD', 'TXE', 'TXP', 'ZID', '0WD', '1DG', '3AA', '3CD', '6V0',
  '8ID', 'A3D', 'AP0', 'CND', 'DG1', 'DN4', 'EAD', 'ENA', 'LNC', 'N01',
  'NA0', 'NAE', 'NAJ', 'NAQ',
  // 辅酶A (Coenzyme A)
  'COA', 'ACO', 'AMX', 'BCA', 'BCO', 'BSJ', 'BYC', 'CA3', 'CA5', 'CA6',
  'CA8', 'CAA', 'CAJ', 'CAO', 'CIC', 'CMC', 'CMX', 'CO6', 'CO8', 'COD',
  'COF', 'COO', 'COT', 'COW', 'COZ', 'DCA', 'DCC', 'FAM', 'FCX', 'FRE',
  'FYN', 'GRA', 'HAX', 'HMG', 'HSC', 'HXC', 'MCA', 'MCD', 'MDE', 'MLC',
  'MYA', 'NHM', 'NHQ', 'NHW', 'NMX', 'OXK', 'S0N', 'SCA', 'SCD', 'SCO',
  'SDX', 'SOP', 'T1G', 'TC6', 'WCA', 'YNC', 'ZOZ',
  // SAM/SAH
  'SAM', 'SAH', 'SFG', 'SMM', 'SX0', 'TT8', '0UM', '0XU', '0Y0', '0Y1',
  '0Y2', '36A', '37H', '4IK', '62X', '6NR', '76H', '76J', '76K', '76L',
  '76M', 'EEM', 'K15', 'SA8',
  // 四氢叶酸 (THF)
  'THF', 'THG', 'THH', 'FFO', 'FON', 'FOZ', '1YJ', 'C2F',
  // 焦磷酸硫胺素 (TPP)
  'TPP', 'TDP', 'THD', 'TD6', 'TD7', 'TD8', 'TD9', 'TDK', 'TDL', 'TDM',
  'TDW', 'TP8', 'TPU', 'TPW', 'TZD', 'WWF', '1TP', '1U0', '2TP', '5GY',
  '8EF', '8EL', '8EO', '8FL', '8PA', 'D7K', 'EN0', 'HTL', 'M6T', 'N1T',
  'N3T', 'R1T', 'S1T', 'T5X', 'T6F',
  // 磷酸吡哆醛 (PLP)
  'PLP', 'PMP', 'PXP', 'PZP', 'MPL', 'NOP', 'NPL', 'PDP', 'PLR', 'UAH',
  // 生物素 (Biotin)
  'BTN', 'BTI', 'BYT', 'DTB', 'Y7Y',
  // 铁硫簇 (Iron-sulfur clusters)
  'SF4', 'FES', 'F3S',
  // 钼蝶呤 (Molybdopterin)
  'MGD', 'MTE', 'MTV', 'MSS', 'PCD', 'XAX', '2MD', 'MCN',
  // 泛醌 (Ubiquinone)
  'UQ1', 'UQ2', 'UQ5', 'UQ6', '4YP', 'AT5',
  // 维生素B12
  'B12', 'COB', 'CNC', 'COY',
  // 抗坏血酸
  'ASC',
  // 硫辛酸
  'LPA', 'LPB',
  // 吡咯喹啉醌 (PQQ)
  'PQQ',
  // 生物蝶呤 (Biopterin)
  'BIO', 'H4B', 'H2B', 'BHS', 'HBI', '4AB', '7AP', 'WSD',
  // 拓扑醌 (Topaquinone)
  'TPQ', 'P2Q', 'P3Q', 'TYQ', 'TYY', '1TY', '2TY', 'AGQ', 'G27', 'HCC',
  // 辅酶M
  'COM',
  // 因子F430
  'F43', 'M43',
  // 甲基萘醌 (Menaquinone)
  'MQ7',
  // 磷酸泛酰巯基乙胺
  'PNS',
  // 辅酶B
  'SHT', 'TP7', 'TPZ', 'TXZ', 'XP8', 'XP9',
  // 谷胱甘肽
  'GSH', 'GSM', 'GSN', 'GSO', 'GTB', 'GTD', 'GTS', 'GTX', 'GTY',
  // 二吡咯甲烷
  'DPM', '18W', '29P',
  // MIO
  'MDO',
  // 正交醌 (Orthoquinone)
  'TOQ', 'TQQ', 'TRQ', '0AF',
  // 核苷酸
  'ATP', 'ADP', 'AMP', 'GTP', 'GDP', 'GUA',
  'CTP', 'CDP', 'CMP', 'UTP', 'UDP', 'UMP', 'ITP', 'TTP',
  // 糖与糖蛋白
  'GLC', 'BGC', 'NAG', 'FUC', 'SIA', 'MAN', 'GAL', 'XYL', 'ARA', 'RAM',
  'BMA', 'NDG', 'FMA',
  // 其它天然配体
  'RET', 'FOL',
]);

/**
 * 批量分类配体（白名单排除法）
 *
 * @param ligands                 待分类的配体列表
 * @param bindingAffinityCompIds  有 RCSB binding affinity 数据的 comp_id 集合（可选）
 */
export function classifyLigands(
  ligands: { entityId: number; compId: string; name: string }[],
  bindingAffinityCompIds?: Set<string>,
): LigandSummary[] {
  return ligands.map((lig) => {
    const compUpper = lig.compId.toUpperCase();

    // 1. 天然功能配体（含功能性金属离子）
    if (NATIVE_LIGANDS.has(compUpper)) {
      return { ...lig, classification: 'cofactor' };
    }

    // 2. 背景化合物（结晶/缓冲液/纯化引入）
    if (BACKGROUND_LIGANDS.has(compUpper)) {
      return { ...lig, classification: 'crystal' };
    }

    // 3. Binding affinity 实验确证的抑制剂
    if (bindingAffinityCompIds?.has(compUpper)) {
      return { ...lig, classification: 'inhibitor' };
    }

    // 4. 不在白名单 → 外来小分子（抑制剂）
    return { ...lig, classification: 'inhibitor' };
  });
}
