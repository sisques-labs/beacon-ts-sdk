import type { NotificationRequest } from '../notification/request.types';
import type { NotifyResult } from '../notification/notify-result.types';

/** Delivery port. Adapters normalize every failure into a `BeaconError`. */
export interface Transport {
  send(request: NotificationRequest): Promise<NotifyResult>;
  close(): Promise<void>;
}
