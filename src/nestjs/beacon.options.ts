import type { ModuleMetadata } from '@nestjs/common';
import type { BeaconConfig } from '../core/config/beacon-config.types';

export interface BeaconModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /** Providers injected into `useFactory`, in order. */
  inject?: unknown[];
  // `any` is required so factories with typed params stay assignable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => BeaconConfig | Promise<BeaconConfig>;
}
