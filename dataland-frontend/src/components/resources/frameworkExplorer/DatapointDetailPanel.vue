<template>
  <div data-test="datapointDetailPanel">
    <Message v-if="!dataPointId" severity="info" data-test="noSelection">Select a datapoint to see its details</Message>
    <Skeleton v-else-if="isPending" height="20rem" data-test="detailLoading" />
    <Message v-else-if="isNotFound" severity="warn" data-test="detailNotFound">
      The datapoint "{{ dataPointId }}" was not found.
    </Message>
    <Message v-else-if="isError" severity="error" data-test="detailError">
      Failed to load the datapoint.
      <PrimeButton label="Retry" size="small" class="ml-2" @click="refetch()" />
    </Message>
    <div v-else-if="dataPoint" class="flex flex-column gap-3">
      <div class="flex flex-column gap-1 text-left">
        <div class="flex align-items-center gap-2">
          <h2 class="m-0" data-test="detailName">{{ dataPoint.name }}</h2>
          <Tag :value="dataPoint.dataPointBaseType.id" data-test="detailBaseTypeTag" />
        </div>
        <div class="flex align-items-center gap-1">
          <span class="text-sm text-color-secondary" data-test="detailId">{{ dataPoint.dataPointType.id }}</span>
          <PrimeButton
            icon="pi pi-copy"
            text
            size="small"
            aria-label="Copy datapoint id"
            data-test="copyIdButton"
            @click="copyId"
          />
        </div>
      </div>
      <Panel header="Description" data-test="descriptionSection">
        <p v-if="dataPoint.businessDefinition" class="m-0">{{ dataPoint.businessDefinition }}</p>
        <p v-else class="m-0">No description available</p>
      </Panel>
      <DatapointFrameworksSection
        :usedBy="dataPoint.usedBy"
        :dataPointId="dataPoint.dataPointType.id"
        @selectFramework="(id: string) => emit('selectFramework', id)"
      />
      <DatapointValuesSection :baseType="baseType" :isPending="isBaseTypePending" :isError="isBaseTypeError" />
      <DatapointRulesSection
        :constraints="dataPoint.constraints ?? []"
        :calculationRules="dataPoint.calculationRules"
      />
      <DatapointTechnicalSection
        :dataPointId="dataPoint.dataPointType.id"
        :baseTypeId="dataPoint.dataPointBaseType.id"
        :validatedBy="baseType?.validatedBy"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isAxiosError } from 'axios';
import Message from 'primevue/message';
import Skeleton from 'primevue/skeleton';
import PrimeButton from 'primevue/button';
import Panel from 'primevue/panel';
import Tag from 'primevue/tag';
import { useGetDataPointTypeSpecificationQuery } from '@/api-queries/specification-service/data-point-type/useGetDataPointTypeSpecificationQuery';
import { useGetDataPointBaseTypeQuery } from '@/api-queries/specification-service/data-point-base-type/useGetDataPointBaseTypeQuery';
import DatapointFrameworksSection from '@/components/resources/frameworkExplorer/DatapointFrameworksSection.vue';
import DatapointValuesSection from '@/components/resources/frameworkExplorer/DatapointValuesSection.vue';
import DatapointRulesSection from '@/components/resources/frameworkExplorer/DatapointRulesSection.vue';
import DatapointTechnicalSection from '@/components/resources/frameworkExplorer/DatapointTechnicalSection.vue';

const props = defineProps<{ dataPointId: string | undefined }>();
const emit = defineEmits<{ (event: 'selectFramework', frameworkId: string): void }>();

const STALE_TIME_IN_MS = 10 * 60 * 1000;

const {
  data: dataPoint,
  isPending,
  isError,
  error,
  refetch,
} = useGetDataPointTypeSpecificationQuery(
  { dataPointTypeId: () => props.dataPointId },
  { staleTime: STALE_TIME_IN_MS, retry: false }
);

const isNotFound = computed(() => isError.value && isAxiosError(error.value) && error.value.response?.status === 404);

const {
  data: baseType,
  isPending: isBaseTypePending,
  isError: isBaseTypeError,
} = useGetDataPointBaseTypeQuery(
  { dataPointBaseTypeId: () => dataPoint.value?.dataPointBaseType.id },
  { staleTime: STALE_TIME_IN_MS }
);

/**
 * Copies the id of the shown datapoint to the clipboard.
 */
function copyId(): void {
  if (props.dataPointId) void navigator.clipboard.writeText(props.dataPointId);
}
</script>
