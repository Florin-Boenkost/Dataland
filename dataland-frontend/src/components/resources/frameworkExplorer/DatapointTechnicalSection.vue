<template>
  <Panel header="Technical details" toggleable collapsed data-test="technicalSection">
    <dl class="m-0">
      <dt class="font-semibold">Datapoint id</dt>
      <dd class="ml-0 mb-2">{{ dataPointId }}</dd>
      <dt class="font-semibold">Base type id</dt>
      <dd class="ml-0 mb-2">{{ baseTypeId }}</dd>
      <template v-if="validatedBy">
        <dt class="font-semibold">Validated by</dt>
        <dd class="ml-0 mb-2">{{ validatedBy }}</dd>
      </template>
    </dl>
  </Panel>
</template>

<script setup lang="ts">
import Panel from 'primevue/panel';

defineProps<{
  dataPointId: string;
  baseTypeId: string;
  validatedBy: string | undefined;
}>();
</script>
