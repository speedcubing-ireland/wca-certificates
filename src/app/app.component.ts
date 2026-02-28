import {Component, ViewEncapsulation, inject, effect, EffectRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatTabsModule} from '@angular/material/tabs';
import {ApiService} from '../common/api';
import {PrintService} from '../common/print';
import {AuthService} from '../common/auth';
import {TemplateExtensionService} from '../common/template-extension';
import {Event} from '@wca/helpers/lib/models/event';
import {Result} from '@wca/helpers/lib/models/result';
import {Person} from '@wca/helpers';
import {Helpers} from '../common/helpers';
import { environment } from '../environments/environment';
import { Competition, WCIF, WcaApiResult, VisualElement } from '../common/types';
import { CertificateEditorComponent } from './certificate-editor/certificate-editor.component';
import { DEFAULT_VISUAL_ELEMENTS, isVisualFormat, convertLegacyTemplate } from '../common/print';

/** Parse competition and tab from URL search params */
export function parseUrlParams(search: string): { competitionId: string | null; tab: string | null } {
  const params = new URLSearchParams(search);
  return {
    competitionId: params.get('competition'),
    tab: params.get('tab'),
  };
}

/** Convert a tab name from URL to mat-tab index */
export function tabNameToIndex(name: string | null): number {
  return name === 'customize' ? 1 : 0;
}

/** Convert a mat-tab index to URL tab name (null means default/podium, omit from URL) */
export function tabIndexToName(index: number): string | null {
  return index === 1 ? 'customize' : null;
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [CommonModule, FormsModule, MatTabsModule, CertificateEditorComponent]
})
export class AppComponent {
  state: 'PRINT' | 'REFRESHING' = 'PRINT';

  // Info about competitions managed by user
  competitionsToChooseFrom: Competition[] | null = null;
  inProgressCompetitions: Competition[] = [];
  pastCompetitions: Competition[] = [];
  futureCompetitions: Competition[] = [];
  competitionId: string;
  customCompetitionId: string;
  events: Event[] = [];
  wcif: WCIF | null = null;
  error: string;
  loading: boolean;

  apiService = inject(ApiService);
  printService = inject(PrintService);
  authService = inject(AuthService);
  templateExtensionService = inject(TemplateExtensionService);

  visualElements: VisualElement[] = DEFAULT_VISUAL_ELEMENTS.map(el => ({...el}));

  savingTemplate = false;
  reloadingTemplate = false;
  templateMessage: { text: string; type: 'success' | 'info' | 'error' } | null = null;
  private messageTimeout: ReturnType<typeof setTimeout> | null = null;

  // URL bookmarking support
  selectedTabIndex = 0;
  pendingNavigation: { competitionId: string; tabIndex: number } | null = null;

  constructor() {
      this.readUrlParams();
      this.handleGetCompetitions();

      // Watch for login state changes to handle URL-based deep linking
      if (this.pendingNavigation) {
        const ref: EffectRef = effect(() => {
          if (this.authService.isLoggedIn()) {
            this.applyPendingNavigation();
            ref.destroy();
          }
        });
      }
  }

  handleGetCompetitions() {
    this.apiService.getIrishCompetitions().subscribe(comps => {
      this.competitionsToChooseFrom = comps;
      this.categorizeCompetitions();
    });
  }

  categorizeCompetitions() {
    if (!this.competitionsToChooseFrom) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison

    this.inProgressCompetitions = [];
    this.pastCompetitions = [];
    this.futureCompetitions = [];

    this.competitionsToChooseFrom.forEach(comp => {
      const startDate = new Date(comp.start_date);
      const endDate = new Date(comp.end_date);
      
      // Reset time part for accurate comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (today >= startDate && today <= endDate) {
        this.inProgressCompetitions.push(comp);
      } else if (today > endDate) {
        this.pastCompetitions.push(comp);
      } else {
        this.futureCompetitions.push(comp);
      }
    });

