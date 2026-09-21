import { describe, expect, it, vi } from 'vitest';
import type { NotificationRequest } from '../../core/notification/request.types';
import { RestTransport } from './rest.transport';

const request: NotificationRequest = {
  tenantId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 'Order shipped',
  body: 'Your order 42 has shipped',
  sourceService: 'orders',
  dedupeKey: 'order-42-shipped',
};

const created = () => new Response(JSON.stringify({ id: 'n-1' }), { status: 201 });

describe('RestTransport', () => {
  it('POSTs the request as JSON to {baseUrl}/api/v1/notifications and maps {id}', async () => {
    const fetchImpl = vi.fn(async () => created());
    const transport = new RestTransport({ transport: 'rest', baseUrl: 'https://beacon.example', fetch: fetchImpl });

    const result = await transport.send(request);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://beacon.example/api/v1/notifications');
    expect(JSON.parse(init.body as string)).toEqual(request);
    expect(result).toEqual({ accepted: true, transport: 'rest', dedupeKey: 'order-42-shipped', id: 'n-1' });
  });

  it.each(['https://beacon.example/', 'https://beacon.example//'])('avoids a double slash for baseUrl %s', async (baseUrl) => {
    const fetchImpl = vi.fn(async () => created());
    await new RestTransport({ transport: 'rest', baseUrl, fetch: fetchImpl }).send(request);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('https://beacon.example/api/v1/notifications');
  });

  it('rejects a 2xx response lacking a string id with TRANSPORT', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 201 }));
    const transport = new RestTransport({ transport: 'rest', baseUrl: 'https://b.test', fetch: fetchImpl });
    await expect(transport.send(request)).rejects.toMatchObject({ code: 'TRANSPORT', transport: 'rest' });
  });

  it('close() resolves', async () => {
    const transport = new RestTransport({ transport: 'rest', baseUrl: 'https://b.test' });
    await expect(transport.close()).resolves.toBeUndefined();
  });
});
