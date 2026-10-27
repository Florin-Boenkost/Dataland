import {
  buildCalculationGraph,
  orderColumns,
  buildReverseLookup,
  type SpecLookup,
} from '@/components/resources/frameworkExplorer/calculationGraph';

type Rule = { inputs: string[]; calculationMethod: string };
const spec = (name: string, calculationRules: Rule[] = []): { name: string; calculationRules: Rule[] } => ({
  name,
  calculationRules,
});

describe('Calculation graph builder', () => {
  const specs: SpecLookup = new Map([
    [
      'total',
      spec('Total', [
        { inputs: ['a', 'b'], calculationMethod: 'Sum' },
        { inputs: ['c'], calculationMethod: 'Copy' },
      ]),
    ],
    ['a', spec('A', [{ inputs: ['a0'], calculationMethod: 'Scale' }])],
    ['a0', spec('A0')],
    ['b', spec('B')],
    ['c', spec('C')],
    ['grand', spec('Grand', [{ inputs: ['total', 'missing'], calculationMethod: 'Share' }])],
  ]);

  it('builds the reverse lookup', () => {
    expect(buildReverseLookup(specs).get('total')).to.deep.equal(['grand']);
  });

  it('shows every rule as its own method node', () => {
    const graph = buildCalculationGraph('total', specs, 1);
    const methods = graph.nodes.filter((node) => node.kind === 'method').map((node) => node.label);
    expect(methods).to.include.members(['Sum', 'Copy', 'Share']);
    expect(graph.nodes.find((node) => node.datapointId === 'total')?.kind).to.equal('center');
  });

  it('limits the depth', () => {
    expect(buildCalculationGraph('total', specs, 1).nodes.some((node) => node.datapointId === 'a0')).to.equal(false);
    expect(buildCalculationGraph('total', specs, 2).nodes.some((node) => node.datapointId === 'a0')).to.equal(true);
  });

  it('places upstream left and downstream right', () => {
    const graph = buildCalculationGraph('total', specs, 1);
    expect(graph.nodes.find((node) => node.datapointId === 'a')?.column).to.be.lessThan(0);
    expect(graph.nodes.find((node) => node.datapointId === 'grand')?.column).to.be.greaterThan(0);
  });

  it('keeps unknown inputs inert', () => {
    const missing = buildCalculationGraph('grand', specs, 1).nodes.find((node) => node.label === 'missing');
    expect(missing?.kind).to.equal('unknown');
    expect(missing?.datapointId).to.equal(undefined);
  });

  it('survives cycles', () => {
    const cyclic: SpecLookup = new Map([
      ['x', spec('X', [{ inputs: ['y'], calculationMethod: 'f' }])],
      ['y', spec('Y', [{ inputs: ['x'], calculationMethod: 'g' }])],
    ]);
    expect(buildCalculationGraph('x', cyclic, 3).nodes.length).to.be.lessThan(20);
  });

  it('shows the output of a rule even when datapoints depend on each other', () => {
    const mutual: SpecLookup = new Map([
      ['kpi', spec('KPI', [{ inputs: ['weighted', 'percent'], calculationMethod: 'DivisionByPercent' }])],
      ['weighted', spec('Weighted', [{ inputs: ['kpi', 'percent2'], calculationMethod: 'MultiplicationByPercent' }])],
      ['percent', spec('Percent')],
      ['percent2', spec('Percent2')],
    ]);
    const graph = buildCalculationGraph('kpi', mutual, 1);
    const multiplication = graph.nodes.find((node) => node.label === 'MultiplicationByPercent');
    expect(multiplication?.column).to.equal(1);
    const output = graph.edges.find((edge) => edge.from === multiplication?.key)?.to;
    expect(graph.nodes.find((node) => node.key === output)).to.include({ label: 'Weighted', column: 2 });
  });

  it('only connects neighbouring columns', () => {
    const graph = buildCalculationGraph('total', specs, 3);
    const column = new Map(graph.nodes.map((node) => [node.key, node.column]));
    graph.edges.forEach((edge) => {
      expect((column.get(edge.to) ?? 0) - (column.get(edge.from) ?? 0)).to.equal(1);
    });
  });

  it('orders columns so that simple graphs have no crossing edges', () => {
    const crossing: SpecLookup = new Map([
      ['t', spec('T', [{ inputs: ['i1', 'i2', 'i3'], calculationMethod: 'Sum' }])],
      ['i1', spec('I1', [{ inputs: ['x1'], calculationMethod: 'Id' }])],
      ['i2', spec('I2', [{ inputs: ['x2'], calculationMethod: 'Id' }])],
      ['i3', spec('I3', [{ inputs: ['x3'], calculationMethod: 'Id' }])],
      ['x1', spec('X1')],
      ['x2', spec('X2')],
      ['x3', spec('X3')],
    ]);
    const graph = buildCalculationGraph('t', crossing, 2);
    const order = orderColumns(graph);
    const index = (key: string): number =>
      (order.get(graph.nodes.find((n) => n.key === key)?.column ?? 0) ?? []).indexOf(key);
    let crossings = 0;
    graph.edges.forEach((a) =>
      graph.edges.forEach((b) => {
        const colA = graph.nodes.find((n) => n.key === a.from)?.column;
        if (colA !== graph.nodes.find((n) => n.key === b.from)?.column) return;
        if (index(a.from) < index(b.from) && index(a.to) > index(b.to)) crossings++;
      })
    );
    expect(crossings).to.equal(0);
  });
});
