# Delta for transport-selection

## MODIFIED Requirements

### Requirement: Transport port

The SDK MUST define a `Transport` port that adapters implement, and `BeaconClient` MUST depend only on that port for delivery. Transport selection via `BeaconConfig` is the sole "channel configuration" surface; per-notification destinations (e.g. a Discord webhook) MUST NOT be accepted. A `deliveryMode` token (`'DELIVER'` | `'RECORD_ONLY'`) is a closed enum value, not a destination, address, or URL, and is exempt from this prohibition; the SDK MUST NOT introduce, now or later, any field carrying a URL, address, or destination regardless of its name.
(Previously: the prohibition covered any per-notification field with no exemption stated.)

#### Scenario: Transport chosen by config
- GIVEN a `BeaconConfig` selecting transport `rest`
- WHEN a client is created and `notify()` is called
- THEN only the REST adapter is used

#### Scenario: Webhook/destination not accepted
- GIVEN a request containing a webhook or destination field
- WHEN `notify()` is called
- THEN validation rejects it as an unknown field and nothing is transmitted

#### Scenario: deliveryMode is not a destination
- GIVEN a request containing `deliveryMode: 'RECORD_ONLY'`
- WHEN `notify()` is called
- THEN validation accepts it as a recognized field, not as a destination
- AND no URL, address, or webhook field exists anywhere in `NotificationRequest`

## ADDED Requirements

### Requirement: deliveryMode pass-through across transports

Each transport adapter (REST, Kafka, GraphQL) MUST serialize `deliveryMode` unchanged as part of the whole validated request object, with no per-field transport logic added for it.

#### Scenario: REST pass-through
- GIVEN REST config and a request with `deliveryMode: 'RECORD_ONLY'`
- WHEN `notify()` is called
- THEN the POST body JSON contains `deliveryMode: 'RECORD_ONLY'` unchanged

#### Scenario: Kafka pass-through
- GIVEN Kafka config and a request with `deliveryMode: 'RECORD_ONLY'`
- WHEN `notify()` is called
- THEN the produced message value contains `deliveryMode: 'RECORD_ONLY'` unchanged

#### Scenario: GraphQL pass-through
- GIVEN GraphQL config and a request with `deliveryMode: 'RECORD_ONLY'`
- WHEN `notify()` is called
- THEN the mutation `variables.input` contains `deliveryMode: 'RECORD_ONLY'` unchanged

#### Scenario: Omitted field stays absent on all transports
- GIVEN a request with no `deliveryMode`
- WHEN `notify()` is called on any transport
- THEN the transmitted payload contains no `deliveryMode` key on REST, Kafka, and GraphQL
