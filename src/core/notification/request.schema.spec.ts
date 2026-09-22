import { describe, expect, it } from 'vitest';
import { SUPPORTED_CONTRACT } from '../contract/supported-contract';
import { BeaconError } from '../errors/beacon-error';
import { notificationRequestSchema, validateNotificationRequest } from './request.schema';

const valid = {
  tenantId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 'Order shipped',
  body: 'Your order 42 has shipped',
  sourceService: 'orders',
  dedupeKey: 'order-42-shipped',
};

function failure(input: unknown): BeaconError {
  try {
    validateNotificationRequest(input);
  } catch (e) {
    expect(BeaconError.is(e)).toBe(true);
    return e as BeaconError;
  }
  throw new Error('expected validation to throw');
}

describe('validateNotificationRequest', () => {
  it('returns a valid request with the dedupeKey unchanged', () => {
    const result = validateNotificationRequest({ ...valid, dedupeKey: '  order-42-shipped ' });
    expect(result).toEqual({ ...valid, dedupeKey: '  order-42-shipped ' });
  });

  it('rejects a malformed UUID naming the field', () => {
    const err = failure({ ...valid, tenantId: 'not-a-uuid' });
    expect(err.code).toBe('VALIDATION');
    expect(err.fields).toEqual(['tenantId']);
  });

  it('rejects a malformed recipientUserId', () => {
    expect(failure({ ...valid, recipientUserId: '123' }).fields).toEqual(['recipientUserId']);
  });

  it('rejects empty and whitespace-only strings', () => {
    expect(failure({ ...valid, title: '' }).fields).toEqual(['title']);
    expect(failure({ ...valid, body: '   ' }).fields).toEqual(['body']);
  });

  it('rejects a missing or empty dedupeKey naming dedupeKey', () => {
    const { dedupeKey: _omit, ...missing } = valid;
    expect(failure(missing).fields).toEqual(['dedupeKey']);
    expect(failure({ ...valid, dedupeKey: '' }).fields).toEqual(['dedupeKey']);
  });

  it('enforces max lengths at the boundary', () => {
    expect(validateNotificationRequest({ ...valid, title: 'a'.repeat(200) }).title).toHaveLength(200);
    expect(failure({ ...valid, title: 'a'.repeat(201) }).fields).toEqual(['title']);
    expect(failure({ ...valid, body: 'a'.repeat(5001) }).fields).toEqual(['body']);
    expect(failure({ ...valid, sourceService: 'a'.repeat(101) }).fields).toEqual(['sourceService']);
    expect(failure({ ...valid, dedupeKey: 'a'.repeat(256) }).fields).toEqual(['dedupeKey']);
  });

  it('accepts only DISCORD as channel', () => {
    expect(failure({ ...valid, channel: 'EMAIL' }).fields).toEqual(['channel']);
  });

  it('rejects unknown keys including webhook/destination', () => {
    expect(failure({ ...valid, webhook: 'https://discord.example/hook' }).fields).toEqual(['webhook']);
    expect(failure({ ...valid, destination: 'x' }).fields).toEqual(['destination']);
  });

  it('reports every offending field at once', () => {
    const err = failure({ ...valid, tenantId: 'x', title: '' });
    expect([...(err.fields ?? [])].sort()).toEqual(['tenantId', 'title']);
  });

  it('rejects non-object input', () => {
    expect(failure(null).code).toBe('VALIDATION');
    expect(failure('nope').code).toBe('VALIDATION');
  });

  it('accepts deliveryMode: DELIVER', () => {
    expect(notificationRequestSchema.safeParse({ ...valid, deliveryMode: 'DELIVER' }).success).toBe(true);
  });

  it('accepts deliveryMode: RECORD_ONLY', () => {
    expect(notificationRequestSchema.safeParse({ ...valid, deliveryMode: 'RECORD_ONLY' }).success).toBe(true);
  });

  it('rejects an unknown deliveryMode naming the field', () => {
    expect(failure({ ...valid, deliveryMode: 'SOMETHING_ELSE' }).fields).toEqual(['deliveryMode']);
  });

  it('omits deliveryMode from the parsed result when not supplied', () => {
    const result = validateNotificationRequest(valid);
    expect('deliveryMode' in result).toBe(false);
  });

  it('pins schema deliveryMode tokens against SUPPORTED_CONTRACT.deliveryModes', () => {
    const deliveryModeShape = notificationRequestSchema.shape.deliveryMode.unwrap();
    expect(deliveryModeShape.options).toEqual(SUPPORTED_CONTRACT.deliveryModes);
  });
});
