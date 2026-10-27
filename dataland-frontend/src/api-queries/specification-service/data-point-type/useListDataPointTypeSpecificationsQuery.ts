import { computed } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import { useApiClient } from '@/utils/useApiClient';
import { dataPointTypeSpecificationKeys } from '@/api-queries/specification-service/data-point-type/dataPointTypeSpecificationKeys';
import { type DataPointTypeSummary } from '@clients/specificationservice';

/**
 * Vue Query hook that lists summaries of all data point types of the specification service.
 *
 * @param options - Additional TanStack query options.
 * @returns Vue Query result containing the list of {@link DataPointTypeSummary}.
 */
export function useListDataPointTypeSpecificationsQuery(
  options: Omit<UseQueryOptions<DataPointTypeSummary[], Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<DataPointTypeSummary[], Error> {
  const apiClientProvider = useApiClient();

  return useQuery<DataPointTypeSummary[], Error>({
    queryKey: computed(() => dataPointTypeSpecificationKeys.list()),
    queryFn: async () => {
      const response = await apiClientProvider.apiClients.specificationController.listDataPointTypeSpecifications();
      return response.data;
    },
    ...options,
  });
}
