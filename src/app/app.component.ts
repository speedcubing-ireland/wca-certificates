import {Component, ViewEncapsulation, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatTabsModule} from '@angular/material/tabs';
import {ApiService} from '../common/api';
import {PrintService} from '../common/print';
import {Event} from '@wca/helpers/lib/models/event';
import {Result} from '@wca/helpers/lib/models/result';
import {Person} from '@wca/helpers';
import {Helpers} from '../common/helpers';
import { environment } from '../environments/environment';
import { Competition, WCIF, WcaApiResult } from '../common/types';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [CommonModule, FormsModule, MatTabsModule]
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
  events: Event[];
  wcif: WCIF | null = null;
  personsWithAResult: Person[];
  acceptedPersons: number;
  error: string;
  loading: boolean;

  apiService = inject(ApiService);
  printService = inject(PrintService);

  constructor() {
      this.handleGetCompetitions();
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

  handleCompetitionSelected(competitionId: string) {
    this.competitionId = competitionId;
    this.loadWcif(this.competitionId);
  }

  handleRefreshCompetition() {
    this.state = 'REFRESHING';
    this.loadWcif(this.competitionId);
  }

  private loadWcif(_competitionId: string) {
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
      this.acceptedPersons = wcif.persons.filter(p => !!p.registration && p.registration.status === 'accepted').length;
      this.events = wcif.events;
      this.events.forEach(function(e) {
        e.rounds.forEach(function(r) {
          const resultsOfEvent = r.results;
          resultsOfEvent.forEach(function(result) {
            const personOfResult: Person = wcif.persons.filter(p => p.registrantId === result.personId)[0];
            if (personOfResult) {
              result['countryIso2'] = personOfResult.countryIso2;
              personOfResult['hasAResult'] = true;
            }
          });
        });
      });

      this.personsWithAResult = wcif.persons.filter(p => !!p['hasAResult']);
      this.state = 'PRINT';
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
    // TODO This needs a test
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

  printParticipationCertificatesAsPdf() {
    this.printService.printParticipationCertificatesAsPdf(this.wcif, this.personsWithAResult);
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

  clearParticipationBackground(fileInput: HTMLInputElement) {
    this.printService.clearParticipationBackground();
    fileInput.value = '';
  }

}
