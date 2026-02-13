/// <reference types="cypress" />

describe('Template Extension - Load', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');
  });

  it('should show Load button when WCIF has a template extension', () => {
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
      fixture: 'wcif-with-template.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="load-template"]').should('be.visible');
  });

  it('should apply saved template settings when Load is clicked', () => {
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
      fixture: 'wcif-with-template.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="load-template"]').click();

    cy.get('[data-cy="load-success"]').should('be.visible');
    cy.get('textarea#podium-template').should('have.value', '["Saved Template Content"]');
    cy.get('textarea#podium-style').should('have.value', '{"font": "mono"}');
    cy.get('#podium-orientation').should('have.value', 'portrait');
    cy.get('input#podium-countries').should('have.value', 'IE');
    cy.get('input#podium-xoffset').should('have.value', '25');
  });

  it('should hide Load button when WCIF has no template extension', () => {
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
      fixture: 'wcif.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="load-template"]').should('not.exist');
  });
});

describe('Template Extension - Save', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');

    cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
      fixture: 'wcif.json'
    }).as('getWcif');
  });

  it('should show save button when logged in', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wca_access_token', 'fake-token');
      }
    });
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="save-template"]').should('be.visible');
  });

  it('should show hint text when not logged in', () => {
    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="save-template"]').should('not.exist');
    cy.get('[data-cy="save-hint"]').should('contain', 'Log in with WCA to save templates');
  });

  it('should save template and show success message', () => {
    cy.intercept('PATCH', '**/api/v0/competitions/*/wcif', {
      statusCode: 200,
      body: {}
    }).as('saveWcif');

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wca_access_token', 'fake-token');
      }
    });
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="save-template"]').click();
    cy.wait('@saveWcif');
    cy.get('[data-cy="save-success"]').should('be.visible');
  });

  it('should show error message on save failure', () => {
    cy.intercept('PATCH', '**/api/v0/competitions/*/wcif', {
      statusCode: 403,
      body: { error: 'Forbidden' }
    }).as('saveWcif');

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wca_access_token', 'fake-token');
      }
    });
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('[data-cy="save-template"]').click();
    cy.wait('@saveWcif');
    cy.get('[data-cy="save-error"]').should('be.visible');
  });
});

describe('Template Extension - Auth UI', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');
  });

  it('should show Log In button when not logged in', () => {
    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.contains('button', 'Log In (WCA)').should('be.visible');
  });

  it('should show Log Out button when logged in', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wca_access_token', 'fake-token');
      }
    });
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.contains('button', 'Log Out (WCA)').should('be.visible');
  });

  it('should log out when Log Out button is clicked', () => {
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wca_access_token', 'fake-token');
      }
    });
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.contains('button', 'Log Out (WCA)').click();
    cy.contains('button', 'Log In (WCA)').should('be.visible');
    cy.window().then(win => {
      expect(win.localStorage.getItem('wca_access_token')).to.be.null;
    });
  });
});

describe('Template Extension - Callback page', () => {
  it('should write access token to localStorage from URL fragment', () => {
    cy.visit('/callback.html#access_token=test-token-123&token_type=Bearer');
    cy.window().then(win => {
      expect(win.localStorage.getItem('wca_access_token')).to.equal('test-token-123');
    });
  });
});
