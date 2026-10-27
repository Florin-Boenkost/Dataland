export const frameworkSpecificationKeys = {
  all: ['frameworkSpecification'] as const,
  list: () => [...frameworkSpecificationKeys.all, 'list'] as const,
  byFrameworkSpecificationId: (frameworkSpecificationId: string | undefined) =>
    [...frameworkSpecificationKeys.all, 'byFrameworkSpecificationId', frameworkSpecificationId] as const,
};
