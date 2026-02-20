"""Export conversations to Markdown or PDF."""

from __future__ import annotations

from datetime import datetime
from typing import Any


class ConversationExporter:
    """Exports a conversation to Markdown or PDF."""

    def to_markdown(self, messages: list[dict[str, Any]], profile: str) -> str:
        lines = [
            f"# Conversation RAGKIT -- {datetime.now().strftime('%d/%m/%Y %H:%M')}",
            f"*Profil : {profile}*\n",
        ]
        q_num = 0
        for msg in messages:
            if msg.get("role") == "user":
                q_num += 1
                lines.append(f"## Question {q_num}")
                lines.append(f"**Utilisateur** : {msg.get('content', '')}\n")
            else:
                lines.append(f"**Assistant** : {msg.get('content', '')}\n")
                sources = msg.get("sources")
                if sources:
                    sources_str = ", ".join(
                        f"{s.get('title', 'Document')} (p.{s.get('page', '?')})"
                        for s in sources
                    )
                    lines.append(f"*Sources : {sources_str}*\n")
                lines.append("---\n")
        return "\n".join(lines)

    def to_pdf(self, messages: list[dict[str, Any]], profile: str, path: str) -> str:
        """Export to PDF by writing markdown to an .md file (PDF generation requires weasyprint)."""
        md_content = self.to_markdown(messages, profile)
        # Write as markdown file with .pdf extension replaced
        md_path = path.replace(".pdf", ".md") if path.endswith(".pdf") else path
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        return md_path
