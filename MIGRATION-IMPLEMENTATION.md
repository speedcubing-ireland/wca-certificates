# Angular 11 → 19 Migration Implementation Guide

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Cypress E2E tests setup |
| Phase 1 | ✅ Complete | Pre-migration cleanup |
| Phase 2 | ✅ Complete | Sequential Angular updates (11→19) |
| Phase 3 | ✅ Complete | Replace TSLint with ESLint |
| Phase 4 | ⏳ Pending | Post-migration updates |

### Angular Version Progress

| Version | Status |
|---------|--------|
| 11 → 12 | ✅ Complete |
| 12 → 13 | ✅ Complete |
| 13 → 14 | ✅ Complete |
| 14 → 15 | ✅ Complete |
| 15 → 16 | ✅ Complete |
| 16 → 17 | ✅ Complete |
| 17 → 18 | ✅ Complete |
| 18 → 19 | ✅ Complete |

## System Knowledge

### Node.js Configuration
- **Required Node version**: 20 (installed via nvm)
- **Switch to Node 20**: `source ~/.nvm/nvm.sh && nvm use 20`
- **Note**: Angular 17+ requires Node 18.13+; OpenSSL workaround no longer needed after Angular 15

### Project Structure
```
src/
├── app/
│   ├── app.component.ts      # Main component (all UI logic)
│   ├── app.component.html    # Template with mat-tabs
│   ├── app.module.ts         # Single NgModule
├── common/
│   ├── api.ts                # WCA API service
│   ├── print.ts              # PDF generation service
│   ├── certificate.ts
│   ├── helpers.ts
│   ├── translation.ts
├── loggly/
│   └── loggly.service.js     # Logging (uses native cookies now)
├── environments/
├── polyfills.ts              # core-js removed
```

### Key Dependencies (Current - Angular 19)
| Package | Version | Notes |
|---------|---------|-------|
| @angular/core | 19.2.18 | Current LTS |
| @angular/material | 19.2.16 | MDC-based components |
| @angular/cdk | 19.2.16 | Updated with Material |
| rxjs | 6.6.7 | Update to 7.x optional |
| zone.js | 0.15.1 | Updated with Angular |
| typescript | 5.8.3 | Updated with Angular |
| @types/node | 20.x | Required for TS 5.8 compatibility |

---

## Migration Notes & Fixes Applied

### Angular 15 - MDC Component Migration
Angular Material 15 switched to MDC-based components with new CSS class names:
- **CSS updates**: Added support for both legacy and MDC class names
  - `.mat-tab-label` → `.mat-mdc-tab`
  - `.mat-tab-group` → `.mat-mdc-tab-group`
  - Updated `src/app/app.component.css` and `src/styles.css`
- **Cypress tests**: Updated selectors from `.mat-tab-label` to `.mat-mdc-tab`

### Angular 17 - Dev Server Configuration
- **Issue**: Webpack dev server overlay blocked Cypress clicks during E2E tests
- **Fix**: Disabled HMR and liveReload in `angular.json` serve options:
  ```json
  "serve": {
    "options": {
      "hmr": false,
      "liveReload": false
    }
  }
  ```
- **Node.js**: Updated requirement from Node 16 to Node 20 (Angular 17 requires 18.13+)
- **GitHub Actions**: Updated workflow to use Node 20

### Angular 19 - TypeScript Compatibility
- **Issue**: TypeScript 5.8 type conflict between @types/node and DOM types for `AbortSignal`
- **Fix**: Updated `@types/node` to version 20.x
- **Migration**: Added `standalone: false` to non-standalone components (automatic migration)

---

## Phase 2: Sequential Angular Updates

### Migration Path
```
11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19
```

### Commands for Each Version

#### Angular 11 → 12
```bash
source ~/.nvm/nvm.sh && nvm use 20
npx @angular/cli@12 update @angular/core@12 @angular/cli@12 --force --allow-dirty
npm install --legacy-peer-deps
NODE_OPTIONS=--openssl-legacy-provider npx ng build
git add -A && git commit -m "Upgrade to Angular 12"
```

**Key changes in v12:**
- Ivy is now mandatory (we already removed enableIvy: false)
- TSLint support removed (we already removed it)
- IE11 support dropped
- Strict mode by default for new projects

#### Angular 12 → 13
```bash
npx @angular/cli@13 update @angular/core@13 @angular/cli@13 --force --allow-dirty
npm install --legacy-peer-deps
NODE_OPTIONS=--openssl-legacy-provider npx ng build
git add -A && git commit -m "Upgrade to Angular 13"
```

**Key changes in v13:**
- View Engine removed entirely
- IE11 support completely removed
- Node.js 12 support dropped

#### Angular 13 → 14
```bash
npx @angular/cli@14 update @angular/core@14 @angular/cli@14 --force --allow-dirty
npm install --legacy-peer-deps
NODE_OPTIONS=--openssl-legacy-provider npx ng build
git add -A && git commit -m "Upgrade to Angular 14"
```

**Key changes in v14:**
- Typed reactive forms
- Standalone components available
- Node.js 14 minimum

