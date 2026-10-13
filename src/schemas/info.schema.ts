import { z } from 'zod';

export const createInfoItemSchema = z.object({
  group_id: z.string().uuid('ID gruppo non valido').optional().nullable(),
  title: z.string().min(1, 'Il titolo è obbligatorio').max(150),
  category: z.enum(['note', 'iban', 'link', 'wifi', 'todo', 'custom']).default('note'),
  content: z.string().min(1, 'Il contenuto è obbligatorio'),
  metadata: z.record(z.string(), z.any()).default({}),
  is_pinned: z.boolean().default(false),
});

export const updateInfoItemSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  category: z.enum(['note', 'iban', 'link', 'wifi', 'todo', 'custom']).optional(),
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  is_pinned: z.boolean().optional(),
});
