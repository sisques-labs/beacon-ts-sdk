import { BeaconError } from '../errors/beacon-error';

export type HeadersInitLike = Record<string, string>;

interface BeaconConfigBase {
  /** Static headers sent on every request (REST/GraphQL HTTP headers, Kafka message headers). */
  headers?: HeadersInitLike;
  /** Resolved per request; its output overrides `headers` on conflict. */
  getHeaders?(): HeadersInitLike | Promise<HeadersInitLike>;
  /** Request timeout in milliseconds (HTTP transports). */
  timeoutMs?: number;
  /** Injected fetch implementation (HTTP transports); defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export type BeaconConfig = BeaconConfigBase &
  (
    | { transport: 'rest'; baseUrl: string }
    | { transport: 'graphql'; endpoint: string }
    | { transport: 'kafka'; brokers: string[]; topic?: string; clientId?: string }
  );

const configError = (message: string) => new BeaconError({ code: 'CONFIG', message });

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Structural validation only; optional peers (kafkajs) are checked lazily by their adapter. */
export function validateBeaconConfig(input: unknown): BeaconConfig {
  if (typeof input !== 'object' || input === null) {
    throw configError('Beacon config must be an object');
  }
  const config = input as Record<string, unknown>;

  if (config.timeoutMs !== undefined && !(typeof config.timeoutMs === 'number' && config.timeoutMs > 0)) {
    throw configError('Beacon config: timeoutMs must be a positive number');
  }
  if (config.getHeaders !== undefined && typeof config.getHeaders !== 'function') {
    throw configError('Beacon config: getHeaders must be a function');
  }

  switch (config.transport) {
    case undefined:
      throw configError("Beacon config: 'transport' is required ('rest', 'graphql' or 'kafka')");
    case 'rest':
      if (!isNonEmptyString(config.baseUrl)) throw configError("Beacon config: 'baseUrl' is required for the rest transport");
      break;
    case 'graphql':
      if (!isNonEmptyString(config.endpoint)) throw configError("Beacon config: 'endpoint' is required for the graphql transport");
      break;
    case 'kafka':
      if (!Array.isArray(config.brokers) || config.brokers.length === 0 || !config.brokers.every(isNonEmptyString)) {
        throw configError("Beacon config: 'brokers' must be a non-empty string array for the kafka transport");
      }
      break;
    default:
      throw configError(`Beacon config: unknown transport '${String(config.transport)}'`);
  }
  return input as BeaconConfig;
}
