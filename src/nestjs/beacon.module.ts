import { type DynamicModule, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { BeaconClient } from '../core/beacon-client';
import { validateBeaconConfig } from '../core/config/beacon-config.types';
import type { BeaconModuleAsyncOptions } from './beacon.options';
import { BEACON_CONFIG } from './beacon.tokens';

/** Registration layer only: config resolution and lifecycle. All behavior lives in the core. */
@Module({})
export class BeaconModule implements OnApplicationShutdown {
  constructor(@Inject(BeaconClient) private readonly client: BeaconClient) {}

  static forRootAsync(options: BeaconModuleAsyncOptions): DynamicModule {
    return {
      module: BeaconModule,
      global: true,
      imports: options.imports ?? [],
      providers: [
        {
          provide: BEACON_CONFIG,
          inject: (options.inject ?? []) as never[],
          useFactory: async (...args: unknown[]) => validateBeaconConfig(await options.useFactory(...args)),
        },
        {
          provide: BeaconClient,
          inject: [BEACON_CONFIG],
          useFactory: (config: Parameters<typeof validateBeaconConfig>[0]) => new BeaconClient(validateBeaconConfig(config)),
        },
      ],
      exports: [BeaconClient, BEACON_CONFIG],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
