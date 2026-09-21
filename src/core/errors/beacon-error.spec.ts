import { describe, expect, it } from 'vitest';
import { BeaconError } from './beacon-error';

describe('BeaconError', () => {
  it('carries code, message and transport', () => {
    const err = new BeaconError({ code: 'HTTP', message: 'bad', transport: 'rest', status: 400, reason: 'Bad Request' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('BeaconError');
    expect(err.code).toBe('HTTP');
    expect(err.message).toBe('bad');
    expect(err.transport).toBe('rest');
    expect(err.status).toBe(400);
    expect(err.reason).toBe('Bad Request');
  });

  it('keeps optional fields undefined when not provided', () => {
    const err = new BeaconError({ code: 'CONFIG', message: 'no transport' });
    expect(err.transport).toBeUndefined();
    expect(err.status).toBeUndefined();
    expect(err.reason).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err.fields).toBeUndefined();
  });

  it('attaches the original error as cause', () => {
    const original = new Error('ECONNREFUSED');
    const err = new BeaconError({ code: 'TRANSPORT', message: 'unreachable', transport: 'kafka', cause: original });
    expect(err.cause).toBe(original);
  });

  it('exposes offending fields for validation errors', () => {
    const err = new BeaconError({ code: 'VALIDATION', message: 'invalid', fields: ['tenantId', 'title'] });
    expect(err.fields).toEqual(['tenantId', 'title']);
  });

  describe('is()', () => {
    it('recognises real instances', () => {
      expect(BeaconError.is(new BeaconError({ code: 'TIMEOUT', message: 't' }))).toBe(true);
    });

    it('recognises a duplicated class through the brand (dual ESM/CJS)', () => {
      const duplicate = Object.assign(new Error('x'), { [Symbol.for('@sisques-labs/beacon-sdk/BeaconError')]: true });
      expect(BeaconError.is(duplicate)).toBe(true);
    });

    it('rejects plain errors and non-errors', () => {
      expect(BeaconError.is(new Error('x'))).toBe(false);
      expect(BeaconError.is(undefined)).toBe(false);
      expect(BeaconError.is({ code: 'HTTP' })).toBe(false);
    });
  });
});
