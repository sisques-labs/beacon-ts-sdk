# Beacon SDK

TypeScript SDK for publishing notification requests to [Beacon](https://github.com/sisques-labs/beacon-api), Sisques Labs' platform notification service.

> **Status: 0.x (pre-1.0).** The API may still change in minor releases until the first green end-to-end run against a real Beacon. The package is not published yet.

One typed client, three interchangeable transports: **REST**, **GraphQL** and **Kafka**. Requests are validated client-side (strict schema) before anything is sent.

## Install

```sh
pnpm add @sisques-labs/beacon-sdk
# only if you use the Kafka transport:
pnpm add kafkajs
# only if you use the NestJS module (already present in any Nest app):
pnpm add @nestjs/common
```

Requires Node >= 20.11. `kafkajs` and `@nestjs/common` are optional peer dependencies: REST/GraphQL users never load either.

## Usage

```ts
import { BeaconClient } from '@sisques-labs/beacon-sdk';

const beacon = new BeaconClient({ transport: 'rest', baseUrl: 'https://beacon.example.com' });

const result = await beacon.notify({
  tenantId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  recipientUserId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  channel: 'DISCORD',
  title: 'Deploy completed',
  body: 'Gardenia finished deploying v1.4.2',
  sourceService: 'gardenia',
  dedupeKey: 'gardenia-deploy-1.4.2',
});

await beacon.close();
```

The request never carries a destination address: Beacon resolves the Discord destination from its own server-side config.

### Transports

```ts
// REST: POST {baseUrl}/api/v1/notifications
{ transport: 'rest', baseUrl: 'https://beacon.example.com' }

// GraphQL: `notificationCreate` mutation over HTTP
{ transport: 'graphql', endpoint: 'https://beacon.example.com/graphql' }

// Kafka: publishes to the ingestion topic (default `beacon-api.notification-requests`)
{ transport: 'kafka', brokers: ['localhost:9092'], topic: 'custom-topic', clientId: 'my-app' }
```

Shared options: `headers` (static), `getHeaders()` (resolved per request, overrides `headers`), `timeoutMs` and `fetch` (HTTP transports).

### Accepted, not delivered

A resolved `notify()` means the transport **accepted** the request. It does **not** mean the notification was delivered: Beacon persists and delivers asynchronously. `dedupeKey` is passed through unchanged so Beacon can deduplicate replays.

- REST/GraphQL resolve with the server-assigned `id`.
- Kafka resolves once the broker acknowledges the message and has **no `id`**.

### Kafka silent-drop limit

Kafka gives the producer no response from Beacon. If Beacon later rejects a message (for example, it fails Beacon's own consumer-side validation), the SDK cannot observe it: the message is dropped silently. The SDK validates requests before sending to reduce this risk, but if you need to observe rejections, use REST or GraphQL.

### Errors

Every failure is a `BeaconError` with `code` (`VALIDATION`, `CONFIG`, `TRANSPORT`, `HTTP`, `TIMEOUT`), `message`, `transport`, and optional `status`, `reason` and `cause`. Use `BeaconError.is(error)` instead of `instanceof` (it survives duplicated ESM/CJS module graphs).

## NestJS

```ts
import { BeaconModule } from '@sisques-labs/beacon-sdk/nestjs';

@Module({
  imports: [
    BeaconModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ transport: 'rest', baseUrl: config.getOrThrow('BEACON_URL') }),
    }),
  ],
})
export class AppModule {}
```

The module is global: inject `BeaconClient` anywhere. The resolved config is available under the `BEACON_CONFIG` token. The client is closed on application shutdown, and invalid config fails bootstrap with a `BeaconError`. The Nest layer only registers; all logic lives in the framework-agnostic core.

## Compatibility with beacon-api

Beacon publishes no versioned ingest contract, so the SDK states the shape it targets through the exported `SUPPORTED_CONTRACT` constant. A breaking change to that shape is a **major** SDK bump.

| `SUPPORTED_CONTRACT` field | Value |
| --- | --- |
| `rest.path` | `/api/v1/notifications` |
| `graphql.mutation` | `notificationCreate` |
| `kafka.defaultTopic` | `beacon-api.notification-requests` |
| `channels` | `DISCORD` |
| `limits.title` | 200 |
| `limits.body` | 5000 |
| `limits.sourceService` | 100 |
| `limits.dedupeKey` | 255 |

While the SDK is `0.x`, treat minor versions as potentially breaking.

## Testing

```sh
pnpm test          # unit + contract fixtures (Tier A)
pnpm build         # ESM + CJS + types
```

Opt-in live smoke tests (Tier B) run against a real Beacon and are skipped by default:

```sh
BEACON_BASE_URL=http://localhost:3000 pnpm vitest run test/e2e   # REST + GraphQL (GraphQL at /graphql, or BEACON_GRAPHQL_URL)
KAFKA_BROKERS=localhost:9092 pnpm vitest run test/e2e            # Kafka
```

Optionally set `BEACON_TENANT_ID` and `BEACON_RECIPIENT_ID` to real UUIDs.

## Relationship to other repos

- [`beacon-api`](https://github.com/sisques-labs/beacon-api) — the service this SDK talks to.
- [`nestjs-kit`](https://github.com/sisques-labs/nestjs-kit) — shared NestJS building blocks used by `beacon-api` and other Sisques Labs services.
