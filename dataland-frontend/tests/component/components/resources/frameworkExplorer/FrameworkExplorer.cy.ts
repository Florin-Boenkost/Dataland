import FrameworkExplorerPage from '@/components/pages/FrameworkExplorerPage.vue';
import DatapointDetailPanel from '@/components/resources/frameworkExplorer/DatapointDetailPanel.vue';
import DatapointSearchList from '@/components/resources/frameworkExplorer/DatapointSearchList.vue';
import {
  buildDatapointIndex,
  buildFrameworkTree,
  flattenValueStructure,
  getDatasetDatapointLabels,
  parseFrameworkSchema,
  resolveStructure,
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
    const tree = buildFrameworkTree(parseFrameworkSchema(pcafFramework.schema), labels);
    expect(tree[0].children?.[0].children?.[0].label).to.equal('Fiscal Year End');
    expect(tree[0].children?.[0].children?.[1].label).to.equal('unknownType');

    getMountingFunction({ keycloak: minimalKeycloakMock({}) })(DatapointSearchList, {
      props: { entries, search: 'Fiscal Year End' },
    });
    cy.contains('Fiscal Year End').should('be.visible');
    cy.contains('unknownType').should('not.exist');
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
