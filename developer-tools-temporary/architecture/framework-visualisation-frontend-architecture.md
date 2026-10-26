# Framework Visualisation: Frontend Architecture Decisions

Temporary planning note. Frontend only. The backend plan is intentionally not part of this document.
Companion to `framework-visualisation-sources.md`.

Status legend: **Decided** (agreed with the product owner), **Proposed** (my recommendation, open to change), **Open** (needs input).

## 1. Goal and audience

- **Decided:** Users select a datapoint and see: which frameworks it appears in, supported values, documentation, plus extra metadata (see section 6).
- **Decided:** Audience is mainly business users, plus admins and reviewers. Business wording comes first, technical details (validation class, raw JSON) are secondary and kept visually lower.
- **Decided:** LkSG is out of scope (being decommissioned, no specification).
- **Decided:** CSV-only fields (unit, mandatory flag, options, document-support, dependency) are deferred. Revisit when the page is built.

## 2. Page concept

- **Decided (option C):** One new page with a mode toggle (`SelectButton`) above the left pane:
  - **All datapoints:** flat, searchable list.
  - **By framework:** framework selector plus tree (category, subcategory, datapoint).
- **Decided:** The detail panel is shared by both modes.
- **Proposed:** The detail panel is a fixed right-hand pane in a single scroll with `Panel` sections (not tabs, not a drawer). Reasons: business users see everything without clicking, the content is easy to link and print, and a fixed pane suits both left-pane modes. The panel is built as a standalone component so it could be moved into a `Drawer` later (for the matrix view) without a rewrite.
- **Decided:** Mobile is out of scope for now. Desktop layout only.

```
+-----------------------------+--------------------------------------+
| [All datapoints|By framework]| Datapoint name           [base type]|
| [Search...]  [Framework v]  | id (copyable)                        |
|-----------------------------|--------------------------------------|
| list or tree                | Panel: Description                   |
|                             | Panel: Appears in frameworks         |
|                             | Panel: Supported values              |
|                             | Panel: Calculation rules             |
|                             | Panel: Technical details (collapsed) |
+-----------------------------+--------------------------------------+
```

## 3. Routing and navigation

- **Proposed:** Route `/framework-explorer` in `src/router/index.ts`, following the existing entries (`name`, `component`, `meta`).
- **Decided (state in URL):** The selection is kept in query parameters, so any view is linkable: `?mode=datapoint|framework&framework=<id>&datapoint=<id>&q=<search>`.
  - The route query is the single source of truth. Components read it and write to it with `router.replace`.
  - Invalid or unknown values fall back to defaults instead of failing.
- **Decided:** The page is login-only: the route sets `meta.requiresAuthentication: true`, like the other authenticated routes.
- **Decided:** The navigation entry goes at the far right of the navigation. The exact component and its position relative to existing right-aligned items (for example user menu, login button) still has to be checked against the existing navigation code.

## 4. Component structure

Under `src/components/pages/` and a new feature folder `src/components/resources/frameworkExplorer/` (matches the existing `resources/<feature>` convention).

| Component | Responsibility |
|---|---|
| `FrameworkExplorerPage.vue` (pages) | Reads and writes route state, owns the layout and the mode toggle. |
| `DatapointSearchList.vue` | "All datapoints" mode. Search input plus `DataTable` or `Listbox`. Emits the selected id. |
| `FrameworkTreeBrowser.vue` | "By framework" mode. Framework `Select` plus PrimeVue `Tree`. Emits the selected id. |
| `DatapointDetailPanel.vue` | Loads and shows the selected datapoint. Composes the section components below. |
| `DatapointFrameworksSection.vue` | Tags per framework with the category path. Click switches to "By framework" for that framework. |
| `DatapointValuesSection.vue` | Base type label, structure table and example. |
| `DatapointRulesSection.vue` | Constraints and calculation rules as readable text. |
| `DatapointTechnicalSection.vue` | Id, base type id, validation class, report reference. Collapsed by default. |

Rules:
- All components use `<script setup lang="ts">` and the Composition API.
- Components are presentational where possible. The page and the detail panel are the only places that talk to hooks and the router.
- UI uses PrimeVue and PrimeIcons only (`SelectButton`, `Select`, `InputText`, `DataTable`, `Tree`, `Panel`, `Tag`, `Message`, `Skeleton`). No new UI library. Default PrimeVue styling, scoped styles only where needed (pane layout).

## 5. Data layer

Rules come from `dataland-frontend/AGENTS.md` and `src/api-queries/AGENTS.md`.

- **Decided:** All backend access goes through TanStack Query hooks in `src/api-queries/`. No client is used in components, composables or utils.
- **Decided:** One hook equals one endpoint, with no logic inside. Filtering, mapping, sorting and combining happen in consumers (`computed`, `select`) or in feature composables outside `api-queries/`.
- **Proposed:** A new folder `src/api-queries/specification-service/` with one subfolder per resource and a key factory each, as the guide requires:

