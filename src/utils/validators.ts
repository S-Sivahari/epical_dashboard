import { z } from 'zod'

export const emailSchema = z.string().email('Enter a valid email')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')

export const phoneSchema = z
  .string()
  .min(10, 'Enter a valid phone number')
  .max(15)
