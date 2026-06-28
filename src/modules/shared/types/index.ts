// ============================================================
// UniProt 相关类型
// ============================================================

/** UniProt 搜索返回的蛋白候选项 */
export interface UniProtCandidate {
  accession: string;          // primaryAccession, e.g. "P14902"
  uniProtId: string;          // uniProtkbId, e.g. "IDO1_HUMAN"
  name: string;               // proteinDescription.recommendedName.fullName.value
  gene: string;               // genes[0].geneName.value
  aliases: string[];          // genes[0].synonyms?.[]?.value
  organism: string;           // organism.scientificName
  taxId: number;              // organism.taxonId
  length: number;             // sequence.length
  cofactors: CofactorRef[];   // UniProt cofactorCrossReference (从详情接口获取)
  reviewed: boolean;          // Swiss-Prot (reviewed) = true, TrEMBL = false
  speciesLabel: string;       // 物种简称标签（从 entry name 后缀提取，预计算）
}

/** UniProt 辅因子交叉引用 */
export interface CofactorRef {
  name: string;               // cofactorCrossReferences[].cofactorName (e.g. "heme")
  accession: string;          // cofactorCrossReferences[].cofactorAccession (e.g. "CHEBI:17627")
}

// ============================================================
// RCSB PDB 相关类型
// ============================================================

/** RCSB Search API 返回的 PDB 条目摘要 (用于表格展示) */
export interface PdbStructure {
  pdbId: string;                      // rcsb_id, e.g. "2D0T"
  method: string;                     // exptl[0].method, e.g. "X-RAY DIFFRACTION"
  resolution: number | null;          // rcsb_entry_info.resolution_combined (Å)
  depositedDate: string;              // rcsb_accession_info.initial_release_date
  chainIds: string[];                 // polymer entities 的 pdbx_strand_id 汇总
  /** 每个 polymer entity 的结构覆盖范围 */
  coverage: EntityCoverage[];
  /** 配体摘要 (nonpolymer entities) */
  ligands: LigandSummary[];
  /** 文献 DOI */
  doi: string | null;                 // rcsb_primary_citation.pdbx_database_id_DOI
  /** 文献标题 */
  citationTitle: string | null;       // rcsb_primary_citation.title
  /** 生物来源 */
  organism: string;                   // rcsb_entity_source_organism[0].ncbi_scientific_name
  /** 有 binding affinity 数据的 comp_id 列表（用于抑制剂判定） */
  bindingAffinityCompIds?: string[];
}

/** 单个 polymer entity 的结构覆盖信息 */
export interface EntityCoverage {
  entityId: number;
  chainId: string;                    // pdbx_strand_id (多个逗号分隔)
  uniprotAccession: string | null;    // 匹配到的 UniProt accession
  organism: string;                   // 表达/来源生物
  sequence: string;                   // 一级序列 (entity_poly.rcsb_seq_one_letter_code)
  /** 结构覆盖的残基范围（UniProt 编号） */
  uniprotStart: number | null;
  uniprotEnd: number | null;
  /** 特征区域 (Pfam 等) */
  features: StructureFeature[];
  /** 序列覆盖比例 0-1 */
  coverageRatio: number;              // 从 entity_sequence_coverage 计算
}

/** Pfam/特征区域 */
export interface StructureFeature {
  type: string;                       // e.g. "Pfam"
  name: string;                       // e.g. "IDO"
  start: number;                      // beg_seq_id
  end: number;                        // end_seq_id
}

/** 配体摘要 (来自 nonpolymer_entity) */
export interface LigandSummary {
  entityId: number;
  compId: string;                     // nonpolymer_comp.comp_id, e.g. "HEM"
  name: string;                       // nonpolymer_comp.name
  /** 分类结果 */
  classification: LigandClass;
}

/** 配体分类 */
export type LigandClass =
  | 'cofactor'       // 天然辅因子 (NATIVE_LIGANDS 白名单命中)
  | 'inhibitor'      // 外来抑制剂 (不在白名单中)
  | 'crystal';       // 结晶/缓冲液成分 (BACKGROUND_LIGANDS 白名单命中)

/** 配体分类颜色映射 — 莫兰迪色系 */
export const LIGAND_COLORS: Record<LigandClass, string> = {
  cofactor:  '#7D9DB5',  // 灰蓝
  inhibitor: '#C49B9B',  // 灰玫瑰
  crystal:   '#9EAE9A',  // 灰绿
};

/** PDB 结构排序优先级 */
export type SortPriority =
  | 'apo'              // 无抑制剂、无辅因子
  | 'holo_cofactor'    // 无抑制剂、有天然辅因子
  | 'inhibited';       // 有外来抑制剂

// ============================================================
// API 响应原始类型 (精简 — 仅保留用到的字段)
// ============================================================

