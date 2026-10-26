# Framework Visualisation: Backend Plan

Temporary planning note. Backend and build wiring only. Companion to `framework-visualisation-sources.md` and `framework-visualisation-frontend-architecture.md`.
Nothing here is implemented yet. Status legend: **Verified** (read in the code), **Proposed**, **Open**.

## 1. Current state (verified)

- The specification service (`dataland-specification-service`, context path `/specifications`, port 8489) serves everything from an in-memory `SpecificationDatabase` (maps `frameworks`, `dataPointTypes`, `dataPointBaseTypes`, `translations`), loaded from JSON files at startup.
- Existing endpoints (`SpecificationApi.kt`): `GET /frameworks`, `GET|HEAD /frameworks/{id}`, `GET /frameworks/{id}/resolved-schema`, `GET /data-point-types/{id}`, `GET /data-point-types/{id}/validated-by`, `GET /data-point-base-types/{id}`, `GET /data-point-base-types/{id}/validated-by`.
- **Gap 1, no list of datapoint types.** The frontend can only reach datapoints by walking framework schemas and requesting each id. That is about 600 requests for the "All datapoints" mode.
- **Gap 2, `usedBy` is expensive.** `DataPointType.toDto` (`model/DataPointTypeSpecification.kt`) computes `usedBy` by flattening every framework schema for each call. Fine for single lookups, but a naive list endpoint reusing it would do roughly 600 times (frameworks times schema size) work.
- **Gap 3, no frontend client.** `dataland-frontend/build.gradle.kts` has no `generateSpecificationServiceClient` task and `generateClients` does not include it. `src/services/ApiClients.ts` has no specification client. The Kotlin backend already has such a task (`dataland-backend/build.gradle.kts`, line 214) that can be used as a model.
- **Routing is already in place.** `dataland-inbound-proxy/templates/common.template` routes `/specifications/` to `specification-service:8489`. No proxy change is needed.
- **Authentication.** The specification service has no Spring Security dependency (see its `build.gradle.kts`), so its endpoints are reachable without a token. The frontend page will be login-only, but that is enforced only in the frontend. See open question 1.

## 2. Scope

In scope:
1. One new list endpoint in the specification service.
2. Regenerating the OpenAPI spec.
3. Adding a specification client to the frontend build (and registering it in `ApiClients.ts`).
4. Tests and CI verification.

Out of scope (deferred, as agreed): CSV-only fields (unit, mandatory flag, options, document-support, dependency), LkSG, translations, and a framework comparison endpoint.

## 3. Design decisions

### 3.1 New endpoint `GET /specifications/data-point-types` (Proposed)

Returns a lightweight summary per datapoint type. Details stay on the existing `GET /data-point-types/{id}`, so no data is duplicated and the existing hooks remain one-endpoint-one-hook.

Proposed response element, `DataPointTypeSummary`:

| Field | Source | Purpose in UI |
|---|---|---|
| `dataPointType: IdWithRef` | `DataPointType.getRef` | Id and link, same shape as the existing DTOs |
| `name` | `DataPointType.name` | List label and search |
| `businessDefinition` | `DataPointType.businessDefinition` | Search over descriptions |
| `dataPointBaseType: IdWithRef` | base type lookup | Filter and tag in the list |
| `usedBy: List<IdWithRef>` | precomputed reverse index | Framework filter and tags without extra calls |

Why this shape:
- It reuses `IdWithRef` and the same field names as `DataPointTypeSpecification`, so the generated client stays consistent.
- It leaves out `constraints` and `calculationRules`, which only the detail panel needs. This keeps the payload small (roughly 600 entries).
- Including `businessDefinition` lets the frontend search descriptions client-side without a search endpoint.

Alternatives considered:
- **Return full `DataPointTypeSpecification` list.** Simplest, no new DTO, but a larger payload and then the detail call is redundant. Possible fallback if the DTO duplication feels excessive. See open question 2.
- **Server-side search and pagination.** Not needed at about 600 entries held in memory. Revisit only if the list grows a lot.
- **Aggregate "framework explorer" endpoint.** More coupled to this one UI. Rejected in the earlier discussion.

### 3.2 Reverse index for `usedBy` (Proposed)

Build `dataPointTypeId -> list of framework refs` once, not per datapoint:
- Iterate each framework's `flattenedSchema` once and group framework ids by datapoint id.
- Keep the index inside the specification service (for example a small Spring component built from `SpecificationDatabase` at startup, or computed lazily once and cached). It must not change the shared `dataland-specification-lib` database class unless that is clearly better.
- Optional follow-up: reuse the same index in the existing `DataPointType.toDto` to make the single lookup cheaper. This is a refactor of existing behaviour, so keep it a separate, optional step and only do it if tests cover it.

Check before building: is the database ever reloaded at runtime? If so, the index must be rebuilt with it. If it is only loaded at startup (to be confirmed in `SpecificationDatabaseConfiguration.kt`), a startup-built index is enough.

### 3.3 Ordering and determinism (Proposed)

Sort the list by `name` (then `id`) in the service so the response is stable. This also keeps the OpenAPI/fixture-style checks and tests deterministic. The frontend can still sort or filter further.

### 3.4 No other endpoint changes needed (Verified)

- Framework membership and the category path: already available via `GET /frameworks/{id}` (schema with `id`, `ref`, `aliasExport` per leaf).
- Description, constraints and calculation rules: `GET /data-point-types/{id}`.
- Supported values (structure and example): `GET /data-point-base-types/{id}`.
- Validation class: `.../validated-by` endpoints (text/plain; only needed for the collapsed technical section; consider whether the frontend needs it at all, because `DataPointBaseTypeSpecification` already carries `validatedBy`).

