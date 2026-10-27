<template>
  <Dialog
    :visible="visible"
    modal
    dismissableMask
    :header="`Calculation dependencies: ${centerName}`"
    :style="{ width: '80vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="flow-toolbar">
      <span>Levels per direction</span>
      <SelectButton v-model="depth" :options="depthOptions" :allowEmpty="false" size="small" />
      <span class="flow-hint">Click a datapoint to re-center the chart on it.</span>
    </div>
    <ProgressBar v-if="scan.pending" :value="scan.percent" class="mb-2" />
    <Message v-if="scan.failed" severity="error" class="mb-2">
      Could not load {{ scan.failed }} datapoint specification(s), the chart may be incomplete.
    </Message>
    <div class="flow-scroll" data-test="flow-scroll">
      <CalculationFlowChart :graph="graph" @select="$emit('select', $event)" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueries } from '@tanstack/vue-query';
import Dialog from 'primevue/dialog';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import { useApiClient } from '@/utils/useApiClient';
import { getDataPointTypeSpecificationQueryOptions } from '@/api-queries/specification-service/data-point-type/useGetDataPointTypeSpecificationQuery';
import CalculationFlowChart from './CalculationFlowChart.vue';
import { buildCalculationGraph, type SpecLookup } from './calculationGraph';

const props = defineProps<{ visible: boolean; centerId: string; datapointIds: string[] }>();
defineEmits<{ 'update:visible': [visible: boolean]; select: [datapointId: string] }>();

const depthOptions = [1, 2, 3];
const depth = ref(1);
const apiClient = useApiClient();
const ids = computed(() => (props.visible ? [...new Set([props.centerId, ...props.datapointIds])] : []));
const scan = useQueries({
  queries: computed(() =>
    ids.value.map((id) => ({ ...getDataPointTypeSpecificationQueryOptions(id, apiClient), staleTime: 600_000 }))
  ),
  combine: (results) => {
    const specs = new Map<string, NonNullable<(typeof results)[number]['data']>>();
    results.forEach((result, index) => {
      const id = ids.value[index];
      if (id && result.data) specs.set(id, result.data);
    });
    const done = results.filter((result) => !result.isPending).length;
    return {
      specs,
      pending: results.some((result) => result.isPending),
      failed: results.filter((result) => result.isError).length,
      percent: results.length ? Math.round((done / results.length) * 100) : 100,
    };
  },
});
const graph = computed(() => buildCalculationGraph(props.centerId, scan.value.specs as SpecLookup, depth.value));
const centerName = computed(() => scan.value.specs.get(props.centerId)?.name ?? props.centerId);
</script>

<style scoped>
.flow-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.flow-hint {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}
.flow-scroll {
  overflow: auto;
  height: 60vh;
  border: 1px solid var(--p-surface-200);
  border-radius: var(--p-border-radius-md);
}
</style>
