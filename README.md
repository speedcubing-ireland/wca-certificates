# WCA Certificates

A web application for generating podium certificates for World Cube Association (WCA) speedcubing competitions. Built primarily for competitions in Ireland and Northern Ireland.

Originally forked from https://github.com/Goosly/wca-certificates

**Live App:** https://speedcubing-ireland.github.io/wca-certificates/

## Features

### Podium Certificates
- Generate certificates for 1st, 2nd, and 3rd place winners
- Select specific events or generate for all events
- Filter results by country (ISO 2-letter codes)
- Handles ties in podium placement

### Customization
- Custom JSON-based certificate templates
- Upload custom background images
- Configurable page orientation (landscape/portrait)
- X-offset adjustment for precise positioning

### Template Save/Load
- Save certificate template settings to a WCA competition (requires WCA login with competition management permissions)
- Load saved templates from any competition without logging in
- Uses the WCIF Extension mechanism for persistence

### Export Options
- Download as single PDF
- Preview in browser before printing

## Technologies

- **Angular** 19.2.18
- **Angular Material** for UI components
- **PDFMake** for client-side PDF generation
- **@wca/helpers** for WCA data models

## Development

### Prerequisites
- Node.js 20.x or 22.x (Angular 19 requires Node 18.19.1+)
- Angular CLI 19.x

### Setting up Node.js with nvm

If you have a different version of Node.js installed, use [nvm](https://github.com/nvm-sh/nvm) to install and switch to Node 20:

```bash
# Install Node 20
nvm install 20

# Use Node 20 in current shell
nvm use 20

# Verify version
node --version  # Should show v20.x.x
```

### Installing Angular CLI 19

```bash
npm install -g @angular/cli@19
```

### Installation

```bash
npm install
```

### Running Locally

```bash
ng serve
```

Navigate to http://localhost:4200/

### Linting

```bash
npm run lint
```

### Unit Testing (Karma/Jasmine)

```bash
npm test
```

Runs unit tests in headless Chrome. Spec files live alongside their source files (`*.spec.ts`).

### End-to-End Testing (Cypress)

The project uses [Cypress](https://www.cypress.io/) for end-to-end testing.

```bash
# Run E2E tests (starts server automatically and runs tests headlessly)
npm run e2e

# Run E2E tests with Cypress UI (interactive mode)
npm run e2e:open

# Run Cypress tests only (requires server running on localhost:4200)
npm run cy:run

# Open Cypress UI only (requires server running on localhost:4200)
npm run cy:open
```

The test suite covers:
- Competition selection and loading
- Podium certificate generation
- Certificate customization options
- Template save/load via WCIF extensions
- Tab navigation and error handling

## Build & Deploy

To build for production:

```bash
npm run build-prod
```

### Testing the Production Build Locally

The production build can behave differently from `ng serve` due to optimizations and base-href settings. To test the bundled output locally before deploying:

```bash
# Build without the GitHub Pages base-href
ng build -c=production

# Serve locally
npx serve dist/wca-certificates -s
```

Then open http://localhost:3000 to test the production bundle.

### Deploying to GitHub Pages

**Automatic (preferred):** Pushing to `master` triggers the CI & Deploy workflow. It runs Cypress E2E tests first, and if they pass, automatically builds and deploys to GitHub Pages using the official GitHub Pages actions. Deployments are tracked in the repo's Environments tab.

**Manual fallback:** For quick rollbacks or emergency fixes, you can still deploy manually:

```bash
npm run build-prod
npm run deploy
```

This pushes the `dist/wca-certificates` directory to the `gh-pages` branch.

## Template Save/Load (OAuth)

The app supports saving and loading podium certificate templates to/from WCA competitions using the WCIF Extension mechanism. Loading saved templates works without authentication (uses the public WCIF endpoint). Saving requires logging in with a WCA account that has competition management permissions.

### Testing OAuth locally

The OAuth popup redirects to the URL configured in `environment.ts` (`appUrl`) followed by callback.html e.g `http://localhost:4200/callback.html`.

If the WCA OAuth app only has the production GitHub Pages URL registered, the popup redirect will fail on localhost. As such also add `http://localhost:4200/callback.html` as a registered redirect URI whilst you test.

## Data Sources

- **Competition data:** Fetched from WCA API and [speedcubing-ireland/wca-analysis](https://github.com/speedcubing-ireland/wca-analysis)
- **Results data:** Fetched from the official WCA WCIF API
