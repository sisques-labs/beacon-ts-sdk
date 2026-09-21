import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeaconClient } from '../core/beacon-client';
import { BeaconError } from '../core/errors/beacon-error';
import { BEACON_CONFIG, BeaconModule } from './index';

const validRequest = {
  tenantId: '3f2b8c1e-6a4d-4c5b-9e1a-2d7f0b9a1c11',
  recipientUserId: '9a7e5d3c-1b2f-4e6a-8c0d-5f4e3d2c1b0a',
  channel: 'DISCORD',
  title: 'Deploy completed',
  body: 'Done',
  sourceService: 'gardenia',
  dedupeKey: 'k-1',
} as const;

const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify({ id: 'n-1' }), { status: 201, headers: { 'content-type': 'application/json' } }));

@Injectable()
class ConfigService {
  get(key: string): string {
    return { BEACON_URL: 'http://beacon.test' }[key] ?? '';
  }
}

@Module({ providers: [ConfigService], exports: [ConfigService] })
class ConfigModule {}

@Injectable()
class ConsumerService {
  constructor(@Inject(BeaconClient) readonly beacon: BeaconClient) {}
}

@Module({ providers: [ConsumerService], exports: [ConsumerService] })
class FeatureModule {}

afterEach(() => vi.restoreAllMocks());

describe('BeaconModule.forRootAsync', () => {
  it('builds the client from a factory with injected config', async () => {
    const fetch = okFetch();
    const moduleRef = await Test.createTestingModule({
      imports: [
        BeaconModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (cfg: ConfigService) => ({ transport: 'rest', baseUrl: cfg.get('BEACON_URL'), fetch }),
        }),
      ],
    }).compile();

    const client = moduleRef.get(BeaconClient);
    expect(client).toBeInstanceOf(BeaconClient);
    await expect(client.notify(validRequest)).resolves.toMatchObject({ id: 'n-1' });
    expect(fetch).toHaveBeenCalledWith('http://beacon.test/api/v1/notifications', expect.anything());
  });

  it('waits for an async factory and exposes the resolved config under BEACON_CONFIG', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BeaconModule.forRootAsync({
          useFactory: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { transport: 'rest', baseUrl: 'http://async.test' } as const;
          },
        }),
      ],
    }).compile();

    expect(moduleRef.get(BEACON_CONFIG)).toMatchObject({ baseUrl: 'http://async.test' });
  });

  it('fails bootstrap with the configuration BeaconError when config is invalid', async () => {
    const compile = Test.createTestingModule({
      imports: [BeaconModule.forRootAsync({ useFactory: () => ({}) as never })],
    }).compile();

    const error = await compile.catch((e: unknown) => e);
    expect(BeaconError.is(error)).toBe(true);
    expect(error).toMatchObject({ code: 'CONFIG' });
  });

  it('is global: a feature module injects the same singleton without re-importing', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BeaconModule.forRootAsync({ useFactory: () => ({ transport: 'rest', baseUrl: 'http://x.test' }) }), FeatureModule],
    }).compile();

    expect(moduleRef.get(ConsumerService).beacon).toBe(moduleRef.get(BeaconClient));
  });

  it('passes core BeaconErrors through unchanged', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('connection refused');
    });
    const moduleRef = await Test.createTestingModule({
      imports: [BeaconModule.forRootAsync({ useFactory: () => ({ transport: 'rest', baseUrl: 'http://x.test', fetch }) })],
    }).compile();

    const error = await moduleRef
      .get(BeaconClient)
      .notify(validRequest)
      .catch((e: unknown) => e);
    expect(BeaconError.is(error)).toBe(true);
    expect(error).toMatchObject({ code: 'TRANSPORT' });
  });

  it('closes the client on application shutdown', async () => {
    const close = vi.spyOn(BeaconClient.prototype, 'close');
    const moduleRef = await Test.createTestingModule({
      imports: [BeaconModule.forRootAsync({ useFactory: () => ({ transport: 'rest', baseUrl: 'http://x.test' }) })],
    }).compile();
    await moduleRef.init();
    expect(close).not.toHaveBeenCalled();

    await moduleRef.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
