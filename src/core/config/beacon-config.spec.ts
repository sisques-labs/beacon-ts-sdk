import { describe, expect, it } from 'vitest';
import { BeaconError } from '../errors/beacon-error';
import { validateBeaconConfig } from './beacon-config.types';

function configFailure(input: unknown): BeaconError {
  try {
    validateBeaconConfig(input);
  } catch (e) {
    expect(BeaconError.is(e)).toBe(true);
    return e as BeaconError;
  }
  throw new Error('expected config validation to throw');
}

describe('validateBeaconConfig', () => {
  it('accepts a rest config and returns it as-is', () => {
    const config = { transport: 'rest', baseUrl: 'https://beacon.example' } as const;
    expect(validateBeaconConfig(config)).toBe(config);
  });

  it('accepts graphql and kafka configs with options', () => {
    expect(validateBeaconConfig({ transport: 'graphql', endpoint: 'https://b/graphql' }).transport).toBe('graphql');
    const kafka = validateBeaconConfig({ transport: 'kafka', brokers: ['a:9092'], topic: 'custom.topic' });
    expect(kafka.transport).toBe('kafka');
  });

  it('accepts static headers, hook and timeout', () => {
    const config = validateBeaconConfig({
      transport: 'rest',
      baseUrl: 'https://b',
      headers: { 'X-A': '1' },
      getHeaders: () => ({ 'X-A': '2' }),
      timeoutMs: 5000,
    });
    expect(config.timeoutMs).toBe(5000);
  });

  it('rejects a missing transport with CONFIG', () => {
    const err = configFailure({ baseUrl: 'https://b' });
    expect(err.code).toBe('CONFIG');
    expect(err.message).toContain('transport');
  });

  it('rejects an unknown transport naming it', () => {
    const err = configFailure({ transport: 'smtp' });
    expect(err.code).toBe('CONFIG');
    expect(err.message).toContain('smtp');
  });

  it('rejects non-object config', () => {
    expect(configFailure(undefined).code).toBe('CONFIG');
    expect(configFailure('rest').code).toBe('CONFIG');
  });

  it('requires the transport-specific option', () => {
    expect(configFailure({ transport: 'rest' }).message).toContain('baseUrl');
    expect(configFailure({ transport: 'rest', baseUrl: '' }).message).toContain('baseUrl');
    expect(configFailure({ transport: 'graphql' }).message).toContain('endpoint');
    expect(configFailure({ transport: 'kafka' }).message).toContain('brokers');
    expect(configFailure({ transport: 'kafka', brokers: [] }).message).toContain('brokers');
  });

  it('rejects an invalid timeout or hook', () => {
    expect(configFailure({ transport: 'rest', baseUrl: 'https://b', timeoutMs: 0 }).message).toContain('timeoutMs');
    expect(configFailure({ transport: 'rest', baseUrl: 'https://b', getHeaders: 'x' }).message).toContain('getHeaders');
  });
});
