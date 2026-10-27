# Frontend Code Review: Framework Explorer

## Summary

**Review result: changes requested for two functional gaps against the agreed frontend architecture.** The page structure, routing, query hooks, URL-backed state, PrimeVue usage, and basic user flows are implemented consistently with Dataland conventions. The required specification-service access is correctly routed through TanStack Query hooks.

## Findings

### Medium — Supported values omit the base-type schema structure

`dataland-frontend/src/components/resources/frameworkExplorer/DatapointValuesSection.vue:5-10` displays the base-type name, business definition, and example, but never renders `baseType.schema`. The agreed detail-panel design (`framework-visualisation-frontend-architecture.md:97`) calls for the value structure table as the primary supported-values content. As implemented, users cannot see the fields and value types that define the datapoint's supported structure. Render the schema in a readable structure table (including nested fields) alongside the existing example.

### Medium — Referenced report path is missing from technical details

`DatapointTechnicalSection.vue` only receives datapoint id, base-type id, and `validatedBy`; it does not show `FrameworkSpecification.referencedReportJsonPath`. The framework detail is fetched in `DatapointFrameworkEntry.vue`, so this metadata is available there but is not displayed. The architecture explicitly includes the report reference path in technical details (`framework-visualisation-frontend-architecture.md:99`). Expose the reference for the relevant framework(s), for example alongside each framework entry or in a technical section that receives this data.

## Dataland convention and plan review

- The `/framework-explorer` route is authentication-protected and its tab is added at the end of the existing tab list.
- Route query parameters are used as the source of truth for mode, framework, selected datapoint, and search. Mode switching preserves the selected datapoint.
- Backend calls in the page and feature components use specification-service TanStack Query hooks. Hooks use generated clients through `useApiClient`, with resource key factories, parameter-aware `enabled` conditions, explicit return types, and TSDoc.
- The feature is separated into page, browser/list, detail sections, and pure schema utilities, in line with the architecture's component structure.
- PrimeVue components, English user-facing text, debounced search, virtualized list rendering, loading/error/empty/not-found states, and linkable selection are used as planned.
- Component tests cover the empty state, search and selection, deep links, detail sections, missing descriptions/framework membership, not-found behavior, detail errors, and framework tree mode.

## Verification

- `npm run lintci` — passed.
- `npm run formatci` — passed.
- `npm run typecheck` — passed.
- `npm run checkcypresscompilation` — passed.
- `npm run testcomponent -- --spec tests/component/components/pages/FrameworkExplorerPage.cy.ts` — passed (7 tests).
- `npm run checkdependencies` — passed.
- `npm run build` — passed.
