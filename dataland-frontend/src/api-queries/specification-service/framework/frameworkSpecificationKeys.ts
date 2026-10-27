export const frameworkSpecificationKeys = {
  all: ['frameworkSpecification'] as const,
  list: () => [...frameworkSpecificationKeys.all, 'list'] as const,
  byId: (id: string | undefined) => [...frameworkSpecificationKeys.all, 'byId', id] as const,
  resolvedById: (id: string | undefined) => [...frameworkSpecificationKeys.all, 'resolvedById', id] as const,
};
