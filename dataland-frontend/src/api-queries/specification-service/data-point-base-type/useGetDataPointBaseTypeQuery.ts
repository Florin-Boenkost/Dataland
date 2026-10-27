import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { DataPointBaseTypeSpecification } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import { dataPointBaseTypeKeys } from './dataPointBaseTypeKeys';

/**
 * Fetches a data point base type, including its example.
 * @param params - Endpoint parameters.
 * @param params.id - Base type id.
 * @param options - Additional query options.
 * @returns The base type query.
 */
export function useGetDataPointBaseTypeQuery(
  params: { id: MaybeRefOrGetter<string | undefined> },
  options: Omit<UseQueryOptions<DataPointBaseTypeSpecification, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<DataPointBaseTypeSpecification, Error> {
  const client = useApiClient().apiClients.specificationController;
  return useQuery<DataPointBaseTypeSpecification, Error>({
    queryKey: computed(() => dataPointBaseTypeKeys.byId(toValue(params.id))),
    queryFn: async () => {
      const id = toValue(params.id);
      if (!id) throw new Error('Base type id is missing');
      return (await client.getDataPointBaseType(id)).data;
    },
    enabled: computed(() => !!toValue(params.id)),
    ...options,
  });
}
