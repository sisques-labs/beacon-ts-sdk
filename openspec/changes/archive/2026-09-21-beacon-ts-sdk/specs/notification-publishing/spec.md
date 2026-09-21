# Delta for notification-publishing

## ADDED Requirements

### Requirement: Single publishing method

`BeaconClient` MUST expose `notify(request)` as its only publishing method in v1. `getNotification` and `waitForDelivery` MUST NOT be part of the public API.

#### Scenario: Public surface
- GIVEN the package entry point `.`
- WHEN a consumer inspects `BeaconClient`
- THEN `notify` is available and no read/poll method exists

### Requirement: Channel restricted to DISCORD

The `channel` field of `NotificationRequest` MUST be typed so that only `'DISCORD'` compiles. At runtime, any other value MUST be rejected before transmission.

#### Scenario: Valid channel
- GIVEN a request with `channel: 'DISCORD'` and otherwise valid fields
- WHEN `notify()` is called
- THEN validation passes and the request is handed to the transport

#### Scenario: Unsupported channel at runtime
- GIVEN a request with `channel: 'EMAIL'` (bypassing types)
- WHEN `notify()` is called
- THEN it rejects with a `BeaconError` of validation kind
- AND no transport call is made

### Requirement: Client-side payload validation

`notify()` MUST validate the request before any transmission. Identifier fields MUST be valid UUIDs. Required string fields MUST be non-empty (whitespace-only counts as empty). Unknown or missing required fields MUST be rejected. The `BeaconError` MUST identify the offending field(s).

#### Scenario: Malformed UUID
- GIVEN a request whose identifier field is `"not-a-uuid"`
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` naming that field
- AND the transport is never invoked

#### Scenario: Empty string
- GIVEN a request whose required string field is `""`
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` naming that field

#### Scenario: Missing required field
- GIVEN a request omitting a required field
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` before transmission

### Requirement: dedupeKey for idempotency

The request MUST carry a `dedupeKey` that is a non-empty string, and it MUST be forwarded unchanged to every transport. The SDK MUST NOT generate or mutate it.

#### Scenario: dedupeKey forwarded
- GIVEN a valid request with `dedupeKey: "order-42-shipped"`
- WHEN `notify()` is called on any transport
- THEN the transmitted payload contains `dedupeKey: "order-42-shipped"` unchanged

#### Scenario: dedupeKey missing or empty
- GIVEN a request with no `dedupeKey` or `dedupeKey: ""`
- WHEN `notify()` is called
- THEN it rejects with a validation `BeaconError` naming `dedupeKey`

### Requirement: Accepted, not delivered

A resolved `notify()` MUST mean the request was accepted by the transport, not that the notification was delivered. Documentation and types MUST NOT imply delivery confirmation.

#### Scenario: Successful acceptance
- GIVEN a valid request and a reachable beacon-api
- WHEN `notify()` resolves
- THEN it signals acceptance only, with no delivery status

### Requirement: Normalized BeaconError

All failures from `notify()` MUST surface as a single `BeaconError` type carrying a normalized `code`, a human-readable `message`, and the originating transport. Transport-specific errors MUST NOT leak as raw exceptions.

Mapping rules:
- REST: a non-2xx body of shape `{statusCode, message, error}` maps `statusCode` to the HTTP status, `message` to message, `error` to the code/reason.
- GraphQL: an `errors[]` entry with `extensions.code` maps that value to the `BeaconError` code.
- Network/connection failures map to a distinct network kind on all transports.

#### Scenario: REST error body
- GIVEN the REST transport and a response `400 {statusCode:400, message:"bad", error:"Bad Request"}`
- WHEN `notify()` is called
- THEN it rejects with a `BeaconError` with status 400, message `"bad"`, reason `"Bad Request"`, transport `rest`

#### Scenario: GraphQL error code
- GIVEN the GraphQL transport and a response with `errors:[{message:"x", extensions:{code:"BAD_USER_INPUT"}}]`
- WHEN `notify()` is called
- THEN it rejects with a `BeaconError` with code `BAD_USER_INPUT`, transport `graphql`

#### Scenario: Network failure
- GIVEN any transport and an unreachable endpoint or broker
- WHEN `notify()` is called
- THEN it rejects with a `BeaconError` of network kind, with the original error attached as `cause`

#### Scenario: Unparseable error body
- GIVEN a REST 502 with a non-JSON body
- WHEN `notify()` is called
- THEN it still rejects with a `BeaconError` carrying status 502 and a fallback message

### Requirement: Framework-agnostic core

The core (client, types, validation, errors) MUST NOT import any framework or optional-peer package.

#### Scenario: Core import without peers
- GIVEN an environment with neither `kafkajs`, a GraphQL client, nor `@nestjs/*` installed
- WHEN a consumer imports `.` and uses the REST transport
- THEN the import and `notify()` work without errors
