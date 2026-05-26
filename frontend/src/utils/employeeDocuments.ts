/** Document metadata returned on profile/detail responses (no file bytes). */
export function documentListFromEmployee(
  employee: Record<string, unknown> | null | undefined,
): { key: string; name: string; uploadedAt?: string }[] {
  const documents = employee?.documents
  if (!documents || typeof documents !== 'object') return []

  return Object.entries(documents as Record<string, { filename?: string; uploadedAt?: string }>).map(
    ([key, doc]) => ({
      key,
      name: doc?.filename ?? key,
      uploadedAt: doc?.uploadedAt,
    }),
  )
}
