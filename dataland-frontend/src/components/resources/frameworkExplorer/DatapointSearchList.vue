<template>
  <div class="flex flex-column gap-2" data-test="datapointSearchList">
    <InputText
      v-model="searchInput"
      placeholder="Search by name, id or description"
      aria-label="Search datapoints"
      data-test="datapointSearchInput"
      fluid
    />
    <Listbox
      :modelValue="selectedId"
      :options="filteredItems"
      optionLabel="name"
      optionValue="id"
      :virtualScrollerOptions="{ itemSize: 52 }"
      listStyle="height: 60vh"
      @update:modelValue="onSelect"
    >
      <template #option="{ option }">
        <div class="flex flex-column text-left" :data-test="`datapointOption-${option.id}`">
          <span class="font-semibold">{{ option.name }}</span>
          <span class="text-sm text-color-secondary">{{ option.id }}</span>
        </div>
      </template>
      <template #empty>
        <span data-test="noDatapointsMatch">No datapoints match</span>
      </template>
    </Listbox>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import Listbox from 'primevue/listbox';

export interface DatapointListItem {
  id: string;
  name: string;
  description: string;
}

const props = defineProps<{
  items: DatapointListItem[];
  selectedId: string | undefined;
  searchTerm: string;
}>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
  (event: 'update:searchTerm', term: string): void;
}>();

const DEBOUNCE_IN_MS = 250;
const searchInput = ref(props.searchTerm);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.searchTerm,
  (term) => {
    if (term !== searchInput.value) searchInput.value = term;
  }
);

watch(searchInput, (term) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit('update:searchTerm', term), DEBOUNCE_IN_MS);
});

onBeforeUnmount(() => clearTimeout(debounceTimer));

const filteredItems = computed(() => {
  const term = props.searchTerm.trim().toLowerCase();
  if (!term) return props.items;
  return props.items.filter((item) =>
    [item.name, item.id, item.description].some((text) => text.toLowerCase().includes(term))
  );
});

/**
 * Emits the selected id; ignores deselection.
 */
function onSelect(id: string | null): void {
  if (id) emit('select', id);
}
</script>
