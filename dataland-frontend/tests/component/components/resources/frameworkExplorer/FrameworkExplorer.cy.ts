import FrameworkExplorerPage from '@/components/pages/FrameworkExplorerPage.vue';
import DatapointDetailPanel from '@/components/resources/frameworkExplorer/DatapointDetailPanel.vue';
import DatapointSearchList from '@/components/resources/frameworkExplorer/DatapointSearchList.vue';
import {
  buildDatapointIndex,
  buildFrameworkTree,
  flattenValueStructure,
  getDatasetDatapointLabels,
  getDatasetSectionLabels,
  groupDatapointsByName,
  parseFrameworkSchema,
  resolveStructure,
  type DatapointEntry,
} from '@/components/resources/frameworkExplorer/frameworkExplorerSchema';
import { minimalKeycloakMock } from '@ct/testUtils/Keycloak';
import { getMountingFunction } from '@ct/testUtils/Mount';
import router from '@/router';
import type { FrameworkSpecification } from '@clients/specification-service';

const schema = {
  category: {
    subsection: {
      first: { id: 'firstType', ref: '/specifications/data-point-types/firstType', aliasExport: 'FIRST' },
      second: { id: 'secondType', ref: '/specifications/data-point-types/secondType' },
    },
  },
};
const framework: FrameworkSpecification = {
  framework: { id: 'sample', ref: '/specifications/frameworks/sample' },
  name: 'Sample framework',
  businessDefinition: 'A sample',
  schema: JSON.stringify(schema),
  referencedReportJsonPath: null,
};
const resolvedSchema = {
  category: {
    subsection: {
      first: { value: 'BigDecimal', dataSource: { page: 'String' } },
      second: 'LocalDate',
    },
  },
};

describe('Framework explorer schema mapping', () => {
  it('uses the labels shown in a PCAF dataset, with IDs as fallback', () => {
    const pcafFramework: FrameworkSpecification = {
      ...framework,
      framework: { id: 'pcaf', ref: '/specifications/frameworks/pcaf' },
      schema: JSON.stringify({
        general: {
          general: {
            fiscalYearEnd: {
              id: 'extendedDateFiscalYearEnd',
              ref: '/specifications/data-point-types/extendedDateFiscalYearEnd',
            },
            unknown: { id: 'unknownType', ref: '/specifications/data-point-types/unknownType' },
          },
        },
      }),
    };
    const labels = getDatasetDatapointLabels('pcaf');
    expect(labels.get('extendedDateFiscalYearEnd')).to.equal('Fiscal Year End');
    const entries = buildDatapointIndex([pcafFramework]);
    expect(entries.find((entry) => entry.id === 'extendedDateFiscalYearEnd')?.displayName).to.equal('Fiscal Year End');
    expect(entries.find((entry) => entry.id === 'unknownType')?.displayName).to.equal('unknownType');
    const parsedSchema = parseFrameworkSchema(pcafFramework.schema);
    const sectionLabels = getDatasetSectionLabels('pcaf', parsedSchema);
    const tree = buildFrameworkTree(parsedSchema, labels, sectionLabels);
    expect(tree[0].label).to.equal('General');
    expect(tree[0].children?.[0].label).to.equal('General');
    expect(tree[0].children?.[0].children?.[0].label).to.equal('Fiscal Year End');
    expect(tree[0].children?.[0].children?.[1].label).to.equal('unknownType');
    expect(entries[0].occurrences[0].displayPath).to.deep.equal(['General', 'General']);

    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointSearchList, {
      props: { entries, search: 'Fiscal Year End' },
    });
    cy.contains('Fiscal Year End').should('be.visible');
    cy.contains('unknownType').should('not.exist');
  });

  it('uses the dataset subcategory heading when a technical name differs', () => {
    const lksgSchema = parseFrameworkSchema(
      JSON.stringify({
        general: {
          masterData: {
            dataDate: { id: 'dataDate', ref: '/specifications/data-point-types/dataDate' },
          },
        },
        unlistedCategory: {
          unlistedSubcategory: {
            unknown: { id: 'unknownType', ref: '/specifications/data-point-types/unknownType' },
          },
        },
      })
    );
    const sectionLabels = getDatasetSectionLabels('lksg', lksgSchema);
    const tree = buildFrameworkTree(lksgSchema, getDatasetDatapointLabels('lksg'), sectionLabels);
    expect(tree[0].label).to.equal('General');
    expect(tree[0].children?.[0].label).to.equal('Master Data');
    expect(tree[1].label).to.equal('unlistedCategory');
    expect(tree[1].children?.[0].label).to.equal('unlistedSubcategory');
    expect(tree[0].key).to.equal('general');
    expect(tree[0].children?.[0].key).to.equal('general.masterData');
  });

  it('builds a tree and reverse index, then reads the same datapoint path from the resolved schema', () => {
    const tree = buildFrameworkTree(parseFrameworkSchema(framework.schema));
    expect(tree[0].children?.[0].children?.[0].data.id).to.equal('firstType');
    const index = buildDatapointIndex([framework]);
    expect(index.map((entry) => entry.id)).to.deep.equal(['firstType', 'secondType']);
    expect(index[0].occurrences[0].aliasExport).to.equal('FIRST');
    const structure = resolveStructure(resolvedSchema, index[0].occurrences[0].path);
    expect(flattenValueStructure(structure)).to.deep.equal([
      { path: 'value', type: 'BigDecimal' },
      { path: 'dataSource.page', type: 'String' },
    ]);
    expect(flattenValueStructure(resolveStructure(resolvedSchema, ['absent']))).to.deep.equal([]);
    expect(flattenValueStructure(resolveStructure(resolvedSchema, index[1].occurrences[0].path))).to.deep.equal([
      { path: 'Value', type: 'LocalDate' },
    ]);
  });
});