export interface UniProtSearchResponse {
  results: Array<{
    primaryAccession: string;
    uniProtkbId: string;
    genes?: Array<{
      geneName?: { value: string };
      synonyms?: Array<{ value: string }>;
    }>;
    proteinDescription?: {
      recommendedName?: { fullName: { value: string } };
    };
    organism?: {
      scientificName: string;
      taxonId: number;
    };
    sequence?: {
      length: number;
    };
    entryType?: string;  // "UniProtKB reviewed (Swiss-Prot)" or "UniProtKB unreviewed (TrEMBL)"
  }>;
}

export interface UniProtDetailResponse {
  accession: string;
  comments?: Array<{
    commentType: string;
    cofactors?: Array<{
      cofactorCrossReferences?: Array<{
        cofactorName?: string;
        cofactorAccession?: string;
      }>;
    }>;
  }>;
}

export interface RcsbSearchResponse {
  result_set: Array<{ identifier: string }>;
}

export interface RcsbEntryResponse {
  rcsb_id: string;
  exptl?: Array<{ method?: string }>;
  rcsb_entry_info?: {
    resolution_combined?: number[];
    deposited_polymer_entity_instance_count?: number;
    deposited_nonpolymer_entity_instance_count?: number;
  };
  rcsb_entry_container_identifiers?: {
    polymer_entity_ids?: string[];
    non_polymer_entity_ids?: string[];
  };
  rcsb_accession_info?: {
    initial_release_date?: string;
  };
  rcsb_primary_citation?: {
    pdbx_database_id_DOI?: string;
    title?: string;
  };
  rcsb_entity_source_organism?: Array<{
    ncbi_scientific_name?: string;
  }>;
}

export interface RcsbPolymerEntityResponse {
  entity_poly?: {
    rcsb_uniprot_accession?: Array<{
      rcbs_id?: string;
    }>;
    pdbx_strand_id?: string;
    rcsb_entity_polymer_type?: string;
    rcsb_seq_one_letter_code?: string;
    rcsb_uniprot_alignments?: Array<{
      beg_seq_id?: number;
      end_seq_id?: number;
      feature_positions?: Array<{
        beg_seq_id?: number;
        end_seq_id?: number;
        type?: string;
        name?: string;
      }>;
    }>;
  };
  rcsb_entity_source_organism?: Array<{
    ncbi_scientific_name?: string;
  }>;
  rcsb_polymer_entity_container_identifiers?: {
    entity_id?: number;
  };
}

export interface RcsbNonpolymerEntityResponse {
  pdbx_entity_nonpoly?: {
    comp_id?: string;
    name?: string;
  };
  rcsb_nonpolymer_entity_container_identifiers?: {
    entity_id?: number;
  };
  rcsb_nonpolymer_entity_annotation?: Array<{
    type?: string;
    name?: string;
    comp_id?: string;
  }>;
}

// ============================================================
// 搜索历史
// ============================================================

export interface SearchHistoryEntry {
  id: string;
  timestamp: number;
  query: string;
  taxId: number;
  protein: {
    accession: string;
    name: string;
    gene: string;
    aliases: string[];
    organism: string;
    length: number;
    reviewed: boolean;
    speciesLabel: string;
  };
  pdbResults: PdbStructure[];
  sortState: Record<string, unknown>;
  filterState: Record<string, unknown>;
  scrollPosition: number;
}

// ============================================================
// Article-Search 相关类型
// ============================================================

/** 单篇文献提取结果 — 四大块 */
export interface ArticleExtraction {
  construct: string;         // Markdown — 蛋白构建信息
  expression: string;        // Markdown — 表达条件
  purification: string;      // Markdown — 纯化步骤
  crystallization: string;   // Markdown — 结晶条件
  verified: boolean;         // 论文是否与预期DOI/PDB/UniProt匹配
  verificationNote: string;  // 验证说明
  /** DeepSeek 生成的各板块一行摘要（可选，兼容旧缓存） */
  summaries?: {
    construct: string;
    expression: string;
    purification: string;
    crystallization: string;
  };
}

/** 汇总条目（存入 localStorage） */
export interface SummaryEntry {
  id: string;
  doi: string;
  pdbId: string;
  uniprot: string;
  proteinName: string;       // 蛋白全名（来自 UniProt 搜索结果）
  gene: string;              // 基因名/蛋白缩写，如 "IDO1"
  title: string;             // 论文标题
  extraction: ArticleExtraction;
  addedAt: number;
}

// ============================================================
// 应用路由参数
// ============================================================

export interface ArticleSearchParams {
  doi?: string;
  pdb?: string;
  uniprot?: string;
}

// ============================================================
// 蛋白搜索页面状态（用于跨页面保存/恢复）
// ============================================================

export interface ProteinSearchState {
  query: string;
  taxId: number;
  selectedProtein: UniProtCandidate | null;
  pdbResults: PdbStructure[];
  sortState: Record<string, unknown>;
  filterState: Record<string, unknown>;
  scrollPosition: number;
}
