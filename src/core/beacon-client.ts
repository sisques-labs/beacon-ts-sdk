import { type BeaconConfig, validateBeaconConfig } from './config/beacon-config.types';
import { BeaconError } from './errors/beacon-error';
import type { NotifyResult } from './notification/notify-result.types';
import { validateNotificationRequest } from './notification/request.schema';
import type { NotificationRequest } from './notification/request.types';
import type { Transport } from './ports/transport.port';

export class BeaconClient {
  private readonly config: BeaconConfig;

  /** Throws a CONFIG `BeaconError` when `config` is invalid. */
  constructor(config: BeaconConfig, private readonly transport: Transport) {
    this.config = validateBeaconConfig(config);
  }

  /**
   * Validates then publishes. Resolving means the transport ACCEPTED the
   * request, not that it was delivered.
   */
  async notify(request: NotificationRequest): Promise<NotifyResult> {
    let validated: NotificationRequest;
    try {
      validated = validateNotificationRequest(request);
    } catch (error) {
      throw BeaconError.is(error) ? withTransport(error, this.config) : error;
    }
    try {
      return await this.transport.send(validated);
    } catch (error) {
      if (BeaconError.is(error)) throw error;
      throw new BeaconError({
        code: 'TRANSPORT',
        message: error instanceof Error ? error.message : 'Transport failure',
        transport: this.config.transport,
        cause: error,
      });
    }
  }

  async close(): Promise<void> {
    await this.transport.close();
  }
}

function withTransport(error: BeaconError, config: BeaconConfig): BeaconError {
  return new BeaconError({
    code: error.code,
    message: error.message,
    transport: config.transport,
    status: error.status,
    reason: error.reason,
    fields: error.fields,
    cause: error.cause,
  });
}
