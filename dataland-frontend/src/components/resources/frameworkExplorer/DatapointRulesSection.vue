<template>
  <Panel header="Rules" data-test="rulesSection">
    <p v-if="!hasRules" class="m-0">No constraints or calculation rules.</p>
    <template v-else>
      <div v-if="constraints.length > 0" class="mb-3">
        <p class="font-semibold mt-0 mb-1">Constraints</p>
        <ul class="m-0 pl-4" data-test="constraints">
          <li v-for="constraint in constraints" :key="constraint">{{ constraint }}</li>
        </ul>
      </div>
      <div v-if="calculationRules.length > 0">
        <p class="font-semibold mt-0 mb-1">Calculation rules</p>
        <ul class="m-0 pl-4" data-test="calculationRules">
          <li v-for="rule in calculationRules" :key="rule.calculationMethod + rule.inputs.join()">
            {{ rule.calculationMethod }}
            <span v-if="rule.inputs.length > 0" class="text-color-secondary"
              >(inputs: {{ rule.inputs.join(', ') }})</span
            >
          </li>
        </ul>
      </div>
    </template>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Panel from 'primevue/panel';
import type { CalculationRule } from '@clients/specificationservice';

const props = defineProps<{
  constraints: string[];
  calculationRules: CalculationRule[];
}>();

const hasRules = computed(() => props.constraints.length > 0 || props.calculationRules.length > 0);
</script>
