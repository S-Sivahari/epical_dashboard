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

export function validateProjectDescription(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return 'Project description is required';
  if (countWords(trimmed) > MAX_PROJECT_DESCRIPTION_WORDS) {
    return `Project description must be ${MAX_PROJECT_DESCRIPTION_WORDS} words or fewer`;
  }
  return null;
}

export function normalizeProjectDescription(description: string): string {
  return truncateToMaxWords(description.trim());
}
