import { describe, expect, it, vi } from 'vitest';
import { BeaconError } from '../../core/errors/beacon-error';
import type { NotificationRequest } from '../../core/notification/request.types';
import { KafkaTransport, type KafkaModule } from './kafka.transport';

const request: NotificationRequest = {
  tenantId: '3f0c1d0e-7b1a-4c55-9d0e-1a2b3c4d5e6f',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 't',
  body: 'b',
  sourceService: 'svc',
  dedupeKey: 'k-1',
};

function fakeKafka(overrides: { send?: () => Promise<unknown>; connect?: () => Promise<void> } = {}) {
  const producer = {
    connect: vi.fn(overrides.connect ?? (async () => {})),
    send: vi.fn(overrides.send ?? (async () => [])),
    disconnect: vi.fn(async () => {}),
  };
  const ctor = vi.fn();
  class Kafka {
    constructor(config: unknown) {
      ctor(config);
    }
    producer() {
      return producer;
    }
  }
  return { producer, ctor, mod: { Kafka } as unknown as KafkaModule };
}

const failure = async (promise: Promise<unknown>): Promise<BeaconError> => {
  try {
    await promise;
  } catch (error) {
    return error as BeaconError;
  }
  throw new Error('expected rejection');
};

describe('KafkaTransport', () => {
  it('publishes the JSON request to the default topic keyed by dedupeKey and returns no id', async () => {
    const { producer, ctor, mod } = fakeKafka();
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b:9092'] }, async () => mod);

    const result = await transport.send(request);

    expect(result).toEqual({ accepted: true, transport: 'kafka', dedupeKey: 'k-1' });
    expect(result).not.toHaveProperty('id');
    expect(ctor).toHaveBeenCalledWith({ clientId: 'beacon-sdk', brokers: ['b:9092'] });
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'beacon-api.notification-requests',
      messages: [{ key: 'k-1', value: JSON.stringify(request), headers: {} }],
    });
  });

  it('honours a custom topic, clientId and merges static + hook headers', async () => {
    const { producer, ctor, mod } = fakeKafka();
    const transport = new KafkaTransport(
      {
        transport: 'kafka',
        brokers: ['b:9092'],
        topic: 'custom',
        clientId: 'svc',
        headers: { a: '1', b: 'static' },
        getHeaders: async () => ({ b: 'hook' }),
      },
      async () => mod,
    );

    await transport.send(request);

    expect(ctor).toHaveBeenCalledWith({ clientId: 'svc', brokers: ['b:9092'] });
    expect(producer.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'custom', messages: [expect.objectContaining({ headers: { a: '1', b: 'hook' } })] }),
    );
  });

  it('connects once across sends and disconnects on close', async () => {
    const { producer, mod } = fakeKafka();
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b'] }, async () => mod);
    await transport.send(request);
    await transport.send(request);
    await transport.close();
    expect(producer.connect).toHaveBeenCalledTimes(1);
    expect(producer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('close before any send does not load or connect', async () => {
    const loader = vi.fn();
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b'] }, loader as never);
    await transport.close();
    expect(loader).not.toHaveBeenCalled();
  });

  it('maps a broker send failure to TRANSPORT with cause', async () => {
    const cause = new Error('broker down');
    const { mod } = fakeKafka({ send: async () => Promise.reject(cause) });
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b'] }, async () => mod);
    const error = await failure(transport.send(request));
    expect(error).toMatchObject({ code: 'TRANSPORT', transport: 'kafka', cause });
  });

  it('maps a connect failure to TRANSPORT', async () => {
    const { mod } = fakeKafka({ connect: async () => Promise.reject(new Error('refused')) });
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b'] }, async () => mod);
    expect(await failure(transport.send(request))).toMatchObject({ code: 'TRANSPORT', transport: 'kafka' });
  });

  it('maps a missing kafkajs module to CONFIG lazily (not at construction)', async () => {
    const loader = async () => {
      throw Object.assign(new Error("Cannot find module 'kafkajs'"), { code: 'ERR_MODULE_NOT_FOUND' });
    };
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b'] }, loader);
    const error = await failure(transport.send(request));
    expect(error).toMatchObject({ code: 'CONFIG', transport: 'kafka' });
    expect(error.message).toContain('kafkajs');
  });

  it('includes deliveryMode in the published message value when supplied', async () => {
    const { producer, mod } = fakeKafka();
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b:9092'] }, async () => mod);
    const withMode: NotificationRequest = { ...request, deliveryMode: 'RECORD_ONLY' };

    await transport.send(withMode);

    expect(producer.send).toHaveBeenCalledWith({
      topic: 'beacon-api.notification-requests',
      messages: [{ key: 'k-1', value: JSON.stringify(withMode), headers: {} }],
    });
  });

  it('omits deliveryMode from the published message value when not supplied', async () => {
    const { producer, mod } = fakeKafka();
    const transport = new KafkaTransport({ transport: 'kafka', brokers: ['b:9092'] }, async () => mod);

    await transport.send(request);

    expect(producer.send).toHaveBeenCalledWith({
      topic: 'beacon-api.notification-requests',
      messages: [{ key: 'k-1', value: JSON.stringify(request), headers: {} }],
    });
  });
});
