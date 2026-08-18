import type { PdbStructure, SortPriority } from '../../shared/types';
import { classifyLigands } from '../config/ligand-classification';

/**
 * 对已分类的 PDB 结构计算排序优先级
 *
 * 优先级（高→低）:
 * 1. apo — 无任何配体/伴侣（真正干净）
 * 2. holo_cofactor — 无抑制剂、有天然辅因子
 * 3. complex — 有共晶肽段/DNA/蛋白伴侣，无小分子配体
 * 4. inhibited — 有外来抑制剂
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

  if (hasInhibitor) return 'inhibited';
  if (hasCofactor) return 'holo_cofactor';

  // 有共晶肽段/DNA/蛋白伴侣 → 非 apo
  if (structure.bindingPartners && structure.bindingPartners.length > 0) {
    return 'complex';
  }

  // 以上皆无 = 真正 apo
  return 'apo';
}

/** 排序优先级数值映射（越小越靠前） */
const PRIORITY_ORDER: Record<SortPriority, number> = {
  apo: 0,
  holo_cofactor: 1,
  complex: 2,
  inhibited: 3,
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
): PdbStructure {
  if (structure.ligands.length === 0) return structure;

  const ligands = structure.ligands.map((l) => ({
    entityId: l.entityId,
    compId: l.compId,
    name: l.name,
  }));

  const bindingAffinitySet = structure.bindingAffinityCompIds
    ? new Set(structure.bindingAffinityCompIds)
    : undefined;

  const classified = classifyLigands(ligands, bindingAffinitySet);

  return {
    ...structure,
    ligands: classified,
  };
}
