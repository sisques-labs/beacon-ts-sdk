import { describe, expect, it } from 'vitest';
import { SUPPORTED_CONTRACT, validateNotificationRequest } from '../src';
import invalidCases from './fixtures/invalid-requests.json';
import validRequest from './fixtures/valid-request.json';

/** Expands "@repeat:<char>:<n>" markers so fixtures stay readable. */
function expand(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('@repeat:')) {
    const [, char = '', count = '0'] = value.split(':');
    return char.repeat(Number(count));
  }
  return value;
}

describe('Tier A contract: mirrored beacon-api constraints', () => {
  it('pins the targeted ingest contract', () => {
    expect(SUPPORTED_CONTRACT.rest.path).toBe('/api/v1/notifications');
    expect(SUPPORTED_CONTRACT.graphql.mutation).toBe('notificationCreate');
    expect(SUPPORTED_CONTRACT.kafka.defaultTopic).toBe('beacon-api.notification-requests');
    expect(SUPPORTED_CONTRACT.channels).toEqual(['DISCORD']);
    expect(SUPPORTED_CONTRACT.limits).toEqual({ title: 200, body: 5000, sourceService: 100, dedupeKey: 255 });
  });

  it('accepts the golden valid payload unchanged', () => {
    expect(validateNotificationRequest(validRequest)).toEqual(validRequest);
  });

  it.each(invalidCases)('rejects golden invalid payload: $name', ({ patch, fields }) => {
    const payload = { ...validRequest, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, expand(v)])) };
    expect(() => validateNotificationRequest(payload)).toThrowError(expect.objectContaining({ code: 'VALIDATION', fields }));
  });
});
