/// <reference types="cypress" />

describe('Customize Podium Tab', () => {
  beforeEach(() => {
    // Intercept API calls (from GitHub raw)
    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/IE.json', {
      fixture: 'competitions.json'
    }).as('getIrishCompetitions');

    cy.intercept('GET', '**/speedcubing-ireland/wca-analysis/api/competitions/GB.json', {
      fixture: 'competitions-gb.json'
    }).as('getUKCompetitions');

    cy.intercept('GET', '**/api/v0/competitions/*/wcif/public', {
      fixture: 'wcif.json'
    }).as('getWcif');

    cy.visit('/');
    cy.wait(['@getIrishCompetitions', '@getUKCompetitions']);

    // Select a competition
    cy.get('.competition').first().click();
    cy.wait('@getWcif');
    cy.get('.comp-interface', { timeout: 10000 }).should('be.visible');

    // Navigate to Customize Podium tab
    cy.contains('.mat-mdc-tab', 'Customize Podium').click();
  });

  it('should have editable certificate template textarea', () => {
    cy.get('textarea').first().should('be.visible');
    cy.get('textarea').first().should('not.be.disabled');

    // Test editability
    cy.get('textarea').first().clear().type('Test template content');
    cy.get('textarea').first().should('have.value', 'Test template content');
  });

  it('should have editable style configuration textarea', () => {
    cy.get('textarea').eq(1).should('be.visible');
    cy.get('textarea').eq(1).should('not.be.disabled');
  });

  it('should show preview-only checkbox and Clear button when background is uploaded', () => {
    // Verify file input exists
    cy.get('input#podium-background').should('exist');

    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    cy.get('input#podium-background').selectFile({
      contents: Cypress.Buffer.from(base64Image, 'base64'),
      fileName: 'test-background.png',
      mimeType: 'image/png'
    }, { force: true });

    cy.contains('Background set', { timeout: 5000 }).should('be.visible');
    cy.get('input#backgroundForPreview').should('exist').and('be.checked');
    cy.contains('label', 'For preview only').should('be.visible');
    cy.contains('button', 'Clear').should('be.visible');
  });

  it('should show preview-only label when background is set with preview-only enabled', () => {
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    cy.get('input#podium-background').selectFile({
      contents: Cypress.Buffer.from(base64Image, 'base64'),
      fileName: 'test-background.png',
      mimeType: 'image/png'
    }, { force: true });

    cy.contains('Background set', { timeout: 5000 }).should('be.visible');
    cy.contains('.mat-mdc-tab', 'Podium Certificates').click();
    cy.contains('Background applied to preview only').should('be.visible');
  });

  it('should hide preview-only label when checkbox is unchecked', () => {
    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    cy.get('input#podium-background').selectFile({
      contents: Cypress.Buffer.from(base64Image, 'base64'),
      fileName: 'test-background.png',
      mimeType: 'image/png'
    }, { force: true });

    cy.contains('Background set', { timeout: 5000 }).should('be.visible');
    cy.get('input#backgroundForPreview').uncheck();
    cy.contains('.mat-mdc-tab', 'Podium Certificates').click();
    cy.contains('Background applied to preview only').should('not.exist');
  });

  it('should display background status indicator', () => {
    // Initially should show "No background"
    cy.contains('No background').should('be.visible');
  });

  it('should have orientation dropdown with landscape and portrait options', () => {
    cy.get('select').contains('option', 'Landscape').should('exist');
    cy.get('select').contains('option', 'Portrait').should('exist');
  });

  it('should allow changing orientation', () => {
    // Find the orientation select (contains Landscape/Portrait options)
    cy.get('select').each(($select) => {
      if ($select.find('option[value="landscape"]').length > 0) {
        cy.wrap($select).select('portrait');
        cy.wrap($select).should('have.value', 'portrait');
        cy.wrap($select).select('landscape');
        cy.wrap($select).should('have.value', 'landscape');
      }
    });
  });

  it('should have countries filter input', () => {
    cy.get('input[placeholder*="ISO codes"]').should('be.visible');
    cy.get('input[placeholder*="ISO codes"]').type('IE;GB');
    cy.get('input[placeholder*="ISO codes"]').should('have.value', 'IE;GB');
  });

  it('should have X Offset input', () => {
    cy.get('input[type="number"]').should('exist');
    cy.get('input[type="number"]').first().clear().type('10');
    cy.get('input[type="number"]').first().should('have.value', '10');
  });

  it('should reset certificate template to default after editing', () => {
    cy.get('textarea#podium-template').invoke('val').then((defaultValue) => {
      cy.get('textarea#podium-template').clear().type('edited template');
      cy.get('textarea#podium-template').should('have.value', 'edited template');

      // Click the Reset button below the template textarea
      cy.contains('button', 'Reset Certificate Template').click();
      cy.get('textarea#podium-template').should('have.value', defaultValue);
    });
  });

  it('should reset style configuration to default after editing', () => {
    cy.get('textarea#podium-style').invoke('val').then((defaultValue) => {
      cy.get('textarea#podium-style').clear().type('edited style');
      cy.get('textarea#podium-style').should('have.value', 'edited style');

      // Click the Reset button below the style textarea
      cy.contains('button', 'Reset Style Configuration').click();
      cy.get('textarea#podium-style').should('have.value', defaultValue);
    });
  });
});
