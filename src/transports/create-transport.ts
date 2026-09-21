import type { BeaconConfig } from '../core/config/beacon-config.types';
import { BeaconError } from '../core/errors/beacon-error';
import type { Transport } from '../core/ports/transport.port';
import { GraphqlTransport } from './graphql/graphql.transport';
import { KafkaTransport } from './kafka/kafka.transport';
import { RestTransport } from './rest/rest.transport';

/** Config -> adapter factory. kafkajs is only imported lazily by the Kafka adapter, never here. */
export function createTransport(config: BeaconConfig): Transport {
  switch (config.transport) {
    case 'rest':
      return new RestTransport(config);
    case 'graphql':
      return new GraphqlTransport(config);
    case 'kafka':
      return new KafkaTransport(config);
    default:
      throw new BeaconError({
        code: 'CONFIG',
        message: `Beacon config: unknown transport '${String((config as { transport?: unknown }).transport)}'`,
      });
  }
}
