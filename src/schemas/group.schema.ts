import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Il nome del gruppo è obbligatorio').max(100),
  description: z.string().max(500).optional().nullable(),
  currency: z.string().length(3).default('EUR'),
});

export const addMemberSchema = z.object({
  email: z.string().email("Inserisci un'email valida"),
  role: z.enum(['admin', 'member']).default('member'),
});
