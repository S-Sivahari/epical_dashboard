export function validateProjectDescription(description: string): string | null {
  const trimmed = description.trim();
  if (!trimmed) return 'Project description is required';
  return null;
}

export function normalizeProjectDescription(description: string): string {
  return description.trim();
}
