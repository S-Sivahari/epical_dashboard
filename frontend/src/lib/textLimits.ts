export const MAX_PROJECT_DESCRIPTION_WORDS = 50;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateToMaxWords(
  text: string,
  maxWords = MAX_PROJECT_DESCRIPTION_WORDS
): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

export function enforceMaxWords(
  text: string,
  maxWords = MAX_PROJECT_DESCRIPTION_WORDS
): string {
  return truncateToMaxWords(text, maxWords);
}
