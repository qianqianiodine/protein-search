"""Article-Search 后端 — FastAPI"""
import asyncio
import tempfile
import os
import re
from pathlib import Path

# Windows SSL 证书修复
import certifi
os.environ["SSL_CERT_FILE"] = certifi.where()
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from document_reader import extract_document_text
from deepseek_client import extract_section
from prompts import SYSTEM_PROMPT, COMBINED_PROMPT

app = FastAPI(title="Article Search Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---- 文本截取工具 ----

# 图片 Markdown 语法 — 去除图片文件但保留描述文字
_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]+\)")

def _strip_images(text: str) -> str:
    """去除 Markdown 图片语法 ![alt](url)，保留 alt 文本（图片描述）"""
    return _IMAGE_RE.sub(r"\1", text)


# 致谢标题正则 — 正文截断点
# 兼容美式(Acknowledgment/s)和英式(Acknowledgement/s)四种拼写
_ACK_HEADING_RE = re.compile(
    r"(?:^|\n)(?:#{1,3}\s+)?\*{0,2}Acknowledg(?:e)?ments?\*{0,2}(?:\s*:)?\s*\n",
    re.IGNORECASE,
)

# 参考文献标题正则 — 补充材料截断点
_REF_HEADING_RE = re.compile(
    r"(?:^|\n)(?:#{1,3}\s+)?\*{0,2}References?\*{0,2}(?:\s*:)?\s*\n",
    re.IGNORECASE,
)


def _extract_main_text(text: str) -> str:
    """正文：从开头截取到 Acknowledgments / Acknowledgements 之前，去除图片"""
    m = _ACK_HEADING_RE.search(text)
    if m:
        text = text[:m.start()]
    return _strip_images(text).strip()


def _extract_supp_text(text: str) -> str:
    """补充材料：从开头截取到 References 之前，去除图片"""
    m = _REF_HEADING_RE.search(text)
    if m:
        text = text[:m.start()]
    return _strip_images(text).strip()


# ---- 论文标题提取 ----

def _extract_paper_title(pdf_text: str) -> str:
    """从 PDF 提取的纯文本中提取论文标题

    策略：
    1. 优先找 Markdown 标题行（# / ##），这些通常是论文标题
    2. 跳过明显的噪声行（URL / DOI / 版权 / 邮箱 / 期刊元数据）
    3. 取第一个 ≥10 字符的有效行
    """
    lines = pdf_text.strip().split('\n')

    # 噪声行匹配模式
    _NOISE_PATTERNS = [
        r'^https?://',
        r'^\d+\.\d+/',                    # DOI (10.xxx/...)
        r'^DOI[:\s]',
        r'©|\bCopyright\b',
        r'^[Tt]his journal is',
        r'^[Tt]his article is',
        r'@\w+\.',                        # 邮箱
        r'^\d{1,4}\s+[A-Z][a-z]+\s+\d{4}', # 日期行
        r'^Received[:\s]',
        r'^Accepted[:\s]',
        r'^Published[:\s]',
        r'^Vol\.?\s*\d+',
        r'^pp\.\s*\d+',
        r'^ISSN[:\s]',
        r'^PMCID[:\s]',
        r'^PMID[:\s]',
        r'^arXiv[:\s]',
        r'^Supplemental\s',
        r'^Supporting\s+Information',
        r'^Electronic\s+Supplementary',
    ]

    # 第一轮：找 Markdown 标题行（# / ## / ###）
    for line in lines:
        line = line.strip()
        if not line or not line.startswith('#'):
            continue
        title = re.sub(r'^#+\s*', '', line)
        title = re.sub(r'\*{1,2}', '', title).strip()
        if len(title) < 10:
            continue
        if any(re.search(p, title, re.IGNORECASE) for p in _NOISE_PATTERNS):
            continue
        return title

    # 第二轮：取第一个 ≥10 字符的普通行
    for line in lines:
        line = line.strip()
        if not line or len(line) < 10:
            continue
        title = re.sub(r'^#+\s*', '', line)
        title = re.sub(r'\*{1,2}', '', title).strip()
        if len(title) < 10:
            continue
        if any(re.search(p, title, re.IGNORECASE) for p in _NOISE_PATTERNS):
            continue
        return title

    # 第三轮：兜底 — 取第一个 ≥10 字符的行
    for line in lines:
        line = line.strip()
        if len(line) >= 10:
            title = re.sub(r'^#+\s*', '', line)
            title = re.sub(r'\*{1,2}', '', title).strip()
            if len(title) >= 10:
                return title
    return ''


# ---- 目标蛋白聚焦 ----

