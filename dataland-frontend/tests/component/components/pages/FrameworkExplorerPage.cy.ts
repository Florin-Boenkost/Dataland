import FrameworkExplorerPage from '@/components/pages/FrameworkExplorerPage.vue';
import { minimalKeycloakMock } from '@ct/testUtils/Keycloak';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { routes } from '@/router';

const ref = (type: string, id: string): { id: string; ref: string } => ({
  id,
  ref: `https://local-dev.dataland.com/specifications/${type}/${id}`,
});

const summaries = [
  {
    dataPointType: ref('data-point-types', 'extendedDecimalScope1'),
    name: 'Scope 1 emissions',
    businessDefinition: 'Direct greenhouse gas emissions',
    dataPointBaseType: ref('data-point-base-types', 'extendedDecimal'),
    usedBy: [ref('frameworks', 'sfdr')],
  },
  {
    dataPointType: ref('data-point-types', 'plainBoolean'),
    name: 'Is sustainable',
    businessDefinition: '',
    dataPointBaseType: ref('data-point-base-types', 'plainBoolean'),
    usedBy: [],
  },
];

const sfdrSchema = {
  environmental: { emissions: { scope1: { ...ref('data-point-types', 'extendedDecimalScope1'), aliasExport: 'S1' } } },
};

/**
 * Creates a router so that the test can inspect and set the query.
 * @returns the router
 */
function createTestRouter(): Router {
  return createRouter({ routes, history: createMemoryHistory() });
}

describe('Component tests for the framework explorer page', function (): void {
  beforeEach(function () {
    cy.intercept('GET', '**/specifications/data-point-types', summaries).as('list');
    cy.intercept('GET', '**/specifications/frameworks', [{ framework: ref('frameworks', 'sfdr'), name: 'SFDR' }]);
    cy.intercept('GET', '**/specifications/frameworks/sfdr', {
      framework: ref('frameworks', 'sfdr'),
      name: 'SFDR',
      businessDefinition: 'SFDR',
      schema: JSON.stringify(sfdrSchema),
    });
    cy.intercept('GET', '**/specifications/data-point-types/extendedDecimalScope1', {
      ...summaries[0],
      constraints: ['must be positive'],
      calculationRules: [{ inputs: ['a', 'b'], calculationMethod: 'a + b' }],
    });
    cy.intercept('GET', '**/specifications/data-point-types/plainBoolean', {
      ...summaries[1],
      calculationRules: [],
    });
    cy.intercept('GET', '**/specifications/data-point-types/unknown', { statusCode: 404, body: {} });
    cy.intercept('GET', '**/specifications/data-point-base-types/*', {
      dataPointBaseType: ref('data-point-base-types', 'extendedDecimal'),
      name: 'Extended decimal',
      businessDefinition: 'A decimal with quality',
      validatedBy: 'org.dataland.Validator',
      example: { value: 1 },
      usedBy: [],
    });
  });

  /**
   * Mounts the page with the given initial query.
   * @param query the initial route query string
   * @returns the router
   */
  function mountPage(query = ''): Router {
    const router = createTestRouter();
    cy.wrap(router.push(`/framework-explorer${query}`)).then(() => {
      // @ts-ignore
      cy.mountWithPlugins(FrameworkExplorerPage, { keycloak: minimalKeycloakMock({}), router });
    });
    return router;
  }

  it('shows the empty state, filters by search and updates the url on selection', function (): void {
    const router = mountPage();
    cy.get('[data-test="noSelection"]').should('exist');
    cy.get('[data-test="datapointSearchInput"]').type('scope 1');
    cy.get('[data-test="datapointOption-plainBoolean"]').should('not.exist');
    cy.get('[data-test="datapointOption-extendedDecimalScope1"]').click();
    cy.get('[data-test="detailName"]').should('contain.text', 'Scope 1 emissions');
    cy.wrap(router.currentRoute).its('value.query.datapoint').should('eq', 'extendedDecimalScope1');
  });

  it('shows a message when no datapoint matches', function (): void {
    mountPage();
    cy.get('[data-test="datapointSearchInput"]').type('nothing like this');
    cy.get('[data-test="noDatapointsMatch"]').should('exist');
  });

  it('opens the right datapoint from a deep link and shows all sections', function (): void {
    mountPage('?datapoint=extendedDecimalScope1');
    cy.get('[data-test="detailName"]').should('contain.text', 'Scope 1 emissions');
    cy.get('[data-test="descriptionSection"]').should('contain.text', 'Direct greenhouse gas emissions');
    cy.get('[data-test="frameworkEntry-sfdr"]').should('contain.text', 'SFDR');
    cy.get('[data-test="frameworkPath"]').should('contain.text', 'Environmental > Emissions');
    cy.get('[data-test="baseTypeName"]').should('contain.text', 'Extended decimal');
    cy.get('[data-test="constraints"]').should('contain.text', 'must be positive');
    cy.get('[data-test="calculationRules"]').should('contain.text', 'a + b');
    cy.get('[data-test="technicalSection"]').should('exist');
  });

  it('handles an empty description and a datapoint without frameworks', function (): void {
    mountPage('?datapoint=plainBoolean');
    cy.get('[data-test="descriptionSection"]').should('contain.text', 'No description available');
    cy.get('[data-test="frameworksSection"]').should('contain.text', 'not used in any framework');
  });

  it('shows a not-found message for an unknown datapoint while the list stays usable', function (): void {
    mountPage('?datapoint=unknown');
    cy.get('[data-test="detailNotFound"]').should('exist');
    cy.get('[data-test="datapointOption-plainBoolean"]').should('exist');
  });

  it('shows an error with retry when the detail request fails', function (): void {
    cy.intercept('GET', '**/specifications/data-point-types/plainBoolean', { statusCode: 500, body: {} });
    mountPage('?datapoint=plainBoolean');
    cy.get('[data-test="detailError"]').should('exist');
  });

  it('switches to the framework mode and renders the tree', function (): void {
    const router = mountPage('?datapoint=extendedDecimalScope1');
    cy.get('[data-test="modeToggle"]').contains('By framework').click();
    cy.wrap(router.currentRoute).its('value.query.mode').should('eq', 'framework');
    cy.get('[data-test="frameworkTree"]').should('contain.text', 'Environmental');
    cy.get('[data-test="frameworkTree"]').should('contain.text', 'Scope1');
    cy.get('[data-test="detailName"]').should('contain.text', 'Scope 1 emissions');
  });
});
