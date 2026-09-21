import { describe, expect, it, vi } from 'vitest';
import { BeaconClient } from './beacon-client';
import { BeaconError } from './errors/beacon-error';
import type { NotifyResult } from './notification/notify-result.types';
import type { NotificationRequest } from './notification/request.types';
import type { Transport } from './ports/transport.port';

const valid: NotificationRequest = {
  tenantId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 'Order shipped',
  body: 'Your order 42 has shipped',
  sourceService: 'orders',
  dedupeKey: 'order-42-shipped',
};
const config = { transport: 'rest', baseUrl: 'https://beacon.example' } as const;

function fakeTransport(result?: Partial<NotifyResult>) {
  const send = vi.fn(async (r: NotificationRequest): Promise<NotifyResult> => ({
    accepted: true,
    transport: 'rest',
    dedupeKey: r.dedupeKey,
    ...result,
  }));
  const close = vi.fn(async () => {});
  const transport: Transport = { send, close };
  return { transport, send, close };
}

describe('BeaconClient', () => {
  it('hands a valid request to the transport and returns its result', async () => {
    const { transport, send } = fakeTransport({ id: 'abc' });
    const client = new BeaconClient(config, transport);

    const result = await client.notify(valid);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(valid);
    expect(result).toEqual({ accepted: true, transport: 'rest', dedupeKey: 'order-42-shipped', id: 'abc' });
  });

  it('forwards the dedupeKey unchanged', async () => {
    const { transport, send } = fakeTransport();
    await new BeaconClient(config, transport).notify({ ...valid, dedupeKey: ' Key-7 ' });
    expect(send.mock.calls[0]?.[0].dedupeKey).toBe(' Key-7 ');
  });

  it('rejects an invalid request without calling the transport', async () => {
    const { transport, send } = fakeTransport();
    const client = new BeaconClient(config, transport);

    const err = await client.notify({ ...valid, tenantId: 'not-a-uuid' } as NotificationRequest).catch((e) => e);

    expect(BeaconError.is(err)).toBe(true);
    expect(err.code).toBe('VALIDATION');
    expect(err.fields).toEqual(['tenantId']);
    expect(err.transport).toBe('rest');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an unsupported channel and a webhook field before transmission', async () => {
    const { transport, send } = fakeTransport();
    const client = new BeaconClient(config, transport);
    await expect(client.notify({ ...valid, channel: 'EMAIL' } as never)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(client.notify({ ...valid, webhook: 'https://x' } as never)).rejects.toMatchObject({
      code: 'VALIDATION',
      fields: ['webhook'],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('passes a BeaconError from the transport through unchanged', async () => {
    const failure = new BeaconError({ code: 'HTTP', message: 'bad', transport: 'rest', status: 400 });
    const { transport, send } = fakeTransport();
    send.mockRejectedValueOnce(failure);
    await expect(new BeaconClient(config, transport).notify(valid)).rejects.toBe(failure);
  });

  it('wraps a raw transport exception into a TRANSPORT BeaconError with cause', async () => {
    const raw = new Error('boom');
    const { transport, send } = fakeTransport();
    send.mockRejectedValueOnce(raw);
    const err = await new BeaconClient(config, transport).notify(valid).catch((e) => e);
    expect(BeaconError.is(err)).toBe(true);
    expect(err.code).toBe('TRANSPORT');
    expect(err.transport).toBe('rest');
    expect(err.cause).toBe(raw);
  });

  it('fails at creation with CONFIG for an invalid config', () => {
    const { transport } = fakeTransport();
    expect(() => new BeaconClient({} as never, transport)).toThrowError(expect.objectContaining({ code: 'CONFIG' }));
    expect(() => new BeaconClient({ transport: 'smtp' } as never, transport)).toThrowError(
      expect.objectContaining({ code: 'CONFIG' }),
    );
  });

  it('close() closes the transport', async () => {
    const { transport, close } = fakeTransport();
    await new BeaconClient(config, transport).close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('exposes notify and close only as public methods', () => {
    const { transport } = fakeTransport();
    const proto = Object.getOwnPropertyNames(BeaconClient.prototype).filter((n) => n !== 'constructor');
    expect(proto.sort()).toEqual(['close', 'notify']);
    void transport;
  });
});
