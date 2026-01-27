import {Injectable} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Observable, forkJoin, of} from 'rxjs';
import {map, catchError} from 'rxjs/operators';
import {environment} from '../environments/environment';
import {LogglyService} from '../loggly/loggly.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

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

  constructor(private httpClient: HttpClient) {
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

  private mapToCompetitionFormat(data: any): any {
    return {
      id: data.id,
      name: data.name,
      start_date: data.date.from,
      end_date: data.date.till,
      city: data.city,
      country: data.country
    };
  }

  getIrishCompetitions(): Observable<any> {
    const irishUrl = `${this.UNOFFICIAL_API_BASE}/competitions/IE.json`;
    const ukUrl = `${this.UNOFFICIAL_API_BASE}/competitions/GB.json`;

    interface ApiResponse {
      items?: any[];
    }

    return forkJoin({
      irish: this.httpClient.get<ApiResponse>(irishUrl).pipe(
        catchError(() => of<ApiResponse>({items: []}))
      ),
      uk: this.httpClient.get<ApiResponse>(ukUrl).pipe(
        catchError(() => of<ApiResponse>({items: []}))
      )
    }).pipe(
      map(({irish, uk}) => {
        const irishComps = ((irish as ApiResponse).items || []).map((comp: any) => this.mapToCompetitionFormat(comp));
        const niComps = ((uk as ApiResponse).items || [])
          .filter((comp: any) => this.isNorthernIreland(comp.city))
          .map((comp: any) => this.mapToCompetitionFormat(comp));
        
        const allComps = [...irishComps, ...niComps];
        
        // Filter by date range (similar to original logic)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (environment.testMode ? this.ONE_YEAR : this.EIGHT_WEEKS));
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (environment.testMode ? this.ONE_YEAR : this.EIGHT_WEEKS));
        
        return allComps.filter((comp: any) => {
          const compEndDate = new Date(comp.end_date);
          return compEndDate >= startDate && new Date(comp.start_date) <= endDate;
        }).sort((a: any, b: any) => {
          return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
        });
      })
    );
  }

  getWcif(competitionId): Observable<any> {
    return this.httpClient.get(`${environment.wcaUrl}/api/v0/competitions/${competitionId}/wcif/public`);
  }

  logUserClicksDownloadCertificatesAsPdf(competitionId: any) {
    this.logMessage(competitionId + ' - Certificates downloaded as pdf');
  }

  logUserClicksDownloadCertificatesAsZip(competitionId: any) {
    this.logMessage(competitionId + ' - Certificates downloaded as zip');
  }

  logUserClicksDownloadParticipationCertificatesAsPdf(competitionId: any) {
    this.logMessage(competitionId + ' - Participation certificates downloaded as pdf');
  }

  logUserClicksDownloadParticipationCertificatesAsZip(competitionId: any) {
    this.logMessage(competitionId + ' - Participation certificates downloaded as zip');
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
