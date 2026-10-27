export const dataPointBaseTypeKeys = {
  all: ['dataPointBaseType'] as const,
  byId: (id: string | undefined) => [...dataPointBaseTypeKeys.all, 'byId', id] as const,
};
