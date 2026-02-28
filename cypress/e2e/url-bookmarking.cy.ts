/// <reference types="cypress" />

function simulateLogin() {
  cy.window().then(win => {
    win.localStorage.setItem('wca_access_token', 'fake-token');
    win.dispatchEvent(new StorageEvent('storage', {
      key: 'wca_access_token',
      newValue: 'fake-token'
    }));
  });
}

describe('URL Bookmarking', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');

    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
      fixture: 'wcif.json'
    }).as('getWcif');
  });

  describe('Direct navigation via URL', () => {
    it('should navigate directly to competition from URL', () => {
      cy.visit('/?competition=TestCompetition2024');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.get('.comp-title').should('contain', 'TestCompetition2024');
    });

    it('should default to Podium Certificates tab when no tab param', () => {
      cy.visit('/?competition=TestCompetition2024');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.get('.events-table').should('be.visible');
    });

    it('should navigate to Customize Podium tab from URL', () => {
      cy.visit('/?competition=TestCompetition2024&tab=customize');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.contains('Certificate Layout').should('be.visible');
    });

    it('should default to podium tab for unknown tab value', () => {
      cy.visit('/?competition=TestCompetition2024&tab=bogus');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.get('.events-table').should('be.visible');
    });
  });

  describe('URL updates on user actions', () => {
    it('should update URL when a competition is selected from the list', () => {
      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.get('.competition').first().click();
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();

      cy.location('search').should('contain', 'competition=');
    });

    it('should update URL when custom competition ID is loaded', () => {
      cy.visit('/');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.get('input[placeholder="Enter competition ID"]').type('CustomComp2024');
      cy.contains('button', 'Load').click();
      cy.wait('@getWcif');

      cy.location('search').should('contain', 'competition=CustomComp2024');
    });

    it('should update URL with tab param when switching to Customize Podium', () => {
      cy.visit('/?competition=TestCompetition2024');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();

      cy.navigateToTab('Customize Podium');
      cy.location('search').should('contain', 'tab=customize');
    });

    it('should remove tab param from URL when switching back to Podium Certificates', () => {
      cy.visit('/?competition=TestCompetition2024&tab=customize');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();

      cy.navigateToTab('Podium Certificates');
      cy.location('search').should('contain', 'competition=TestCompetition2024');
      cy.location('search').should('not.contain', 'tab=');
    });

    it('should clear URL params on logout', () => {
      cy.visit('/?competition=TestCompetition2024');
      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();

      cy.on('window:confirm', () => true);
      cy.contains('button', 'Log Out').click();

      cy.location('search').should('eq', '');
    });
  });

  describe('Login redirect flow', () => {
    it('should show login prompt when visiting URL with competition param while not logged in', () => {
      window.localStorage.removeItem('wca_access_token');
      cy.visit('/?competition=TestCompetition2024');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.contains('Please log in with your WCA account').should('be.visible');
      cy.get('.comp-interface').should('not.exist');
      // URL should be preserved
      cy.location('search').should('contain', 'competition=TestCompetition2024');
    });

    it('should navigate to competition after login when URL has competition param', () => {
      window.localStorage.removeItem('wca_access_token');
      cy.visit('/?competition=TestCompetition2024');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.contains('Please log in with your WCA account').should('be.visible');

      simulateLogin();

      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.get('.comp-title').should('contain', 'TestCompetition2024');
    });

    it('should navigate to competition with customize tab after login', () => {
      window.localStorage.removeItem('wca_access_token');
      cy.visit('/?competition=TestCompetition2024&tab=customize');
      cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

      cy.contains('Please log in with your WCA account').should('be.visible');

      simulateLogin();

      cy.wait('@getWcif');
      cy.waitForCompetitionLoad();
      cy.contains('Certificate Layout').should('be.visible');
    });
  });
});