describe('Framework explorer datapoint list', () => {
  const entry = (id: string, frameworkId: string, frameworkName: string, category: string): DatapointEntry => ({
    id,
    displayName: 'Absolute Share',
    occurrences: [
      { frameworkId, frameworkName, path: [category, id], displayPath: [category], aliasExport: undefined },
    ],
  });
  const entries = [
    entry('absoluteShareA', 'fw-a', 'Framework A', 'Turnover'),
    entry('absoluteShareB', 'fw-b', 'Framework B', 'CapEx'),
  ];

  it('groups datapoints with the same name into one expandable row listing every framework', () => {
    expect(groupDatapointsByName(entries)).to.have.length(1);
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointSearchList, {
      props: { entries, search: '' },
    });
    cy.get('tbody tr').should('have.length', 1);
    cy.contains('Absolute Share').click();
    cy.contains('button', 'Framework A').should('be.visible');
    cy.contains('button', 'Framework B').should('be.visible');
    cy.contains('Turnover').should('be.visible');
    cy.contains('CapEx').should('be.visible');
  });

  it('highlights the selected datapoint in Dataland colours while keeping its text visible', () => {
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointSearchList, {
      props: { entries, search: '', selectedId: 'absoluteShareB', selectedFrameworkId: 'fw-b' },
    });
    cy.get('tr.explorer-selected-row').should('have.length', 2);
    cy.get('tr.explorer-selected-row')
      .first()
      .contains('Absolute Share')
      .should('be.visible')
      .then(($text) => {
        const row = $text.closest('tr')[0];
        const style = getComputedStyle(row);
        expect(style.backgroundColor).not.to.equal(style.color);
        expect(style.backgroundColor).not.to.equal('rgb(15, 23, 42)');
      });
    cy.contains('button', 'Framework A').closest('tr').should('not.have.class', 'explorer-selected-row');
    cy.contains('button', 'Framework B').closest('tr').should('have.class', 'explorer-selected-row');
  });
});

