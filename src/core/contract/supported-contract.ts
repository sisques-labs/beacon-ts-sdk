/**
 * Shape of the beacon-api ingest contract this SDK version targets. Mirrors
 * beacon-api DTO constraints; a breaking change here is a MAJOR SDK bump.
 */
export const SUPPORTED_CONTRACT = {
  rest: { path: '/api/v1/notifications' },
  graphql: { mutation: 'notificationCreate' },
  kafka: { defaultTopic: 'beacon-api.notification-requests' },
  channels: ['DISCORD'],
  deliveryModes: ['DELIVER', 'RECORD_ONLY'],
  limits: {
    title: 200,
    body: 5000,
    sourceService: 100,
    dedupeKey: 255,
  },
} as const;
