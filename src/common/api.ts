import {Injectable, inject} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable, forkJoin, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {environment} from '../environments/environment';
import {LogglyService} from '../loggly/loggly.service';
import {Competition, RawCompetition, CompetitionsApiResponse, WCIF, WcaApiResult} from './types';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private httpClient = inject(HttpClient);
  private logglyService: LogglyService;
  private headerParams: HttpHeaders;

  private ONE_YEAR = 365;
  private EIGHT_WEEKS = 56;
  private UNOFFICIAL_API_BASE = 'https://raw.githubusercontent.com/speedcubing-ireland/wca-analysis/api';
  private NORTHERN_IRELAND_COUNTIES = [
    'County Antrim',
    'County Armagh',
    'County Down',
    'County Fermanagh',
    'County Londonderry',
    'County Tyrone'
  ];

  constructor() {
    this.headerParams = new HttpHeaders();
    this.headerParams = this.headerParams.set('Content-Type', 'application/json');

    this.initLoggly();
  }

  private initLoggly() {
    this.logglyService = new LogglyService(this.httpClient);
    this.logglyService.push({
      logglyKey: '3c4e81e2-b2ae-40e3-88b5-ba8e8b810586',
      sendConsoleErrors: false,
      tag: 'wca-certificates'
    });
  }

  private isNorthernIreland(city: string): boolean {
    return this.NORTHERN_IRELAND_COUNTIES.some(county => city.includes(county));
  }

  private mapToCompetitionFormat(data: RawCompetition): Competition {
    return {
      id: data.id,
      name: data.name,
      start_date: data.date.from,
      end_date: data.date.till,
      city: data.city,
      country: data.country
    };
  }

  getIrishCompetitions(): Observable<Competition[]> {
    const irishUrl = `${this.UNOFFICIAL_API_BASE}/competitions/IE.json`;
    const ukUrl = `${this.UNOFFICIAL_API_BASE}/competitions/GB.json`;

    return forkJoin({
      irish: this.httpClient.get<CompetitionsApiResponse>(irishUrl).pipe(
        catchError(() => of<CompetitionsApiResponse>({items: []}))
      ),
      uk: this.httpClient.get<CompetitionsApiResponse>(ukUrl).pipe(
        catchError(() => of<CompetitionsApiResponse>({items: []}))
      )
    }).pipe(
      map(({irish, uk}) => {
        const irishComps = (irish.items || []).map((comp) => this.mapToCompetitionFormat(comp));
        const niComps = (uk.items || [])
          .filter((comp) => this.isNorthernIreland(comp.city))
          .map((comp) => this.mapToCompetitionFormat(comp));

        const allComps = [...irishComps, ...niComps];

        // Filter by date range (similar to original logic)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (environment.testMode ? this.ONE_YEAR : this.EIGHT_WEEKS));
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (environment.testMode ? this.ONE_YEAR : this.EIGHT_WEEKS));

        return allComps.filter((comp) => {
          const compEndDate = new Date(comp.end_date);
          return compEndDate >= startDate && new Date(comp.start_date) <= endDate;
        }).sort((a, b) => {
          return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
        });
      })
    );
  }

  getWcif(competitionId: string): Observable<WCIF> {
    return this.httpClient.get<WCIF>(`${environment.wcaUrl}/api/v0/competitions/${competitionId}/wcif/public`);
  }

  getResults(competitionId: string): Observable<WcaApiResult[]> {
    return this.httpClient.get<WcaApiResult[]>(`${environment.wcaUrl}/api/v0/competitions/${competitionId}/results`);
  }

  logUserClicksDownloadCertificatesAsPdf(competitionId: string) {
    this.logMessage(competitionId + ' - Certificates downloaded as pdf');
  }

  logUserClicksDownloadParticipationCertificatesAsPdf(competitionId: string) {
    this.logMessage(competitionId + ' - Participation certificates downloaded as pdf');
  }

  private logMessage(message: string) {
    if (! environment.testMode) {
      setTimeout(() => {
        try {
          this.logglyService.push(message);
        } catch (e) {
          console.error(e);
        }
      }, 0);
    }
  }

}
