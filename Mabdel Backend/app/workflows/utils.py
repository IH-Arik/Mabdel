from __future__ import annotations
import os
from openai import OpenAI
from app.core.config import settings

def get_llm_client() -> OpenAI:
    return OpenAI(api_key=settings.OPENAI_API_KEY)

def read_prompt(filename: str) -> str:
    prompt_path = os.path.join(os.path.dirname(__file__), "prompts", filename)
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read()

def call_llm(prompt: str, model: str = settings.OPENAI_MODEL) -> str:
    client = get_llm_client()
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content.strip()
