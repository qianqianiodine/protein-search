import type { ArticleExtraction } from '../../shared/types';

const API_BASE = '/api';

export async function extractPdf(
  mainPdf: File | null,
  suppPdf?: File | null,
  signal?: AbortSignal,
  metadata?: { doi?: string; pdb?: string; uniprot?: string; paperTitle?: string; gene?: string; proteinName?: string },
  textInput?: { text?: string; suppText?: string },
): Promise<ArticleExtraction> {
  const formData = new FormData();
  if (mainPdf) {
    formData.append('pdf', mainPdf);
  }
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
  if (metadata?.gene) {
    formData.append('gene', metadata.gene);
  }
  if (metadata?.proteinName) {
    formData.append('protein_name', metadata.proteinName);
  }
  if (textInput?.text) {
    formData.append('text', textInput.text);
  }
  if (textInput?.suppText) {
    formData.append('supp_text', textInput.suppText);
  }

  const timeoutAbort = AbortSignal.timeout(180_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutAbort])
    : timeoutAbort;

  const response = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    body: formData,
    signal: combinedSignal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '未知错误');
    throw new Error(`提取失败 (${response.status}): ${text}`);
  }

  return response.json();
}
