import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { DataPointTypeSpecification } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import { dataPointTypeSpecificationKeys } from './dataPointTypeSpecificationKeys';

/**
 * Fetches the description and metadata of one data point type.
 * @param params - Endpoint parameters.
 * @param params.id - Data point type id.
 * @param options - Additional query options.
 * @returns The data point type query.
 */
export function useGetDataPointTypeSpecificationQuery(
  params: { id: MaybeRefOrGetter<string | undefined> },
  options: Omit<UseQueryOptions<DataPointTypeSpecification, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<DataPointTypeSpecification, Error> {
  const client = useApiClient().apiClients.specificationController;
  return useQuery<DataPointTypeSpecification, Error>({
    queryKey: computed(() => dataPointTypeSpecificationKeys.byId(toValue(params.id))),
    queryFn: async () => {
      const id = toValue(params.id);
      if (!id) throw new Error('Data point type id is missing');
      return (await client.getDataPointTypeSpecification(id)).data;
    },
    enabled: computed(() => !!toValue(params.id)),
    ...options,
  });
}
