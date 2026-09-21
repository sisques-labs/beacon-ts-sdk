import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import validRequest from '../fixtures/valid-request.json';
import { BeaconClient } from '../../src/index';
import type { NotificationRequest } from '../../src/index';

/**
 * Tier B: opt-in live smoke tests against a real beacon-api. Skipped unless the
 * environment enables them, so CI and local runs never need a running service.
 *
 *   BEACON_BASE_URL   e.g. http://localhost:3000  (REST at /api/v1/notifications, GraphQL at /graphql)
 *   BEACON_GRAPHQL_URL optional override of the GraphQL endpoint
 *   KAFKA_BROKERS     comma-separated, e.g. localhost:9092
 *   BEACON_TENANT_ID / BEACON_RECIPIENT_ID  optional real ids (UUIDs)
 */
const baseUrl = process.env.BEACON_BASE_URL;
const brokers = process.env.KAFKA_BROKERS?.split(',').map((b) => b.trim()).filter(Boolean);

const freshRequest = (): NotificationRequest =>
  ({
    ...validRequest,
    tenantId: process.env.BEACON_TENANT_ID ?? validRequest.tenantId,
    recipientUserId: process.env.BEACON_RECIPIENT_ID ?? validRequest.recipientUserId,
    dedupeKey: `sdk-smoke-${randomUUID()}`,
  }) as NotificationRequest;

describe.skipIf(!baseUrl)('live smoke: HTTP transports', () => {
  it('rest: notify is accepted and returns an id; a dedupeKey replay is accepted too', async () => {
    const client = new BeaconClient({ transport: 'rest', baseUrl: baseUrl as string });
    const request = freshRequest();

    const first = await client.notify(request);
    const replay = await client.notify(request);

    expect(first.transport).toBe('rest');
    expect(typeof first.id).toBe('string');
    expect(replay.transport).toBe('rest');
    await client.close();
  });

  it('graphql: notificationCreate is accepted', async () => {
    const endpoint = process.env.BEACON_GRAPHQL_URL ?? `${(baseUrl as string).replace(/\/+$/, '')}/graphql`;
    const client = new BeaconClient({ transport: 'graphql', endpoint });

    const result = await client.notify(freshRequest());

    expect(result.transport).toBe('graphql');
    await client.close();
  });
});

describe.skipIf(!brokers?.length)('live smoke: Kafka transport', () => {
  it('kafka: notify resolves once the broker accepts the message (no id)', async () => {
    const client = new BeaconClient({ transport: 'kafka', brokers: brokers as string[] });

    const result = await client.notify(freshRequest());

    expect(result.transport).toBe('kafka');
    expect(result.id).toBeUndefined();
    await client.close();
  });
});
