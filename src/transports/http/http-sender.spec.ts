import { describe, expect, it, vi } from 'vitest';
import { BeaconError } from '../../core/errors/beacon-error';
import { HttpSender } from './http-sender';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function sender(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof HttpSender>[0]> = {}) {
  return new HttpSender({ transport: 'rest', fetch: fetchImpl, ...extra });
}

const failure = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected rejection');
    },
    (e: BeaconError) => e,
  );

describe('HttpSender', () => {
  it('POSTs JSON with content-type and returns the parsed body', async () => {
    const fetchImpl = vi.fn(async () => json({ id: 'n1' }, 201));
    const result = await sender(fetchImpl).postJson('https://x.test/a', { a: 1 });

    expect(result).toEqual({ id: 'n1' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x.test/a');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('merges static headers with the hook, hook winning, resolved per call', async () => {
    const fetchImpl = vi.fn(async () => json({}));
    let n = 0;
    const s = sender(fetchImpl, {
      headers: { 'x-static': 's', authorization: 'static' },
      getHeaders: async () => ({ authorization: `hook-${++n}` }),
    });
    await s.postJson('https://x.test', {});
    await s.postJson('https://x.test', {});

    const h = (i: number) => (fetchImpl.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(h(0)).toMatchObject({ 'x-static': 's', authorization: 'hook-1' });
    expect(h(1).authorization).toBe('hook-2');
  });

  it('maps a throwing hook to CONFIG with cause and does not call fetch', async () => {
    const fetchImpl = vi.fn(async () => json({}));
    const boom = new Error('token expired');
    const err = await failure(
      sender(fetchImpl, {
        getHeaders: () => {
          throw boom;
        },
      }).postJson('https://x.test', {}),
    );

    expect(BeaconError.is(err)).toBe(true);
    expect(err).toMatchObject({ code: 'CONFIG', transport: 'rest' });
    expect(err.cause).toBe(boom);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a REST error body to HTTP with status, message and reason', async () => {
    const fetchImpl = vi.fn(async () => json({ statusCode: 400, message: 'bad', error: 'Bad Request' }, 400));
    const err = await failure(sender(fetchImpl).postJson('https://x.test', {}));
    expect(err).toMatchObject({ code: 'HTTP', status: 400, message: 'bad', reason: 'Bad Request', transport: 'rest' });
  });

  it('joins array messages from validation error bodies', async () => {
    const fetchImpl = vi.fn(async () => json({ statusCode: 400, message: ['a bad', 'b bad'], error: 'Bad Request' }, 400));
    const err = await failure(sender(fetchImpl).postJson('https://x.test', {}));
    expect(err.message).toBe('a bad; b bad');
  });

  it('falls back to a generic message for a non-JSON 502', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const err = await failure(sender(fetchImpl).postJson('https://x.test', {}));
    expect(err).toMatchObject({ code: 'HTTP', status: 502, transport: 'rest' });
    expect(err.message).toContain('502');
  });

  it('maps a network failure to TRANSPORT keeping the cause', async () => {
    const boom = new TypeError('fetch failed');
    const fetchImpl = vi.fn(async () => {
      throw boom;
    });
    const err = await failure(sender(fetchImpl).postJson('https://x.test', {}));
    expect(err).toMatchObject({ code: 'TRANSPORT', transport: 'rest' });
    expect(err.cause).toBe(boom);
  });

  it('maps a timeout to TIMEOUT', async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener('abort', () => rej(init.signal?.reason));
        }),
    ) as unknown as typeof fetch;
    const err = await failure(sender(fetchImpl, { timeoutMs: 10 }).postJson('https://x.test', {}));
    expect(err).toMatchObject({ code: 'TIMEOUT', transport: 'rest' });
  });

  it('maps a 2xx non-JSON body to TRANSPORT', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    const err = await failure(sender(fetchImpl).postJson('https://x.test', {}));
    expect(err).toMatchObject({ code: 'TRANSPORT', status: 200 });
  });
});
