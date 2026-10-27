<template>
  <Panel header="Appears in frameworks" data-test="frameworksSection">
    <p v-if="usedBy.length === 0" class="m-0">This datapoint is not used in any framework.</p>
    <DatapointFrameworkEntry
      v-for="framework in usedBy"
      :key="framework.id"
      :frameworkId="framework.id"
      :dataPointId="dataPointId"
      @selectFramework="(id: string) => emit('selectFramework', id)"
    />
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel';
import DatapointFrameworkEntry from '@/components/resources/frameworkExplorer/DatapointFrameworkEntry.vue';
import type { IdWithRef } from '@clients/specificationservice';

defineProps<{
  usedBy: IdWithRef[];
  dataPointId: string;
}>();

const emit = defineEmits<{ (event: 'selectFramework', frameworkId: string): void }>();
</script>
