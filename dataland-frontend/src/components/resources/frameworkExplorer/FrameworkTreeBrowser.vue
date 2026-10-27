<template>
  <div>
    <label for="framework-select" class="block mb-2">Framework</label>
    <Select
      id="framework-select"
      :modelValue="frameworkId"
      :options="frameworks"
      optionLabel="name"
      optionValue="framework.id"
      placeholder="Select a framework"
      class="w-full mb-3"
      @update:modelValue="$emit('select-framework', $event)"
    />
    <Message v-if="schemaError" severity="error">This framework's schema could not be displayed.</Message>
    <Tree
      v-else
      :value="nodes"
      selectionMode="single"
      :expandedKeys="expandedKeys"
      :selectionKeys="selectionKeys"
      @update:selectionKeys="onSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { FrameworkSpecification, SimpleFrameworkSpecification } from '@clients/specification-service';
import Select from 'primevue/select';
import Tree from 'primevue/tree';
import Message from 'primevue/message';
import { buildFrameworkTree, getDatasetDatapointLabels, parseFrameworkSchema } from './frameworkExplorerSchema';

const props = defineProps<{
  frameworks: SimpleFrameworkSpecification[];
  frameworkId?: string;
  specification?: FrameworkSpecification;
  selectedId?: string;
}>();
const emit = defineEmits<{ 'select-framework': [id: string]; select: [id: string] }>();
const schemaError = computed(() => {
  if (!props.specification) return false;
  try {
    parseFrameworkSchema(props.specification.schema);
    return false;
  } catch {
    return true;
  }
});
const nodes = computed(() =>
  props.specification && !schemaError.value
    ? buildFrameworkTree(
        parseFrameworkSchema(props.specification.schema),
        getDatasetDatapointLabels(props.specification.framework.id)
      )
    : []
);
const expandedKeys = computed(() => {
  const keys: Record<string, boolean> = {};
  const visit = (treeNodes: typeof nodes.value): void => {
    for (const node of treeNodes) {
      if (node.children?.length) {
        keys[String(node.key)] = true;
        visit(node.children);
      }
    }
  };
  visit(nodes.value);
  return keys;
});
const selectionKeys = computed(() => {
  const search = (nodesToSearch: typeof nodes.value): string | undefined => {
    for (const node of nodesToSearch) {
      if (node.data?.id === props.selectedId) return String(node.key);
      const nested = node.children && search(node.children);
      if (nested) return nested;
    }
  };
  const key = search(nodes.value);
  return key ? { [key]: true } : {};
});
/** Emit the selected datapoint, ignoring category nodes. */
function onSelect(keys: Record<string, boolean> | null): void {
  const key = Object.keys(keys ?? {})[0];
  const search = (nodesToSearch: typeof nodes.value): string | undefined => {
    for (const node of nodesToSearch) {
      if (node.key === key) return node.data?.id as string | undefined;
      const nested = node.children && search(node.children);
      if (nested) return nested;
    }
  };
  const id = search(nodes.value);
  if (id) emit('select', id);
}
</script>
