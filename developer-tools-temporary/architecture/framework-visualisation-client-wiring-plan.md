# Framework Visualisation: Client Wiring Plan (frontend only)

Temporary planning note. Replaces the earlier backend plan. Decision: **no backend or specification-service changes.** Everything is built in `dataland-frontend` on top of the existing specification service endpoints.
Companion to `framework-visualisation-sources.md` and `framework-visualisation-frontend-architecture.md`.
Status legend: **Verified** (read in the code), **Proposed**, **Open**.

## 1. What already exists (verified)

- Specification service (`/specifications`, port 8489) is already routed by `dataland-inbound-proxy/templates/common.template`. No proxy change.
- Existing endpoints are enough: `GET /frameworks`, `GET /frameworks/{id}` (schema with leaves `{id, ref, aliasExport}`), `GET /data-point-types/{id}` (name, businessDefinition, base type, `usedBy`, constraints, calculationRules), `GET /data-point-base-types/{id}`.
- `specificationServiceOpenApi.json` already exists and is not modified.
- The frontend has no specification client yet. This is the only missing piece, and it is a frontend build change, not a backend change.

## 2. What the frontend must do instead of a new endpoint

The missing "list all datapoint types" endpoint is replaced by client-side derivation:

1. Load the framework list (1 request) and every framework (about 7 requests).
2. Parse each framework `schema` and build, in a pure function:
   - the category tree per framework (for "By framework" mode);
   - a flat datapoint index: `id`, `aliasExport`, category path, and the frameworks it appears in (this is the reverse index; it replaces the server-side `usedBy`).
3. "All datapoints" mode lists this index. Names and descriptions come from `GET /data-point-types/{id}`, fetched lazily (see 3).

## 3. Tradeoff: names and descriptions (Decided: Option A for the MVP)

Datapoint names and descriptions only exist on the per-id endpoint (about 600 ids). Options:

| Option | Effect | Cost |
|---|---|---|
| A. Lazy details (recommended start) | List shows id, category path and frameworks from the schemas. Name and description load when a row is selected or becomes visible. Search covers id, alias and category path. | Search does not cover names/descriptions until loaded. |
| B. Prefetch all details in the background | After the schemas load, fetch all about 600 details with a bounded concurrency (for example 6 at a time), cached with a long `staleTime`. Search then covers names and descriptions once loaded. | About 600 small GETs on first visit. Needs a progress hint and care for the proxy and rate limits. |
| C. Visible rows only | Fetch details only for rows in the virtual-scroll window. | More complex, partial search. |

**Decided:** the MVP ships Option A (lazy details). Option B is a possible later upgrade behind the same list component if users need description search; measure request time first.

## 4. Implementation steps (all in `dataland-frontend`)

### Step 1: Client generation
- `dataland-frontend/build.gradle.kts`: add `generateSpecificationServiceClient` (`typescript-axios`, `inputSpec` = `dataland-specification-service/specificationServiceOpenApi.json`, output `build/clients/specification-service`), copying an existing task such as `generateAccountingServiceClient`. The `@clients` alias already resolves it.
- Add it to `generateClients` `dependsOn`.
- Run `./gradlew :dataland-frontend:generateClients` (skill `dataland-generate-clients`). Never hand-edit generated clients.

### Step 2: Client registration
- `src/services/ApiClients.ts`: import the generated controller, add it to the `ApiClients` interface, register in `constructApiClients()` with `getClientFactory('/specifications')`.

### Step 3: Query hooks
- `src/api-queries/specification-service/` as described in the frontend architecture file (framework list, framework detail, data point type, base type). One hook per endpoint, no logic inside. Read `src/api-queries/AGENTS.md` first.

### Step 4: Pure logic and UI
- Framework tree and datapoint index builders, components, route and navigation: see the frontend architecture file.

### Step 5: Verification
- `npm run lint`, `npm run typecheck`, `npm run lintci`, `npm run formatci`, `npm run checkdependencies`, `npm run checkcypresscompilation`, plus the new Cypress component tests. Use skill `dataland-frontend-impact`.
- `testing/verifyOpenApiFiles.sh` should show no diff, since no OpenAPI file changes.
- No Gradle backend tests, `ktlint` or `detekt` runs are needed unless Kotlin files are touched (they are not).

## 5. Risks

| Risk | Mitigation |
|---|---|
| Many requests for names/descriptions | Option A first, long `staleTime`, bounded concurrency if B is added |
| Search does not cover descriptions at first | Communicate in the UI (search placeholder), upgrade to B if needed |
| Schema parsing complexity (the schema is a JSON string with nested categories) | Pure, unit-tested builder using real specification files as fixtures |
| Endpoints are unauthenticated and the page is login-only only in the frontend | Decided: the endpoints stay public, since the specifications describe the data model, not company data. Authentication testing is deferred |
| Backend change later wanted for performance | Additive list endpoint can still be introduced later. The list component takes plain props, so the data source can be swapped without UI changes |

## 6. Decisions and remaining open points

Decided:
1. MVP uses lazy loading of names and descriptions (Option A). No description search in the MVP.
2. Specification endpoints stay public. Login is enforced only in the frontend. Testing of this is deferred to later.

Open (deferred):
1. Does the E2E journey need a specification client in `dataland-e2etests`, or is a UI-only journey enough? Decide when the E2E test is written.
