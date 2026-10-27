<template>
  <TheContent class="flex" data-test="frameworkExplorerPage">
    <div class="col-12 text-left pb-0">
      <h1>Framework Explorer</h1>
    </div>
    <div class="explorer-layout col-12 grid m-0">
      <div class="col-12 lg:col-5 text-left flex flex-column gap-3">
        <SelectButton
          :modelValue="mode"
          :options="modeOptions"
          optionLabel="label"
          optionValue="value"
          :allowEmpty="false"
          aria-label="View mode"
          data-test="modeToggle"
          @update:modelValue="onModeChange"
        />
        <template v-if="mode === 'datapoint'">
          <Skeleton v-if="isListPending" height="20rem" />
          <Message v-else-if="isListError" severity="error" data-test="listError">
            Failed to load the datapoints.
            <PrimeButton label="Retry" size="small" class="ml-2" @click="refetchList()" />
          </Message>
          <DatapointSearchList
            v-else
            :items="listItems"
            :selectedId="dataPointId"
            :searchTerm="searchTerm"
            @select="(id: string) => update({ datapoint: id })"
            @update:searchTerm="(term: string) => update({ q: term })"
          />
        </template>
        <FrameworkTreeBrowser
          v-else
          :frameworks="frameworks"
          :frameworkId="effectiveFrameworkId"
          :schema="frameworkSpecification?.schema"
          :selectedDataPointId="dataPointId"
          :isLoading="isFrameworksPending || (!!effectiveFrameworkId && isFrameworkPending)"
          :hasError="isFrameworksError || isFrameworkError"
          @selectFramework="(id: string) => update({ framework: id })"
          @selectDataPoint="(id: string) => update({ datapoint: id })"
          @retry="onRetryFramework"
        />
      </div>
      <div class="col-12 lg:col-7">
        <DatapointDetailPanel :dataPointId="dataPointId" @selectFramework="onSelectFramework" />
      </div>
    </div>
  </TheContent>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Message from 'primevue/message';
import PrimeButton from 'primevue/button';
import SelectButton from 'primevue/selectbutton';
import Skeleton from 'primevue/skeleton';
import TheContent from '@/components/generics/TheContent.vue';
import DatapointSearchList from '@/components/resources/frameworkExplorer/DatapointSearchList.vue';
import FrameworkTreeBrowser from '@/components/resources/frameworkExplorer/FrameworkTreeBrowser.vue';
import DatapointDetailPanel from '@/components/resources/frameworkExplorer/DatapointDetailPanel.vue';
import {
  useFrameworkExplorerRouteState,
  type FrameworkExplorerMode,
} from '@/components/resources/frameworkExplorer/useFrameworkExplorerRouteState';
import { useListDataPointTypeSpecificationsQuery } from '@/api-queries/specification-service/data-point-type/useListDataPointTypeSpecificationsQuery';
import { useListFrameworkSpecificationsQuery } from '@/api-queries/specification-service/framework/useListFrameworkSpecificationsQuery';
import { useGetFrameworkSpecificationQuery } from '@/api-queries/specification-service/framework/useGetFrameworkSpecificationQuery';

import type { SimpleFrameworkSpecification } from '@clients/specificationservice';

const STALE_TIME_IN_MS = 10 * 60 * 1000;
const modeOptions: { label: string; value: FrameworkExplorerMode }[] = [
  { label: 'All datapoints', value: 'datapoint' },
  { label: 'By framework', value: 'framework' },
];

const { mode, frameworkId, dataPointId, searchTerm, update } = useFrameworkExplorerRouteState();

const {
  data: dataPointSummaries,
  isPending: isListPending,
  isError: isListError,
  refetch: refetchList,
} = useListDataPointTypeSpecificationsQuery({ staleTime: STALE_TIME_IN_MS });

const {
  data: frameworkList,
  isPending: isFrameworksPending,
  isError: isFrameworksError,
  refetch: refetchFrameworks,
} = useListFrameworkSpecificationsQuery({ staleTime: STALE_TIME_IN_MS });

const frameworks = computed(() => (frameworkList.value ?? []).map(toFrameworkOption));

const effectiveFrameworkId = computed(() => {
  const known = frameworks.value;
  return known.find((framework) => framework.id === frameworkId.value)?.id ?? known[0]?.id;
});

const {
  data: frameworkSpecification,
  isPending: isFrameworkPending,
  isError: isFrameworkError,
  refetch: refetchFramework,
} = useGetFrameworkSpecificationQuery(
  { frameworkSpecificationId: () => (mode.value === 'framework' ? effectiveFrameworkId.value : undefined) },
  { staleTime: STALE_TIME_IN_MS }
);

const listItems = computed(() =>
  (dataPointSummaries.value ?? []).map((summary) => ({
    id: summary.dataPointType.id,
    name: summary.name,
    description: summary.businessDefinition,
  }))
);

/**
 * Maps a framework specification summary to a select option.
 */
function toFrameworkOption(framework: SimpleFrameworkSpecification): { id: string; name: string } {
  return { id: framework.framework.id, name: framework.name };
}

/**
 * Switches the mode and keeps the selected datapoint.
 */
function onModeChange(newMode: FrameworkExplorerMode): void {
  update({ mode: newMode });
}

/**
 * Switches to the framework view of the given framework, keeping the selected datapoint.
 */
function onSelectFramework(id: string): void {
  update({ mode: 'framework', framework: id });
}

/**
 * Retries loading whatever failed in the framework view.
 */
function onRetryFramework(): void {
  if (isFrameworksError.value) void refetchFrameworks();
  else void refetchFramework();
}
</script>
