# Delta for transport-selection

## ADDED Requirements

### Requirement: Transport port

The SDK MUST define a `Transport` port that adapters implement, and `BeaconClient` MUST depend only on that port for delivery. Transport selection via `BeaconConfig` is the sole "channel configuration" surface; per-notification destinations (e.g. a Discord webhook) MUST NOT be accepted.

#### Scenario: Transport chosen by config
- GIVEN a `BeaconConfig` selecting transport `rest`
- WHEN a client is created and `notify()` is called
- THEN only the REST adapter is used

#### Scenario: Webhook/destination not accepted
- GIVEN a request containing a webhook or destination field
- WHEN `notify()` is called
- THEN validation rejects it as an unknown field and nothing is transmitted

### Requirement: Explicit transport selection

`BeaconConfig` MUST require an explicit transport choice (`rest`, `kafka`, or `graphql`) with its transport-specific options. A missing or unknown transport MUST fail at client creation.

#### Scenario: Missing transport
- GIVEN a `BeaconConfig` with no transport
- WHEN a client is created
- THEN creation fails with a configuration `BeaconError`

#### Scenario: Unknown transport
- GIVEN `transport: 'smtp'` (bypassing types)
- WHEN a client is created
- THEN creation fails with a configuration `BeaconError`

### Requirement: REST adapter

The REST adapter MUST send `POST {baseUrl}/api/v1/notifications` with a JSON body of the validated request and `Content-Type: application/json`.

#### Scenario: REST publish
- GIVEN REST config with `baseUrl: "https://beacon.example"`
- WHEN `notify()` is called with a valid request
- THEN one POST to `https://beacon.example/api/v1/notifications` is made with the request as JSON

#### Scenario: Trailing slash in baseUrl
- GIVEN `baseUrl: "https://beacon.example/"`
- WHEN `notify()` is called
- THEN the request URL contains no double slash

### Requirement: Kafka adapter with configurable topic

The Kafka adapter MUST publish the validated request to a topic that defaults to `beacon-api.notification-requests` and MUST be overridable via config. It MUST use `kafkajs` directly.

#### Scenario: Default topic
- GIVEN Kafka config with brokers and no topic
- WHEN `notify()` is called
- THEN the message is produced to `beacon-api.notification-requests`

#### Scenario: Custom topic
- GIVEN Kafka config with `topic: "custom.topic"`
- WHEN `notify()` is called
- THEN the message is produced to `custom.topic`

#### Scenario: Broker failure
- GIVEN the producer send fails
- WHEN `notify()` is called
- THEN it rejects with a network-kind `BeaconError`

### Requirement: Kafka silent-drop mitigation

Because beacon-api silently drops malformed Kafka events, the Kafka adapter MUST only publish requests that passed client-side validation, and package documentation MUST state that Kafka gives no server-side rejection feedback and that resolution means broker acknowledgement only.

#### Scenario: Invalid payload never published
- GIVEN Kafka transport and an invalid request
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` and no message is produced

#### Scenario: Limit documented
- GIVEN the package README/docs
- WHEN a reader looks up the Kafka transport
- THEN the silent-drop limitation and accepted-not-delivered semantics are stated

### Requirement: GraphQL adapter

The GraphQL adapter MUST invoke the `notificationCreate` mutation at the configured endpoint with the validated request as input, using the optional-peer GraphQL client.

#### Scenario: GraphQL publish
- GIVEN GraphQL config with an endpoint
- WHEN `notify()` is called with a valid request
- THEN a `notificationCreate` mutation is sent with the request as input

### Requirement: Optional peer dependencies

`kafkajs` and the GraphQL client MUST be declared as optional peer dependencies. Selecting a transport whose peer is not installed MUST fail at client creation with a clear configuration `BeaconError` naming the missing package. REST MUST require no extra install.

#### Scenario: REST-only install
- GIVEN an app with neither `kafkajs` nor a GraphQL client installed
- WHEN it uses the REST transport
- THEN it installs and runs without warnings or errors about missing peers

#### Scenario: Missing kafkajs
- GIVEN `kafkajs` is not installed and Kafka is selected
- WHEN a client is created
- THEN creation fails with a configuration `BeaconError` naming `kafkajs`

#### Scenario: Peers loaded lazily
- GIVEN REST is selected and `kafkajs` is absent
- WHEN the package is imported
- THEN no attempt to load `kafkajs` occurs

### Requirement: Optional headers and auth hook

`BeaconConfig` MUST accept optional static headers and an optional (sync or async) auth hook returning headers, resolved per request. For REST and GraphQL they MUST be sent as HTTP headers; when both are provided, hook output MUST override static headers on conflict. For Kafka they MUST map to message headers where supported. Omitting both MUST work (API is currently unauthenticated).

#### Scenario: No headers configured
- GIVEN config without headers or hook
- WHEN `notify()` is called on REST
- THEN the request is sent with no auth header

#### Scenario: Async hook per request
- GIVEN an async hook returning `{Authorization: "Bearer t"}`
- WHEN `notify()` is called twice
- THEN the hook is invoked once per call and each request carries the returned header

#### Scenario: Hook overrides static
- GIVEN static `{X-A: "1"}` and a hook returning `{X-A: "2"}`
- WHEN `notify()` is called
- THEN the request carries `X-A: 2`

#### Scenario: Hook throws
- GIVEN a hook that throws
- WHEN `notify()` is called
- THEN it rejects with a `BeaconError` (auth kind) with the original error as `cause`, and nothing is transmitted
