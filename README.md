# WCA Certificates

A web application for generating podium and participation certificates for World Cube Association (WCA) speedcubing competitions. Built primarily for competitions in Ireland and Northern Ireland.

**Live App:** https://goosly.github.io/wca-certificates/

## Features

### Podium Certificates
- Generate certificates for 1st, 2nd, and 3rd place winners
- Select specific events or generate for all events
- Filter results by country (ISO 2-letter codes)
- Handles ties in podium placement

### Participation Certificates
- Generate certificates for all competitors
- Includes a results summary table with rankings per event

### Customization
- Multi-language support: English (UK/US), Dutch, French, German (Switzerland), Mexican Spanish, Russian
- Custom JSON-based certificate templates
- Upload custom background images
- Configurable page orientation (landscape/portrait)
- X-offset adjustment for precise positioning

### Export Options
- Download as single PDF
- Download as ZIP with individual PDF files per certificate

## Technologies

- **Angular** 11.2.14
- **Angular Material** for UI components
- **PDFMake** for client-side PDF generation
- **JSZip** for ZIP file creation
- **@wca/helpers** for WCA data models

## Development

### Prerequisites
- Node.js 12.x or 14.x (LTS recommended; Node 16+ may have compatibility issues with Angular 11)
- Angular CLI 11.x

### Installation

```bash
npm install
```

### Running Locally

```bash
ng serve
```

Navigate to http://localhost:4200/

### Testing

```bash
# Unit tests
ng test

# End-to-end tests
ng e2e
```

## Build & Deploy

To build and deploy to GitHub Pages:

```bash
sh build-prod.sh
```

This builds the production app and pushes the `dist` directory to the `gh-pages` branch, triggering a GitHub Pages deployment.

## Data Sources

- **Competition data:** Fetched from WCA API and [speedcubing-ireland/wca-analysis](https://github.com/speedcubing-ireland/wca-analysis)
- **Results data:** Fetched from the official WCA WCIF API
