import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {environment} from '../environments/environment';
import {AuthService} from './auth';
import {PrintService} from './print';
import {WCIF, WcifExtension, PodiumTemplateExtensionData} from './types';

const EXTENSION_ID = 'io.github.speedcubing-ireland.podiumTemplate';
const SPEC_URL = 'https://github.com/speedcubing-ireland/wca-certificates';

@Injectable({
  providedIn: 'root'
})
export class TemplateExtensionService {

  private httpClient = inject(HttpClient);
  private authService = inject(AuthService);
  private printService = inject(PrintService);

  hasTemplate(wcif: WCIF): boolean {
    return (wcif.extensions || []).some(ext => ext.id === EXTENSION_ID);
  }

  extractTemplate(wcif: WCIF): PodiumTemplateExtensionData | null {
    const ext = (wcif.extensions || []).find(e => e.id === EXTENSION_ID);
    if (!ext) return null;
    return ext.data as unknown as PodiumTemplateExtensionData;
  }

  buildExtension(): WcifExtension {
    const data: PodiumTemplateExtensionData = {
      podiumCertificateJson: this.printService.podiumCertificateJson,
      podiumCertificateStyleJson: this.printService.podiumCertificateStyleJson,
      pageOrientation: this.printService.pageOrientation,
      backgroundForPreviewOnly: this.printService.backgroundForPreviewOnly,
      countries: this.printService.countries,
      xOffset: this.printService.xOffset
    };
    return {
      id: EXTENSION_ID,
      specUrl: SPEC_URL,
      data: data as unknown as Record<string, unknown>
    };
  }

  applyTemplate(data: PodiumTemplateExtensionData): void {
    this.printService.podiumCertificateJson = data.podiumCertificateJson;
    this.printService.podiumCertificateStyleJson = data.podiumCertificateStyleJson;
    this.printService.pageOrientation = data.pageOrientation;
    this.printService.backgroundForPreviewOnly = data.backgroundForPreviewOnly;
    this.printService.countries = data.countries;
    this.printService.xOffset = data.xOffset;
  }

  loadTemplate(wcif: WCIF): boolean {
    const data = this.extractTemplate(wcif);
    if (!data) return false;
    this.applyTemplate(data);
    return true;
  }

  saveTemplate(competitionId: string, wcif: WCIF): Observable<boolean> {
    const token = this.authService.accessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const extension = this.buildExtension();

    // Replace or add our extension in the WCIF extensions array
    const otherExtensions = wcif.extensions.filter(e => e.id !== EXTENSION_ID);
    const extensions = [...otherExtensions, extension];

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    return this.httpClient.patch(
      `${environment.wcaUrl}/api/v0/competitions/${competitionId}/wcif`,
      {extensions},
      {headers}
    ).pipe(
      map(() => true)
    );
  }
}
