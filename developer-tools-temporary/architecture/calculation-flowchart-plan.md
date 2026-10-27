# Calculation Rules Flow Chart: Implementation Plan (frontend only)

Temporary planning note. Status legend: **Verified** (read in code), **Proposed**, **Open**.

## 1. Goal

In the Framework Explorer detail panel, the "Calculation rules and constraints" box gets a clickable entry that opens a popup with a multi-level flow chart of calculation rule dependencies, in both directions:

- Upstream: "calculated from" (rule inputs, recursively).
- Downstream: "used to calculate" (datapoints that list the current one as an input, recursively).

Decisions from the requirements discussion:

- Multi-level, in both directions, with a scrollable chart area inside the popup.
- Clicking a node keeps the popup open and re-centers the chart on that node. The datapoint shown in the page behind the popup switches to the clicked datapoint (route query `datapoint`).
- Datapoints with several rules show all of them.
- Constraints are out of scope for now.

## 2. What exists (verified)

- `CalculationRule = { inputs: string[]; calculationMethod: string }`, found in `DataPointTypeSpecification.calculationRules`. No backend or OpenAPI change is needed.
- `GET /specifications/data-point-types/{id}` is the only datapoint-type endpoint. There is **no list endpoint and no reverse ("used as input by") lookup**. `usedBy` on the spec lists frameworks, not datapoints.
- `useGetDataPointTypeSpecificationQuery({ id }, options)` exists in `src/api-queries/specification-service/data-point-type/`. It is one endpoint per hook, with a key factory.
- `buildDatapointIndex` in `frameworkExplorerSchema.ts` gives every known datapoint ID with name and occurrences. This is the universe of nodes.
- `DatapointDetailPanel.vue` currently shows rules as text. `FrameworkExplorerPage.vue` stores the selection in the route query via `setQuery`.
- **Open:** whether `inputs` are always datapoint type IDs. They are treated as IDs and non-matching entries are rendered as inert "unknown" nodes.

## 3. Key challenge: the downstream direction

Downstream needs the rules of every other datapoint, and there is no endpoint for it. Options:

- A. **Lazy full scan (recommended):** when the popup opens, fetch the specs of all datapoints in the index (a few hundred requests, at 10 minute `staleTime` and cached by TanStack Query), build a reverse map `inputId -> [datapointIds]`, and cache it. Show upstream immediately and downstream with a loading state ("Scanning N datapoints...", with a progress count).
- B. Add a backend endpoint for reverse lookup. This is cleaner but is out of scope, because the project decision so far is frontend only. It can be revisited if A proves too slow.

The scan is started only on first popup open, and the cached reverse map is shared by all later opens.

## 4. Architecture

### 4.1 Data layer (`src/api-queries/`)

- Reuse `useGetDataPointTypeSpecificationQuery`. No new hook is strictly required.
- The multi-call orchestration is not allowed inside a hook (see `api-queries/AGENTS.md` rule 1), so it goes into a **feature composable** outside `api-queries/`:
  - `src/components/resources/frameworkExplorer/useCalculationGraph.ts`
  - It composes TanStack `useQueries` over the datapoint ID list, and each query's `queryKey` and `queryFn` come from the existing key factory.
  - **Open:** `useQueries` needs the client call, and clients may not be used outside `api-queries/`. Resolution: add one thin hook file there, for example `useGetDataPointTypeSpecificationQueryOptions.ts`, which returns the `queryOptions` object for an ID (one endpoint, no logic). The composable passes those options to `useQueries`. This follows the repo rules and is the only change in `api-queries/`.
- Upstream expansion: starting at the center ID, request specs on demand for each input, down to the depth limit. These are cache hits once the full scan has finished.

### 4.2 Pure graph builder (`frameworkExplorerSchema.ts` or a new `calculationGraph.ts`)

- `buildCalculationGraph(centerId, specsById, reverseMap, { upDepth, downDepth })` returns `{ nodes, edges, levels }`.
  - Node: `{ id, name, kind: 'center' | 'datapoint' | 'method' | 'unknown', level }`.
  - A rule becomes a **method node** (label `calculationMethod`) between its inputs and its output, so several rules on the same datapoint are all visible as separate method nodes.
  - `level` is negative for upstream and positive for downstream. The center is 0.
  - Cycle protection with a visited set per direction. A repeated datapoint is shown as a reference node (dashed) and is not expanded again.
  - Depth cap (default 3 per direction), with a "+N more" collapsed marker at the boundary that re-centers when clicked.
