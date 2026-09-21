import { z } from 'zod';
import { SUPPORTED_CONTRACT } from '../contract/supported-contract';
import { BeaconError } from '../errors/beacon-error';
import type { NotificationRequest } from './request.types';

const { limits } = SUPPORTED_CONTRACT;

/** Non-empty after trimming (whitespace-only counts as empty), but never mutated. */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.trim().length > 0, { message: 'must not be empty' });

export const notificationRequestSchema = z.strictObject({
  tenantId: z.uuid(),
  recipientUserId: z.uuid(),
  channel: z.literal('DISCORD'),
  title: text(limits.title),
  body: text(limits.body),
  sourceService: text(limits.sourceService),
  dedupeKey: text(limits.dedupeKey),
}) satisfies z.ZodType<NotificationRequest>;

/** Validates untrusted input; throws a VALIDATION `BeaconError` naming the offending fields. */
export function validateNotificationRequest(input: unknown): NotificationRequest {
  const result = notificationRequestSchema.safeParse(input);
  if (result.success) return result.data;

  const fields = new Set<string>();
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') issue.keys.forEach((key) => fields.add(key));
    else if (issue.path.length > 0) fields.add(String(issue.path[0]));
  }
  const names = [...fields];
  throw new BeaconError({
    code: 'VALIDATION',
    message: names.length > 0 ? `Invalid notification request: ${names.join(', ')}` : 'Invalid notification request',
    fields: names,
    cause: result.error,
  });
}
