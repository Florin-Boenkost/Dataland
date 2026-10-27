export const dataPointTypeSpecificationKeys = {
  all: ['dataPointTypeSpecification'] as const,
  list: () => [...dataPointTypeSpecificationKeys.all, 'list'] as const,
  byDataPointTypeId: (dataPointTypeId: string | undefined) =>
    [...dataPointTypeSpecificationKeys.all, 'byDataPointTypeId', dataPointTypeId] as const,
};
