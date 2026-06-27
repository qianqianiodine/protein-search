import { apiFetch } from '../../shared/services/api';
import type {
  UniProtSearchResponse,
  UniProtDetailResponse,
  UniProtCandidate,
  CofactorRef,
} from '../../shared/types';

const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb';

/**
 * 搜索 UniProt 蛋白（名称/基因/accession）
 */
export async function searchProteins(
  query: string,
  taxId: number,
  signal?: AbortSignal,
): Promise<UniProtCandidate[]> {
  const taxFilter = taxId !== 0 ? `+AND+taxonomy_id:${taxId}` : '';
  const url = `${UNIPROT_BASE}/search?query=${encodeURIComponent(query)}${taxFilter}&size=10&fields=accession,id,gene_names,protein_name,organism_name,length`;
  const data = await apiFetch<UniProtSearchResponse>(url, { signal });

  return data.results.map((r) => ({
    accession: r.primaryAccession,
    uniProtId: r.uniProtkbId,
    name: r.proteinDescription?.recommendedName?.fullName?.value || r.uniProtkbId,
    gene: r.genes?.[0]?.geneName?.value || '-',
    aliases: r.genes?.[0]?.synonyms?.map((s) => s.value) || [],
    organism: r.organism?.scientificName || '-',
    taxId: r.organism?.taxonId || taxId,
    length: r.sequence?.length || 0,
    reviewed: r.entryType?.includes('reviewed') ?? false,
    cofactors: [], // 从详情接口再获取
    speciesLabel: extractSpeciesLabel(r.uniProtkbId, r.organism?.scientificName || '-'),
  }));
}

/**
 * 获取 UniProt 蛋白详情（含辅因子信息）
 */
export async function getProteinDetail(
  accession: string,
  signal?: AbortSignal,
): Promise<CofactorRef[]> {
  const url = `${UNIPROT_BASE}/${accession}?fields=accession,cc_cofactor`;
  const data = await apiFetch<UniProtDetailResponse>(url, { signal });

  const cofactors: CofactorRef[] = [];
  for (const comment of data.comments || []) {
    if (comment.commentType === 'COFACTOR') {
      for (const cf of comment.cofactors || []) {
        for (const ref of cf.cofactorCrossReferences || []) {
          if (ref.cofactorName) {
            cofactors.push({
              name: ref.cofactorName,
              accession: ref.cofactorAccession || '',
            });
          }
        }
      }
    }
  }
  return cofactors;
}

/** 从 UniProt entry name 后缀提取物种标签（如 PTEN_HUMAN → Human） */
const SPECIES_LABEL_MAP: Record<string, string> = {
  HUMAN: 'Human', MOUSE: 'Mouse', RAT: 'Rat', BOVIN: 'Cow',
  PIG: 'Pig', CHICK: 'Chicken', DANRE: 'Zebrafish', DROME: 'Fruit fly',
  CAEEL: 'C. elegans', YEAST: 'Yeast', SCHPO: 'Fission yeast',
  ECOLI: 'E. coli', ECO57: 'E. coli', SALTY: 'Salmonella',
  ARATH: 'Arabidopsis', XENLA: 'Frog', CANLF: 'Dog', DICDI: 'Dictyostelium',
  RABIT: 'Rabbit', MAIZE: 'Maize', TOBAC: 'Tobacco', SOYBN: 'Soybean',
  ORYSA: 'Rice', PANTR: 'Chimpanzee', MACFA: 'Macaque', HORSE: 'Horse',
  SHEEP: 'Sheep', PONAB: 'Orangutan', MYCTU: 'M. tuberculosis',
  PSEAE: 'P. aeruginosa', BACSU: 'B. subtilis',
};

function extractSpeciesLabel(uniProtId: string, organism: string): string {
  const parts = uniProtId.split('_');
  if (parts.length < 2) return organism;
  const code = parts[parts.length - 1];
  return SPECIES_LABEL_MAP[code] || organism;
}
