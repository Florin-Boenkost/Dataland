<template>
  <Panel header="Supported values" data-test="valuesSection">
    <Skeleton v-if="isPending" height="4rem" />
    <Message v-else-if="isError" severity="error">Failed to load the supported values.</Message>
    <template v-else-if="baseType">
      <p class="font-semibold mt-0 mb-1" data-test="baseTypeName">{{ baseType.name }}</p>
      <p class="mt-0">{{ baseType.businessDefinition }}</p>
      <Panel header="Show example" toggleable collapsed>
        <pre class="m-0" data-test="baseTypeExample">{{ JSON.stringify(baseType.example, null, 2) }}</pre>
      </Panel>
    </template>
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel';
import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import type { DataPointBaseTypeSpecification } from '@clients/specificationservice';

defineProps<{
  baseType: DataPointBaseTypeSpecification | undefined;
  isPending: boolean;
  isError: boolean;
}>();
</script>
