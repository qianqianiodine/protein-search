import type { PdbStructure, SortPriority, CofactorRef } from '../../shared/types';
import { classifyLigands } from '../config/ligand-classification';

/**
 * 对已分类的 PDB 结构计算排序优先级
 *
 * 优先级（高→低）:
 * 1. apo — 无抑制剂、无辅因子（真正干净）
 * 2. holo_cofactor — 无抑制剂、有天然辅因子
 * 3. inhibited — 有外来抑制剂
 * 4. unknown — 无法判断
 *
 * 结晶/缓冲液成分已被分类为 crystal，不影响排序
 */
export function computeSortPriority(
  structure: PdbStructure & { classifiedLigands?: ReturnType<typeof classifyLigands> },
): SortPriority {
  const ligands = structure.classifiedLigands || structure.ligands;

  // 过滤掉结晶/缓冲液成分，只看影响排序的配体
  const relevant = ligands.filter((l) => l.classification !== 'crystal');

  const hasInhibitor = relevant.some((l) => l.classification === 'inhibitor');
  const hasCofactor = relevant.some((l) => l.classification === 'cofactor');
  const hasUnknown = relevant.some((l) => l.classification === 'unknown');

  if (hasInhibitor) return 'inhibited';
  if (hasCofactor) return 'holo_cofactor';
  if (hasUnknown) return 'unknown';

  // 无抑制剂、无辅因子 = 真正 apo
  return 'apo';
}

/** 排序优先级数值映射（越小越靠前） */
const PRIORITY_ORDER: Record<SortPriority, number> = {
  apo: 0,
  holo_cofactor: 1,
  inhibited: 2,
  unknown: 3,
};

/** 按排序优先级 + DOI 分组排列 PDB 结构 */
export function sortByPriority(
  structures: PdbStructure[],
): PdbStructure[] {
  return [...structures].sort((a, b) => {
    const pa = PRIORITY_ORDER[computeSortPriority(a)];
    const pb = PRIORITY_ORDER[computeSortPriority(b)];
    if (pa !== pb) return pa - pb;
    // 同优先级内按 DOI 分组（相同 DOI 排一起，无 DOI 排最后）
    const da = a.doi || '';
    const db = b.doi || '';
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}

/** 将分类应用到结构的配体上 */
export function classifyStructureLigands(
  structure: PdbStructure,
  uniprotCofactors: CofactorRef[],
): PdbStructure {
  if (structure.ligands.length === 0) return structure;

  const ligands = structure.ligands.map((l) => ({
    entityId: l.entityId,
    compId: l.compId,
    name: l.name,
  }));

  const classified = classifyLigands(ligands, uniprotCofactors);

  return {
    ...structure,
    ligands: classified,
  };
}
