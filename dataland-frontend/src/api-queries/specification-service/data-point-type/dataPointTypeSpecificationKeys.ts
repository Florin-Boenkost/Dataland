export const dataPointTypeSpecificationKeys = {
  all: ['dataPointTypeSpecification'] as const,
  byId: (id: string | undefined) => [...dataPointTypeSpecificationKeys.all, 'byId', id] as const,
};
