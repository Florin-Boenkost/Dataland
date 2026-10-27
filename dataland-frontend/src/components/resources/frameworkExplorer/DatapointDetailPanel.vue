<template>
  <div v-if="!id">Select a datapoint to see its details.</div>
  <Message v-else-if="!entry" severity="warn">Datapoint not found in the available frameworks.</Message>
  <div v-else>
    <Skeleton v-if="detail.isPending.value" width="100%" height="8rem" />
    <Message v-else-if="detail.isError.value" severity="error">
      Failed to load datapoint details. <Button label="Retry" @click="detail.refetch()" />
    </Message>
    <template v-else-if="detail.data.value">
      <h2>{{ detail.data.value.name }}</h2>
      <div class="detail-meta">
        <Tag v-if="base.data.value" :value="base.data.value.name" />
        <Button
          :label="showId ? 'Hide ID' : 'Show ID'"
          :icon="showId ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          text
          size="small"
          :aria-expanded="showId"
          @click="showId = !showId"
        />
        <template v-if="showId">
          <code class="detail-id">{{ id }}</code>
          <Button label="Copy ID" icon="pi pi-copy" text size="small" @click="navigator.clipboard.writeText(id)" />
        </template>
      </div>
      <Panel header="Description" class="mb-3"
        ><p>{{ detail.data.value.businessDefinition || 'No description available' }}</p></Panel
      >
      <Panel header="Appears in frameworks" class="mb-3">
        <ul class="occurrence-list">
          <li v-for="(occurrence, index) in entry.occurrences" :key="index">
            <Button
              link
              class="occurrence-link"
              :label="occurrence.frameworkName"
              @click="$emit('show-framework', occurrence.frameworkId)"
            />
            <span class="muted">{{ occurrence.displayPath.join(' > ') }}</span>
          </li>
        </ul>
      </Panel>
      <Panel header="Supported values" class="mb-3">
        <Skeleton v-if="base.isPending.value || resolved.isPending.value" height="6rem" />
        <Message v-if="base.isError.value" severity="error"
          >Could not load base type.
          <Button label="Retry" @click="base.refetch()" />
        </Message>
        <template v-if="base.data.value">
          <p>{{ base.data.value.name }} — {{ base.data.value.businessDefinition }}</p>
          <details>
            <summary>Show example</summary>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <pre class="code-block" v-html="highlightedExample"></pre>
          </details>
        </template>
        <Message v-if="resolved.isError.value" severity="error"
          >Could not load value structure.
          <Button label="Retry" @click="resolved.refetch()" />
        </Message>
        <DataTable v-else-if="fields.length" :value="fields" size="small">
          <Column field="path" header="Field path" /><Column field="type" header="Type" />
        </DataTable>
        <p v-else-if="!resolved.isPending.value && !resolved.isError.value">Value structure unavailable.</p>
      </Panel>
      <Panel header="Calculation rules and constraints" class="mb-3">
        <Button
          v-if="detail.data.value.calculationRules.length"
          label="Show flow chart"
          icon="pi pi-sitemap"
          size="small"
          text
          class="mb-2"
          @click="showFlowChart = true"
        />
        <p v-if="!detail.data.value.constraints?.length && !detail.data.value.calculationRules.length">
          No rules available.
        </p>
        <ul>
          <li v-for="(constraint, index) in detail.data.value.constraints ?? []" :key="`constraint-${index}`">
            {{ constraint }}
          </li>
          <li v-for="(rule, index) in detail.data.value.calculationRules" :key="`rule-${index}`">
            {{ rule.calculationMethod }} (inputs: {{ rule.inputs.join(', ') }})
          </li>
        </ul>
      </Panel>
      <Panel header="Technical details" toggleable collapsed>
        <dl class="tech-details">
          <dt>Datapoint ID</dt>
          <dd>{{ id }}</dd>
          <dt>Base type ID</dt>
          <dd>{{ detail.data.value.dataPointBaseType.id }}</dd>
          <dt>Validation class</dt>
          <dd>{{ base.data.value?.validatedBy ?? 'Unavailable' }}</dd>
          <dt>Report reference</dt>
          <dd>{{ framework?.referencedReportJsonPath ?? 'None' }}</dd>
          <template v-for="(occurrence, index) in entry.occurrences" :key="index">
            <dt>{{ occurrence.frameworkName }} export alias</dt>
            <dd>{{ occurrence.aliasExport ?? 'None' }}</dd>
          </template>
        </dl>
      </Panel>
    </template>
    <CalculationFlowChartDialog
      v-if="showFlowChart"
      v-model:visible="showFlowChart"
      :centerId="id"
      :datapointIds="(entries ?? []).map((item) => item.id)"
      @select="$emit('show-datapoint', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { FrameworkSpecification } from '@clients/specification-service';
