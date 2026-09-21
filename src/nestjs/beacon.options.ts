import type { ModuleMetadata } from '@nestjs/common';
import type { BeaconConfig } from '../core/config/beacon-config.types';

export interface BeaconModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Providers injected into `useFactory`, in order. */
  inject?: unknown[];
  useFactory: (...args: any[]) => BeaconConfig | Promise<BeaconConfig>;
}