#### Angular 14 → 15
```bash
npx @angular/cli@15 update @angular/core@15 @angular/cli@15 --force --allow-dirty
npm install --legacy-peer-deps
npx ng build  # OpenSSL workaround may no longer be needed
git add -A && git commit -m "Upgrade to Angular 15"
```

**Key changes in v15:**
- Standalone APIs stable
- New directive composition API
- Image directive improvements

#### Angular 15 → 16
```bash
npx @angular/cli@16 update @angular/core@16 @angular/cli@16 --force --allow-dirty
npm install --legacy-peer-deps
npx ng build
git add -A && git commit -m "Upgrade to Angular 16"
```

**Key changes in v16:**
- Signals API (preview)
- Required inputs
- Server-side rendering improvements

#### Angular 16 → 17
```bash
npx @angular/cli@17 update @angular/core@17 @angular/cli@17 --force --allow-dirty
npx @angular/cli@17 update @angular/material@17 --force --allow-dirty
npm install --legacy-peer-deps
npx ng build
git add -A && git commit -m "Upgrade to Angular 17"
```

**Key changes in v17:**
- New control flow syntax (@if, @for, @switch)
- Deferrable views
- Built-in SSR improvements
- New build system (esbuild)

#### Angular 17 → 18
```bash
npx @angular/cli@18 update @angular/core@18 @angular/cli@18 --force --allow-dirty
npx @angular/cli@18 update @angular/material@18 --force --allow-dirty
npm install --legacy-peer-deps
npx ng build
git add -A && git commit -m "Upgrade to Angular 18"
```

**Key changes in v18:**
- Zoneless change detection (experimental)
- Material 3 support
- Improved hydration

#### Angular 18 → 19
```bash
npx @angular/cli@19 update @angular/core@19 @angular/cli@19 --force --allow-dirty
npx @angular/cli@19 update @angular/material@19 --force --allow-dirty
npm install --legacy-peer-deps
npx ng build
git add -A && git commit -m "Upgrade to Angular 19"
```

**Key changes in v19:**
- Current LTS (support until May 2026)
- Incremental hydration
- Improved signals

---

## Phase 3: Replace TSLint with ESLint

ESLint has been set up with Angular ESLint for modern linting:

### Installation
```bash
ng add @angular-eslint/schematics
```

### Configuration
ESLint is configured in `eslint.config.js` (flat config format) with:
- TypeScript ESLint rules
- Angular ESLint rules for components and templates
- Relaxed rules for legacy code migration:
  - `@typescript-eslint/no-explicit-any`: warn (many `any` types in legacy code)
  - `@angular-eslint/prefer-standalone`: off (uses NgModule pattern)
  - `@angular-eslint/prefer-inject`: off (uses constructor injection)
  - `@angular-eslint/template/prefer-control-flow`: off (uses *ngIf/*ngFor)
  - `@typescript-eslint/no-unused-vars`: allows underscore-prefixed params

### Running ESLint
```bash
npx ng lint
```

Current state: 0 errors, 57 warnings (mostly `any` types and label accessibility)

---

## Phase 4: Post-Migration Updates

### Update polyfills.ts
```typescript
// Old (Angular 11)
import 'zone.js/dist/zone';

// New (Angular 15+)
import 'zone.js';
```

### Update Third-Party Packages
```bash
npm install rxjs@7 --save
npm install zone.js@latest --save
```

### Optional Modernization
- Convert `*ngIf`/`*ngFor` to `@if`/`@for` (v17+ syntax)
- Consider standalone components
- Remove jQuery dependency if possible

---

## Verification Checklist

After completing migration:

1. **Build verification**
   ```bash
   npx ng build --configuration=production
   ```

2. **Development server**
   ```bash
   npm start
   # Visit http://localhost:4200
   ```

3. **E2E tests**
   ```bash
   npm run e2e
   ```

4. **Manual smoke test**
   - [ ] App loads with header "WCA Competition Certificates"
   - [ ] Competitions list loads from WCA API
   - [ ] Can select a competition
   - [ ] All 4 tabs work (Podium, Customize Podium, Participation, Customize Participation)
   - [ ] Can select events and download PDF
   - [ ] Language selection works
   - [ ] Background upload works

---

## Troubleshooting

### OpenSSL Error
```
Error: error:0308010C:digital envelope routines::unsupported
```
**Fix**: Use `NODE_OPTIONS=--openssl-legacy-provider` (needed until ~Angular 15)

### Peer Dependency Errors
```
npm ERR! ERESOLVE unable to resolve dependency tree
```
**Fix**: Use `npm install --legacy-peer-deps`

### TypeScript Version Mismatch
Angular CLI will update TypeScript automatically. If manual update needed:
```bash
npm install typescript@<version> --save-dev
```

### Material Import Changes
After Angular Material 15+, imports may change:
```typescript
// Old
import { MatTabsModule } from '@angular/material/tabs';

// Usually stays the same, but check for deprecated components
```

---

## Git Branch
All work is on: `angular-19-upgrade`

To push to remote:
```bash
git push -u origin angular-19-upgrade
```
