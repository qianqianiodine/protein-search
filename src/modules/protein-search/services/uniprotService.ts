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
  const url = `${UNIPROT_BASE}/search?query=${encodeURIComponent(query)}${taxFilter}&size=10&fields=accession,id,gene_names,protein_name,organism_name,length&sort=annotation_score+desc`;
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
    cofactors: [], // 从详情接口再获取
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
