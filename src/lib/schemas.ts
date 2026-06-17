import { z } from 'zod';

export const reportTypes = ['complaint', 'suggestion'] as const;
export const reportStatuses = ['new', 'in_review', 'resolved', 'rejected'] as const;
export const imageReviewStatuses = ['none', 'hidden_until_review', 'approved', 'rejected'] as const;
export const roleTypes = ['moderator', 'superuser'] as const;

export const categorySchema = z.enum([
  'academico',
  'infraestructura',
  'seguridad',
  'convivencia',
  'servicios',
  'otro'
]);

export const publicReportSchema = z.object({
  type: z.enum(reportTypes),
  title: z.string().trim().min(8, 'Escribe un titulo mas especifico.').max(120),
  description: z.string().trim().min(30, 'Describe la situacion con mas detalle.').max(2500),
  category: categorySchema,
  isAnonymous: z.boolean().default(true),
  contactName: z.string().trim().max(80).optional().or(z.literal('')),
  contactEmail: z.string().trim().email().max(120).optional().or(z.literal('')),
  group: z.string().trim().max(40).optional().or(z.literal('')),
  image: z
    .object({
      publicId: z.string().min(3).max(180),
      secureUrl: z.string().url(),
      width: z.number().int().positive().max(1600),
      height: z.number().int().positive(),
      bytes: z.number().int().positive().max(2_000_000),
      format: z.enum(['jpg', 'jpeg', 'png', 'webp'])
    })
    .optional()
});

export const reportCreateSchema = publicReportSchema.superRefine((value, ctx) => {
  if (value.type === 'suggestion' && value.image) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['image'],
      message: 'Las sugerencias no pueden incluir imágenes.'
    });
  }

  if (!value.isAnonymous && !value.contactEmail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactEmail'],
      message: 'Agrega un correo si decides identificarte.'
    });
  }
});

export const reportUpdateSchema = z.object({
  status: z.enum(reportStatuses),
  moderatorNotes: z.string().trim().max(2500).optional().or(z.literal('')),
  imageReviewStatus: z.enum(imageReviewStatuses).optional()
});

export const roleWriteSchema = z.object({
  uid: z.string().trim().min(20).max(128),
  role: z.enum(roleTypes),
  displayName: z.string().trim().max(100).optional().or(z.literal('')),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  active: z.boolean().default(true)
});

export const geminiSummarySchema = z.object({
  summary: z.string(),
  category: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  sentiment: z.enum(['negative', 'neutral', 'positive', 'mixed']),
  riskFlags: z.array(z.string()),
  recommendedAction: z.string()
});

export type PublicReportInput = z.infer<typeof publicReportSchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
export type RoleWriteInput = z.infer<typeof roleWriteSchema>;
export type GeminiSummary = z.infer<typeof geminiSummarySchema>;