- Pure and unit-testable, with no Vue or network access.

### 4.3 UI components (PrimeVue, plus plain SVG/CSS)

- `CalculationFlowChartDialog.vue`:
  - PrimeVue `Dialog`, modal, medium size (about 80vw by 70vh), `dismissableMask`.
  - Header: the center datapoint name, and a depth selector (`SelectButton`: 1, 2, 3 levels).
  - Body: the scroll container (`overflow: auto`, both axes) holding the chart. On open and on re-center it scrolls the center node into view.
  - Loading and error states: `Skeleton` for the first load, `ProgressBar` or text for the downstream scan, `Message` plus a retry `Button` when specs fail.
  - Emits `recenter(id)` and `close`.
- `CalculationFlowChart.vue`:
  - Left-to-right layout. Columns are levels, ordered from -N to +N, the center is highlighted, and nodes in a column are stacked vertically.
  - Datapoint nodes are HTML boxes, absolutely positioned from a simple deterministic layout. Edges are an SVG overlay with cubic paths and arrowheads. No new library.
  - Method nodes are small pills sitting on the edge, between the input and output columns.
  - Keyboard support: nodes are `button`s with `aria-label`s, and the Enter key re-centers.
  - Unknown input IDs are greyed out and not clickable.
- `DatapointDetailPanel.vue`:
  - In the "Calculation rules and constraints" box, add a `Button` ("Show flow chart", `pi pi-sitemap`, `link` or `text` style). It is shown when the datapoint has rules **or** when the reverse map says it is an input to another datapoint. Before the scan, show it whenever rules exist, and show a downstream-only entry after the scan.
  - It emits `show-datapoint(id)`, which the page maps to `setQuery({ datapoint })`.

### 4.4 Page wiring

- `FrameworkExplorerPage.vue` handles `show-datapoint` through `setQuery({ datapoint: id })`. The detail panel in the background re-renders with the new datapoint because it is already driven by the query.
- The dialog's open state and its center ID live in the panel. The center ID follows the `id` prop, so a node click only emits `show-datapoint` and the dialog re-centers when the prop changes. There is one source of truth, and it also supports deep links.
- **Open:** clicking a datapoint that is not in the current list filter must not clear the search. `setQuery` should only change `datapoint`.

## 5. Implementation steps

1. Add the `queryOptions` hook in `api-queries/specification-service/data-point-type/` and extend the key factory if needed.
2. Write `calculationGraph.ts` (pure builder) and its Cypress component unit tests: single rule, multiple rules, shared inputs, cycle, depth cap, unknown input, downstream-only.
3. Write `useCalculationGraph.ts` (full scan with `useQueries`, reverse map, progress, error aggregation).
4. Build `CalculationFlowChart.vue` (layout and SVG edges) and `CalculationFlowChartDialog.vue`.
5. Add the button and the `show-datapoint` event to `DatapointDetailPanel.vue`, and wire the page.
6. Add component tests (see section 6).
7. Run verification (see section 7).

## 6. Tests (Cypress component, `FrameworkExplorer.cy.ts` or a new spec in the same folder)

- Graph builder unit tests (step 2).
- The button is hidden when a datapoint has no rules and no dependents.
- The popup opens and shows the center, its inputs, and one method pill per rule.
- Multi-level: a chain A <- B <- C shows all three at depth 2 or more.
- Downstream: a datapoint used by another shows it on the right after the scan finishes.
- Clicking a node keeps the dialog open, changes the route query `datapoint`, and the detail panel behind it shows the new name.
- The chart area is scrollable (`overflow: auto`) and the center node is in view after re-center.
- Failure case: a failing spec request shows an error message with retry.
- Intercepts use `cy.intercept` on `/specifications/data-point-types/*`.

## 7. Verification

From `dataland-frontend`:

- `npm run lint`, `npm run typecheck`, `npm run formatci`, `npm run checkdependencies`
- `npm run checkcypresscompilation`
- `npx cypress run --component --spec tests/component/components/resources/frameworkExplorer/*.cy.ts`

