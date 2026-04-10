/**
 * Input sanitization utility for XSS prevention.
 * Strips HTML tags and escapes dangerous characters.
 */

const HTML_TAG_REGEX = /<[^>]*>/g;
const ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/** Strip HTML tags and escape special characters */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(HTML_TAG_REGEX, '')
    .replace(/[&<>"'/]/g, (char) => ENTITY_MAP[char] || char)
    .trim();
}

/** Sanitize but preserve basic readability (for display, not for DB storage) */
export function sanitizeForDisplay(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(HTML_TAG_REGEX, '').trim();
}

/** Validate and sanitize a text field with length limit */
export function sanitizeField(input: string | null | undefined, maxLength: number = 500): string {
  if (!input) return '';
  const cleaned = input.replace(HTML_TAG_REGEX, '').trim();
  return cleaned.substring(0, maxLength);
}
