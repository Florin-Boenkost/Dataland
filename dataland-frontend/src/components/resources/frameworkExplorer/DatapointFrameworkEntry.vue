<template>
  <div class="flex flex-column gap-1 mb-3" :data-test="`frameworkEntry-${frameworkId}`">
    <div>
      <Tag
        :value="frameworkName"
        severity="secondary"
        role="button"
        tabindex="0"
        class="cursor-pointer"
        :aria-label="`Show ${frameworkName} in the framework view`"
        @click="emit('selectFramework', frameworkId)"
        @keydown.enter="emit('selectFramework', frameworkId)"
      />
    </div>
    <Skeleton v-if="isPending" height="1rem" width="60%" />
    <span v-else-if="isError" class="text-sm text-color-secondary">Location in framework could not be loaded.</span>
    <template v-else>
      <div v-for="entry in paths" :key="entry.path.join('.')" class="text-sm">
        <span data-test="frameworkPath">{{ entry.path.slice(0, -1).map(humanizeSchemaKey).join(' > ') }}</span>
        <span v-if="entry.aliasExport" class="text-color-secondary"> (export alias: {{ entry.aliasExport }})</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import { useGetFrameworkSpecificationQuery } from '@/api-queries/specification-service/framework/useGetFrameworkSpecificationQuery';
import { findDataPointPaths, humanizeSchemaKey } from '@/components/resources/frameworkExplorer/frameworkSchemaUtils';

const props = defineProps<{
  frameworkId: string;
  dataPointId: string;
}>();

const emit = defineEmits<{ (event: 'selectFramework', frameworkId: string): void }>();

const { data, isPending, isError } = useGetFrameworkSpecificationQuery(
  { frameworkSpecificationId: () => props.frameworkId },
  { staleTime: 10 * 60 * 1000 }
);

const frameworkName = computed(() => data.value?.name ?? props.frameworkId);
const paths = computed(() => (data.value ? findDataPointPaths(data.value.schema, props.dataPointId) : []));
</script>