## 8. Risks and mitigations

- **Downstream scan cost:** hundreds of requests. Mitigations: lazy start, `staleTime` 10 minutes, concurrency is bounded by the browser, a progress indicator, and a decision point to move to backend option B if it is too slow.
- **Large fan-in or fan-out:** wide columns. Mitigations: the scroll container, the depth selector, and a "+N more" cap per column (for example 12).
- **`inputs` that are not IDs:** inert nodes (see section 2).
- **Layout quality:** a column-based layout is deterministic but may produce crossing edges. This is acceptable for the first version, and it can be reduced by ordering nodes by their parents' position.
- **Accessibility:** the SVG is decorative, and the nodes carry the semantics.

## 9. Out of scope

- Showing constraints in the chart.
- Backend changes or a new reverse-lookup endpoint (unless the scan proves too slow).
- Editing rules, export of the chart as an image, and zoom or pan beyond the native scrolling.

## 10. Decisions (resolved)

1. Downstream data: frontend-only lazy scan (option A). No backend change.
2. Default depth: **1 level** per direction. The selector offers 1, 2 and 3.
3. The "Show flow chart" button appears **only for datapoints that have their own calculation rules**. It does not appear for datapoints that are merely used as inputs elsewhere.

## 11. Implementation status

All planned work is implemented and verified in `dataland-frontend`.

### Done

- `api-queries/specification-service/data-point-type/useGetDataPointTypeSpecificationQuery.ts`: added `getDataPointTypeSpecificationQueryOptions(id, apiClientProvider)`. The existing hook is unchanged.
- `frameworkExplorer/calculationGraph.ts`: pure builder (`buildReverseLookup`, `buildCalculationGraph`). Each rule is its own method node, with cycle protection, a depth cap, truncated markers and inert unknown inputs. A depth off-by-one found by the unit tests was fixed.
- `frameworkExplorer/CalculationFlowChart.vue`: column layout, SVG edges and clickable nodes. It scrolls the center node into view.
- `frameworkExplorer/CalculationFlowChartDialog.vue`: PrimeVue `Dialog` with a scrollable area, a depth selector (default 1, options 1 to 3), a progress bar and an error message. It loads specs through `useQueries` and the options helper, with a 10 minute `staleTime`.
- `DatapointDetailPanel.vue`: a "Show flow chart" button only when the datapoint has its own rules. New `entries` prop and `show-datapoint` emit. The dialog is mounted outside the loading and rules branches, so it stays open while the datapoint behind it switches.
- `FrameworkExplorerPage.vue`: passes the index and handles `show-datapoint` with `setQuery({ datapoint })`.
- Tests: `CalculationGraph.cy.ts` (6 unit tests) and 2 new cases in `FrameworkExplorer.cy.ts` (open and re-center on click, button hidden without rules).

### Verification

- eslint, vue-tsc, prettier, `checkcypresscompilation` and `checkdependencies`: see the final summary.
- Cypress component specs in `frameworkExplorer/`: 20 tests passing.

### Caveats

- The scan fetches one spec per known datapoint when the popup opens. If it is too slow, revisit the backend reverse-lookup option.
- Layout is a simple column layout, so edges can cross. It has not been checked visually in a browser.

## 12. Feedback round 1 (done)

- **Missing rule output.** This was a display bug, not a data problem. "Assets covered by the KPI - monetary amount" and "Weighted Average ... monetary amount" depend on each other (DivisionByPercent and MultiplicationByPercent). The builder kept one node per datapoint, so the output of the multiplication was drawn onto the existing upstream node and the edge ran backwards. Datapoints now get one node per level (`dp:<id>@<level>`), and every edge connects neighbouring columns.
- **Higher levels hiding lower-level calculations.** This came from the same node sharing. Expansion now tracks each (datapoint, level) separately.
- **Edge crossings.** Added `orderColumns` (barycenter ordering that sweeps outwards from the center). `CalculationFlowChart.vue` uses it for the vertical order.
- **Scrolling.** The chart area has a fixed height of 60vh and scrolls in both directions. The center node is scrolled to the middle of that container, not the page.
- Tests: 3 new graph tests (mutual dependency, neighbouring columns only, no crossings). 23 explorer component tests pass.