## 4. Implementation steps

Order matters: the OpenAPI spec must exist before the frontend client can be generated.

### Step 1: Model
- Add `DataPointTypeSummary` (data class) in `dataland-specification-service/src/main/kotlin/org/dataland/datalandspecificationservice/model/`, next to `DataPointTypeSpecification.kt`.
- Add a mapper function (for example `DataPointType.toSummaryDto(baseUrl, database, usedByIndex)`), following the file's existing `toDto` style and KDoc.

### Step 2: Reverse index
- Add the index (see 3.2) with a KDoc-documented component or function. Keep it small and covered by a unit test.

### Step 3: API and controller
- `api/SpecificationApi.kt`: add `listDataPointTypeSpecifications()` (name to be aligned with `listFrameworkSpecifications`) mapped to `GET /data-point-types`, with `@Operation` summary and description like the other methods, `produces = ["application/json"]`.
- `controller/SpecificationController.kt`: implement it using the index, sorted as in 3.3.
- Use `defaultObjectMapper` only if serialization is touched; the controller itself should not need an `ObjectMapper`.

### Step 4: Tests (specification service)
- Extend `SpecificationControllerTest.kt` and the fixtures in `src/test/resources/specifications-test/**`:
  - the list returns all datapoint types, sorted;
  - `usedBy` is correct for a datapoint in several frameworks, in one framework, and in none;
  - the summary matches the corresponding detail response for `name`, `businessDefinition`, base type and `usedBy`;
  - a datapoint with a missing base type fails the same way as the detail endpoint (or is rejected at startup validation).
- Use `org.mockito.kotlin` if mocks are needed. Follow the existing test style of that file.

### Step 5: Local checks
- `./gradlew ktlintFormat`
- `./gradlew :dataland-specification-service:test`
- `./gradlew detekt` (production Kotlin changed)

### Step 6: Regenerate the OpenAPI spec
- `./gradlew :dataland-specification-service:generateOpenApiDocs` (use the `dataland-regenerate-openapi-spec` skill).
- Never hand-edit `specificationServiceOpenApi.json`. The diff should contain only the new path and schema.
- Check downstream consumers of this spec compile: `dataland-backend` and `dataland-qa-service` generate Kotlin clients from it. Run their client generation and a compile (`./gradlew :dataland-backend:generateSpecificationServiceClient` and the qa-service equivalent, then a build of both). A new endpoint is additive, so no break is expected, but it has to be confirmed.

### Step 7: Frontend client generation
- `dataland-frontend/build.gradle.kts`: add `generateSpecificationServiceClient` (`typescript-axios`, `inputSpec` = `dataland-specification-service/specificationServiceOpenApi.json`), copying the configuration of an existing task such as `generateAccountingServiceClient` (line 299). Output to `build/clients/specification-service`, which resolves through the existing `@clients` alias (`vite.config.mts`, `tsconfig*.json`), so no alias changes are needed.
- Add `dependsOn("generateSpecificationServiceClient")` to `generateClients` (line 82).
- Run `./gradlew :dataland-frontend:generateClients` (use the `dataland-generate-clients` skill).
- `dataland-e2etests` generates its own clients. Only add one there if the planned E2E journey needs to call the specification service directly. Decide later (open question 4).

### Step 8: Frontend client registration
- `dataland-frontend/src/services/ApiClients.ts`: import the generated controller from `@clients/specification-service`, add it to the `ApiClients` interface, and register it in `constructApiClients()` with `this.getClientFactory('/specifications')(<SpecificationControllerApi>)`. The generated class name is known only after Step 7.
- This is the only change in the frontend that belongs to the backend plan. Hooks, components and routes are in the frontend architecture file.

### Step 9: Repo-level verification
- `testing/verifyOpenApiFiles.sh` (OpenAPI files up to date).
- `testing/verify_that_fake_fixtures_are_up_to_date.sh` (should be unaffected; run to confirm).
- `./gradlew ktlintCheck detekt`
- Specification service and specification lib tests as in CI (`.github/workflows/CI.yaml`, line 216).
- Frontend: `npm run typecheck`, `npm run lint` after the client is generated, via the `dataland-frontend-impact` skill.

### Step 10: Review checklist
- Only additive API change; existing endpoints and DTOs unchanged.
- No generated file hand-edited.
- New code has KDoc (detekt) and tests.
- `usedBy` computed once, not per datapoint.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Performance of a naive `usedBy` per datapoint | Reverse index (3.2), with a test on the real specification data if feasible |
| Response size of the list | Summary DTO without constraints/rules; check actual size (about 600 entries) |
| Stale generated artifacts | Regenerate the spec first, then clients, in that order; run `verifyOpenApiFiles.sh` |
| Other consumers of the spec (`dataland-backend`, `dataland-qa-service`) break | Additive change; run their client generation and compile |
| Public data endpoints behind a login-only page | Open question 1 |

## 6. Open questions

1. **Authentication on the specification service.** Its endpoints are public today and the page is login-only in the frontend only. Is that acceptable? The specifications describe the data model and are not company data. If the endpoints must require a token, that is a bigger change (Spring Security, proxy and token handling) that is not planned here.
2. **DTO shape.** New slim `DataPointTypeSummary` (recommended) or return the full `DataPointTypeSpecification` list?
3. **Description in the list.** Include `businessDefinition` in the summary so the frontend can search descriptions (recommended), or only names?
4. **E2E clients.** Does the E2E journey need a specification client in `dataland-e2etests`, or is a UI-only journey enough?
5. **Refactor of `toDto`.** Should the existing single-lookup `usedBy` also use the new index, or stay as it is?
