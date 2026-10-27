<template><span hidden aria-hidden="true"></span></template>

<script setup lang="ts">
import type { FrameworkSpecification } from '@clients/specification-service';
import { watch } from 'vue';
import { useGetFrameworkSpecificationQuery } from '@/api-queries/specification-service/framework/useGetFrameworkSpecificationQuery';

const props = defineProps<{ id: string }>();
const emit = defineEmits<{
  loaded: [specification: FrameworkSpecification];
  failed: [id: string];
}>();
const query = useGetFrameworkSpecificationQuery({ id: () => props.id }, { staleTime: 600_000 });
watch(
  query.data,
  (value) => {
    if (value) emit('loaded', value);
  },
  { immediate: true }
);
watch(
  query.isError,
  (value) => {
    if (value) emit('failed', props.id);
  },
  { immediate: true }
);
</script>
