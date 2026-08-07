"""
Prompt for the Memory Assistant's conversational answer: given a user's
natural-language question and a handful of their own candidate links
(already found via semantic search), produce a short answer citing them.

Kept separate from summarize_and_tag.py — different call, different
shape of input/output — but follows the same pattern (prompt text lives
here, ai_service.py only calls into it).
"""
from app.models.link import Link

SYSTEM_PROMPT = """You are a helpful assistant that answers questions about links a user \
previously saved, using ONLY the candidate links provided below — never invent a link or \
detail that isn't in them. Respond with a short, natural, conversational answer (2-4 \
sentences) that references the relevant link(s) by title. If none of the candidates \
actually answer the question, say so plainly rather than forcing a match."""


def build_user_message(*, question: str, candidates: list[Link]) -> str:
    if not candidates:
        return f'Question: "{question}"\n\nThe user has no saved links matching this question.'

    lines = [f'Question: "{question}"', "", "Candidate links (most relevant first):"]
    for i, link in enumerate(candidates, start=1):
        reason = link.user_note or link.ai_reason or ""
        tag_names = ", ".join(tag.name for tag in link.tags)
        lines.append(
            f"{i}. Title: {link.title or link.url}\n"
            f"   Summary: {link.ai_summary or '(no summary)'}\n"
            f"   Why saved: {reason or '(not given)'}\n"
            f"   Tags: {tag_names or '(none)'}"
        )
    return "\n".join(lines)
