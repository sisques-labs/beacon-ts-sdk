# Delta for notification-publishing

## ADDED Requirements

### Requirement: Optional delivery mode

`NotificationRequest` and `notificationRequestSchema` MUST accept an optional `deliveryMode` field with exactly two allowed values: `'DELIVER'` and `'RECORD_ONLY'`. Any other value MUST be rejected as a validation error naming `deliveryMode`. Omitting the field MUST leave the serialized payload unchanged; the SDK MUST NOT apply a client-side default for it. The field is informational for SDK consumers only — the SDK MUST NOT interpret or act on its value locally; only beacon-api enforces delivery-mode semantics.

#### Scenario: RECORD_ONLY accepted
- GIVEN a request with `deliveryMode: 'RECORD_ONLY'` and otherwise valid fields
- WHEN `notify()` is called
- THEN validation passes and `deliveryMode` is forwarded unchanged in the transmitted payload

#### Scenario: DELIVER accepted
- GIVEN a request with `deliveryMode: 'DELIVER'`
- WHEN `notify()` is called
- THEN validation passes and `deliveryMode` is forwarded unchanged

#### Scenario: Unknown value rejected
- GIVEN a request with `deliveryMode: 'SOMETHING_ELSE'` (bypassing types)
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` naming `deliveryMode`
- AND no transport call is made

#### Scenario: Omitted field preserved
- GIVEN a request with no `deliveryMode`
- WHEN `notify()` is called
- THEN validation passes and the serialized payload contains no `deliveryMode` key
- AND the payload is otherwise byte-identical to the pre-change shape

### Requirement: Supported delivery modes advertised

`SUPPORTED_CONTRACT` MUST expose a `deliveryModes` entry listing the two allowed tokens, mirroring the existing `channels` entry, for consumers that introspect supported values.

#### Scenario: Contract lists delivery modes
- GIVEN a consumer reads `SUPPORTED_CONTRACT`
- WHEN it inspects `deliveryModes`
- THEN it lists exactly `['DELIVER', 'RECORD_ONLY']`
