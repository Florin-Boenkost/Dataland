import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { DataPointTypeSpecification } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import type { ApiClientProvider } from '@/services/ApiClients';
import { dataPointTypeSpecificationKeys } from './dataPointTypeSpecificationKeys';

/**
 * Builds the query options (key and fetch function) for one data point type.
 * Shared between the single query hook and multi-query usages (e.g. useQueries).
 * @param id - Data point type id.
 * @param apiClientProvider - The provider used to access the specification clients.
 * @returns The query options.
 */
export function getDataPointTypeSpecificationQueryOptions(
  id: string,
  apiClientProvider: ApiClientProvider
): {
  queryKey: ReturnType<typeof dataPointTypeSpecificationKeys.byId>;
  queryFn: () => Promise<DataPointTypeSpecification>;
} {
  return {
    queryKey: dataPointTypeSpecificationKeys.byId(id),
    queryFn: async (): Promise<DataPointTypeSpecification> =>
      (await apiClientProvider.apiClients.specificationController.getDataPointTypeSpecification(id)).data,
  };
}

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
