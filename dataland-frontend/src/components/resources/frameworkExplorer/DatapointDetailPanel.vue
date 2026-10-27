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
      <p>
        <Tag v-if="base.data.value" :value="base.data.value.name" /> {{ id }}
        <Button label="Copy ID" text size="small" @click="navigator.clipboard.writeText(id)" />
      </p>
      <Panel header="Description" class="mb-3"
        ><p>{{ detail.data.value.businessDefinition || 'No description available' }}</p></Panel
      >
      <Panel header="Appears in frameworks" class="mb-3">
        <ul>
          <li v-for="(occurrence, index) in entry.occurrences" :key="index">
            <Button link :label="occurrence.frameworkName" @click="$emit('show-framework', occurrence.frameworkId)" />
            {{ occurrence.path.slice(0, -1).join(' > ') }}
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
            <pre>{{ JSON.stringify(base.data.value.example, null, 2) }}</pre>
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
      <details>
        <summary>Technical details</summary>
        <dl>
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
      </details>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
import type { DatapointEntry } from './frameworkExplorerSchema';
import { flattenValueStructure, resolveStructure } from './frameworkExplorerSchema';

const props = defineProps<{
  id?: string;
  entry?: DatapointEntry;
  frameworkId?: string;
  frameworks: FrameworkSpecification[];
}>();
defineEmits<{ 'show-framework': [id: string] }>();
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
</script>
