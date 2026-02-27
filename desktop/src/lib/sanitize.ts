/**
 * Strip XML context/source tags that the LLM may echo from its response.
 */
export function stripSourceTags(text: string): string {
  let cleaned = text.replace(/<context>[\s\S]*?<\/context>/g, "");
  cleaned = cleaned.replace(/<\/?context>/g, "");
  cleaned = cleaned.replace(/<source\b[^>]*>/g, "");
  cleaned = cleaned.replace(/<\/source>/g, "");
  return cleaned.trim();
}
