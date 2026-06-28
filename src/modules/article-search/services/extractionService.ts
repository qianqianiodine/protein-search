import type { ArticleExtraction } from '../../shared/types';

const API_BASE = '/api';

export async function extractPdf(
  mainPdf: File,
  suppPdf?: File | null,
  signal?: AbortSignal,
  metadata?: { doi?: string; pdb?: string; uniprot?: string; paperTitle?: string },
): Promise<ArticleExtraction> {
  const formData = new FormData();
  formData.append('pdf', mainPdf);
  if (suppPdf) {
    formData.append('supp_pdf', suppPdf);
  }
  if (metadata?.doi) {
    formData.append('doi', metadata.doi);
  }
  if (metadata?.pdb) {
    formData.append('pdb', metadata.pdb);
  }
  if (metadata?.uniprot) {
    formData.append('uniprot', metadata.uniprot);
  }
  if (metadata?.paperTitle) {
    formData.append('paper_title', metadata.paperTitle);
  }

  const response = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '未知错误');
    throw new Error(`提取失败 (${response.status}): ${text}`);
  }

  return response.json();
}
