<template>
  <div class="flow-chart" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
    <svg class="flow-edges" :width="layout.width" :height="layout.height" aria-hidden="true">
      <defs>
        <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" class="flow-arrow-head" />
        </marker>
      </defs>
      <path
        v-for="edge in layout.edges"
        :key="edge.key"
        :d="edge.path"
        class="flow-edge"
        marker-end="url(#flow-arrow)"
      />
    </svg>
    <template v-for="item in layout.items" :key="item.node.key">
      <span
        v-if="item.node.kind === 'method'"
        class="flow-method"
        :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.w}px`, height: `${item.h}px` }"
        >{{ item.node.label }}</span
      >
      <button
        v-else
        :ref="(el) => setNodeRef(item.node.key, el)"
        type="button"
        class="flow-node"
        :class="[`flow-${item.node.kind}`, { 'flow-truncated': item.node.truncated }]"
        :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.w}px`, height: `${item.h}px` }"
        :disabled="!item.node.datapointId || item.node.kind === 'center'"
        :aria-label="`Datapoint ${item.node.label}`"
        :title="item.node.truncated ? `${item.node.label} (has more dependencies)` : item.node.label"
        @click="item.node.datapointId && $emit('select', item.node.datapointId)"
      >
        {{ item.node.label }}<span v-if="item.node.truncated"> …</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { orderColumns, type CalculationGraph, type CalculationNode } from './calculationGraph';

const props = defineProps<{ graph: CalculationGraph }>();
defineEmits<{ select: [datapointId: string] }>();

const DATAPOINT_WIDTH = 190;
const METHOD_WIDTH = 120;
const GAP = 60;
const ROW = 64;
const NODE_HEIGHT = 44;
const PADDING = 24;

interface PlacedNode {
  node: CalculationNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

const layout = computed(() => {
  const ordered = orderColumns(props.graph);
  const nodeByKey = new Map(props.graph.nodes.map((node) => [node.key, node]));
  const columns = [...ordered.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(1, ...[...ordered.values()].map((keys) => keys.length));
  const height = maxRows * ROW + PADDING * 2;
  const placed = new Map<string, PlacedNode>();
  let x = PADDING;
  columns.forEach((column) => {
    const inColumn = (ordered.get(column) ?? []).flatMap((key) => nodeByKey.get(key) ?? []);
    const isMethod = column % 2 !== 0;
    const w = isMethod ? METHOD_WIDTH : DATAPOINT_WIDTH;
    const startY = (height - inColumn.length * ROW) / 2 + (ROW - NODE_HEIGHT) / 2;
    inColumn.forEach((node, index) => {
      placed.set(node.key, { node, x, y: startY + index * ROW, w, h: NODE_HEIGHT });
    });
    x += w + GAP;
  });
  const edges = props.graph.edges.flatMap((edge) => {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    if (!from || !to) return [];
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const mid = (x1 + x2) / 2;
    return [{ key: `${edge.from}->${edge.to}`, path: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 2},${y2}` }];
  });
  return { items: [...placed.values()], edges, width: x - GAP + PADDING, height };
});

const nodeRefs = new Map<string, HTMLElement>();
/**
 * Remembers rendered node elements so the center node can be scrolled into view.
 * @param key - Node key.
 * @param el - Rendered element or component instance.
 */
function setNodeRef(key: string, el: unknown): void {
  if (el instanceof HTMLElement) nodeRefs.set(key, el);
  else nodeRefs.delete(key);
}
/** Scrolls the surrounding scroll container so the center node is in the middle. */
function scrollToCenter(): void {
  const center = props.graph.nodes.find((node) => node.kind === 'center');
  const element = center && nodeRefs.get(center.key);
  const scroller = element?.closest<HTMLElement>('[data-test="flow-scroll"]');
  if (!element || !scroller) return;
  scroller.scrollLeft = element.offsetLeft + element.offsetWidth / 2 - scroller.clientWidth / 2;
  scroller.scrollTop = element.offsetTop + element.offsetHeight / 2 - scroller.clientHeight / 2;
}
watch(
  () => props.graph,
  () => void nextTick(scrollToCenter),
  { immediate: true, flush: 'post' }
);
defineExpose({ scrollToCenter });
</script>

<style scoped>
.flow-chart {
  position: relative;
}
.flow-edges {
  position: absolute;
  inset: 0;
}
.flow-edge {
  fill: none;
  stroke: var(--p-surface-400);
  stroke-width: 1.5;
}
.flow-arrow-head {
  fill: var(--p-surface-400);
}
.flow-node,
.flow-method {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.2;
  overflow: hidden;
  border-radius: var(--p-border-radius-md);
}
.flow-node {
  border: 1px solid var(--p-surface-300);
  background: var(--p-surface-0);
  color: var(--p-text-color);
  cursor: pointer;
}
.flow-node:hover:not(:disabled),
.flow-node:focus-visible {
  border-color: var(--p-primary-color);
}
.flow-node:disabled {
  cursor: default;
}
.flow-center {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-weight: 600;
}
.flow-unknown {
  color: var(--p-text-muted-color);
  background: var(--p-surface-100);
}
.flow-truncated {
  border-style: dashed;
}
.flow-method {
  background: var(--p-surface-100);
  color: var(--p-text-muted-color);
  border-radius: 1rem;
  font-style: italic;
}
</style>
