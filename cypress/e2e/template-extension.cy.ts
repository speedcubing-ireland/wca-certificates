/// <reference types="cypress" />

describe('Template Extension - Auto-load', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');
  });

  it('should auto-load template when competition with saved template is opened', () => {
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
      fixture: 'wcif-with-template.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    // Template should be auto-loaded with distinct message
    cy.get('[data-cy="template-message"]').should('contain', 'Saved template applied.');
    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('textarea#podium-template').should('have.value', '["Saved Template Content"]');
    cy.get('textarea#podium-style').should('have.value', '{"font": "mono"}');
    cy.get('#podium-orientation').should('have.value', 'portrait');
    cy.get('input#podium-countries').should('have.value', 'IE');
    cy.get('input#podium-xoffset').should('have.value', '25');
  });

  it('should keep default template when competition has no saved template', () => {
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
      fixture: 'wcif.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    // No auto-load message should appear
    cy.get('[data-cy="template-message"]').should('not.exist');
    // Default template should contain the standard certificate placeholders
    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('textarea#podium-template').invoke('val').should('contain', 'certificate.');
    cy.get('#podium-orientation').should('have.value', 'landscape');
  });
});

describe('Template Extension - Load from Server', () => {
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

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');
  });

  it('should show Load Saved Template button', () => {
    cy.get('[data-cy="load-template"]').should('be.visible');
  });

  it('should be disabled while loading', () => {
    // Delay the response so we can check the disabled state
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
      fixture: 'wcif-with-template.json',
      delay: 500
    }).as('getWcifRefresh');

    cy.get('[data-cy="load-template"]').click();
    cy.get('[data-cy="load-template"]').should('be.disabled');
    cy.wait('@getWcifRefresh');
    cy.get('[data-cy="load-template"]').should('not.be.disabled');
  });

  it('should fetch WCIF and apply template when clicked', () => {
    // Now intercept with template for the load fetch
    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
      fixture: 'wcif-with-template.json'
    }).as('getWcifRefresh');

    cy.get('[data-cy="load-template"]').click();
    cy.wait('@getWcifRefresh');

    cy.get('[data-cy="template-message"]').should('be.visible');
    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
    cy.get('textarea#podium-template').should('have.value', '["Saved Template Content"]');
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

    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
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

    cy.get('[data-cy="save-template"]').should('be.visible');
  });

  it('should disable save button when not logged in', () => {
    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    // Log out to check that save button becomes disabled
    cy.contains('button', 'Log Out (WCA)').click();
    cy.get('[data-cy="save-template"]').should('be.visible').and('be.disabled');
  });

  it('should not save when confirmation is cancelled', () => {
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

    cy.on('window:confirm', () => false);
    cy.get('[data-cy="save-template"]').click();
    cy.get('[data-cy="template-message"]').should('not.exist');
  });

  it('should save template and show success message after confirmation', () => {
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

    cy.on('window:confirm', () => true);
    cy.get('[data-cy="save-template"]').click();
    cy.wait('@saveWcif');
    cy.get('[data-cy="template-message"]').should('be.visible');
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

    cy.on('window:confirm', () => true);
    cy.get('[data-cy="save-template"]').click();
    cy.wait('@saveWcif');
    cy.get('[data-cy="template-message"]').should('be.visible');
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
    window.localStorage.removeItem('wca_access_token');
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