    // Sort each category by date
    this.inProgressCompetitions.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    this.futureCompetitions.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    this.pastCompetitions.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()); // Most recent first
  }

  readUrlParams(search = window.location.search): void {
    const parsed = parseUrlParams(search);
    if (parsed.competitionId) {
      this.pendingNavigation = {
        competitionId: parsed.competitionId,
        tabIndex: tabNameToIndex(parsed.tab),
      };
    }
  }

  applyPendingNavigation(): void {
    if (this.pendingNavigation && !this.competitionId) {
      this.selectedTabIndex = this.pendingNavigation.tabIndex;
      this.handleCompetitionSelected(this.pendingNavigation.competitionId);
      this.pendingNavigation = null;
    }
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    if (this.competitionId) {
      this.updateUrl(this.competitionId, index);
    }
  }

  updateUrl(competitionId: string, tabIndex = 0): void {
    const params = new URLSearchParams();
    params.set('competition', competitionId);
    const tabName = tabIndexToName(tabIndex);
    if (tabName) {
      params.set('tab', tabName);
    }
    history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }

  clearUrlParams(): void {
    history.replaceState(null, '', window.location.pathname);
  }

  handleCompetitionSelected(competitionId: string) {
    this.competitionId = competitionId;
    this.updateUrl(competitionId, this.selectedTabIndex);
    this.loadWcif();
  }

  handleRefreshCompetition() {
    this.state = 'REFRESHING';
    this.loadWcif();
  }

  private loadWcif() {
    this.loading = true;
    this.apiService.getWcif(this.competitionId).subscribe(wcif => {
      this.wcif = wcif;

      // Check if WCIF already has results
      const hasResults = wcif.events.some(e =>
        e.rounds.some(r => r.results && r.results.length > 0)
      );

      if (hasResults) {
        this.processWcifResults(wcif);
      } else {
        // WCIF has no results, try fetching from /results endpoint (which syncs faster)
        console.log('WCIF has no results, fetching from /results endpoint...');
        this.apiService.getResults(this.competitionId).subscribe(
          apiResults => {
            if (apiResults && apiResults.length > 0) {
              console.log(`Found ${apiResults.length} results from /results endpoint`);
              this.mergeResultsIntoWcif(wcif, apiResults);
            }
            this.processWcifResults(wcif);
          },
          () => {
            // If /results endpoint fails, just process with empty results
            this.processWcifResults(wcif);
          }
        );
      }
    }, (error: { error?: { error?: string }; message?: string }) => {
      this.loading = false;
      this.error = error?.error?.error || error?.message || 'Failed to load competition data';
    });
  }

  private processWcifResults(wcif: WCIF) {
    this.loading = false;
    try {
      this.events = wcif.events;
      this.events.forEach(function(e) {
        e.rounds.forEach(function(r) {
          const resultsOfEvent = r.results;
          resultsOfEvent.forEach(function(result) {
            const personOfResult: Person = wcif.persons.filter(p => p.registrantId === result.personId)[0];
            if (personOfResult) {
              result['countryIso2'] = personOfResult.countryIso2;
            }
          });
        });
      });

      this.state = 'PRINT';

      // Auto-load template if one is saved in the WCIF
      this.autoLoadTemplate();
    } catch (error) {
      this.loading = false;
      console.error(error);
      this.wcif = null;
      this.competitionId = null;
    }
  }

  private mergeResultsIntoWcif(wcif: WCIF, apiResults: WcaApiResult[]) {
    // Group results by event and round
    const resultsByEventRound = new Map<string, WcaApiResult[]>();

    for (const result of apiResults) {
      const key = `${result.event_id}-${result.round_type_id}`;
      if (!resultsByEventRound.has(key)) {
        resultsByEventRound.set(key, []);
      }
      resultsByEventRound.get(key)!.push(result);
    }

    // Create a map of person names to their registrantIds
    const personNameToId = new Map<string, number>();
    for (const person of wcif.persons) {
      personNameToId.set(person.name, person.registrantId);
    }

    // Merge results into WCIF events
    for (const event of wcif.events) {
      const totalRounds = event.rounds.length;

      for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
        const round = event.rounds[roundIndex];
        const isLastRound = roundIndex === totalRounds - 1;

        // Determine which API round_type_id to look for
        // API uses: "1" (first round), "2" (second), "3" (third/semi), "f" (final), "c" (combined final), "d" (combined first)
        // WCIF uses: "r1", "r2", "r3", etc.
        let roundResults: WcaApiResult[] | undefined;

        if (isLastRound) {
          // Last round - try final types first: f (final), c (combined final)
          roundResults = resultsByEventRound.get(`${event.id}-f`) ||
                         resultsByEventRound.get(`${event.id}-c`);
        }

        if (!roundResults) {
          // Try numeric round type based on position (1-indexed)
          const numericRoundType = String(roundIndex + 1);
          roundResults = resultsByEventRound.get(`${event.id}-${numericRoundType}`);
        }

        if (!roundResults) {
          // Try combined first round for first round
          if (roundIndex === 0) {
            roundResults = resultsByEventRound.get(`${event.id}-d`);
          }
        }

        if (roundResults && roundResults.length > 0) {
          // Convert API results to WCIF format
          round.results = roundResults.map(apiResult => {
            // Try to find the person by name
            const personId = personNameToId.get(apiResult.name) || 0;

            // Convert attempts array to WCIF format
            const attempts = apiResult.attempts.map(attemptResult => ({
              result: attemptResult,
              reconstruction: null
            }));

            return {
              personId,
              ranking: apiResult.pos,
              attempts,
              best: apiResult.best,
              average: apiResult.average
            };
          });
        }
      }
    }
  }

  onVisualElementsChange(elements: VisualElement[]): void {
    this.visualElements = elements;
    this.printService.podiumCertificateJson = JSON.stringify(elements, null, 2);
  }

  resetVisualElements(): void {
    this.visualElements = DEFAULT_VISUAL_ELEMENTS.map(el => ({...el}));
    this.printService.podiumCertificateJson = JSON.stringify(DEFAULT_VISUAL_ELEMENTS, null, 2);
  }

  printCertificatesAsPdf() {
    this.printService.printCertificatesAsPdf(this.wcif, this.getSelectedEvents());
  }

  printCertificatesAsPreview() {
    this.printService.printCertificatesAsPreview(this.wcif, this.getSelectedEvents());
  }

  private getSelectedEvents() {
    return Array.from(this.events.filter(e => e['printCertificate']).map(e => e.id));
  }

  getWarningIfAny(eventId: string): string {
    const event: Event = this.events.filter(e => e.id === eventId)[0];
    let results: Result[] = event.rounds[event.rounds.length - 1].results;
    results = this.filterResultsWithOnlyDNF(results);
    results = this.filterResultsByCountry(results);

    const podiumPlaces = this.getPodiumPlaces(results);
    this.calculateRankingAfterFiltering(podiumPlaces);
    event['podiumPlaces'] = podiumPlaces;

    switch (podiumPlaces.length) {
      case 0:
        return 'Not available yet';
      case 1:
        return 'Only 1 person on the podium!';
      case 2:
        return 'Only 2 persons on the podium!';
      case 3:
        return ''; // No warning
      default:
        return 'More than 3 persons on the podium!';
    }
  }

  private filterResultsWithOnlyDNF(results: Result[]): Result[] {
    return results.filter(r => r['best'] > 0);
  }

  private filterResultsByCountry(results: Result[]): Result[] {
    if (!! this.printService.countries && this.printService.countries.length > 0) {
      return results.filter(r => this.printService.countries.split(';').includes(r['countryIso2']));
    }
    return results;
  }

  private getPodiumPlaces(results: Result[]): Result[] {
    Helpers.sortResultsByRanking(results);
    const podiumPlaces = results.slice(0, 3);
    if (podiumPlaces.length === 3) {
      let i = 3;
      while (i < results.length) {
        if (podiumPlaces[i - 1].ranking === results[i].ranking) {
          podiumPlaces.push(results[i]);
        } else {
          break;
        }
        i++;
      }
    }
    return podiumPlaces.reverse();
  }

  private calculateRankingAfterFiltering(podiumPlaces: Result[]): void {
    podiumPlaces.forEach(function(p) {
      p['rankingAfterFiltering'] = podiumPlaces.filter(o => o.ranking < p.ranking).length + 1;
    });
  }

  printDisabled(): boolean {
    return this.events.filter(e => e['printCertificate']).length === 0;
  }

  toggleEventSelection(wcaEvent: Event & { printCertificate?: boolean }, _clickEvent: globalThis.Event): void {
    // Toggle the checkbox state
    wcaEvent.printCertificate = !wcaEvent.printCertificate;
  }

  version() {
    return environment.version;
  }

  // Helper method to format competition date for display
  formatCompetitionDate(comp: Competition): string {
    const startDate = new Date(comp.start_date);
    const endDate = new Date(comp.end_date);
    
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric' 
    };
    
    if (comp.start_date === comp.end_date) {
      return startDate.toLocaleDateString('en-US', options);
    } else {
      return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
  }

  clearBackground(fileInput: HTMLInputElement) {
    this.printService.clearBackground();
    fileInput.value = '';
  }

  get acceptedPersons(): number {
    if (!this.wcif) return 0;
    return this.wcif.persons.filter(p => p.registration?.status === 'accepted').length;
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    if (!confirm('Are you sure you want to log out?')) return;
    this.authService.logout();
    this.competitionId = '';
    this.wcif = null;
    this.events = [];
    this.error = '';
    this.loading = false;
    this.selectedTabIndex = 0;
    this.clearUrlParams();
  }

  private showTemplateMessage(text: string, type: 'success' | 'info' | 'error', ms = 3000): void {
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.templateMessage = { text, type };
    this.messageTimeout = setTimeout(() => this.templateMessage = null, ms);
  }

  private autoLoadTemplate(): void {
    if (this.wcif && this.templateExtensionService.loadTemplate(this.wcif)) {
      this.syncVisualElementsFromJson();
      this.showTemplateMessage('Saved template applied.', 'success');
    }
  }

  private syncVisualElementsFromJson(): void {
    const json = this.printService.podiumCertificateJson;
    if (isVisualFormat(json)) {
      this.visualElements = JSON.parse(json);
    } else {
      // Legacy format — auto-convert
      this.visualElements = convertLegacyTemplate(json, this.printService.xOffset);
      this.printService.podiumCertificateJson = JSON.stringify(this.visualElements, null, 2);
      this.printService.xOffset = 0;
    }
  }

  loadTemplateFromServer(): void {
    if (!this.wcif || !this.competitionId) return;
    this.reloadingTemplate = true;
    this.templateMessage = null;
    this.apiService.getWcif(this.competitionId).subscribe({
      next: (wcif) => {
        this.reloadingTemplate = false;
        if (this.wcif) {
          this.wcif.extensions = wcif.extensions;
          if (this.templateExtensionService.loadTemplate(this.wcif)) {
            this.syncVisualElementsFromJson();
            this.showTemplateMessage('Template loaded successfully.', 'success');
          } else {
            this.showTemplateMessage('No saved template found for this competition.', 'info');
          }
        }
      },
      error: (err) => {
        this.reloadingTemplate = false;
        this.showTemplateMessage(err?.message || 'Failed to load template from server.', 'error', 5000);
      }
    });
  }

  saveTemplate(): void {
    if (!this.wcif || !this.competitionId) return;
    if (!confirm('Save the current template to this competition on WCA?')) return;
    this.savingTemplate = true;
    this.templateMessage = null;

    this.templateExtensionService.saveTemplate(this.competitionId, this.wcif).subscribe({
      next: () => {
        this.savingTemplate = false;
        this.showTemplateMessage('Template saved successfully.', 'success');
      },
      error: (err: { message?: string }) => {
        this.savingTemplate = false;
        this.showTemplateMessage(err?.message || 'Failed to save template', 'error');
      }
    });
  }

}
