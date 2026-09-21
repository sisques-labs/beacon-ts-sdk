import type { BeaconConfig } from '../../core/config/beacon-config.types';
import { BeaconError } from '../../core/errors/beacon-error';
import { SUPPORTED_CONTRACT } from '../../core/contract/supported-contract';
import type { NotifyResult } from '../../core/notification/notify-result.types';
import type { NotificationRequest } from '../../core/notification/request.types';
import type { Transport } from '../../core/ports/transport.port';

type KafkaConfig = Extract<BeaconConfig, { transport: 'kafka' }>;

/** Minimal structural view of the kafkajs surface used here (keeps kafkajs types out of the public API). */
interface KafkaProducer {
  connect(): Promise<void>;
  send(record: { topic: string; messages: { key: string; value: string; headers: Record<string, string> }[] }): Promise<unknown>;
  disconnect(): Promise<void>;
}
export interface KafkaModule {
  Kafka: new (config: { clientId: string; brokers: string[] }) => { producer(): KafkaProducer };
}
export type KafkaLoader = () => Promise<KafkaModule>;

const defaultLoader: KafkaLoader = () => import('kafkajs') as unknown as Promise<KafkaModule>;

/**
 * Publishes to the beacon-api ingest topic. Fire-and-forget: the broker ack is
 * the only signal, and beacon-api drops invalid events silently.
 */
export class KafkaTransport implements Transport {
  private producer?: Promise<KafkaProducer>;

  constructor(
    private readonly config: KafkaConfig,
    private readonly load: KafkaLoader = defaultLoader,
  ) {}

  async send(request: NotificationRequest): Promise<NotifyResult> {
    const producer = await this.connect();
    const headers = await this.resolveHeaders();
    try {
      await producer.send({
        topic: this.config.topic ?? SUPPORTED_CONTRACT.kafka.defaultTopic,
        messages: [{ key: request.dedupeKey, value: JSON.stringify(request), headers }],
      });
    } catch (error) {
      throw transportError(error);
    }
    return { accepted: true, transport: 'kafka', dedupeKey: request.dedupeKey };
  }

  async close(): Promise<void> {
    if (!this.producer) return;
    const pending = this.producer;
    this.producer = undefined;
    try {
      await (await pending).disconnect();
    } catch {
      // best effort on shutdown
    }
  }

  private connect(): Promise<KafkaProducer> {
    this.producer ??= this.createProducer().catch((error) => {
      this.producer = undefined;
      throw error;
    });
    return this.producer;
  }

  private async createProducer(): Promise<KafkaProducer> {
    let mod: KafkaModule;
    try {
      mod = await this.load();
    } catch (error) {
      throw new BeaconError({
        code: 'CONFIG',
        message: "The kafka transport requires the optional peer dependency 'kafkajs'. Install it with: npm install kafkajs",
        transport: 'kafka',
        cause: error,
      });
    }
    const producer = new mod.Kafka({ clientId: this.config.clientId ?? 'beacon-sdk', brokers: this.config.brokers }).producer();
    try {
      await producer.connect();
    } catch (error) {
      throw transportError(error);
    }
    return producer;
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    try {
      return { ...this.config.headers, ...(await this.config.getHeaders?.()) };
    } catch (error) {
      throw new BeaconError({ code: 'CONFIG', message: 'getHeaders hook threw', transport: 'kafka', cause: error });
    }
  }
}

const transportError = (error: unknown) =>
  new BeaconError({
    code: 'TRANSPORT',
    message: error instanceof Error ? error.message : 'Kafka failure',
    transport: 'kafka',
    cause: error,
  });
