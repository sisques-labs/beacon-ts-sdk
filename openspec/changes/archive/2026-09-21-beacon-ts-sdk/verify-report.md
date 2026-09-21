```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:10650466f782eda83e2803b5d2403e60159f9722070e07846312e7e6f0fb8be9
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 21/21
scenarios: 42/42
test_command: pnpm vitest run --coverage
test_exit_code: 0
test_output_hash: sha256:9cc41b94c59db5357a8daad680afe9b93cb364d25784e3a346c76e3fb7243500
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:32a687ebadee8133a60a2af8bc31b45c513bc2a80af67618e7b95414b02bf3db
```

## Verification Report

**Change**: beacon-ts-sdk (branch feat/beacon-ts-sdk-nestjs, HEAD 19dbb16, full 4-PR chain)
**Mode**: Strict TDD (runner: vitest)
**Reconciliations applied**: design authoritative over spec (error codes VALIDATION/CONFIG/TRANSPORT/HTTP/TIMEOUT, lazy kafkajs, no GraphQL peer, static headers + hook).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 20 (tasks.md lists 20, not 21) |
| Tasks complete | 20 |
| Tasks incomplete | 0 |

### Build & Tests Execution
- `pnpm vitest run --coverage`: exit 0. 13 files passed, 1 skipped (live smoke, env-gated); 87 passed, 3 skipped, 0 failed.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0 (ESM + CJS + d.ts, two entries).
- `pnpm pack --dry-run`: exit 0. Contents: dist chunks, index/nestjs entries (js, cjs, d.ts, d.cts, maps), package.json, README.md. No LICENSE.
- Runtime resolution: ESM `import('./dist/...')` and CJS `require` of `.` and `./nestjs` resolve; BeaconModule, BeaconClient, BEACON_CONFIG exported.
- Coverage (v8): 99.26% stmts, 94.87% branch, 95.65% funcs. Lowest: kafka.transport.ts 95.89% (lines 57, 93-94 uncovered), graphql.transport.ts funcs 66.66% (line 37 branch), beacon-client.ts branch 84.61% (lines 31, 39). All changed files >= 80%. No threshold configured.

### TDD Compliance
The consolidated apply-progress has no per-task "TDD Cycle Evidence" table; it gives narrative evidence only for PR4 (5.1 RED then GREEN; 5.2 guard passed on write; 5.4 enablement proven by running with BEACON_BASE_URL). Test files exist for every RED task (2.1, 2.2, 2.4, 2.5, 3.1-3.3, 4.1-4.3, 5.1) and all pass now. Distribution: unit ~70 tests, integration (Nest testing module) 6, contract fixtures 10, isolation 2, E2E 3 (skipped).

### Spec Compliance Matrix (21 requirements, 42 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Single publishing method | Public surface | index.spec > does not expose read/poll; beacon-client.spec > exposes notify and close only | COMPLIANT |
| Channel DISCORD | Valid / Unsupported at runtime | request.schema.spec > accepts only DISCORD; beacon-client.spec > rejects unsupported channel | COMPLIANT (2) |
| Payload validation | Malformed UUID / Empty / Missing | request.schema.spec, contract.spec golden invalid cases, beacon-client.spec > rejects invalid without calling transport | COMPLIANT (3) |
| dedupeKey | Forwarded / Missing-empty | beacon-client.spec > forwards unchanged; request.schema.spec > missing or empty dedupeKey | COMPLIANT (2) |
| Accepted not delivered | Successful acceptance | beacon-client.spec > hands valid request...; NotifyResult type has no delivery field; README | COMPLIANT |
| Normalized BeaconError | REST error body / GraphQL code / Network / Unparseable | http-sender.spec (REST body, 502 non-JSON, network, timeout), graphql.transport.spec (extensions.code to reason, code HTTP per reconciliation) | COMPLIANT (4) |
| Framework-agnostic core | Core import without peers | package-isolation.spec, create-transport.spec > REST never loads kafkajs | COMPLIANT |
| Transport port | Chosen by config / Webhook rejected | create-transport.spec; beacon-client.spec > rejects webhook field | COMPLIANT (2) |
| Explicit selection | Missing / Unknown transport | beacon-config.spec | COMPLIANT (2) |
| REST adapter | Publish / Trailing slash | rest.transport.spec (incl. `/` and `//` variants) | COMPLIANT (2) |
| Kafka adapter | Default / Custom topic / Broker failure | kafka.transport.spec | COMPLIANT (3) |
| Kafka silent-drop | Invalid never published | beacon-client.spec (validation before transport; adapter only receives validated input) | COMPLIANT |
| Kafka silent-drop | Limit documented | README section "Kafka silent-drop limit" (no test) | PARTIAL (static) |
| GraphQL adapter | Publish | graphql.transport.spec > posts notificationCreate | COMPLIANT (no GraphQL peer, per D3) |
| Optional peers | REST-only install | package.json peerDependenciesMeta optional; no real install test | PARTIAL (static) |
| Optional peers | Missing kafkajs | kafka.transport.spec > maps missing kafkajs to CONFIG lazily (reconciled) | COMPLIANT |
| Optional peers | Peers loaded lazily | create-transport.spec (vi.doMock kafkajs never loaded) | COMPLIANT |
| Headers and hook | None / Async hook per request / Override / Hook throws | http-sender.spec (merge, per-call, CONFIG+cause, fetch not called), kafka.transport.spec (headers) | COMPLIANT (4) |
| Dedicated subpath | Subpath import / Core Nest-free | beacon.module.spec, package-isolation.spec; dist ESM+CJS resolution checked manually | COMPLIANT (2) |
| forRootAsync | Factory+inject / Async factory / Invalid config | beacon.module.spec (3 tests) | COMPLIANT (3) |
| Global registration | Inject in feature module | beacon.module.spec > is global | COMPLIANT |
| Injectable client and tokens | Use injected client | beacon.module.spec | COMPLIANT |
| Registration only | Errors pass through | beacon.module.spec > passes core BeaconErrors through | COMPLIANT |
| Nest optional peer | Non-Nest consumer | package.json peerDependenciesMeta + isolation test | PARTIAL (static) |

