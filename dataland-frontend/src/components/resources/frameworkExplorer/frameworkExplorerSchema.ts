import type { FrameworkSpecification } from '@clients/specification-service';
import type { TreeNode } from 'primevue/treenode';
import { getFrontendFrameworkDefinition } from '@/frameworks/FrontendFrameworkRegistry';

export interface DatapointOccurrence {
  frameworkId: string;
  frameworkName: string;
  path: string[];
  aliasExport?: string;
}

export interface DatapointEntry {
  id: string;
  displayName: string;
  occurrences: DatapointOccurrence[];
}

export interface ValueField {
  path: string;
  type: string;
}

/** Check that a JSON value is an object. */
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Check that a schema node is a datapoint reference. */
function isLeaf(value: unknown): value is { id: string; aliasExport?: string } {
  return record(value) && typeof value.id === 'string' && typeof value.ref === 'string';
}

/** Use the labels shown in dataset views for the framework's datapoint types. */
export function getDatasetDatapointLabels(frameworkId: string): Map<string, string> {
  const labels = new Map<string, string>();
  const configuration = getFrontendFrameworkDefinition(frameworkId)?.getFrameworkViewConfiguration().configuration;
  const visit = (items: typeof configuration): void => {
    for (const item of items ?? []) {
      if (item.type === 'section') visit(item.children);
      else if (item.dataPointTypeId) labels.set(item.dataPointTypeId, item.label);
    }
  };
  visit(configuration);
  return labels;
}

/** Parse a framework's JSON schema, treating a datapoint reference as a leaf. */
export function parseFrameworkSchema(schema: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(schema);
  if (!record(parsed)) throw new Error('Framework schema is not an object');
  return parsed;
}

/** Build the framework browser tree from a parsed schema. */
export function buildFrameworkTree(
  schema: Record<string, unknown>,
  labels: ReadonlyMap<string, string> = new Map()
): TreeNode[] {
  const walk = (node: Record<string, unknown>, path: string[]): TreeNode[] =>
    Object.entries(node).flatMap(([label, value]): TreeNode[] => {
      const currentPath = [...path, label];
      if (isLeaf(value)) {
        return [
          {
            key: currentPath.join('.'),
            label: labels.get(value.id) ?? value.id,
            data: { id: value.id, path: currentPath },
          },
        ];
      }
      return record(value) ? [{ key: currentPath.join('.'), label, children: walk(value, currentPath) }] : [];
    });
  return walk(schema, []);
}

/** Build a reverse index while retaining every path on which a datapoint occurs. */
export function buildDatapointIndex(frameworks: FrameworkSpecification[]): DatapointEntry[] {
  const index = new Map<string, DatapointEntry>();
  for (const framework of frameworks) {
    const labels = getDatasetDatapointLabels(framework.framework.id);
    const visit = (node: Record<string, unknown>, path: string[]): void => {
      for (const [key, value] of Object.entries(node)) {
        const nextPath = [...path, key];
        if (isLeaf(value)) {
          const entry = index.get(value.id) ?? {
            id: value.id,
            displayName: labels.get(value.id) ?? value.id,
            occurrences: [],
          };
          if (entry.displayName === entry.id) entry.displayName = labels.get(value.id) ?? value.id;
          entry.occurrences.push({
            frameworkId: framework.framework.id,
            frameworkName: framework.name,
            path: nextPath,
            aliasExport: typeof value.aliasExport === 'string' ? value.aliasExport : undefined,
          });
          index.set(value.id, entry);
        } else if (record(value)) {
          visit(value, nextPath);
        }
      }
    };
    visit(parseFrameworkSchema(framework.schema), []);
  }
  return [...index.values()].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}

/** Find a datapoint's structure at the same path in its framework's resolved schema. */
export function resolveStructure(schema: unknown, path: string[]): unknown {
  let node: unknown = schema;
  for (const segment of path) {
    if (!record(node)) return undefined;
    node = node[segment];
  }
  return node;
}

/** Flatten a resolved base-type structure into field paths and type names. */
export function flattenValueStructure(value: unknown): ValueField[] {
  if (value === undefined || value === null) return [];
  const fields: ValueField[] = [];
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      fields.push({ path: path || 'Value', type: node });
    } else if (Array.isArray(node)) {
      if (!node.length) fields.push({ path: path || 'Value', type: 'Array' });
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
    } else if (record(node)) {
      for (const [key, item] of Object.entries(node)) visit(item, path ? `${path}.${key}` : key);
    }
  };
  visit(value, '');
  return fields;
}