| Folder | Hooks (one per endpoint) | Key factory |
|---|---|---|
| `framework/` | `useListFrameworkSpecificationsQuery`, `useGetFrameworkSpecificationQuery` | `frameworkSpecificationKeys` |
| `data-point-type/` | `useGetDataPointTypeSpecificationQuery` | `dataPointTypeSpecificationKeys` |
| `data-point-base-type/` | `useGetDataPointBaseTypeQuery` | `dataPointBaseTypeKeys` |

  Each hook gets TSDoc, `MaybeRefOrGetter` params, an `enabled` default of "params present", and an explicit return type. Hooks for any further endpoints are added the same way once they exist.
- **Proposed:** Client access: the generated specification client has to be registered in `src/services/ApiClients.ts` so `useApiClient()` can return it. This is the only change outside `api-queries/` for client access. (The client generation itself is part of the backend/build plan, not covered here.)
- **Proposed:** Feature composables outside `api-queries/`, under `src/components/resources/frameworkExplorer/` (or a `composables` folder if the repo has one):
  - `useFrameworkExplorerRouteState`: typed read/write of the query parameters.
  - `useFrameworkTree`: turns the framework `schema` string into `Tree` nodes (parse JSON, build nodes, keep the category path per datapoint). Pure function plus a thin composable, so it is unit-testable.
  - `useDatapointFrameworkPaths`: resolves, for the selected datapoint, the path inside each framework.
  - `useBaseTypeStructure`: flattens the base type `schema` into table rows (field, type, nullable).
- **Proposed:** Caching: the specification data changes only with a deployment, so use a long `staleTime` (for example 10 minutes or more) through the hook `options` argument at the consumer. Detail requests are cached per id by the key factory, so reselecting a datapoint is instant.
- **Open (depends on the backend):** How the flat "all datapoints" list gets its data. The frontend design only requires "a list of datapoint summaries (id, name, frameworks)". It stays unspecified until the backend plan exists. The list component takes plain props, so the data source can change without touching the UI.

## 6. Detail panel content

| Section | Content | Notes for business users |
|---|---|---|
| Header | Name, base type `Tag`, copyable id | Name first, id is secondary. |
| Description | `businessDefinition` | Plain text. Handle empty with a neutral "No description available" message. |
| Appears in frameworks | One entry per framework: name `Tag` plus path "Category > Subcategory" | Click switches to "By framework" with the datapoint highlighted. |
| Supported values | Base type name and definition, structure table, example | Structure table is primary, example JSON is collapsed under "Show example". |
| Rules | Constraints and calculation rules as readable lines | Show raw rule text if it can't be formatted. |
| Technical details (collapsed) | Datapoint id, base type id, validation class, report reference path, export alias per framework | For admins and reviewers. |

Later iterations: related datapoints, framework comparison (matrix), download as CSV or JSON, CSV-only fields.

## 7. State and UX behaviour

- **Loading:** `Skeleton` in the panel while loading. The left pane shows its own loading state.
- **Errors:** A `Message` (severity error) with a retry button using the query's `refetch`. A failed detail request must not break the list.
- **Empty states:** "Select a datapoint to see its details" before a selection. "No datapoints match" for an empty search.
- **Not found:** An unknown `datapoint` id in the URL shows a not-found message in the panel, and the list stays usable.
- **Search:** Client-side, case-insensitive, over name and id (and description if the list data contains it). Debounced input.
- **Large list:** About 600 datapoints. Use the `DataTable` virtual scroller or pagination if rendering is slow. Decide after measuring.
- **Selection sync:** Selecting in either mode updates `?datapoint=`. Switching mode keeps the selected datapoint.
- **Accessibility:** Keyboard navigation comes from the PrimeVue components. The panel has a heading hierarchy, and the tags are real links or buttons with labels.
- **Decided (text):** All user-facing text is English only. No translation layer for now.

## 8. Testing

- **Cypress component tests** (`npm run testcomponent`) with `cy.mountWithPlugins(..., { keycloak: minimalKeycloakMock({}) })` and `cy.intercept` for the specification endpoints. Do not mock hooks.
  - Page: mode toggle, search, selection updates the URL, deep link opens the right datapoint.
  - Detail panel: all sections for a normal datapoint, empty description, datapoint in several frameworks, error and not-found states.
  - Tree browser: schema renders as the expected hierarchy.
- **Unit-level checks for pure logic** (`useFrameworkTree`, `useBaseTypeStructure`) with fixtures taken from real specification files.
- **E2E:** One journey: open the page, search a datapoint, see its frameworks and values. To be added once the backend side exists.

## 9. Verification before finishing

From `dataland-frontend/AGENTS.md`: `npm run lint`, `npm run typecheck`, then `npm run lintci`, `npm run formatci`, `npm run checkdependencies`, `npm run checkcypresscompilation` (if Cypress files change), plus the relevant component tests. Use the `dataland-frontend-impact` skill to scope the checks.

## 10. Open questions

Resolved: login-only, navigation entry at the far right, English only, mobile out of scope (see sections 2, 3 and 7).

1. Which navigation component hosts the entry, and how does it sit next to the existing right-aligned items? To be checked in the code.
2. Which list data the frontend can rely on (depends on the backend plan, not yet written).
