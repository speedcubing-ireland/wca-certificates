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

  it('should display the certificate editor with a preview area', () => {
    cy.get('[data-cy="preview-area"]').should('be.visible');
  });

  it('should render preview canvas layer', () => {
    cy.get('[data-cy="preview-canvas"]').should('be.visible');
  });

  it('should display x and y offset sliders', () => {
    cy.get('[data-cy="x-offset-slider"]').should('be.visible');
    cy.get('[data-cy="y-offset-slider"]').should('be.visible');
    cy.get('[data-cy="x-offset-value"]').should('contain.text', '0pt');
    cy.get('[data-cy="y-offset-value"]').should('contain.text', '0pt');
  });

  it('should update x offset value when slider changes', () => {
    cy.get('[data-cy="x-offset-slider"]').invoke('val', 50).trigger('input');
    cy.get('[data-cy="x-offset-value"]').should('contain.text', '50pt');
  });

  it('should update y offset value when slider changes', () => {
    cy.get('[data-cy="y-offset-slider"]').invoke('val', -30).trigger('input');
    cy.get('[data-cy="y-offset-value"]').should('contain.text', '-30pt');
  });

  it('should reset style when Reset to Default Style is clicked', () => {
    cy.get('textarea#podium-style').should('be.visible');
    cy.get('textarea#podium-style').clear().type('{"font":"mono"}', { parseSpecialCharSequences: false });
    cy.get('textarea#podium-style').should('have.value', '{"font":"mono"}');
    cy.contains('button', 'Reset to Default Style').click();
    cy.get('textarea#podium-style').should('not.have.value', '{"font":"mono"}');
  });

  it('should keep the last valid template preview when layout JSON is invalid', () => {
    cy.get('[data-cy="edit-layout-json"]').check();
    cy.get('[data-cy="certificate-layout-json"]').clear().type('{"broken":', { parseSpecialCharSequences: false });
    cy.get('[data-cy="certificate-layout-json-error"]')
      .should('be.visible')
      .and('contain.text', 'Preview stays on the last valid template');
    cy.get('[data-cy="preview-error"]').should('not.exist');
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
