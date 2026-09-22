# Design: deliveryMode on NotificationRequest (SDK side)

## Technical Approach

Three additive edits in `src/core/` plus one barrel export. `BeaconClient.notify()` already validates then hands the **zod output** to `Transport.send()` (`src/core/beacon-client.ts:29-34`), and every adapter serializes that whole object. Widening type + schema + contract therefore delivers both specs with zero transport code.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Union shape | Exported alias `NotificationDeliveryMode = 'DELIVER' \| 'RECORD_ONLY'` in `request.types.ts`, re-exported from `src/index.ts` | Inline literal union | Repo convention: 1-member literal is inline (`channel: 'DISCORD'`), multi-member unions get a named exported alias (`BeaconTransportKind`, `notify-result.types.ts:1`). Alias also lets consumers annotate variables. |
| Schema source of tokens | Literal `z.enum(['DELIVER', 'RECORD_ONLY'])`, tokens duplicated in `SUPPORTED_CONTRACT` | Derive schema from `SUPPORTED_CONTRACT.deliveryModes` | Mirrors the existing split: `channel: z.literal('DISCORD')` is hardcoded even though `channels` exists. Drift is pinned by a test asserting schema tokens == contract tokens. |
| Defaulting | No `.default()`, no `.catch()` | `.default('DELIVER')` | Frozen upstream contract: omitted must stay omitted on the wire; beacon-api owns the default. Matches the `dedupeKey` "forward, never generate" convention. |
| Transport changes | None | Per-transport field mapping | Verified below. |
| SSRF posture | `z.strictObject` unchanged; the new field is a closed 2-token enum | Free-form string, destination field | `transport-selection` carve-out: a mode token is not a destination. Unknown keys (`webhook`, `destination`) keep failing. |

## Transport Verification (no changes required)

| File | Line | Serialization | Per-field mapping? |
|---|---|---|---|
| `src/transports/kafka/kafka.transport.ts` | 41 | `value: JSON.stringify(request)` | No |
| `src/transports/rest/rest.transport.ts` | 22 | `this.sender.postJson(this.url, request)` | No |
| `src/transports/graphql/graphql.transport.ts` | 29 | `variables: { input: request }` | No — whole object, not field-by-field |

`HttpSender.postJson` (`src/transports/http/http-sender.ts`) takes an opaque body. No adapter reads request fields except `request.dedupeKey` for the Kafka message key and the `NotifyResult`.

## File Changes

| File | Action | Change |
|---|---|---|
| `src/core/notification/request.types.ts` | Modify | Add `export type NotificationDeliveryMode = 'DELIVER' \| 'RECORD_ONLY';` and `deliveryMode?: NotificationDeliveryMode;` (doc comment: SDK forwards, never interprets) |
| `src/core/notification/request.schema.ts` | Modify | Add `deliveryMode: z.enum(['DELIVER', 'RECORD_ONLY']).optional(),` after `dedupeKey` inside `z.strictObject` |
| `src/core/contract/supported-contract.ts` | Modify | Add `deliveryModes: ['DELIVER', 'RECORD_ONLY'],` after `channels` |
| `src/index.ts` | Modify | `export type { NotificationDeliveryMode, NotificationRequest } from './core/notification/request.types';` |
| `README.md` | Modify | Usage snippet note + `deliveryModes` row in the `SUPPORTED_CONTRACT` table (line ~101) |
| `src/transports/**` | None | Pass-through verified |

`satisfies z.ZodType<NotificationRequest>` (schema line 23) stays valid: `tsconfig.json` does not set `exactOptionalPropertyTypes`.

## Testing Strategy (strict TDD — RED first)

| File (exists today) | New specs |
|---|---|
| `src/core/notification/request.schema.spec.ts` | `DELIVER` accepted; `RECORD_ONLY` accepted; `'SOMETHING_ELSE'` → `fields === ['deliveryMode']`; omitted → `'deliveryMode' in result === false`; schema tokens == `SUPPORTED_CONTRACT.deliveryModes` |
| `src/transports/rest/rest.transport.spec.ts` | POST body JSON carries `deliveryMode`; absent when omitted |
| `src/transports/graphql/graphql.transport.spec.ts` | `variables.input.deliveryMode` present; absent when omitted |
| `src/transports/kafka/kafka.transport.spec.ts` | `messages[0].value` parsed carries `deliveryMode`; absent when omitted |
| `src/index.spec.ts` | `SUPPORTED_CONTRACT.deliveryModes` equals `['DELIVER', 'RECORD_ONLY']` |

No type-level test infrastructure exists (no `expectTypeOf`/`assertType`/`tsd` anywhere); type safety is covered by `pnpm typecheck`. Commands: `pnpm test`, `pnpm typecheck`.

**Pin, do not assume:** zod's output for a missing optional key must be asserted directly (`'deliveryMode' in result`), because `JSON.stringify` drops `undefined` values and would mask an added key.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The SSRF-adjacent concern is handled by the closed enum + unchanged `z.strictObject` (covered above and by existing `webhook`/`destination` rejection tests).

## Migration / Rollout

No migration. Version is not hand-edited: `package.json` is `0.0.0` and CI (`.github/workflows/ci-cd.yml` → `sisques-labs/workflows/trunk-npm-publish.yml`, `commit_release_files: true`) runs semantic-release, which writes the version and `CHANGELOG.md` back to main. A `feat:` commit produces the MINOR bump; no `CHANGELOG.md` exists locally to edit. Ship after beacon-api accepts the field.

## Non-Scope

Nothing in beacon-api is designed or implemented here. The only cross-repo obligation: `deliveryMode`, `DELIVER`, and `RECORD_ONLY` must stay byte-identical to beacon-api's DTOs, and absent must keep meaning `DELIVER` server-side.

## Open Questions

- [ ] None blocking.
