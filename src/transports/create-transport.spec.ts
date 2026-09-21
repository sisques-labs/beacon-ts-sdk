import { describe, expect, it, vi } from 'vitest';
import { createTransport } from './create-transport';
import { GraphqlTransport } from './graphql/graphql.transport';
import { KafkaTransport } from './kafka/kafka.transport';
import { RestTransport } from './rest/rest.transport';

describe('createTransport', () => {
  it('builds a RestTransport for the rest config', () => {
    expect(createTransport({ transport: 'rest', baseUrl: 'https://b.test' })).toBeInstanceOf(RestTransport);
  });

  it('builds a GraphqlTransport for the graphql config', () => {
    expect(createTransport({ transport: 'graphql', endpoint: 'https://b.test/graphql' })).toBeInstanceOf(GraphqlTransport);
  });

  it('builds a KafkaTransport for the kafka config without loading kafkajs', () => {
    expect(createTransport({ transport: 'kafka', brokers: ['b:9092'] })).toBeInstanceOf(KafkaTransport);
  });

  it('throws CONFIG for an unknown transport', () => {
    expect(() => createTransport({ transport: 'smtp' } as never)).toThrowError(expect.objectContaining({ code: 'CONFIG' }));
  });

  it('creating a REST transport never loads kafkajs', async () => {
    vi.resetModules();
    const loaded = vi.fn();
    vi.doMock('kafkajs', () => {
      loaded();
      return {};
    });
    const { createTransport: fresh } = await import('./create-transport');
    fresh({ transport: 'rest', baseUrl: 'https://b.test' });
    fresh({ transport: 'graphql', endpoint: 'https://b.test/graphql' });
    expect(loaded).not.toHaveBeenCalled();
    vi.doUnmock('kafkajs');
  });
});
