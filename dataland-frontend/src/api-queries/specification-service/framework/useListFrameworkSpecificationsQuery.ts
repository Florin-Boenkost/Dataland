import { computed } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import { useApiClient } from '@/utils/useApiClient';
import { frameworkSpecificationKeys } from '@/api-queries/specification-service/framework/frameworkSpecificationKeys';
import { type SimpleFrameworkSpecification } from '@clients/specificationservice';

/**
 * Vue Query hook that lists all framework specifications of the specification service.
 *
 * @param options - Additional TanStack query options.
 * @returns Vue Query result containing the list of {@link SimpleFrameworkSpecification}.
 */
export function useListFrameworkSpecificationsQuery(
  options: Omit<UseQueryOptions<SimpleFrameworkSpecification[], Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<SimpleFrameworkSpecification[], Error> {
  const apiClientProvider = useApiClient();

  return useQuery<SimpleFrameworkSpecification[], Error>({
    queryKey: computed(() => frameworkSpecificationKeys.list()),
    queryFn: async () => {
      const response = await apiClientProvider.apiClients.specificationController.listFrameworkSpecifications();
      return response.data;
    },
    ...options,
  });
}
