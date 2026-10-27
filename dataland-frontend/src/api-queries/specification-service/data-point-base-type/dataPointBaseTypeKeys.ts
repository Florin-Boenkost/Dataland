export const dataPointBaseTypeKeys = {
  all: ['dataPointBaseType'] as const,
  byDataPointBaseTypeId: (dataPointBaseTypeId: string | undefined) =>
    [...dataPointBaseTypeKeys.all, 'byDataPointBaseTypeId', dataPointBaseTypeId] as const,
};