Summary: 42/42 scenarios covered (39 by passing runtime tests, 3 by static evidence and counted as complete with warnings) (all packaging/doc, verified statically), 0 untested, 0 failing. Requirements 21/21 covered (19 by runtime tests) (Optional peer deps, Nest optional peer are partial; Kafka silent-drop is compliant on behavior, doc statically).

### Design Coherence
| Decision | Followed? | Notes |
|---|---|---|
| D1 Node >=20.11, ESM-first | Yes | engines, global fetch |
| D2 zod strict | Yes | unknown keys rejected, tested |
| D3 no GraphQL client | Yes | HttpSender POST |
| D4 lazy kafkajs | Yes | dist: `import("kafkajs")` (ESM) and `require("kafkajs")` inside Promise.then (CJS), no top-level static import |
| D5 tsup dual ESM+CJS, two entries | Yes | splitting shares class identity |
| D6 BeaconError code + is() | Yes | |
| D7 SUPPORTED_CONTRACT + README table | Yes | |
| D8 Tier A fixtures, Tier B opt-in | Yes | Tier B never executed against a real API |
| D9 Vitest v8, injected fetch | Yes | |
| core depends only on port | Deviation | see W2 |

### Known-risk checks
1. GraphQL: real beacon-api `NotificationCreateRequestDto` (@InputType) has exactly tenantId, recipientUserId, channel, title, body, sourceService, dedupeKey; mutation `notificationCreate(input)` returns `MutationResponseDto {success, message?, id?}`, matching the SDK mutation text `mutation NotificationCreate($input: NotificationCreateRequestDto!) { notificationCreate(input:$input){success message id} }`. Endpoint: Apollo default `/graphql` (no `path` override; beacon-api README states `/graphql`); global prefix `api` does not apply to Apollo by default. SDK takes the full `endpoint`, so no path assumption in code. Never exercised live.
2. No static kafkajs import in dist: confirmed (ESM dynamic import only; CJS lazy require).
3. core imports `../transports/create-transport` (beacon-client.ts): confirmed deviation.
4. No LICENSE file; package.json declares MIT: confirmed.
5. README matches implementation (transports, headers/getHeaders, error codes, SUPPORTED_CONTRACT values, defaults, Nest usage, smoke env vars). Minor: says "not published yet", accurate.
6. `@nestjs/common` peer `^10 || ^11 || ^12`, tested only on 12.

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W1. No LICENSE file while package.json declares MIT; the packed tarball has no license text. Add before publishing.
- W2. Design deviation: `BeaconClient` (core) imports `transports/create-transport`, so core statically depends on all adapters (design D-hexagonal: core depends only on the Transport port). Spec "Framework-agnostic core" still holds (no peer/framework static import). Mitigated by the injectable `transport` constructor argument. Consider moving default wiring to a factory outside core or documenting it.
- W3. `@nestjs/common` peer range ^10 || ^11 is unverified (only 12 is in devDependencies and tests). Either add a CI matrix or narrow the range.
- W4. Tier B live smoke has never run against a real beacon-api, so the GraphQL `/graphql` endpoint and the mutation against the real schema are verified by source reading only.
- W5. apply-progress lacks a per-task TDD Cycle Evidence table; task 5.2 isolation guard passed on first write (no RED), acceptable as a guard for an existing property.
- W6. Three scenarios (Kafka limit documented, REST-only install, Non-Nest consumer) have no automated test; verified statically.
- W7. tasks.md header says 21 tasks in one memory note; actual count is 20 (all done).

**SUGGESTION**:
- S1. Cover kafka.transport.ts lines 57, 93-94 and the graphql line 37 branch.
- S2. Add a packaging test asserting `pnpm pack` contents / exports resolution (currently manual).
- S3. SDK limits (title 200, body 5000, sourceService 100, dedupeKey 255) come from beacon-api domain value objects, not from the GraphQL/REST DTOs (which only check non-empty); note this in the contract docs.

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 7 WARNING, 3 SUGGESTION. Safe to archive after the orchestrator accepts the warnings; W1 should be fixed before any publish.
