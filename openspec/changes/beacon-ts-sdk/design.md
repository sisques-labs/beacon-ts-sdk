# Design: Beacon TypeScript SDK v1

## Technical Approach

Hexagonal. `src/core/` owns the request model, zod validation and `BeaconError`, and depends only on a `Transport` port. `src/transports/` holds three adapters; REST and GraphQL share one `HttpSender` (headers hook, timeout, error normalization). `src/nestjs/` is registration only. Covers specs `notification-publishing`, `transport-selection`, `nestjs-integration`.

Verified against beacon-api: `POST /api/v1/notifications` → `201 {id}`; `notificationCreate(input)` → `MutationResponseDto`; Kafka topic default `beacon-api.notification-requests`, JSON value, fire-and-forget. Limits mirrored client-side: `tenantId`/`recipientUserId` UUID, `title` ≤200, `body` ≤5000, `sourceService` ≤100, `dedupeKey` ≤255, all non-empty, `channel` `'DISCORD'` only.

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Node baseline | `engines: node >=20.11`, target ES2022, ESM-first | Node 18 | Node 18 is EOL; global `fetch` is stable from 20, so REST/GraphQL need zero HTTP deps. |
| D2 | Validation | `zod` as a regular dependency; `.strict()` so unknown keys throw | hand-rolled guards; `class-validator` | Kafka ingest **silently drops** invalid events, so client-side validation is the only feedback loop. `.strict()` catches the field typo the README names. class-validator needs decorators + `reflect-metadata`. |
| D3 | GraphQL client | None — POST `{query, variables}` through the shared `HttpSender` | `graphql-request`, Apollo | One fixed mutation. Avoids a second optional peer and keeps "REST-only installs nothing extra" true for GraphQL too. |
| D4 | Kafka dependency | `kafkajs` optional peer, loaded via `await import('kafkajs')` inside `connect()` | static import; `nestjs-kit` messaging | Static import makes bundlers resolve it for REST users. Missing module → `BeaconError{code:'CONFIG'}` with install hint. |
| D5 | Build | `tsup` dual ESM+CJS, `dts`, two entries (`.`, `./nestjs`) | tsc ESM-only; rollup | NestJS consumers are CJS today; dual output avoids forcing a migration. |
| D6 | Error model | One `BeaconError` class with discriminant `code`, plus `BeaconError.is()` brand check | subclass hierarchy | `instanceof` is unreliable across dual ESM/CJS graphs; a discriminant survives duplication. |
| D7 | Versioning vs beacon-api | SDK MAJOR on ingest-contract breaks; exported `SUPPORTED_CONTRACT` + README compatibility table | date/version lockstep | beacon-api publishes no versioned contract; the SDK must state which shape it targets. |
| D8 | Contract tests | Tier A: golden payload fixtures asserted against mirrored beacon-api constraints (CI). Tier B: live smoke, opt-in via `BEACON_BASE_URL`/`KAFKA_BROKERS`. | codegen | `autoSchemaFile: true` and no committed OpenAPI mean nothing to generate from. Swap Tier A for codegen when beacon-api commits `schema.gql`. |
| D9 | Test runner | Vitest + v8 coverage; adapters take an injected `fetch` | Jest; msw | Injection removes the HTTP-mocking dependency entirely and keeps adapters pure. |

## Data Flow

    notify(req) → validate (zod) → Transport.send(req)
                     │                    │
                  BeaconError      ┌──────┼──────┐
                  (VALIDATION)    REST  GraphQL Kafka
                                    └──┬──┘       │
                                  HttpSender   producer.send
                                  (+getHeaders, timeout)
                                       └──→ NotifyResult | BeaconError

## File Changes

| File | Action | Description |
|---|---|---|
| `src/core/beacon-client.ts` | Create | `notify()`, `close()`; validation then delegation |
| `src/core/notification/{request.types,request.schema,notify-result.types}.ts` | Create | Public request/result types + zod schema |
| `src/core/errors/beacon-error.ts` | Create | `BeaconError`, `BeaconErrorCode` |
| `src/core/config/beacon-config.types.ts` | Create | Discriminated union config + auth hook |
| `src/core/ports/transport.port.ts` | Create | `Transport` port |
| `src/core/contract/supported-contract.ts` | Create | `SUPPORTED_CONTRACT` constants (topic, paths, limits) |
| `src/transports/http/http-sender.ts` | Create | fetch, headers hook, timeout, error mapping |
| `src/transports/{rest,graphql,kafka}/*.transport.ts` | Create | Three adapters |
| `src/transports/create-transport.ts` | Create | Config → adapter factory |
| `src/nestjs/{beacon.module,beacon.tokens,beacon.options}.ts` | Create | Global module, `forRootAsync`, shutdown hook |
| `src/index.ts`, `src/nestjs/index.ts` | Create | Subpath barrels |
| `package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts` | Create | Exports map, optional peers, build, tests |
| `openspec/config.yaml` | Modify | `strict_tdd: true`, `testing.runner: vitest` after scaffold |
| `README.md` | Modify | Three transports, not Kafka-only |

## Interfaces / Contracts

```ts
type BeaconConfig = { getHeaders?(): HeadersInit | Promise<HeadersInit>; timeoutMs?: number; fetch?: typeof fetch } & (
  | { transport: 'rest'; baseUrl: string }
  | { transport: 'graphql'; endpoint: string }
  | { transport: 'kafka'; brokers: string[]; topic?: string; clientId?: string });

interface NotificationRequest { tenantId: string; recipientUserId: string; channel: 'DISCORD';
  title: string; body: string; sourceService: string; dedupeKey: string } // no destination — by design

interface NotifyResult { accepted: true; transport: BeaconTransportKind; dedupeKey: string; id?: string } // id absent on Kafka
interface Transport { send(r: NotificationRequest): Promise<NotifyResult>; close(): Promise<void> }
type BeaconErrorCode = 'VALIDATION' | 'CONFIG' | 'TRANSPORT' | 'HTTP' | 'TIMEOUT';
```

`BeaconModule.forRootAsync({ imports?, inject?, useFactory })` → `@Global()`, provides `BeaconClient` (inject by class) and `BEACON_CONFIG`; `onApplicationShutdown` calls `close()`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | zod rules (UUID, lengths, non-`DISCORD`, unknown key), `BeaconError` mapping, transport factory, lazy kafkajs failure | Vitest, injected `fetch`, fake producer |
| Contract | Payload/paths/topic match beacon-api DTOs; HTTP 4xx/5xx and GraphQL `extensions.code` → `BeaconError` | Golden fixtures (Tier A, CI) |
| Integration | NestJS `Test.createTestingModule` injects client; shutdown disconnects | `@nestjs/testing` |
| E2E (opt-in) | Real `notify()` per transport; dedupe replay is idempotent | Tier B, env-gated, skipped in CI |

Strict TDD turns on right after the scaffold work unit lands (runner + one passing test), not before.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process integration. Destination remains server-side (`DISCORD_WEBHOOK_URL`); the SDK never accepts a per-notification address, and `baseUrl`/`brokers` are operator config, not caller data.

## Migration / Rollout

No migration — greenfield, no consumers. Ship `0.x` until one producer app validates all three transports, then `1.0.0`.

## Open Questions

- [ ] Publish `0.x` first or go straight to `1.0.0` on first green E2E?
- [ ] Retry/backoff for REST 5xx in v1, or leave it to the caller? (current design: caller)
