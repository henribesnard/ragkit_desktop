/**
 * Strip XML context/source tags that the LLM may echo from its response.
 */
export function stripSourceTags(text: string): string {
  let cleaned = text;
  // Full block removal
  cleaned = cleaned.replace(/<context>[\s\S]*?<\/context>/g, "");
  cleaned = cleaned.replace(/<sources>[\s\S]*?<\/sources>/g, "");
  // Stray opening/closing tags
  cleaned = cleaned.replace(/<\/?context>/g, "");
  cleaned = cleaned.replace(/<\/?sources>/g, "");
  cleaned = cleaned.replace(/<source\b[^>]*\/?\s*>/g, "");
  cleaned = cleaned.replace(/<\/source>/g, "");
  return cleaned.trim();
}
