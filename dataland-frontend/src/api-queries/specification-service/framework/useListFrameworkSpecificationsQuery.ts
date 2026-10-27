import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import type { SimpleFrameworkSpecification } from '@clients/specification-service';
import { useApiClient } from '@/utils/useApiClient';
import { frameworkSpecificationKeys } from './frameworkSpecificationKeys';

/**
 * Fetches the list of framework specifications.
 * @param options - Additional query options.
 * @returns The framework list query.
 */
export function useListFrameworkSpecificationsQuery(
  options: Omit<UseQueryOptions<SimpleFrameworkSpecification[], Error>, 'queryKey' | 'queryFn'> = {}
): UseQueryReturnType<SimpleFrameworkSpecification[], Error> {
  const client = useApiClient().apiClients.specificationController;
  return useQuery<SimpleFrameworkSpecification[], Error>({
    queryKey: frameworkSpecificationKeys.list(),
    queryFn: async () => (await client.listFrameworkSpecifications()).data,
    ...options,
  });
}