def _build_protein_context(gene: str, protein_name: str) -> str:
    """生成目标蛋白聚焦指令，引导模型只关注目标蛋白相关信息"""
    if not gene and not protein_name:
        return ""
    label = gene or protein_name
    extra = f"（{protein_name}）" if gene and protein_name else ""
    return (
        f"**目标蛋白：{label}{extra}。**\n"
        f"论文中该蛋白可能有多种变体（截短体、全长、突变体、融合蛋白等），请全部提取。\n"
        f"对于论文中其他不相关的蛋白（如对照蛋白、同家族其他成员等），跳过它们，不要列出，不要提取。\n\n"
    )


# ---- 文献匹配验证 ----

def _build_meta_section(doi: str, pdb: str, uniprot: str, paper_title: str) -> tuple[str, str]:
    """构建文献匹配验证 section，标题优先验证"""
    if not paper_title and not doi and not pdb:
        return "", ""

    meta_lines = []
    if paper_title:
        meta_lines.append(f"- 预期文献标题: {paper_title}")
    if doi:
        meta_lines.append(f"- 预期 DOI: {doi}")
    if pdb:
        meta_lines.append(f"- 预期 PDB ID: {pdb}")
    if uniprot:
        meta_lines.append(f"- 预期 UniProt ID: {uniprot}")

    lines = "\n".join(meta_lines)

    if paper_title:
        verify_instruction = (
            "请先验证文献：比对 PDF 中的论文标题是否与预期标题一致。"
            "只验证正文 PDF，补充材料无需验证。"
        )
    else:
        verify_instruction = "请验证论文信息是否与预期一致。"

    meta_section = f"""## 文献匹配验证

{lines}

验证规则（只验证正文 PDF，补充材料无需验证）：
- 优先比对文献标题，若标题一致 → 仅输出「文献提交正确」
- 标题不一致时，再比对 DOI / PDB ID / UniProt ID
- 若标识符匹配 → 输出「文献提交正确」
- 若全部不匹配 → 输出「⚠️ 文献不匹配：」并说明哪里不一致

---
"""
    return meta_section, verify_instruction


# ---- 输出解析 ----

_SUMMARY_LINE_RE = re.compile(r"^\s*\*{0,2}关键摘要[:：]\*{0,2}\s*(.*)$")


def _split_summary_line(section_text: str) -> tuple[str, str]:
    """按行摘出「关键摘要」行（无论位置），返回 (板块内容, 摘要)"""
    summary = ""
    kept: list[str] = []
    for line in section_text.split("\n"):
        m = _SUMMARY_LINE_RE.match(line)
        if m:
            if not summary:
                summary = m.group(1).strip()
        else:
            kept.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip(), summary


def _parse_combined(text: str) -> tuple[dict[str, str], dict[str, str]]:
    """将合并输出的文本按板块标题拆分，返回 (sections, summaries)"""
    sections_order = [
        ("verification", "## 文献匹配验证"),
        ("construct", "## 蛋白构建"),
        ("expression", "## 表达"),
        ("purification", "## 纯化"),
        ("crystallization", "## 结晶"),
    ]

    result: dict[str, str] = {}
    summaries: dict[str, str] = {}
    for i, (key, header) in enumerate(sections_order):
        start_idx = text.find(header)
        if start_idx == -1:
            result[key] = ""
            summaries[key] = ""
            continue

        content_start = start_idx + len(header)
        if i < len(sections_order) - 1:
            next_header = sections_order[i + 1][1]
            end_idx = text.find(next_header, content_start)
        else:
            end_idx = -1

        section_text = text[content_start:end_idx] if end_idx != -1 else text[content_start:]
        section_text = section_text.strip()

        # 解析 **关键摘要：** 行：按行摘除（无论摘要行在板块什么位置），其余内容原样保留
        section_text, summary = _split_summary_line(section_text)
        summaries[key] = summary
        result[key] = section_text

    return result, summaries


def _parse_verification(verification_text: str) -> tuple[bool, str]:
    """从验证文本中解析匹配状态"""
    if not verification_text:
        return True, ""
    if "文献提交正确" in verification_text:
        return True, "文献提交正确"
    if "✅" in verification_text or "验证通过" in verification_text:
        return True, "文献提交正确"
    if "⚠️" in verification_text or "可能不匹配" in verification_text or "文献不匹配" in verification_text:
        return False, verification_text
    if "ℹ️" in verification_text:
        return True, verification_text
    return True, "文献提交正确"


# ---- API ----

