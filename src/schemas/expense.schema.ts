import { z } from 'zod';

export const createExpenseSchema = z.object({
  group_id: z.string().uuid('ID gruppo non valido'),
  paid_by: z.string().uuid('ID utente pagante non valido').optional(),
  title: z.string().min(1, 'Il titolo della spesa è obbligatorio').max(150),
  amount: z.number().positive("L'importo deve essere maggiore di zero"),
  currency: z.string().length(3).default('EUR'),
  category: z.string().default('general'),
  split_type: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']).default('EQUAL'),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)').optional(),
  receipt_url: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  splits: z
    .array(
      z.object({
        user_id: z.string().uuid('ID utente non valido per la divisione'),
        amount: z.number().min(0).optional(),
        percentage: z.number().min(0).max(100).optional(),
      })
    )
    .optional(),
});

export const createSettlementSchema = z.object({
  group_id: z.string().uuid('ID gruppo non valido'),
  payer_id: z.string().uuid('ID utente debitore/pagatore non valido'),
  receiver_id: z.string().uuid('ID utente beneficiario non valido'),
  amount: z.number().positive("L'importo del rimborso deve essere maggiore di zero"),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().max(500).optional().nullable(),
});

