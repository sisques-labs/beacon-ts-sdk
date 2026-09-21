import { describe, expect, it, vi } from 'vitest';
import { BeaconError } from '../../core/errors/beacon-error';
import type { NotificationRequest } from '../../core/notification/request.types';
import { GraphqlTransport } from './graphql.transport';

const request: NotificationRequest = {
  tenantId: '3f0c1d0e-7b1a-4c55-9d0e-1a2b3c4d5e6f',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 't',
  body: 'b',
  sourceService: 'svc',
  dedupeKey: 'k-1',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const failure = async (promise: Promise<unknown>): Promise<BeaconError> => {
  try {
    await promise;
  } catch (error) {
    return error as BeaconError;
  }
  throw new Error('expected rejection');
};

describe('GraphqlTransport', () => {
  it('posts the notificationCreate mutation with the request as input and returns the id', async () => {
    const fetchMock = vi.fn(async () => json({ data: { notificationCreate: { success: true, id: 'n-1' } } }));
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });

    const result = await transport.send(request);

    expect(result).toEqual({ accepted: true, transport: 'graphql', dedupeKey: 'k-1', id: 'n-1' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://b.test/graphql');
    const body = JSON.parse(init.body as string);
    expect(body.query).toContain('notificationCreate');
    expect(body.variables).toEqual({ input: request });
  });

  it('omits id when the response carries none', async () => {
    const fetchMock = vi.fn(async () => json({ data: { notificationCreate: { success: true } } }));
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });
    const result = await transport.send(request);
    expect(result).not.toHaveProperty('id');
  });

  it('keeps extensions.code in reason and uses code HTTP for a 200 errors[] body', async () => {
    const fetchMock = vi.fn(async () =>
      json({ errors: [{ message: 'title too long', extensions: { code: 'BAD_USER_INPUT' } }], data: null }),
    );
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });
    const error = await failure(transport.send(request));
    expect(error).toMatchObject({ code: 'HTTP', transport: 'graphql', reason: 'BAD_USER_INPUT', status: 200 });
    expect(error.message).toContain('title too long');
  });

  it('handles errors[] without extensions', async () => {
    const fetchMock = vi.fn(async () => json({ errors: [{ message: 'boom' }] }));
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });
    const error = await failure(transport.send(request));
    expect(error).toMatchObject({ code: 'HTTP', message: expect.stringContaining('boom') });
    expect(error.reason).toBeUndefined();
  });

  it('rejects with TRANSPORT when the mutation payload is missing', async () => {
    const fetchMock = vi.fn(async () => json({ data: {} }));
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });
    expect(await failure(transport.send(request))).toMatchObject({ code: 'TRANSPORT', transport: 'graphql' });
  });

  it('propagates HttpSender failures (network) tagged as graphql', async () => {
    const fetchMock = vi.fn(async () => Promise.reject(new Error('offline')));
    const transport = new GraphqlTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql', fetch: fetchMock });
    expect(await failure(transport.send(request))).toMatchObject({ code: 'TRANSPORT', transport: 'graphql' });
  });
});
