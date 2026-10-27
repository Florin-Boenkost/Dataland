<template>
  <div>
    <label for="datapoint-search" class="block mb-2">Search name, datapoint ID, alias or category</label>
    <InputText
      id="datapoint-search"
      :modelValue="search"
      @update:modelValue="$emit('update:search', String($event))"
      class="w-full mb-3"
    />
    <p v-if="!filtered.length">No datapoints match.</p>
    <DataTable
      v-else
      :value="filtered"
      paginator
      :rows="20"
      scrollable
      scrollHeight="60vh"
      dataKey="id"
      selectionMode="single"
      :selection="selected"
      @update:selection="onSelection"
    >
      <Column field="displayName" header="Datapoint" />
      <Column header="Frameworks / category">
        <template #body="{ data }">
          {{
            data.occurrences
              .map((entry: DatapointOccurrence) => `${entry.frameworkName}: ${entry.path.slice(0, -1).join(' > ')}`)
              .join('; ')
          }}
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import type { DatapointEntry, DatapointOccurrence } from './frameworkExplorerSchema';

const props = defineProps<{ entries: DatapointEntry[]; search: string; selectedId?: string }>();
const emit = defineEmits<{ 'update:search': [value: string]; select: [id: string] }>();
const selected = computed(() => props.entries.find((entry) => entry.id === props.selectedId));
const filtered = computed(() => {
  const search = props.search.trim().toLowerCase();
  if (!search) return props.entries;
  return props.entries.filter((entry) =>
    [
      entry.displayName,
      entry.id,
      ...entry.occurrences.flatMap((occurrence) => [occurrence.aliasExport ?? '', ...occurrence.path]),
    ].some((value) => value.toLowerCase().includes(search))
  );
});
/** Ignore selection-clear events when a row is clicked twice. */
function onSelection(entry: DatapointEntry | undefined): void {
  if (entry) emit('select', entry.id);
}
</script>
