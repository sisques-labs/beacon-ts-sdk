export type BeaconTransportKind = 'rest' | 'graphql' | 'kafka';

/**
 * Result of a resolved `notify()`. It signals that the transport ACCEPTED the
 * request, never that the notification was delivered.
 */
export interface NotifyResult {
  accepted: true;
  transport: BeaconTransportKind;
  /** Forwarded unchanged from the request. */
  dedupeKey: string;
  /** Server-assigned id. Absent on Kafka, which gives no server response. */
  id?: string;
}
