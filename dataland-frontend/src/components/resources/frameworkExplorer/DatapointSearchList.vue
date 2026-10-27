<template>
  <div class="explorer-list">
    <label for="datapoint-search" class="block mb-2">Search name, datapoint ID, alias or category</label>
    <InputText
      id="datapoint-search"
      :modelValue="search"
      @update:modelValue="$emit('update:search', String($event))"
      class="w-full mb-3"
    />
    <p v-if="!groups.length">No datapoints match.</p>
    <DataTable
      v-else
      v-model:expandedRows="expandedRows"
      :value="groups"
      paginator
      :rows="20"
      scrollable
      scrollHeight="60vh"
      dataKey="name"
      :rowClass="groupRowClass"
      @row-click="onGroupClick"
    >
      <Column expander style="width: 3rem" />
      <Column field="name" header="Datapoint" />
      <Column header="Frameworks">
        <template #body="{ data }">{{ frameworkNames(data).join(', ') }}</template>
      </Column>
      <template #expansion="{ data }">
        <DataTable
          :value="occurrenceRows(data)"
          size="small"
          :rowClass="occurrenceRowClass"
          @row-click="onOccurrenceClick($event.data)"
        >
          <Column header="Framework">
            <template #body="{ data: row }">
              <Button link :label="row.frameworkName" @click.stop="onOccurrenceClick(row)" />
            </template>
          </Column>
          <Column field="category" header="Category" />
          <Column field="id" header="Datapoint ID" />
        </DataTable>
      </template>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from 'primevue/button';
import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable';
import Column from 'primevue/column';
import InputText from 'primevue/inputtext';
import { groupDatapointsByName, type DatapointEntry, type DatapointGroup } from './frameworkExplorerSchema';

interface OccurrenceRow {
  id: string;
  frameworkId: string;
  frameworkName: string;
  category: string;
}

const props = defineProps<{
  entries: DatapointEntry[];
  search: string;
  selectedId?: string;
  selectedFrameworkId?: string;
}>();
const emit = defineEmits<{ 'update:search': [value: string]; select: [id: string, frameworkId: string] }>();
const expandedRows = ref<Record<string, boolean>>({});

const filteredEntries = computed(() => {
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
const groups = computed(() => groupDatapointsByName(filteredEntries.value));

watch(
  [(): string | undefined => props.selectedId, groups],
  (): void => {
    const group = groups.value.find((item) => item.entries.some((entry) => entry.id === props.selectedId));
    if (group && !expandedRows.value[group.name]) expandedRows.value = { ...expandedRows.value, [group.name]: true };
  },
  { immediate: true }
);

/** List the distinct frameworks in which any datapoint of the group occurs. */
function frameworkNames(group: DatapointGroup): string[] {
  return [...new Set(group.entries.flatMap((entry) => entry.occurrences.map((item) => item.frameworkName)))];
}

/** Flatten a group into one row per framework occurrence. */
function occurrenceRows(group: DatapointGroup): OccurrenceRow[] {
  return group.entries.flatMap((entry) =>
    entry.occurrences.map((occurrence) => ({
      id: entry.id,
      frameworkId: occurrence.frameworkId,
      frameworkName: occurrence.frameworkName,
      category: occurrence.displayPath.join(' > '),
    }))
  );
}

/** Expand or collapse a group when its row is clicked, ignoring the expander button itself. */
function onGroupClick(event: DataTableRowClickEvent): void {
  if ((event.originalEvent.target as HTMLElement).closest('button')) return;
  const name = (event.data as DatapointGroup).name;
  expandedRows.value = { ...expandedRows.value, [name]: !expandedRows.value[name] };
}

/** Select the datapoint in the chosen framework. */
function onOccurrenceClick(row: OccurrenceRow): void {
  emit('select', row.id, row.frameworkId);
}

/** Highlight a group row that contains the selected datapoint. */
function groupRowClass(group: DatapointGroup): string {
  return group.entries.some((entry) => entry.id === props.selectedId) ? 'explorer-selected-row' : '';
}

/** Highlight the exact framework occurrence that is currently shown. */
function occurrenceRowClass(row: OccurrenceRow): string {
  return row.id === props.selectedId && row.frameworkId === props.selectedFrameworkId ? 'explorer-selected-row' : '';
}
</script>

<style scoped>
.explorer-list :deep(tbody > tr) {
  cursor: pointer;
}
.explorer-list :deep(tr.explorer-selected-row) {
  background: var(--p-primary-100);
  color: var(--p-text-color);
  box-shadow: inset 4px 0 0 var(--p-primary-color);
}
</style>
