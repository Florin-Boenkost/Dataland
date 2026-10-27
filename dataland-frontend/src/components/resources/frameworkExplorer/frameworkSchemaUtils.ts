import type { TreeNode } from 'primevue/treenode';

export interface FrameworkSchemaLeaf {
  id: string;
  ref: string;
  aliasExport?: string | null;
}

export interface DataPointPathInFramework {
  path: string[];
  aliasExport: string | null;
}

/**
 * Converts a camelCase or snake_case schema key into a readable label.
 * @param key the raw schema key
 * @returns a human readable label
 */
export function humanizeSchemaKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Checks whether a schema entry is a data point leaf.
 */
function isLeaf(value: unknown): value is FrameworkSchemaLeaf {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

/**
 * Parses the schema string; invalid input yields an empty object.
 */
function parseSchema(schema: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(schema);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Recursively builds tree nodes for a schema object.
 */
function buildNodes(schema: Record<string, unknown>, parentKey: string): TreeNode[] {
  return Object.entries(schema).map(([key, value]) => {
    const nodeKey = parentKey ? `${parentKey}.${key}` : key;
    if (isLeaf(value)) {
      return { key: nodeKey, label: humanizeSchemaKey(key), data: { dataPointId: value.id }, leaf: true };
    }
    return {
      key: nodeKey,
      label: humanizeSchemaKey(key),
      selectable: false,
      children: buildNodes((value ?? {}) as Record<string, unknown>, nodeKey),
    };
  });
}

/**
 * Builds PrimeVue tree nodes (category, subcategory, data point) from the schema string of a framework.
 * Invalid schemas result in an empty tree.
 * @param schema the JSON schema string of a framework specification
 * @returns the tree nodes
 */
export function buildFrameworkTreeNodes(schema: string): TreeNode[] {
  return buildNodes(parseSchema(schema), '');
}

/**
 * Recursively collects the occurrences of a data point.
 */
function collectPaths(
  schema: Record<string, unknown>,
  dataPointId: string,
  parentPath: string[],
  result: DataPointPathInFramework[]
): void {
  for (const [key, value] of Object.entries(schema)) {
    if (isLeaf(value)) {
      if (value.id === dataPointId) result.push({ path: [...parentPath, key], aliasExport: value.aliasExport ?? null });
    } else if (typeof value === 'object' && value !== null) {
      collectPaths(value as Record<string, unknown>, dataPointId, [...parentPath, key], result);
    }
  }
}

/**
 * Finds all positions of a data point inside the schema string of a framework.
 * @param schema the JSON schema string of a framework specification
 * @param dataPointId the id of the data point type
 * @returns the key path and export alias of each occurrence
 */
export function findDataPointPaths(schema: string, dataPointId: string): DataPointPathInFramework[] {
  const result: DataPointPathInFramework[] = [];
  collectPaths(parseSchema(schema), dataPointId, [], result);
  return result;
}

/**
 * Collects the keys of all tree nodes that are ancestors of leaves holding the given data point, and the keys of
 * those leaves themselves.
 * @param nodes the tree nodes
 * @param dataPointId the selected data point id
 * @returns the keys of matching leaves and of their ancestors
 */
export function findNodeKeysForDataPoint(
  nodes: TreeNode[],
  dataPointId: string
): { leafKeys: string[]; ancestorKeys: string[] } {
  const leafKeys: string[] = [];
  const ancestorKeys: string[] = [];
  const visit = (node: TreeNode, ancestors: string[]): void => {
    if (node.children?.length) {
      node.children.forEach((child) => visit(child, [...ancestors, node.key as string]));
    } else if (node.data?.dataPointId === dataPointId) {
      leafKeys.push(node.key as string);
      ancestorKeys.push(...ancestors);
    }
  };
  nodes.forEach((node) => visit(node, []));
  return { leafKeys, ancestorKeys };
}
