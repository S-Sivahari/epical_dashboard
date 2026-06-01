export const MAX_PROJECT_DESCRIPTION_WORDS = 50;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateToMaxWords(
  text: string,
  maxWords = MAX_PROJECT_DESCRIPTION_WORDS
): string {
  if (countWords(text) <= maxWords) return text;
  
  let wordCount = 0;
  let cutIndex = text.length;
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    wordCount++;
    if (wordCount === maxWords) {
      cutIndex = match.index + match[0].length;
      break;
    }
  }
  return text.slice(0, cutIndex);
}

export function enforceMaxWords(
  text: string,
  maxWords = MAX_PROJECT_DESCRIPTION_WORDS
): string {
  return truncateToMaxWords(text, maxWords);
}
