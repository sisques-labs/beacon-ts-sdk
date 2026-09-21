import type { BeaconTransportKind } from '../notification/notify-result.types';

export type BeaconErrorCode = 'VALIDATION' | 'CONFIG' | 'TRANSPORT' | 'HTTP' | 'TIMEOUT';

export interface BeaconErrorInit {
  code: BeaconErrorCode;
  message: string;
  transport?: BeaconTransportKind;
  /** HTTP status when the failure came from an HTTP response. */
  status?: number;
  /** Server-side reason, e.g. the REST `error` string or a GraphQL `extensions.code`. */
  reason?: string;
  /** Offending request fields for VALIDATION errors. */
  fields?: string[];
  cause?: unknown;
}

/** Cross-realm brand so `is()` survives duplicated ESM/CJS copies of this class. */
const BRAND = Symbol.for('@sisques-labs/beacon-sdk/BeaconError');

export class BeaconError extends Error {
  readonly [BRAND] = true;
  readonly code: BeaconErrorCode;
  readonly transport?: BeaconTransportKind;
  readonly status?: number;
  readonly reason?: string;
  readonly fields?: string[];

  constructor(init: BeaconErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = 'BeaconError';
    this.code = init.code;
    this.transport = init.transport;
    this.status = init.status;
    this.reason = init.reason;
    this.fields = init.fields;
  }

  static is(value: unknown): value is BeaconError {
    return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[BRAND] === true;
  }
}
