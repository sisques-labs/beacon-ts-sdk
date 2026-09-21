# Delta for nestjs-integration

## ADDED Requirements

### Requirement: Dedicated subpath

The NestJS layer MUST be exported from the `./nestjs` subpath only. Importing `.` MUST NOT load `@nestjs/*`.

#### Scenario: Subpath import
- GIVEN a NestJS app
- WHEN it imports `BeaconModule` from `@sisques-labs/beacon-sdk/nestjs`
- THEN the import resolves

#### Scenario: Core stays Nest-free
- GIVEN a non-Nest app importing `.`
- WHEN the module graph loads
- THEN no `@nestjs/*` module is required

### Requirement: BeaconModule.forRootAsync

`BeaconModule.forRootAsync(options)` MUST register a `BeaconClient` built from async-resolved `BeaconConfig` (supporting `useFactory`, `inject`, and `imports`), so config can come from e.g. `ConfigService`.

#### Scenario: Factory with injected config
- GIVEN `forRootAsync({ imports:[ConfigModule], inject:[ConfigService], useFactory: cfg => ({transport:'rest', baseUrl: cfg.get('BEACON_URL')}) })`
- WHEN the app bootstraps
- THEN `BeaconClient` is created using the resolved config

#### Scenario: Async factory
- GIVEN a `useFactory` returning a Promise
- WHEN the app bootstraps
- THEN the client is created only after the promise resolves

#### Scenario: Invalid config at bootstrap
- GIVEN a factory returning a config with no transport
- WHEN the app bootstraps
- THEN bootstrap fails with the configuration `BeaconError`

### Requirement: Global registration

`BeaconModule` MUST be global so that `BeaconClient` is injectable in any module after a single `forRootAsync` in the root module, without re-importing.

#### Scenario: Inject in feature module
- GIVEN `forRootAsync` registered once in `AppModule`
- WHEN a service in an unrelated feature module injects `BeaconClient`
- THEN injection succeeds with the same singleton instance

### Requirement: Injectable client and tokens

The module MUST export `BeaconClient` as injectable by class token, and MUST expose the resolved `BeaconConfig` under an exported provider token.

#### Scenario: Use injected client
- GIVEN an injected `BeaconClient`
- WHEN a service calls `notify()` with a valid request
- THEN behavior is identical to the framework-agnostic client

### Requirement: Registration only

The NestJS layer MUST contain no validation, transport, or error-mapping logic; it MUST delegate to the core.

#### Scenario: Errors pass through
- GIVEN an injected client and a transport failure
- WHEN `notify()` is called
- THEN the same `BeaconError` as the core is thrown, unwrapped by Nest exceptions

### Requirement: Nest as optional peer

`@nestjs/common` MUST be an optional peer dependency, needed only by `./nestjs`.

#### Scenario: Non-Nest consumer
- GIVEN an app without `@nestjs/common`
- WHEN it installs the package and uses `.`
- THEN no peer warning or error occurs for Nest
