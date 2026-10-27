import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { DataPointBaseTypeResolvedSchema } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import { frameworkSpecificationKeys } from './frameworkSpecificationKeys';

/**
 * Fetches a framework schema resolved to base-type structures.
 * @param params - Endpoint parameters.
 * @param params.id - Framework id.
 * @param options - Additional query options.
 * @returns The resolved framework query.
 */
export function useGetResolvedFrameworkSpecificationQuery(
  params: { id: MaybeRefOrGetter<string | undefined> },
  options: Omit<UseQueryOptions<DataPointBaseTypeResolvedSchema, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<DataPointBaseTypeResolvedSchema, Error> {
  const client = useApiClient().apiClients.specificationController;
  return useQuery<DataPointBaseTypeResolvedSchema, Error>({
    queryKey: computed(() => frameworkSpecificationKeys.resolvedById(toValue(params.id))),
    queryFn: async () => {
      const id = toValue(params.id);
      if (!id) throw new Error('Framework id is missing');
      return (await client.getResolvedFrameworkSpecification(id)).data;
    },
    enabled: computed(() => !!toValue(params.id)),
    ...options,
  });
}
