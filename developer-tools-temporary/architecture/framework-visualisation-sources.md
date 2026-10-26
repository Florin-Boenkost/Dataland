# Framework Visualisation: Sources

Temporary planning note. Goal: show in the UI which datapoints belong to which framework, plus their descriptions and metadata.

Scope notes:
- LkSG is out of scope. It has no spec JSON and is being decommissioned.
- CSV-only fields (unit, mandatory flag, options, document-support, dependency) are listed below as a known gap. Revisit when building the page.

## 1. Specification service (runtime source of truth)
Base path `/specifications`, port 8489. The inbound proxy already routes `/specifications/` to it (`dataland-inbound-proxy/templates/common.template:78`).

| Source | Useful for |
|---|---|
| `dataland-specification-service/src/main/kotlin/org/dataland/datalandspecificationservice/api/SpecificationApi.kt` | Endpoints: `GET /frameworks`, `/frameworks/{id}`, `/frameworks/{id}/resolved-schema`, `/data-point-types/{id}`, `/data-point-types/{id}/validated-by`, `/data-point-base-types/{id}`, `/data-point-base-types/{id}/validated-by`. There is no "list all datapoint types" endpoint, so walk the framework schema and fetch each type by id. |
| `.../controller/SpecificationController.kt` | Implementation on top of the in-memory `SpecificationDatabase`. |
| `.../model/FrameworkSpecification.kt` | Framework `name`, `businessDefinition`, `referencedReportJsonPath`, and `schema` (a JSON string). Leaves are `{id, ref, aliasExport}`, giving framework to datapoint membership and the category/subcategory hierarchy. |
| `.../model/DataPointTypeSpecification.kt` | Datapoint `name`, `businessDefinition` (the description), base type, `usedBy` (frameworks using it), `constraints`, `calculationRules`. |
| `.../model/DataPointBaseTypeSpecification.kt` | Value structure, `example`, `validatedBy`, `usedBy`. |
| `.../model/IdWithRef.kt` | `{id, ref}` pair; `ref` is a URL to the resource. |
| `dataland-specification-service/specificationServiceOpenApi.json` | Input for client generation. Do not hand-edit; regenerate with `./gradlew :dataland-specification-service:generateOpenApiDocs`. |
| `.../src/test/kotlin/.../SpecificationControllerTest.kt`, `src/test/resources/specifications-test/**` | Fixtures showing the file formats. |

## 2. Stored spec JSON
All under `dataland-specification-service/src/main/resources/specifications/`:
- `frameworks/*.json` (7): sfdr, pcaf, nuclear-and-gas, eutaxonomy-financials, eutaxonomy-financials-2026-73, eutaxonomy-non-financials, eutaxonomy-non-financials-2026-73. Hierarchical membership schema.
- `dataPointTypes/*.json` (599): `id`, `name`, `businessDefinition`, `dataPointBaseTypeId`, `frameworkOwnership`, `constraints`, `calculationRules`.
- `dataPointBaseTypes/*.json` (22): `validatedBy`, value `schema`, `example`.
- `translations/*.json` (7): datapoint to export alias (source of `aliasExport`).

## 3. CSVs (original authoring source)
All under `dataland-framework-toolbox/inputs/`:
- `sfdr/sfdr.csv`
- `pcaf/pcaf.csv`
- `nuclear-and-gas/nuclear-and-gas.csv`
- `eu-taxonomy-financials/eu-taxonomy-financials.csv`
- `euTaxonomyNonFinancials/EutaxonomyNonFinancials.csv`
- `eutaxonomy-financials-2026-73/eutaxonomy-financials-2026-73.csv`
- `eutaxonomy-non-financials-2026-73/eutaxonomy-non-financials-2026-73.csv`
- (`lksg/lksg.csv` exists but is out of scope.)

Useful columns: Field Identifier, Category, Sub-Category, Field Name, Alias Export, Tooltip (upload/view), Component, Options, Unit, Document-Support, Dependency, Show when value is, Mandatory Field, Field Calculation, Data Point Type Name Overwrite.

Known gap (CSV-only, not exposed by the spec service; revisit when building the page): unit, mandatory flag, options, document-support, dependency. Also present in frontend `ViewConfig.ts` / `UploadConfig.ts`.

Helper: `dataland-framework-toolbox/excel-to-csv/convert-excel-to-csv.sh` converts the Excel source to CSV.

## 4. Framework-toolbox generator code
Explains how CSV columns map to spec fields. Under `dataland-framework-toolbox/`:
- `AGENTS.md`
- `src/main/kotlin/org/dataland/frameworktoolbox/utils/DatalandRepository.kt` (spec output path)
- `.../specific/specification/FrameworkSpecificationBuilder.kt`, `FrameworkBuilder.kt`, `FrameworkTranslationBuilder.kt`, `SpecificationNamingConvention.kt`
- `.../specific/specification/elements/DatapointBuilder.kt`, `CategoryBuilder.kt`, `TranslationBuilder.kt`, `SpecificationElement.kt`
- `.../frameworks/sfdr/SfdrFramework.kt`, `pcaf/PcafFramework.kt`, `eutaxonomyfinancials/EuTaxonomyFinancialsFramework.kt`, `eutaxonomyfinancials202673/EuTaxonomyFinancials202673Framework.kt`, `EuTaxonomyNonFinancialsBaseFramework.kt`
- `.../template/components/FieldCalculationParser.kt` (parses `Field Calculation` into `calculationRules`)
- `.../intermediate/group/ComponentGroup.kt`, `.../intermediate/components/ReportPreuploadComponent.kt`

## 5. Shared library
`dataland-specification-lib/src/main/kotlin/org/dataland/datalandspecification/`:
- `specifications/Framework.kt` (includes `flattenedSchema`), `DataPointType.kt`, `DataPointBaseType.kt`, `FrameworkTranslation.kt`, `CalculationRule.kt`
- `database/SpecificationDatabase.kt`, `database/fs/FileSystemSpecificationDatabase.kt`

## 6. Client and frontend wiring
- The frontend has no specification-service client and no code consuming `/specifications`.
- Add a `generateSpecificationServiceClient` task in `dataland-frontend/build.gradle.kts` (input: `specificationServiceOpenApi.json`) and include it in `generateClients`.
- Model for the task: `dataland-backend/build.gradle.kts` (~lines 210-275, output `build/clients/specification-service`). `dataland-qa-service/build.gradle.kts` also references it.
- Patterns to mirror: `dataland-frontend/src/frameworks/` (`ViewConfig.ts`, `FrontendFrameworkRegistry.ts`, `BaseFrameworkDefinition.ts`, `FrameworkApiUtils.ts`), `src/router/index.ts`, `src/components/pages/`.
- Follow `dataland-frontend/AGENTS.md` and `dataland-sharedElements/AGENTS.md`.

## Data mapping for the feature
- Framework to datapoints: `GET /specifications/frameworks`, then `/frameworks/{id}`; parse `schema` and read each leaf's `id` (and `aliasExport`).
- Datapoint to frameworks: `usedBy` on `/data-point-types/{id}` (static: `frameworkOwnership`).
- Descriptions: `name` and `businessDefinition` on the datapoint type; base type adds `example`; CSV tooltip is the original text.
- Other metadata: `constraints`, `calculationRules`, `dataPointBaseType.id`, `referencedReportJsonPath`.
