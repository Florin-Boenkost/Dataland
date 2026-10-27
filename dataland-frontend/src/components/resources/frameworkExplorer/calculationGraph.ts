import type { DataPointTypeSpecification } from '@clients/specification-service';

export interface CalculationNode {
  key: string;
  datapointId?: string;
  label: string;
  kind: 'center' | 'datapoint' | 'method' | 'unknown';
  /** Horizontal column. Datapoints sit on even columns, method nodes on odd ones, the center is 0. */
  column: number;
  /** True when the node was already expanded elsewhere or the depth limit stopped expansion. */
  truncated: boolean;
}

export interface CalculationEdge {
  from: string;
  to: string;
}

export interface CalculationGraph {
  nodes: CalculationNode[];
  edges: CalculationEdge[];
}

export type SpecLookup = ReadonlyMap<string, Pick<DataPointTypeSpecification, 'name' | 'calculationRules'>>;

/**
 * Builds the reverse lookup "input datapoint id -> datapoints calculated from it".
 * @param specs - All known datapoint specifications by id.
 * @returns The reverse lookup.
 */
export function buildReverseLookup(specs: SpecLookup): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  specs.forEach((spec, id) => {
    new Set(spec.calculationRules.flatMap((rule) => rule.inputs)).forEach((input) => {
      reverse.set(input, [...(reverse.get(input) ?? []), id]);
    });
  });
  return reverse;
}

/**
 * Builds a layered graph around one datapoint. Each rule becomes a method node between its inputs and its result.
 * A datapoint gets one node per level, so every edge connects neighbouring columns even when datapoints depend on each
 * other. Upstream columns are negative, downstream columns are positive, the center is column 0.
 * @param centerId - The datapoint in the center.
 * @param specs - Known datapoint specifications by id.
 * @param depth - Number of levels per direction.
 * @returns Nodes and edges of the graph.
 */
export function buildCalculationGraph(centerId: string, specs: SpecLookup, depth: number): CalculationGraph {
  const nodes = new Map<string, CalculationNode>();
  const edges: CalculationEdge[] = [];
  const reverse = buildReverseLookup(specs);
  const dpKey = (id: string, level: number): string => `dp:${id}@${level}`;
  const addDatapoint = (id: string, level: number, truncated: boolean): void => {
    const key = dpKey(id, level);
    if (nodes.has(key)) return;
    nodes.set(key, {
      key,
      datapointId: specs.has(id) || level === 0 ? id : undefined,
      label: specs.get(id)?.name ?? id,
      kind: level === 0 ? 'center' : specs.has(id) ? 'datapoint' : 'unknown',
      column: level * 2,
      truncated,
    });
  };
  const addMethod = (targetId: string, targetLevel: number, index: number, label: string): string => {
    const key = `rule:${targetId}:${index}@${targetLevel}`;
    nodes.set(key, { key, label, kind: 'method', column: targetLevel * 2 - 1, truncated: false });
    return key;
  };
  const addEdge = (from: string, to: string): void => {
    if (!edges.some((edge) => edge.from === from && edge.to === to)) edges.push({ from, to });
  };
  const expandedUp = new Set<string>();
  const expandedDown = new Set<string>();
  const expandUp = (id: string, level: number, visited: Set<string>): void => {
    if (expandedUp.has(dpKey(id, level))) return;
    expandedUp.add(dpKey(id, level));
    (specs.get(id)?.calculationRules ?? []).forEach((rule, index) => {
      const methodKey = addMethod(id, level, index, rule.calculationMethod);
      addEdge(methodKey, dpKey(id, level));
      rule.inputs.forEach((input) => {
        const hasRules = (specs.get(input)?.calculationRules.length ?? 0) > 0;
        const canExpand = hasRules && level - 1 > -depth && !visited.has(input);
        addDatapoint(input, level - 1, hasRules && !canExpand);
        addEdge(dpKey(input, level - 1), methodKey);
        if (canExpand) expandUp(input, level - 1, new Set([...visited, input]));
      });
    });
  };
  const expandDown = (id: string, level: number, visited: Set<string>): void => {
    if (expandedDown.has(dpKey(id, level))) return;
    expandedDown.add(dpKey(id, level));
    (reverse.get(id) ?? []).forEach((targetId) => {
      const canExpand = level + 1 < depth && !visited.has(targetId);
      (specs.get(targetId)?.calculationRules ?? []).forEach((rule, index) => {
        if (!rule.inputs.includes(id)) return;
        const methodKey = addMethod(targetId, level + 1, index, rule.calculationMethod);
        addEdge(dpKey(id, level), methodKey);
        addEdge(methodKey, dpKey(targetId, level + 1));
      });
      addDatapoint(targetId, level + 1, !canExpand && (reverse.get(targetId)?.length ?? 0) > 0);
      if (canExpand) expandDown(targetId, level + 1, new Set([...visited, targetId]));
    });
  };
  addDatapoint(centerId, 0, false);
  expandUp(centerId, 0, new Set([centerId]));
  expandDown(centerId, 0, new Set([centerId]));
  return { nodes: [...nodes.values()], edges };
}

/**
 * Orders the nodes inside each column so that edges between neighbouring columns cross as little as possible
 * (barycenter heuristic, sweeping outwards from the center column).
 * @param graph - The graph to order.
 * @returns Node keys per column, sorted top to bottom, by column number.
 */
export function orderColumns(graph: CalculationGraph): Map<number, string[]> {
  const columns = new Map<number, string[]>();
  graph.nodes.forEach((node) => columns.set(node.column, [...(columns.get(node.column) ?? []), node.key]));
  const columnOf = new Map(graph.nodes.map((node) => [node.key, node.column]));
  const neighbours = new Map<string, string[]>();
  graph.edges.forEach(({ from, to }) => {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
    neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
  });
  const sorted = [...columns.keys()].sort((a, b) => a - b);
  const position = (key: string): number => {
    const column = columns.get(columnOf.get(key) ?? 0) ?? [];
    return column.indexOf(key) - (column.length - 1) / 2;
  };
  const reorder = (column: number, towards: number): void => {
    const keys = columns.get(column) ?? [];
    const score = new Map<string, number>();
    keys.forEach((key) => {
      const fixed = (neighbours.get(key) ?? []).filter((other) => columnOf.get(other) === towards);
      score.set(
        key,
        fixed.length ? fixed.reduce((sum, other) => sum + position(other), 0) / fixed.length : position(key)
      );
    });
    columns.set(
      column,
      [...keys].sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0))
    );
  };
  for (let sweep = 0; sweep < 4; sweep++) {
    sorted.filter((column) => column > 0).forEach((column) => reorder(column, column - 1));
    [...sorted]
      .reverse()
      .filter((column) => column < 0)
      .forEach((column) => reorder(column, column + 1));
  }
  return columns;
}
