import { describe, expect, it } from 'vitest';
import { BeaconClient, BeaconError, SUPPORTED_CONTRACT } from './index';

describe('package entry point', () => {
  it('exports the public core API', () => {
    expect(typeof BeaconClient).toBe('function');
    expect(typeof BeaconError.is).toBe('function');
    expect(SUPPORTED_CONTRACT.kafka.defaultTopic).toBe('beacon-api.notification-requests');
  });

  it('does not expose read/poll methods on the client', () => {
    expect('getNotification' in BeaconClient.prototype).toBe(false);
    expect('waitForDelivery' in BeaconClient.prototype).toBe(false);
  });

  it('advertises the supported delivery modes', () => {
    expect(SUPPORTED_CONTRACT.deliveryModes).toEqual(['DELIVER', 'RECORD_ONLY']);
  });
});
