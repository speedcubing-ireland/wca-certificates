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

    cy.intercept('GET', '**/api/v0/competitions/*/wcif/', {
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

  it('should display the visual editor with a preview area', () => {
    cy.get('[data-cy="preview-area"]').should('be.visible');
  });

  it('should show default text elements with placeholder values', () => {
    cy.get('[data-cy="visual-element"]').should('have.length', 4);
    cy.get('[data-cy="visual-element"]').first().should('contain.text', '3x3x3 Cube');
  });

  it('should select an element on click and show controls panel', () => {
    cy.get('[data-cy="visual-element"]').first().click();
    cy.get('[data-cy="controls-panel"]').should('be.visible');
    cy.get('[data-cy="element-font-size"]').should('be.visible');
    cy.get('[data-cy="element-bold"]').should('be.visible');
  });

  it('should update fontSize via controls', () => {
    cy.get('[data-cy="visual-element"]').first().click();
    cy.get('[data-cy="element-font-size"]').clear().type('50');
    cy.get('[data-cy="element-font-size"]').should('have.value', '50');
  });

  it('should reset layout when Reset to Default Layout is clicked', () => {
    // Change an element
    cy.get('[data-cy="visual-element"]').first().click();
    cy.get('[data-cy="element-font-size"]').clear().type('99');
    cy.get('[data-cy="element-font-size"]').should('have.value', '99');

    // Click elsewhere to deselect, then reset
    cy.get('[data-cy="preview-area"]').click();
    cy.get('[data-cy="reset-layout"]').click();

    // Re-select first element and verify reset font size
    cy.get('[data-cy="visual-element"]').first().click();
    cy.get('[data-cy="element-font-size"]').should('have.value', '40');
  });

  it('should have editable style configuration textarea', () => {
    cy.get('textarea').first().should('be.visible');
    cy.get('textarea').first().should('not.be.disabled');
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

  it('should reset style configuration to default after editing', () => {
    cy.get('textarea#podium-style').invoke('val').then((defaultValue) => {
      cy.get('textarea#podium-style').clear().type('edited style');
      cy.get('textarea#podium-style').should('have.value', 'edited style');

      // Click the Reset button below the style textarea
      cy.contains('button', 'Reset to Default Style').click();
      cy.get('textarea#podium-style').should('have.value', defaultValue);
    });
  });
});
