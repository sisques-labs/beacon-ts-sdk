/**
 * A notification request. There is deliberately no destination/webhook field:
 * the destination is resolved server-side by beacon-api.
 */
export interface NotificationRequest {
  tenantId: string;
  recipientUserId: string;
  channel: 'DISCORD';
  title: string;
  body: string;
  sourceService: string;
  /** Idempotency key; forwarded unchanged, never generated or mutated by the SDK. */
  dedupeKey: string;
}
