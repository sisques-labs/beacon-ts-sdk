export { SUPPORTED_CONTRACT } from './core/contract/supported-contract';
export { BeaconError } from './core/errors/beacon-error';
export type { BeaconErrorCode, BeaconErrorInit } from './core/errors/beacon-error';
export type { BeaconTransportKind, NotifyResult } from './core/notification/notify-result.types';
export { validateNotificationRequest } from './core/notification/request.schema';
export type { NotificationRequest } from './core/notification/request.types';
export type { Transport } from './core/ports/transport.port';
