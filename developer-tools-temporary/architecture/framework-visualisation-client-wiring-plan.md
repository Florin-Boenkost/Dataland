# Framework Visualisation: Client Wiring Plan (frontend only)

Temporary planning note. Replaces the earlier backend plan. Decision: **no backend or specification-service changes.** Everything is built in `dataland-frontend` on top of the existing specification service endpoints.
Companion to `framework-visualisation-sources.md` and `framework-visualisation-frontend-architecture.md`.
Status legend: **Verified** (read in the code), **Proposed**, **Open**.

## 1. What already exists (verified)

- Specification service (`/specifications`, port 8489) is already routed by `dataland-inbound-proxy/templates/common.template`. No proxy change.
- Existing endpoints are enough: `GET /frameworks`, `GET /frameworks/{id}` (schema with leaves `{id, ref, aliasExport}`), `GET /frameworks/{id}/resolved-schema` (base-type structures at the same framework paths), `GET /data-point-types/{id}` (name, businessDefinition, base type, `usedBy`, constraints, calculationRules), `GET /data-point-base-types/{id}` (name, definition, example, validation metadata; no structure schema).
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

### Step 1: Client generation — implemented
- `dataland-frontend/build.gradle.kts`: add `generateSpecificationServiceClient` (`typescript-axios`, `inputSpec` = `dataland-specification-service/specificationServiceOpenApi.json`, output `build/clients/specification-service`), copying an existing task such as `generateAccountingServiceClient`. The `@clients` alias already resolves it.
- Add it to `generateClients` `dependsOn`.
- Run `./gradlew :dataland-frontend:generateClients` (skill `dataland-generate-clients`). Never hand-edit generated clients.

### Step 2: Client registration — implemented
- `src/services/ApiClients.ts`: import the generated controller, add it to the `ApiClients` interface, register in `constructApiClients()` with `getClientFactory('/specifications')`.

### Step 3: Query hooks — implemented; typecheck passed
- `src/api-queries/specification-service/` as described in the frontend architecture file (framework list, framework detail, resolved framework schema, data point type, base type). One hook per endpoint, no logic inside. Read `src/api-queries/AGENTS.md` first.

### Step 4: Pure logic and UI — implemented
- Framework tree and datapoint index builders, components and route: see the frontend architecture file. Put the navigation tab immediately after `COMPANIES` in `DatasetsTabMenu.vue`, before the conditional `MY COMPANY` tab.
- For a selected datapoint, use its path from the ordinary framework schema to look up its structure in that framework's resolved schema. Fetch and cache the resolved schema for one containing framework on selection, not for every framework on initial load. Render field paths and types; keep the base-type example separately collapsible. Do not infer a nullable column from these endpoints.

### Step 5: Verification — completed for the frontend implementation
- `npm run lint`, `npm run typecheck`, `npm run lintci`, `npm run formatci`, `npm run checkdependencies`, `npm run checkcypresscompilation`, plus the new Cypress component tests. Use skill `dataland-frontend-impact`.
- `testing/verifyOpenApiFiles.sh` should show no diff, since no OpenAPI file changes.
- No Gradle backend tests, `ktlint` or `detekt` runs are needed unless Kotlin files are touched (they are not).

## Implementation status (DALA-0002)

- Generated the frontend specification-service client from the existing OpenAPI file and registered `SpecificationControllerApi` at `/specifications`.
- Added framework-list, framework-detail, resolved-framework, datapoint-type and base-type TanStack Query hooks with resource key factories.
- Added the schema tree, reverse datapoint index, lazy value-structure lookup, explorer page, route and the navigation tab immediately after `COMPANIES`.
- Added Cypress component coverage for schema mapping, selection/deep links, value structure and its fallback, and navigation order.
- Passed: frontend lint, typecheck, lintci, formatci, checkdependencies, Cypress compilation, build, and the targeted framework explorer and navigation component tests (16 total). No specification-service code or OpenAPI contract changed.
- Follow-up: The explorer's left-hand flat list and framework-tree datapoints now use the same human-readable labels as dataset views (`ViewConfig`), falling back to the datapoint ID where a label is unavailable. Search still accepts IDs and aliases and now also matches labels. Cypress coverage was extended for dataset labels and fallback; re-run that spec after the frontend Cypress dev-server port (8090) is free.
- Follow-up: Framework tree category/subcategory headings and the displayed category paths now use dataset-view section labels where they match the framework schema by datapoint membership. Schema keys stay intact for selection and resolved-schema lookup; unmatched headings retain their technical label. Lint, typecheck, formatci, Cypress compilation and build pass.
- Follow-up: The "All datapoints" list now shows each human-readable name once (`groupDatapointsByName`). Clicking a row, or its expander, shows every framework and category path in which datapoints of that name occur, plus the datapoint ID, since different IDs can share a label. Clicking a framework entry selects that datapoint and framework. The selected row (list and framework tree) uses the Dataland primary tint with an orange edge instead of the theme's dark `highlight` colour, so its text stays readable. The theme itself was not changed.
- Verification: lintci, formatci, typecheck, Cypress compilation, checkdependencies, build and the targeted Cypress component specs (explorer and navigation, 20 tests) all pass.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Many requests for names/descriptions | Option A first, long `staleTime`, bounded concurrency if B is added |
| Search does not cover descriptions at first | Communicate in the UI (search placeholder), upgrade to B if needed |
| Schema parsing complexity (the schema is a JSON string with nested categories) | Pure, unit-tested builder using real specification files as fixtures |
| Resolved schema is framework-scoped, not a per-base-type response | Match the selected datapoint's path in the ordinary framework schema to the same path in the resolved schema; handle missing or malformed paths with a neutral fallback |
| Endpoints are unauthenticated and the page is login-only only in the frontend | Decided: the endpoints stay public, since the specifications describe the data model, not company data. Authentication testing is deferred |
| Backend change later wanted for performance | Additive list endpoint can still be introduced later. The list component takes plain props, so the data source can be swapped without UI changes |

## 6. Decisions and remaining open points

Decided:
1. MVP uses lazy loading of names and descriptions (Option A). No description search in the MVP.
2. Specification endpoints stay public. Login is enforced only in the frontend. Testing of this is deferred to later.

Open (deferred):
1. Does the E2E journey need a specification client in `dataland-e2etests`, or is a UI-only journey enough? Decide when the E2E test is written.
