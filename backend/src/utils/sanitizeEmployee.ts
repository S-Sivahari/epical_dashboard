import type { Employee } from '../models/Employee';

type StoredFile = { filename: string; data?: string; contentType?: string; uploadedAt?: Date };

function stripFileData(file: StoredFile | undefined) {
  if (!file) return undefined;
  return {
    filename: file.filename,
    contentType: file.contentType,
    uploadedAt: file.uploadedAt,
  };
}

/** List/detail JSON — never include base64 blobs (use upload routes for files). */
export function sanitizeEmployeeForList(employee: Employee): Record<string, unknown> {
  const { photo, documents, ...rest } = employee as Employee & { _id?: unknown };
  return {
    ...rest,
    hasPhoto: Boolean(photo?.data || photo?.filename),
  };
}

export function sanitizeEmployeeForDetail(employee: Employee): Record<string, unknown> {
  const { photo, documents, ...rest } = employee as Employee & { _id?: unknown };
  const docMeta: Record<string, ReturnType<typeof stripFileData>> = {};

  if (documents) {
    for (const [key, doc] of Object.entries(documents)) {
      const meta = stripFileData(doc as StoredFile);
      if (meta) docMeta[key] = meta;
    }
  }

  return {
    ...rest,
    hasPhoto: Boolean(photo?.data || photo?.filename),
    documents: Object.keys(docMeta).length > 0 ? docMeta : undefined,
  };
}
