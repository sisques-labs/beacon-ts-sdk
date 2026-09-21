import { describe, expect, it } from 'vitest';
import { createTransport } from './create-transport';
import { RestTransport } from './rest/rest.transport';

describe('createTransport', () => {
  it('builds a RestTransport for the rest config', () => {
    expect(createTransport({ transport: 'rest', baseUrl: 'https://b.test' })).toBeInstanceOf(RestTransport);
  });

  it.each(['smtp', 'graphql', 'kafka'])('throws CONFIG for the not-yet-available or unknown transport %s', (transport) => {
    expect(() => createTransport({ transport } as never)).toThrowError(expect.objectContaining({ code: 'CONFIG' }));
  });
});
