"""文档文本提取 — PDF (PyMuPDF) + DOCX (python-docx)"""
from pathlib import Path
import fitz  # PyMuPDF


def _extract_pdf_text(pdf_path: str) -> str:
    """用 PyMuPDF 提取 PDF 全文纯文本，按阅读顺序"""
    doc = fitz.open(pdf_path)
    pages: list[str] = []
    for page in doc:
        text = page.get_text("text")
        if text.strip():
            pages.append(text)
    doc.close()

    if not pages:
        raise RuntimeError("PDF 未提取到任何文本（可能是扫描版图片PDF）")

    return "\n\n".join(pages)


def _extract_docx_text(docx_path: str) -> str:
    """用 python-docx 提取 .docx 全文纯文本"""
    from docx import Document
    doc = Document(docx_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    if not paragraphs:
        raise RuntimeError("Word 文档未提取到任何文本")
    return "\n\n".join(paragraphs)


def extract_document_text(path: str) -> str:
    """根据文件扩展名选择提取器，支持 .pdf / .docx"""
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf_text(path)
    elif ext == ".docx":
        return _extract_docx_text(path)
    elif ext == ".doc":
        raise RuntimeError("不支持旧版 .doc 格式，请转换为 .docx 后重试")
    else:
        raise RuntimeError(f"不支持的文件格式: {ext}")