@app.post("/api/extract")
async def extract(
    pdf: UploadFile | None = File(None),
    supp_pdf: UploadFile | None = File(None),
    text: str = Form(""),
    supp_text: str = Form(""),
    doi: str = Form(""),
    pdb: str = Form(""),
    uniprot: str = Form(""),
    paper_title: str = Form(""),
    gene: str = Form(""),
    protein_name: str = Form(""),
):
    """上传文献 → 提取文本 → DeepSeek 提取四大块（含文献验证）"""
    _ALLOWED_EXTS = (".pdf", ".doc", ".docx")

    has_text = bool(text and text.strip())
    has_main = bool(pdf and pdf.filename and pdf.filename.strip())
    has_supp = bool(supp_pdf and supp_pdf.filename and supp_pdf.filename.strip())

    if not has_text and not has_main and not has_supp:
        raise HTTPException(400, "请至少上传正文文件、补充材料文件或粘贴文本")

    # ---- 文本模式：跳过 PDF 读取，直接用粘贴的文本 ----
    if has_text:
        full_text = text.strip()
        if supp_text and supp_text.strip():
            full_text += "\n\n---\n\n## 补充材料\n\n" + supp_text.strip()
        extracted_title = paper_title or ""  # 文本模式标题由前端传入

    # ---- 文件模式：现有 PDF/Word 提取逻辑 ----
    else:
        # 校验文件扩展名
        if pdf and pdf.filename:
            if not any(pdf.filename.lower().endswith(e) for e in _ALLOWED_EXTS):
                raise HTTPException(400, "正文文件格式不支持，请上传 PDF 或 Word 文档（.pdf / .doc / .docx）")
        if supp_pdf and supp_pdf.filename:
            if not any(supp_pdf.filename.lower().endswith(e) for e in _ALLOWED_EXTS):
                raise HTTPException(400, "补充材料文件格式不支持，请上传 PDF 或 Word 文档（.pdf / .doc / .docx）")

        with tempfile.TemporaryDirectory() as tmpdir:
            main_path = None
            main_ext = ".pdf"
            if has_main:
                main_ext = os.path.splitext(pdf.filename)[1].lower() if pdf.filename else ".pdf"
                main_path = os.path.join(tmpdir, f"main{main_ext}")
                with open(main_path, "wb") as f:
                    f.write(await pdf.read())

            supp_path = None
            supp_ext = ".pdf"
            if has_supp:
                supp_ext = os.path.splitext(supp_pdf.filename)[1].lower() if supp_pdf.filename else ".pdf"
                supp_path = os.path.join(tmpdir, f"supp{supp_ext}")
                with open(supp_path, "wb") as f:
                    f.write(await supp_pdf.read())

            # 1. 提取文本：根据扩展名自动选择 PDF/DOCX 提取器
            main_raw = ""
            if main_path:
                try:
                    main_raw = await asyncio.to_thread(extract_document_text, main_path)
                except RuntimeError as e:
                    raise HTTPException(500, f"正文处理失败: {e}")

            # 1.5 从正文中提取论文标题
            extracted_title = _extract_paper_title(main_raw) if main_raw else ""

            supp_raw = ""
            if supp_path:
                try:
                    supp_raw = await asyncio.to_thread(extract_document_text, supp_path)
                except RuntimeError as e:
                    supp_raw = f"\n\n[补充材料处理失败: {e}]\n"

            # 2. 截取正文和补充材料，去除图片
            # Word 文档纯文本没有 markdown 标题标记，直接全文传入（DeepSeek 自行截断）
            is_pdf_main = main_ext == ".pdf"
            is_pdf_supp = supp_ext == ".pdf"
            main_text = _extract_main_text(main_raw) if is_pdf_main else main_raw
            supp_text = _extract_supp_text(supp_raw) if (supp_raw and is_pdf_supp) else supp_raw

            if main_text and supp_text:
                full_text = main_text + "\n\n---\n\n## 补充材料\n\n" + supp_text
            elif main_text:
                full_text = main_text
            elif supp_text:
                full_text = supp_text
            else:
                # 兜底：正文去图片后的全文
                full_text = _strip_images(main_raw)
                if supp_raw:
                    full_text += "\n\n---\n\n## 补充材料\n\n" + _strip_images(supp_raw)

    # ---- 公共：DeepSeek 提取 ----
    # 3. 目标蛋白聚焦指令
    protein_context = _build_protein_context(gene, protein_name)

    # 4. 构建 prompt 并调用 DeepSeek（单次提取）
    meta_section, verify_instruction = _build_meta_section(doi, pdb, uniprot, paper_title or extracted_title)
    combined_prompt = COMBINED_PROMPT.format(
        protein_context=protein_context,
        meta_section=meta_section,
        verify_instruction=verify_instruction,
    )

    try:
        combined = await extract_section(SYSTEM_PROMPT, combined_prompt, full_text)
        sections, summaries = _parse_combined(combined)
    except Exception as e:
        err = f"提取失败: {e}"
        return {
            "construct": err, "expression": err, "purification": err, "crystallization": err,
            "verified": True, "verificationNote": "", "summaries": {}, "paperTitle": extracted_title,
        }

    verified, verification_note = _parse_verification(sections.get("verification", ""))

    return {
        "construct": sections.get("construct", "提取失败"),
        "expression": sections.get("expression", "提取失败"),
        "purification": sections.get("purification", "提取失败"),
        "crystallization": sections.get("crystallization", "提取失败"),
        "verified": verified,
        "verificationNote": verification_note,
        "summaries": summaries,
        "paperTitle": extracted_title,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
