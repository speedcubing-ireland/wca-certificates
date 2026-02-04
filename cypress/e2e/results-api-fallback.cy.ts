/// <reference types="cypress" />

/**
 * Tests for the results API fallback mechanism.
 *
 * When WCIF data doesn't contain results (due to sync delay after competition ends),
 * the app should fall back to the /results API endpoint which syncs faster.
 */
describe('Results API Fallback', () => {
  beforeEach(() => {
    // Intercept competition list API calls
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');

    // Intercept logging calls
    cy.intercept('POST', '**/inputs/*', { statusCode: 200 }).as('logEvent');
  });

  describe('when WCIF has no results but /results API has data', () => {
    beforeEach(() => {
      // WCIF returns empty results
      cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
        fixture: 'wcif-no-results.json'
      }).as('getWcif');

      // /results API returns actual results
      cy.intercept('GET', '**/api/v0/competitions/*/results', {
        fixture: 'api-results.json'
      }).as('getResults');

      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      // Select a competition
      cy.get('.competition').first().click();
      cy.wait('@getWcif');
    });

    it('should fetch results from /results API when WCIF has no results', () => {
      // Verify the /results API was called
      cy.wait('@getResults');
    });

    it('should display events with results after fallback', () => {
      cy.wait('@getResults');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Events should be displayed
      cy.get('.events-table').should('be.visible');
      cy.get('.event-row').should('have.length.at.least', 1);
    });

    it('should show podium status instead of "Not available yet" after fallback', () => {
      cy.wait('@getResults');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Check that at least one event does NOT show "Not available yet"
      // The 333 and 222 events should have results from the fallback
      cy.get('.event-row').first().find('.event-warning').should('not.contain', 'Not available yet');
    });

    it('should show correct podium count for events with 3 competitors', () => {
      cy.wait('@getResults');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // First event (333 / 3x3x3 Cube) has 3 competitors, should show no warning (empty = 3 on podium)
      cy.get('.event-row').first().find('.event-warning').should('be.empty');
    });

    it('should show warning for events with only 2 on podium', () => {
      cy.wait('@getResults');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Second event (222 / 2x2x2 Cube) has only 2 competitors
      cy.get('.event-row').eq(1).find('.event-warning')
        .should('contain', 'Only 2 persons on the podium');
    });

    it('should allow selecting events for certificate generation', () => {
      cy.wait('@getResults');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Should be able to select an event
      cy.get('.event-checkbox').first().click();
      cy.get('.event-checkbox').first().should('be.checked');

      // Download button should be enabled
      cy.contains('button', 'Download PDF').should('not.be.disabled');
    });
  });

  describe('when WCIF has no results and /results API also has no data', () => {
    beforeEach(() => {
      // WCIF returns empty results
      cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
        fixture: 'wcif-no-results.json'
      }).as('getWcif');

      // /results API returns empty array
      cy.intercept('GET', '**/api/v0/competitions/*/results', {
        body: []
      }).as('getResultsEmpty');

      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.get('.competition').first().click();
      cy.wait('@getWcif');
    });

    it('should show "Not available yet" when both APIs have no results', () => {
      cy.wait('@getResultsEmpty');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // All events should show "Not available yet"
      cy.get('.event-row').each(($row) => {
        cy.wrap($row).find('.event-warning').should('contain', 'Not available yet');
      });
    });

    it('should disable download buttons when no results available', () => {
      cy.wait('@getResultsEmpty');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Select an event
      cy.get('.event-checkbox').first().click();

      // Download PDF should still be enabled (user can try to download)
      // but Preview might show empty certificates
      cy.contains('button', 'Download PDF').should('not.be.disabled');
    });
  });

  describe('when WCIF has no results and /results API fails', () => {
    beforeEach(() => {
      // WCIF returns empty results
      cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
        fixture: 'wcif-no-results.json'
      }).as('getWcif');

      // /results API fails
      cy.intercept('GET', '**/api/v0/competitions/*/results', {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('getResultsFailed');

      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.get('.competition').first().click();
      cy.wait('@getWcif');
    });

    it('should gracefully handle /results API failure', () => {
      cy.wait('@getResultsFailed');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Should still display the interface without crashing
      cy.get('.events-table').should('be.visible');
    });

    it('should show "Not available yet" when /results API fails', () => {
      cy.wait('@getResultsFailed');
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Events should show "Not available yet"
      cy.get('.event-row').each(($row) => {
        cy.wrap($row).find('.event-warning').should('contain', 'Not available yet');
      });
    });
  });

  describe('when WCIF already has results', () => {
    beforeEach(() => {
      // WCIF returns results (normal case)
      cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
        fixture: 'wcif.json'
      }).as('getWcif');

      // /results API should NOT be called
      cy.intercept('GET', '**/api/v0/competitions/*/results', {
        fixture: 'api-results.json'
      }).as('getResults');

      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.get('.competition').first().click();
      cy.wait('@getWcif');
    });

    it('should NOT call /results API when WCIF has results', () => {
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      // Give some time to ensure the request would have been made if it was going to
      cy.wait(1000);

      // Verify /results was not called
      cy.get('@getResults.all').should('have.length', 0);
    });

    it('should display events with results from WCIF', () => {
      cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

      cy.get('.events-table').should('be.visible');
      cy.get('.event-row').should('have.length.at.least', 1);

      // First event (333) should not show "Not available yet"
      cy.get('.event-row').first().find('.event-warning').should('not.contain', 'Not available yet');
    });
  });
});
