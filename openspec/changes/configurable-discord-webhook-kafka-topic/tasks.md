# Tasks: deliveryMode on NotificationRequest (SDK side)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150-200 (source ~10, README ~15, tests ~130-170) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Ship `deliveryMode` end-to-end (types, schema, contract, tests, docs) | PR 1 (single) | `pnpm vitest run` | N/A — pure unit tests, no external service | Revert one commit; field is additive/optional, no stored-data shape change |

## Phase 1: RED — Failing tests first

- [x] 1.1 `src/core/notification/request.schema.spec.ts`: add test — `deliveryMode: 'DELIVER'` is accepted (`safeParse(...).success === true`).
- [x] 1.2 `src/core/notification/request.schema.spec.ts`: add test — `deliveryMode: 'RECORD_ONLY'` is accepted.
- [x] 1.3 `src/core/notification/request.schema.spec.ts`: add test — `deliveryMode: 'SOMETHING_ELSE'` is rejected via `validateNotificationRequest`, asserting the thrown `BeaconError.fields` equals `['deliveryMode']`.
- [x] 1.4 `src/core/notification/request.schema.spec.ts`: add test — omitting `deliveryMode` parses successfully and `'deliveryMode' in result.data === false`, asserted directly on the parsed object (not via `JSON.stringify`, which drops `undefined` and would mask a schema bug).
- [x] 1.5 `src/core/notification/request.schema.spec.ts`: add test pinning schema tokens against `SUPPORTED_CONTRACT.deliveryModes` (equality check) to prevent drift between the two lists.
- [x] 1.6 `src/transports/rest/rest.transport.spec.ts`: add tests — POST body JSON contains `deliveryMode: 'RECORD_ONLY'` when supplied; contains no `deliveryMode` key when omitted.
- [x] 1.7 `src/transports/graphql/graphql.transport.spec.ts`: add tests — `variables.input.deliveryMode` present when supplied, absent when omitted.
- [x] 1.8 `src/transports/kafka/kafka.transport.spec.ts`: add tests — parsed `messages[0].value` carries `deliveryMode` when supplied, absent when omitted.
- [x] 1.9 `src/index.spec.ts`: add test — `SUPPORTED_CONTRACT.deliveryModes` equals `['DELIVER', 'RECORD_ONLY']`.
- [x] 1.10 Run `pnpm vitest run`; confirm every new test in 1.1-1.9 fails RED (schema rejects `deliveryMode` as an unrecognized key; contract test fails on missing key).

## Phase 2: GREEN — Minimal implementation

- [x] 2.1 `src/core/notification/request.types.ts`: add `export type NotificationDeliveryMode = 'DELIVER' | 'RECORD_ONLY';` and optional `deliveryMode?: NotificationDeliveryMode;` on `NotificationRequest`, with a doc comment noting the SDK forwards but never interprets it.
- [x] 2.2 `src/core/notification/request.schema.ts`: add `deliveryMode: z.enum(['DELIVER', 'RECORD_ONLY']).optional(),` after `dedupeKey` inside `notificationRequestSchema`.
- [x] 2.3 `src/core/contract/supported-contract.ts`: add `deliveryModes: ['DELIVER', 'RECORD_ONLY'],` after `channels`.
- [x] 2.4 `src/index.ts`: extend the existing `export type { NotificationRequest }` line to also export `NotificationDeliveryMode`.
- [x] 2.5 Run `pnpm vitest run`; confirm every test from Phase 1 now passes GREEN with zero edits under `src/transports/**`.

## Phase 3: Docs

- [x] 3.1 `README.md`: add a `deliveryModes` row to the `SUPPORTED_CONTRACT` table (~line 101).
- [x] 3.2 `README.md`: add a short usage snippet showing `deliveryMode: 'RECORD_ONLY'` on a `notify()` call, noting it is forwarded unchanged and never interpreted by the SDK.

## Phase 4: Verification

- [x] 4.1 Run `pnpm typecheck`; confirm no errors.
- [x] 4.2 Run `pnpm vitest run` (full suite); confirm no regressions and that the pre-change payload shape stays byte-identical when `deliveryMode` is omitted.
