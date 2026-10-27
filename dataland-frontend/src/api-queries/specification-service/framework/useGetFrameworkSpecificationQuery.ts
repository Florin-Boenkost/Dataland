import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import { useApiClient } from '@/utils/useApiClient';
import { frameworkSpecificationKeys } from '@/api-queries/specification-service/framework/frameworkSpecificationKeys';
import { type FrameworkSpecification } from '@clients/specificationservice';

/**
 * Vue Query hook that fetches the specification of a framework.
 * The query is disabled while `frameworkSpecificationId` is empty.
 *
 * @param params - Endpoint parameters.
 * @param params.frameworkSpecificationId - Id of the framework.
 * @param options - Additional TanStack query options. A passed `enabled` replaces the default.
 * @returns Vue Query result containing the {@link FrameworkSpecification}.
 */
export function useGetFrameworkSpecificationQuery(
  params: { frameworkSpecificationId: MaybeRefOrGetter<string | undefined> },
  options: Omit<UseQueryOptions<FrameworkSpecification, Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<FrameworkSpecification, Error> {
  const apiClientProvider = useApiClient();

  return useQuery<FrameworkSpecification, Error>({
    queryKey: computed(() =>
      frameworkSpecificationKeys.byFrameworkSpecificationId(toValue(params.frameworkSpecificationId))
    ),
    queryFn: async () => {
      const frameworkSpecificationId = toValue(params.frameworkSpecificationId);
      if (!frameworkSpecificationId) throw new Error('frameworkSpecificationId is undefined');
      const response =
        await apiClientProvider.apiClients.specificationController.getFrameworkSpecification(frameworkSpecificationId);
      return response.data;
    },
    enabled: computed(() => !!toValue(params.frameworkSpecificationId)),
    ...options,
  });
}