import { useGetDataPointTypeSpecificationQuery } from '@/api-queries/specification-service/data-point-type/useGetDataPointTypeSpecificationQuery';
import { useGetDataPointBaseTypeQuery } from '@/api-queries/specification-service/data-point-base-type/useGetDataPointBaseTypeQuery';
import { useGetResolvedFrameworkSpecificationQuery } from '@/api-queries/specification-service/framework/useGetResolvedFrameworkSpecificationQuery';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import Panel from 'primevue/panel';
import Skeleton from 'primevue/skeleton';
import Tag from 'primevue/tag';
import CalculationFlowChartDialog from './CalculationFlowChartDialog.vue';
import type { DatapointEntry } from './frameworkExplorerSchema';
import { flattenValueStructure, resolveStructure } from './frameworkExplorerSchema';

const props = defineProps<{
  id?: string;
  entry?: DatapointEntry;
  entries?: DatapointEntry[];
  frameworkId?: string;
  frameworks: FrameworkSpecification[];
}>();
defineEmits<{ 'show-framework': [id: string]; 'show-datapoint': [id: string] }>();
const occurrence = computed(
  () => props.entry?.occurrences.find((item) => item.frameworkId === props.frameworkId) ?? props.entry?.occurrences[0]
);
const framework = computed(() => props.frameworks.find((item) => item.framework.id === occurrence.value?.frameworkId));
const detail = useGetDataPointTypeSpecificationQuery({ id: () => props.entry?.id }, { staleTime: 600_000 });
const base = useGetDataPointBaseTypeQuery(
  { id: () => detail.data.value?.dataPointBaseType.id },
  { staleTime: 600_000 }
);
const resolved = useGetResolvedFrameworkSpecificationQuery(
  { id: () => occurrence.value?.frameworkId },
  { staleTime: 600_000 }
);
const fields = computed(() =>
  flattenValueStructure(resolveStructure(resolved.data.value?.resolvedSchema, occurrence.value?.path ?? []))
);
const navigator = globalThis.navigator;
const showId = ref(false);
const showFlowChart = ref(false);
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const highlightedExample = computed(() =>
  escapeHtml(JSON.stringify(base.data.value?.example, null, 2) ?? '').replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match: string, _token: string, colon?: string): string => {
      let cls = 'json-number';
      if (match.startsWith('&quot;') || match.startsWith('"')) cls = colon ? 'json-key' : 'json-string';
      else if (match === 'null') cls = 'json-null';
      else if (match === 'true' || match === 'false') cls = 'json-boolean';
      return `<span class="${cls}">${match}</span>`;
    }
  )
);
</script>

<style scoped>
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.detail-id,
.tech-details dd {
  font-family: monospace;
  overflow-wrap: anywhere;
}
.muted {
  color: var(--p-text-muted-color);
}
.occurrence-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.occurrence-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
}
.occurrence-link {
  padding-left: 0;
  justify-content: flex-start;
}
.code-block :deep(.json-key) {
  color: #0451a5;
}
.code-block :deep(.json-string) {
  color: #a31515;
}
.code-block :deep(.json-number) {
  color: #098658;
}
.code-block :deep(.json-boolean),
.code-block :deep(.json-null) {
  color: #0000ff;
}
.code-block {
  width: fit-content;
  min-width: 50%;
  max-width: 100%;
  margin: 0.5rem auto;
  text-align: left;
  background: var(--p-surface-100);
  border-radius: var(--p-border-radius-md);
  padding: 0.75rem;
  max-height: 15rem;
  overflow: auto;
}
.tech-details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin: 0;
}
.tech-details dt {
  color: var(--p-text-muted-color);
}
.tech-details dd {
  margin: 0;
}
</style>
