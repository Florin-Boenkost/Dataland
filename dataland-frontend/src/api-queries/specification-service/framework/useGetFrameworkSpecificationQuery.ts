import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { FrameworkSpecification } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import { frameworkSpecificationKeys } from './frameworkSpecificationKeys';

/**
 * Fetches one framework specification.
 * @param params - Endpoint parameters.
 * @param params.id - Framework id.
 * @param options - Additional query options.
 * @returns The framework detail query.
 */
export function useGetFrameworkSpecificationQuery(
  params: { id: MaybeRefOrGetter<string | undefined> },
  options: Omit<UseQueryOptions<FrameworkSpecification, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<FrameworkSpecification, Error> {
  const client = useApiClient().apiClients.specificationController;
  return useQuery<FrameworkSpecification, Error>({
    queryKey: computed(() => frameworkSpecificationKeys.byId(toValue(params.id))),
    queryFn: async () => {
      const id = toValue(params.id);
      if (!id) throw new Error('Framework id is missing');
      return (await client.getFrameworkSpecification(id)).data;
    },
    enabled: computed(() => !!toValue(params.id)),
    ...options,
  });
}
