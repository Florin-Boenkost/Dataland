<template>
  <div class="flex flex-column gap-2" data-test="frameworkTreeBrowser">
    <Select
      :modelValue="frameworkId"
      :options="frameworks"
      optionLabel="name"
      optionValue="id"
      placeholder="Select a framework"
      aria-label="Framework"
      data-test="frameworkSelect"
      fluid
      @update:modelValue="(id: string) => emit('selectFramework', id)"
    />
    <Skeleton v-if="isLoading" height="20rem" />
    <Message v-else-if="hasError" severity="error" data-test="frameworkTreeError">
      Failed to load the framework.
      <PrimeButton label="Retry" size="small" class="ml-2" @click="emit('retry')" />
    </Message>
    <Tree
      v-else
      v-model:expandedKeys="expandedKeys"
      :value="nodes"
      selectionMode="single"
      :selectionKeys="selectionKeys"
      class="p-0"
      scrollHeight="60vh"
      data-test="frameworkTree"
      @nodeSelect="onNodeSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Select from 'primevue/select';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import PrimeButton from 'primevue/button';
import Tree from 'primevue/tree';
import type { TreeNode } from 'primevue/treenode';
import {
  buildFrameworkTreeNodes,
  findNodeKeysForDataPoint,
} from '@/components/resources/frameworkExplorer/frameworkSchemaUtils';

const props = defineProps<{
  frameworks: { id: string; name: string }[];
  frameworkId: string | undefined;
  schema: string | undefined;
  selectedDataPointId: string | undefined;
  isLoading: boolean;
  hasError: boolean;
}>();

const emit = defineEmits<{
  (event: 'selectFramework', id: string): void;
  (event: 'selectDataPoint', id: string): void;
  (event: 'retry'): void;
}>();

const expandedKeys = ref<Record<string, boolean>>({});

const nodes = computed<TreeNode[]>(() => (props.schema ? buildFrameworkTreeNodes(props.schema) : []));

const matchingKeys = computed(() =>
  props.selectedDataPointId
    ? findNodeKeysForDataPoint(nodes.value, props.selectedDataPointId)
    : { leafKeys: [], ancestorKeys: [] }
);

const selectionKeys = computed(() => Object.fromEntries(matchingKeys.value.leafKeys.map((key) => [key, true])));

watch(
  matchingKeys,
  (keys) => {
    expandedKeys.value = { ...expandedKeys.value, ...Object.fromEntries(keys.ancestorKeys.map((key) => [key, true])) };
  },
  { immediate: true }
);

/**
 * Emits the selected data point id.
 */
function onNodeSelect(node: TreeNode): void {
  if (node.data?.dataPointId) emit('selectDataPoint', node.data.dataPointId);
}
</script>
