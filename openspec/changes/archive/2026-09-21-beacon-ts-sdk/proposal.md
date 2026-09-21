# Proposal: Beacon TypeScript SDK v1

## Intent

Producers re-derive Beacon's notification contract by hand (topic, broker wiring, payload shape). Nothing catches drift or a typo until an event silently fails. Ship `@sisques-labs/beacon-sdk`: one typed, versioned client, so producers call `notify()` instead.

## Scope

### In Scope
- Framework-agnostic `BeaconClient` with one method: `notify(request)`.
- `Transport` port + three adapters: REST (`POST /api/v1/notifications`), Kafka (configurable topic, default `beacon-api.notification-requests`), GraphQL (`notificationCreate`).
- Client-side transport selection as the "channel configuration" surface.
- Optional headers/auth hook from day one.
- Thin NestJS layer: `BeaconModule.forRootAsync(...)`, global, injectable client.
- `channel` typed so only `'DISCORD'` compiles today.
- Single npm package, subpath exports (`.`, `./nestjs`).

### Out of Scope (non-goals)
- Per-notification Discord webhook/destination — beacon-api ignores destination deliberately (SSRF on unauthenticated ingest); webhook comes from server env `DISCORD_WEBHOOK_URL`.
- `getNotification` / `waitForDelivery` (future work).
- Templates, recipient management, server-side channel config (no such API).
- JSON Schema for non-Node producers.
- `@sisques-labs/nestjs-kit` messaging — `kafkajs` is used directly.

## Capabilities

### New Capabilities
- `notification-publishing`: `notify()` contract, payload validation, `dedupeKey` idempotency, normalized errors.
- `transport-selection`: `Transport` port, REST/Kafka/GraphQL adapters, config and auth-hook resolution.
- `nestjs-integration`: `BeaconModule.forRootAsync`, global registration, `BeaconClient` injection.

### Modified Capabilities
- None (`openspec/specs/` is empty).

## Approach

Hexagonal. A core with zero framework imports owns validation and the request model; a `Transport` port abstracts delivery; three thin adapters implement it and normalize errors into one SDK error type. `kafkajs` and the GraphQL client are optional peers, so REST users install nothing extra. The NestJS module is registration only.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/core/` | New | Client, types, validation, errors |
| `src/transport/` | New | Port + 3 adapters |
| `src/nestjs/` | New | Module, provider tokens |
| `package.json`, build | New | Subpath exports, optional peers |
| `README.md` | Modified | States Kafka-only scope today |

**Public API surface**: `BeaconClient`, `notify()`, `BeaconConfig`, `NotificationRequest`, `BeaconError`, `BeaconModule`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Contract drift — no committed OpenAPI/GraphQL schema | High | Hand-written types + contract tests; codegen deferred |
| Kafka silently drops malformed events | High | Validate client-side before publish; document the limit |
| At-least-once async delivery, no delivery ack | Med | Require `dedupeKey`; `notify()` returns accepted, not delivered |
| API unauthenticated; auth expected later | Med | Auth hook in v1 makes auth a config change, not a break |
| README premise (Kafka-only) stale | High | README update in scope |
| Three transports triple surface area | Med | One shared port, thin adapters |

## Rollback Plan

Greenfield, no consumers: `npm deprecate` plus revert of the change branch. A broken adapter can be dropped from exports in a patch without touching core or the other two.

## Dependencies

- `beacon-api` ingest contract (unversioned source of truth).
- `kafkajs`, GraphQL client (optional peers).
- Deferred to design: Node baseline, `zod`, `tsup`, Vitest.

## Review Workload Forecast (rough)

400-line budget risk: High. ~4 slices: core + types; REST; Kafka + GraphQL; NestJS + packaging. `sdd-tasks` owns the binding forecast.

## Success Criteria

- [ ] `notify()` succeeds against beacon-api over all three transports.
- [ ] NestJS app injects `BeaconClient` after one `forRootAsync`.
- [ ] REST-only consumers install no Kafka/GraphQL dependency.
- [ ] Invalid payloads and non-`DISCORD` channels fail before transmission.
- [ ] Publishes to npm with working `.` and `./nestjs` subpaths.
