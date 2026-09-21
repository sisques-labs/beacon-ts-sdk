import type { BeaconConfig } from '../../core/config/beacon-config.types';
import { BeaconError } from '../../core/errors/beacon-error';
import { SUPPORTED_CONTRACT } from '../../core/contract/supported-contract';
import type { NotifyResult } from '../../core/notification/notify-result.types';
import type { NotificationRequest } from '../../core/notification/request.types';
import type { Transport } from '../../core/ports/transport.port';
import { HttpSender } from '../http/http-sender';

type RestConfig = Extract<BeaconConfig, { transport: 'rest' }>;

/** `POST {baseUrl}/api/v1/notifications` -> `201 {id}`. */
export class RestTransport implements Transport {
  private readonly sender: HttpSender;
  private readonly url: string;

  constructor(config: RestConfig) {
    this.sender = new HttpSender({ ...config, transport: 'rest' });
    this.url = `${config.baseUrl.replace(/\/+$/, '')}${SUPPORTED_CONTRACT.rest.path}`;
  }

  async send(request: NotificationRequest): Promise<NotifyResult> {
    const body = await this.sender.postJson(this.url, request);
    const id = (body as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') {
      throw new BeaconError({
        code: 'TRANSPORT',
        message: 'Beacon API response is missing the notification id',
        transport: 'rest',
      });
    }
    return { accepted: true, transport: 'rest', dedupeKey: request.dedupeKey, id };
  }

  async close(): Promise<void> {}
}