describe('Framework explorer page', () => {
  beforeEach(() => {
    cy.intercept('GET', '/specifications/frameworks', [{ framework: framework.framework, name: framework.name }]);
    cy.intercept('GET', '/specifications/frameworks/sample', framework);
    cy.intercept('GET', '/specifications/frameworks/sample/resolved-schema', {
      framework: framework.framework,
      name: framework.name,
      businessDefinition: '',
      resolvedSchema,
      referencedReportJsonPath: null,
    }).as('resolved');
    cy.intercept('GET', '/specifications/data-point-types/firstType', {
      dataPointType: { id: 'firstType', ref: '' },
      name: 'First datapoint',
      businessDefinition: 'Explanation',
      dataPointBaseType: { id: 'extendedDecimal', ref: '' },
      usedBy: [framework.framework],
      constraints: [],
      calculationRules: [],
    }).as('detail');
    cy.intercept('GET', '/specifications/data-point-base-types/extendedDecimal', {
      dataPointBaseType: { id: 'extendedDecimal', ref: '' },
      name: 'Decimal',
      businessDefinition: 'Decimal value',
      validatedBy: 'DecimalValidator',
      example: { value: 5 },
      usedBy: [],
    }).as('base');
  });

  it('opens a deep link and loads value structure only after selection', () => {
    cy.wrap(router.replace('/framework-explorer')).then(() => {
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    cy.get('@resolved.all').should('have.length', 0);
    cy.contains('firstType').click();
    cy.contains('button', 'Sample framework').click();
    cy.wait('@detail');
    cy.wait('@base');
    cy.wait('@resolved');
    cy.contains('First datapoint').should('be.visible');
    cy.contains('dataSource.page').should('be.visible');
    cy.contains('Show example').click();
    cy.contains('"value": 5').should('be.visible');
    cy.wrap(null).then(() => expect(router.currentRoute.value.query.datapoint).to.equal('firstType'));
  });

  it('restores a framework-mode deep link and filters by alias', () => {
    cy.wrap(router.replace('/framework-explorer?mode=framework&framework=sample&datapoint=firstType')).then(() => {
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    cy.contains('First datapoint').should('be.visible');
    cy.contains('category').should('be.visible');
    cy.contains('All datapoints').click();
    cy.get('#datapoint-search').type('FIRST');
    cy.contains('firstType').should('be.visible');
    cy.contains('secondType').should('not.exist');
  });

  it('shows a useful fallback when the resolved path is absent', () => {
    cy.intercept('GET', '/specifications/frameworks/sample/resolved-schema', {
      framework: framework.framework,
      name: framework.name,
      businessDefinition: '',
      resolvedSchema: {},
    });
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointDetailPanel, {
      props: { id: 'firstType', entry: buildDatapointIndex([framework])[0], frameworks: [framework] },
    });
    cy.contains('Value structure unavailable.').should('be.visible');
    cy.contains('Show example').should('be.visible');
  });

  it('shows technical details collapsed by default and expands them on demand', () => {
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointDetailPanel, {
      props: { id: 'firstType', entry: buildDatapointIndex([framework])[0], frameworks: [framework] },
    });
    cy.contains('First datapoint').should('be.visible');
    cy.contains('DecimalValidator').should('not.be.visible');
    cy.get('button[aria-label="Technical details"]').should('have.attr', 'aria-expanded', 'false').click();
    cy.contains('dt', 'Base type ID').should('be.visible');
    cy.contains('dd', 'extendedDecimal').should('be.visible');
    cy.contains('dd', 'DecimalValidator').should('be.visible');
  });

  it('hides the datapoint ID until requested and colors the JSON example', () => {
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointDetailPanel, {
      props: { id: 'firstType', entry: buildDatapointIndex([framework])[0], frameworks: [framework] },
    });
    cy.get('.detail-id').should('not.exist');
    cy.contains('button', 'Show ID').click();
    cy.get('.detail-id').should('have.text', 'firstType');
    cy.contains('button', 'Copy ID').should('be.visible');
    cy.contains('Show example').click();
    cy.get('.json-key').should('contain.text', '"value"');
    cy.get('.json-number').should('contain.text', '5');
  });

  it('opens a flow chart for calculated datapoints and re-centers on click', () => {
    cy.intercept('GET', '/specifications/data-point-types/firstType', {
      dataPointType: { id: 'firstType', ref: '' },
      name: 'First datapoint',
      businessDefinition: 'Explanation',
      dataPointBaseType: { id: 'extendedDecimal', ref: '' },
      usedBy: [],
      constraints: [],
      calculationRules: [{ inputs: ['secondType'], calculationMethod: 'Doubling' }],
    });
    cy.intercept('GET', '/specifications/data-point-types/secondType', {
      dataPointType: { id: 'secondType', ref: '' },
      name: 'Second datapoint',
      businessDefinition: '',
      dataPointBaseType: { id: 'extendedDecimal', ref: '' },
      usedBy: [],
      constraints: [],
      calculationRules: [],
    });
    cy.wrap(router.replace('/framework-explorer?datapoint=firstType')).then(() => {
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    cy.contains('button', 'Show flow chart').click();
    cy.get('[data-test="flow-scroll"]').should('be.visible');
    cy.contains('.flow-method', 'Doubling').should('be.visible');
    cy.contains('button.flow-node', 'Second datapoint').click();
    cy.get('[data-test="flow-scroll"]').should('be.visible');
    cy.wrap(null).then(() => expect(router.currentRoute.value.query.datapoint).to.equal('secondType'));
  });

  it('hides the flow chart button for datapoints without rules', () => {
    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointDetailPanel, {
      props: { id: 'firstType', entry: buildDatapointIndex([framework])[0], frameworks: [framework] },
    });
    cy.contains('First datapoint').should('be.visible');
    cy.contains('button', 'Show flow chart').should('not.exist');
  });

  it('keeps the datapoint list usable if its detail request fails', () => {
    cy.intercept('GET', '/specifications/data-point-types/firstType', { statusCode: 404, body: {} });
    cy.wrap(router.replace('/framework-explorer?datapoint=firstType')).then(() => {
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    cy.contains('Failed to load datapoint details.').should('be.visible');
    cy.contains('secondType').should('be.visible');
  });

  it('reports an unknown datapoint without disabling search', () => {
    cy.wrap(router.replace('/framework-explorer?datapoint=unknown')).then(() => {
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    cy.contains('Datapoint not found in the available frameworks.').should('be.visible');
    cy.contains('firstType').should('be.visible');
  });
});
