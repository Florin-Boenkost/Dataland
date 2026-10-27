import { computed, type ComputedRef } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw, type LocationQueryValue } from 'vue-router';

export type FrameworkExplorerMode = 'datapoint' | 'framework';

export interface FrameworkExplorerRouteState {
  mode: ComputedRef<FrameworkExplorerMode>;
  frameworkId: ComputedRef<string | undefined>;
  dataPointId: ComputedRef<string | undefined>;
  searchTerm: ComputedRef<string>;
  update: (patch: {
    mode?: FrameworkExplorerMode;
    framework?: string | undefined;
    datapoint?: string | undefined;
    q?: string | undefined;
  }) => void;
}

/**
 * Returns the first non-empty value of a query parameter.
 */
function firstValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single ? single : undefined;
}

/**
 * Typed access to the framework explorer state stored in the route query. The query is the single source of truth.
 * Unknown values fall back to defaults.
 * @returns the state and an update function writing to the query via `router.replace`
 */
export function useFrameworkExplorerRouteState(): FrameworkExplorerRouteState {
  const route = useRoute();
  const router = useRouter();

  const mode = computed<FrameworkExplorerMode>(() =>
    firstValue(route.query.mode) === 'framework' ? 'framework' : 'datapoint'
  );
  const frameworkId = computed(() => firstValue(route.query.framework));
  const dataPointId = computed(() => firstValue(route.query.datapoint));
  const searchTerm = computed(() => firstValue(route.query.q) ?? '');

  /**
   * Merges the patch into the route query; empty values remove the parameter.
   */
  function update(patch: Parameters<FrameworkExplorerRouteState['update']>[0]): void {
    const query: Record<string, unknown> = { ...route.query, ...patch };
    for (const key of Object.keys(query)) {
      if (!query[key]) delete query[key];
    }
    router
      .replace({ query: query as LocationQueryRaw })
      .catch((error) => console.error('Navigation error in framework explorer:', error));
  }

  return { mode, frameworkId, dataPointId, searchTerm, update };
}
