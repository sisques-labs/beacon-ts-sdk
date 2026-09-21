import type { BeaconConfig } from '../core/config/beacon-config.types';
import { BeaconError } from '../core/errors/beacon-error';
import type { Transport } from '../core/ports/transport.port';
import { RestTransport } from './rest/rest.transport';

/** Config -> adapter factory. Kafka and GraphQL branches land in a later change unit. */
export function createTransport(config: BeaconConfig): Transport {
  switch (config.transport) {
    case 'rest':
      return new RestTransport(config);
    default:
      throw new BeaconError({
        code: 'CONFIG',
        message: `Beacon config: transport '${String(config.transport)}' is not available`,
      });
  }
}
