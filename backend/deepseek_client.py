"""DeepSeek API 客户端 — OpenAI 兼容格式"""
import os
from openai import OpenAI
from dotenv import load_dotenv
import httpx

load_dotenv()

_client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    timeout=httpx.Timeout(120.0, connect=10.0),
    max_retries=0,
)

MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")


async def extract_section(system_prompt: str, user_prompt: str, markdown_text: str) -> str:
    """调用 DeepSeek 提取单个 section，返回 Markdown 文本"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"{user_prompt}\n\n论文内容：\n{markdown_text}"},
    ]

    # openai 库的 chat.completions.create 是同步的，用 run_in_executor 避免阻塞
    import asyncio
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: _client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.2,    # 信息提取需要一定灵活性，太低容易漏内容
            max_tokens=16384,
        ),
    )

    content = response.choices[0].message.content
    return content.strip() if content else "提取失败"
