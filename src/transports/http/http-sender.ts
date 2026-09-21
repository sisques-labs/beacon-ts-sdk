import type { BeaconConfig } from '../../core/config/beacon-config.types';
import { BeaconError } from '../../core/errors/beacon-error';
import type { BeaconTransportKind } from '../../core/notification/notify-result.types';

const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpSenderOptions = Pick<BeaconConfig, 'headers' | 'getHeaders' | 'timeoutMs' | 'fetch'> & {
  transport: BeaconTransportKind;
};

/**
 * Shared HTTP plumbing for the REST and GraphQL adapters: header resolution,
 * timeout and normalization of every failure into a `BeaconError`.
 */
export class HttpSender {
  constructor(private readonly options: HttpSenderOptions) {}

  /** POSTs `body` as JSON and returns the parsed JSON response body. */
  async postJson(url: string, body: unknown): Promise<unknown> {
    const { transport } = this.options;
    const headers = { 'content-type': 'application/json', ...(await this.resolveHeaders()) };
    const fetchImpl = this.options.fetch ?? globalThis.fetch;
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new BeaconError({ code: 'TIMEOUT', message: `Request timed out after ${timeoutMs}ms`, transport, cause: error });
      }
      throw new BeaconError({
        code: 'TRANSPORT',
        message: error instanceof Error ? error.message : 'Network failure',
        transport,
        cause: error,
      });
    }

    const text = await response.text().catch(() => '');
    const parsed = tryParse(text);
    if (!response.ok) throw httpError(transport, response.status, parsed);
    if (parsed === undefined) {
      throw new BeaconError({
        code: 'TRANSPORT',
        message: `Beacon API returned a non-JSON response (${response.status})`,
        transport,
        status: response.status,
      });
    }
    return parsed;
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    try {
      const dynamic = (await this.options.getHeaders?.()) ?? {};
      return { ...this.options.headers, ...dynamic };
    } catch (error) {
      throw new BeaconError({
        code: 'CONFIG',
        message: 'getHeaders hook threw',
        transport: this.options.transport,
        cause: error,
      });
    }
  }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function httpError(transport: BeaconTransportKind, status: number, body: unknown): BeaconError {
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const raw = fields.message;
  const message = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : `Beacon API responded with HTTP ${status}`;
  return new BeaconError({
    code: 'HTTP',
    message,
    transport,
    status,
    reason: typeof fields.error === 'string' ? fields.error : undefined,
  });
}
