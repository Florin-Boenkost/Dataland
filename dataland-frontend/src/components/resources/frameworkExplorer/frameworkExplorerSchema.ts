import type { FrameworkSpecification } from '@clients/specification-service';
import type { TreeNode } from 'primevue/treenode';
import { getFrontendFrameworkDefinition } from '@/frameworks/FrontendFrameworkRegistry';
import type { MLDTConfig } from '@/components/resources/dataTable/MultiLayerDataTableConfiguration';

export interface DatapointOccurrence {
  frameworkId: string;
  frameworkName: string;
  path: string[];
  displayPath: string[];
  aliasExport?: string;
}

export interface DatapointEntry {
  id: string;
  displayName: string;
  occurrences: DatapointOccurrence[];
}

export interface DatapointGroup {
  name: string;
  entries: DatapointEntry[];
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

/** Match dataset-view section headings to schema paths by their constituent datapoint ids. */
export function getDatasetSectionLabels(frameworkId: string, schema: Record<string, unknown>): Map<string, string> {
  const labels = new Map<string, string>();
  const configuration = getFrontendFrameworkDefinition(frameworkId)?.getFrameworkViewConfiguration().configuration;
  if (!configuration) return labels;

  const idsInSchema = (node: unknown): Set<string> => {
    if (isLeaf(node)) return new Set([node.id]);
    if (!record(node)) return new Set();
    return new Set(Object.values(node).flatMap((child) => [...idsInSchema(child)]));
  };
  const idsInConfiguration = (items: MLDTConfig<object>): Set<string> =>
    new Set(
      items.flatMap((item) =>
        item.type === 'section'
          ? [...idsInConfiguration(item.children)]
          : item.dataPointTypeId
            ? [item.dataPointTypeId]
            : []
      )
    );

  const visit = (node: Record<string, unknown>, sections: MLDTConfig<object>, path: string[]): void => {
    const candidates = sections.filter((item) => item.type === 'section');
    const matched = new Set<(typeof candidates)[number]>();
    for (const [key, value] of Object.entries(node)) {
      if (!record(value) || isLeaf(value)) continue;
      const ids = idsInSchema(value);
      const section = candidates
        .filter((item) => !matched.has(item))
        .map((item) => ({ item, overlap: [...idsInConfiguration(item.children)].filter((id) => ids.has(id)).length }))
        .sort((a, b) => b.overlap - a.overlap)[0];
      const nextPath = [...path, key];
      if (section && section.overlap > 0) {
        matched.add(section.item);
        labels.set(JSON.stringify(nextPath), section.item.label);
        visit(value, section.item.children, nextPath);
      }
    }
  };
  visit(schema, configuration, []);
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
  labels: ReadonlyMap<string, string> = new Map(),
  sectionLabels: ReadonlyMap<string, string> = new Map()
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
      return record(value)
        ? [
            {
              key: currentPath.join('.'),
              label: sectionLabels.get(JSON.stringify(currentPath)) ?? label,
              children: walk(value, currentPath),
            },
          ]
        : [];
    });
  return walk(schema, []);
}

/** Build a reverse index while retaining every path on which a datapoint occurs. */
export function buildDatapointIndex(frameworks: FrameworkSpecification[]): DatapointEntry[] {
  const index = new Map<string, DatapointEntry>();
  for (const framework of frameworks) {
    const labels = getDatasetDatapointLabels(framework.framework.id);
    const schema = parseFrameworkSchema(framework.schema);
    const sectionLabels = getDatasetSectionLabels(framework.framework.id, schema);
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
            displayPath: nextPath
              .slice(0, -1)
              .map((segment, index) => sectionLabels.get(JSON.stringify(nextPath.slice(0, index + 1))) ?? segment),
            aliasExport: typeof value.aliasExport === 'string' ? value.aliasExport : undefined,
          });
          index.set(value.id, entry);
        } else if (record(value)) {
          visit(value, nextPath);
        }
      }
    };
    visit(schema, []);
  }
  return [...index.values()].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}

/** Group datapoints that share a human-readable name so each name is listed once. */
export function groupDatapointsByName(entries: DatapointEntry[]): DatapointGroup[] {
  const groups = new Map<string, DatapointGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.displayName) ?? { name: entry.displayName, entries: [] };
    group.entries.push(entry);
    groups.set(entry.displayName, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
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
