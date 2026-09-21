# Tasks: Beacon TypeScript SDK v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1400-1700 (incl. tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 core+types -> PR 2 REST -> PR 3 Kafka+GraphQL -> PR 4 NestJS+packaging |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

Note: chain strategy (stacked-to-main vs feature-branch-chain) must be asked before PR 1.

### Reconciliations (design authoritative)
- `BeaconErrorCode` = design union. Spec kinds map: validation=VALIDATION, configuration=CONFIG, network=TRANSPORT. Auth-hook throw (spec "auth") = CONFIG + `cause`. GraphQL `extensions.code` (e.g. BAD_USER_INPUT) goes to `reason`; code=HTTP. Error carries `code, message, transport, status?, reason?, cause?`.
- `NotifyResult.id?` absent on Kafka (design).
- No GraphQL peer (D3); spec "GraphQL client peer" superseded. Kafka missing-peer error is raised lazily at `connect()`/first notify, not at creation (D4).
- Config gains static `headers?` (spec) beside `getHeaders`; hook overrides static.

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|------|------|----|--------------|-----------------|----------|
| 1 | Scaffold + strict TDD flip | PR 1 | `pnpm vitest run` | `pnpm build` | tooling files |
| 2 | Core, validation, errors | PR 1 | `pnpm vitest run src/core` | N/A, pure logic | `src/core` |
| 3 | HttpSender + REST | PR 2 | `pnpm vitest run src/transports/http src/transports/rest` | injected fetch | `src/transports/{http,rest}` |
| 4 | Kafka + GraphQL + factory | PR 3 | `pnpm vitest run src/transports` | fake producer | `src/transports/{kafka,graphql}` |
| 5 | NestJS, packaging, docs | PR 4 | `pnpm vitest run src/nestjs` | `pnpm build` + exports check | `src/nestjs`, docs |

## Phase 1: Scaffold (PR 1)
- [x] 1.1 Create `package.json` (version `0.0.0`, name `@sisques-labs/beacon-sdk`, engines node>=20.11, exports `.`/`./nestjs`, optional peers kafkajs/@nestjs/common, zod dep), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- [x] 1.2 Create `.gitignore` (node_modules, dist, coverage, `.atl/` as local tooling cache; `openspec/` stays tracked)
- [x] 1.3 Add `src/index.ts` stub and one passing smoke test `src/index.spec.ts`
- [x] 1.4 Modify `openspec/config.yaml`: `strict_tdd: true`, `testing.runner: vitest`, update stale context (no longer Kafka-only, no longer idea stage)

## Phase 2: Core (PR 1, strict TDD: RED then GREEN)
- [x] 2.1 RED+GREEN `src/core/errors/beacon-error.ts` (code union, `is()` brand, fields) - spec Normalized BeaconError
- [x] 2.2 RED+GREEN `src/core/notification/request.schema.ts` + `request.types.ts` (strict zod, UUID, limits, DISCORD only, unknown key incl. webhook rejected)
- [x] 2.3 Create `src/core/notification/notify-result.types.ts`, `src/core/ports/transport.port.ts`, `src/core/contract/supported-contract.ts`
- [x] 2.4 RED+GREEN `src/core/config/beacon-config.types.ts` + config validation (missing/unknown transport -> CONFIG)
- [x] 2.5 RED+GREEN `src/core/beacon-client.ts` (validate before send, no transport call on invalid, dedupeKey unchanged, `close()`)
- [x] 2.6 Export from `src/index.ts`; Tier A golden fixtures `test/fixtures/`

## Phase 3: REST (PR 2)
- [x] 3.1 RED+GREEN `src/transports/http/http-sender.ts` (timeout, static+hook headers per call, hook override, hook throw -> CONFIG, REST error body/502 non-JSON/network -> BeaconError)
- [x] 3.2 RED+GREEN `src/transports/rest/rest.transport.ts` (POST `/api/v1/notifications`, trailing slash, `{id}` result)
- [x] 3.3 RED+GREEN `src/transports/create-transport.ts` (rest branch, unknown -> CONFIG); wire into client

## Phase 4: Kafka + GraphQL (PR 3)
- [x] 4.1 RED+GREEN `src/transports/kafka/kafka.transport.ts` (lazy `import('kafkajs')`, default/custom topic, headers, broker failure -> TRANSPORT, missing kafkajs -> CONFIG, no `id`)
- [x] 4.2 RED+GREEN `src/transports/graphql/graphql.transport.ts` (`notificationCreate` via HttpSender, `extensions.code` -> `reason`)
- [x] 4.3 Extend `create-transport.ts` for kafka/graphql; test REST import never loads kafkajs

## Phase 5: NestJS + packaging + docs (PR 4)
- [ ] 5.1 RED+GREEN `src/nestjs/{beacon.module,beacon.tokens,beacon.options}.ts` + `src/nestjs/index.ts` (global, forRootAsync, `BEACON_CONFIG`, shutdown `close()`, invalid config fails bootstrap, errors pass through)
- [ ] 5.2 Test core import loads no `@nestjs/*`; verify ESM+CJS build and exports map
- [ ] 5.3 Modify `README.md`: three transports, accepted-not-delivered, Kafka silent-drop, `SUPPORTED_CONTRACT` compatibility table, 0.x note
- [ ] 5.4 Add opt-in Tier B smoke `test/e2e/*.spec.ts` gated by `BEACON_BASE_URL`/`KAFKA_BROKERS`
