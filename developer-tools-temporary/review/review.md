# Code Review: Framework Visualisation Backend Wiring

## Summary

**Review result: approve with one minor test-coverage follow-up.** The changes implement the backend and frontend-client wiring described in `architecture/framework-visualisation-backend-plan.md`. No correctness or style blockers were found.

## Findings

### Minor — Add explicit coverage for a missing datapoint base type

`architecture/framework-visualisation-backend-plan.md` step 4 asks for coverage that a summary with a missing base type fails in the same way as the detail endpoint, or that startup validation rejects it. The new tests cover list ordering, framework membership (including shared and unused datapoints), and parity with detail responses, but do not explicitly verify the missing-base-type case. The production code does fail on a missing base type, and the filesystem database validates datapoint references during startup, so this is a test-completeness item rather than a known functional defect.

## Plan and Dataland conventions

- Adds the `GET /data-point-types` summary endpoint and the planned lightweight `DataPointTypeSummary` DTO, preserving the existing detail endpoint.
- Builds a reverse framework-membership index once from the startup-loaded specification database, avoiding repeated schema scans for each listed datapoint.
- Sorts datapoints by name then id and sorts framework ids, providing deterministic responses.
- Adds controller tests and fixture coverage for single-framework, multiple-framework, and unused datapoints.
- Regenerates/updates the specification OpenAPI contract and adds a frontend TypeScript client task and registration. The client output/import naming follows existing frontend client conventions and compiles.
- Kotlin style, KDoc, Spring component wiring, DTO mapping, and frontend client registration are consistent with nearby Dataland code. No frontend API calls outside the approved client registration were added.
- The intentionally deferred frontend hooks and UI are outside the backend/build scope of the plan.

## Verification

- `./gradlew :dataland-specification-service:test :dataland-frontend:generateSpecificationServiceClient --rerun-tasks` — passed; 10 service tests passed and client generation succeeded.
- `./gradlew :dataland-specification-service:ktlintCheck detekt` — passed.
- `./testing/verifyOpenApiFiles.sh` — passed; OpenAPI artifacts are up to date.
- `npm run typecheck` in `dataland-frontend` — passed.
