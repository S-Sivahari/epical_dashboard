import type { Request } from 'express'
import multer from 'multer'

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
] as const

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const

export const IMAGE_UPLOAD_ERROR = 'Only JPEG, PNG, or WebP images are allowed.'

export function isAllowedImageUpload(
  file: Pick<Express.Multer.File, 'mimetype' | 'originalname'>
): boolean {
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    return true
  }
  const name = (file.originalname || '').toLowerCase()
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function imageUploadFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (isAllowedImageUpload(file)) {
    cb(null, true)
    return
  }
  cb(new Error(IMAGE_UPLOAD_ERROR))
}

export function createImageUpload(options?: { maxFileSize?: number }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options?.maxFileSize ?? 4 * 1024 * 1024 },
    fileFilter: imageUploadFileFilter,
  })
}
