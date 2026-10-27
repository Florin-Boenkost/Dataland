<template>
  <TheContent>
    <h1>Framework Explorer</h1>
    <Message v-if="list.isError.value" severity="error"
      >Could not load frameworks.
      <Button label="Retry" @click="list.refetch()" />
    </Message>
    <Skeleton v-else-if="list.isPending.value || pendingFrameworks" height="12rem" />
    <Message v-else-if="failedFrameworks.length || indexResult.error" severity="error"
      >Could not load some frameworks.
      <Button v-if="failedFrameworks.length" label="Retry" @click="retryFrameworks" />
    </Message>
    <template v-else>
      <div class="explorer-layout">
        <aside>
          <SelectButton
            :modelValue="mode"
            :options="modes"
            optionLabel="label"
            optionValue="value"
            @update:modelValue="setQuery({ mode: $event })"
            class="mb-3"
          />
          <DatapointSearchList
            v-if="mode === 'datapoint'"
            :entries="indexResult.entries"
            :search="searchInput"
            :selectedId="selectedId"
            @update:search="onSearch"
            @select="setQuery({ datapoint: $event })"
          />
          <FrameworkTreeBrowser
            v-else
            :frameworks="list.data.value ?? []"
            :frameworkId="frameworkId"
            :specification="selectedFramework"
            :selectedId="selectedId"
            @select-framework="setQuery({ framework: $event })"
            @select="setQuery({ datapoint: $event })"
          />
        </aside>
        <main>
          <DatapointDetailPanel
            :id="selectedId"
            :entry="selectedEntry"
            :frameworkId="frameworkId"
            :frameworks="frameworkDetails"
            @show-framework="setQuery({ mode: 'framework', framework: $event })"
          />
        </main>
      </div>
    </template>
    <FrameworkLoader
      v-for="id in frameworkIds"
      :key="`${id}-${retryKey}`"
      :id="id"
      @loaded="onFrameworkLoaded"
      @failed="onFrameworkFailed"
    />
  </TheContent>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router';
import type { FrameworkSpecification } from '@clients/specification-service';
import TheContent from '@/components/generics/TheContent.vue';
import FrameworkLoader from '@/components/resources/frameworkExplorer/FrameworkLoader.vue';
import DatapointSearchList from '@/components/resources/frameworkExplorer/DatapointSearchList.vue';
import FrameworkTreeBrowser from '@/components/resources/frameworkExplorer/FrameworkTreeBrowser.vue';
import DatapointDetailPanel from '@/components/resources/frameworkExplorer/DatapointDetailPanel.vue';
import { buildDatapointIndex } from '@/components/resources/frameworkExplorer/frameworkExplorerSchema';
import { useListFrameworkSpecificationsQuery } from '@/api-queries/specification-service/framework/useListFrameworkSpecificationsQuery';
import Button from 'primevue/button';
import Message from 'primevue/message';
import SelectButton from 'primevue/selectbutton';
import Skeleton from 'primevue/skeleton';

const route = useRoute();
const router = useRouter();
const list = useListFrameworkSpecificationsQuery({ staleTime: 600_000 });
const modes = [
  { label: 'All datapoints', value: 'datapoint' },
  { label: 'By framework', value: 'framework' },
];
const queryString = (value: LocationQueryValue | LocationQueryValue[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;
const mode = computed(() => (queryString(route.query.mode) === 'framework' ? 'framework' : 'datapoint'));
const search = computed(() => queryString(route.query.q) ?? '');
const selectedId = computed(() => queryString(route.query.datapoint));
const frameworkIds = computed(() => (list.data.value ?? []).map((item) => item.framework.id));
const frameworkId = computed(() => {
  const requested = queryString(route.query.framework);
  return frameworkIds.value.includes(requested ?? '') ? requested : frameworkIds.value[0];
});
const details = ref<Record<string, FrameworkSpecification>>({});
const failedFrameworks = ref<string[]>([]);
const retryKey = ref(0);
const frameworkDetails = computed(() => frameworkIds.value.map((id) => details.value[id]).filter((item) => !!item));
const pendingFrameworks = computed(() =>
  frameworkIds.value.some((id) => !details.value[id] && !failedFrameworks.value.includes(id))
);
const indexResult = computed(() => {
  if (pendingFrameworks.value || failedFrameworks.value.length) return { entries: [], error: false };
  try {
    return { entries: buildDatapointIndex(frameworkDetails.value), error: false };
  } catch {
    return { entries: [], error: true };
  }
});
const selectedEntry = computed(() => indexResult.value.entries.find((entry) => entry.id === selectedId.value));
const selectedFramework = computed(() => details.value[frameworkId.value ?? '']);
/** Keep explorer state shareable in the route query. */
function setQuery(changes: Record<string, string>): void {
  void router.replace({ query: { ...route.query, ...changes } });
}
/** Store one framework after its query succeeds. */
function onFrameworkLoaded(framework: FrameworkSpecification): void {
  details.value = { ...details.value, [framework.framework.id]: framework };
  failedFrameworks.value = failedFrameworks.value.filter((id) => id !== framework.framework.id);
}
/** Flag a framework load failure without rendering a partial index. */
function onFrameworkFailed(id: string): void {
  if (!failedFrameworks.value.includes(id)) failedFrameworks.value = [...failedFrameworks.value, id];
}
/** Retry failed framework detail queries. */
function retryFrameworks(): void {
  failedFrameworks.value = [];
  retryKey.value++;
}
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const searchInput = ref(search.value);
watch(search, (value) => {
  searchInput.value = value;
});
/** Debounce search updates before replacing the URL. */
function onSearch(value: string): void {
  searchInput.value = value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => setQuery({ q: value }), 250);
}
onUnmounted(() => clearTimeout(searchTimer));
</script>

<style scoped>
.explorer-layout {
  display: grid;
  grid-template-columns: minmax(25rem, 45%) minmax(30rem, 1fr);
  gap: 1.5rem;
}
.explorer-layout aside {
  min-width: 0;
}
.explorer-layout main {
  min-width: 0;
}
</style>
