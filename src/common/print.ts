import {Injectable} from '@angular/core';
import {saveAs} from 'file-saver';
import {Certificate} from './certificate';
import {Event} from '@wca/helpers/lib/models/event';
import {Result} from '@wca/helpers/lib/models/result';
import {formatCentiseconds} from '@wca/helpers/lib/helpers/time';
import {decodeMultiResult, formatMultiResult, isDnf} from '@wca/helpers/lib/helpers/result';
import {TranslationHelper} from './translation';
import {getEventName, EventId} from '@wca/helpers';
import {WCIF, PdfDocument, PdfMakeStatic} from './types';
import {environment} from '../environments/environment';

declare const pdfMake: PdfMakeStatic;

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  public language = 'en';
  public pageOrientation: 'landscape' | 'portrait' = 'landscape';
  public showLocalNames = false;
  public background: string = null;
  public backgroundForPreviewOnly = true;
  public countries = '';
  public xOffset = 0;

  public podiumCertificateJson = '';
  public podiumCertificateStyleJson = '';

  constructor() {
    const baseUrl = environment.appUrl;

    pdfMake.fonts = {
      barriecito: {
        normal: `${baseUrl}fonts/Barriecito-Regular.ttf`,
        bold: `${baseUrl}fonts/Barriecito-Regular.ttf`,
      },
      mono: {
        normal: `${baseUrl}fonts/RobotoMono.ttf`,
        bold: `${baseUrl}fonts/RobotoMono-Bold.ttf`
      },
      Roboto: {
        normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
        bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
        italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf',
        bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-MediumItalic.ttf'
      },
    }

    this.podiumCertificateJson = TranslationHelper.getTemplate(this.language);
    const defaultStyle = {
      font: 'Roboto',
      otherFonts: ['barriecito', 'mono']
    }
    this.podiumCertificateStyleJson = JSON.stringify(defaultStyle, null, 2);
  }

  public getEventName(eventId: EventId | string) {
    return getEventName(eventId as EventId).replace(' Cube', '');
  }

  private getNewCertificate(wcif: WCIF, eventId: string, format: string, result: Result): Certificate {
    const certificate: Certificate = new Certificate();
    certificate.delegate = this.getPersonsWithRole(wcif, 'delegate', this.language);
    certificate.organizers = this.getPersonsWithRole(wcif, 'organizer', this.language);
    certificate.competitionName = wcif.name;
    certificate.name = wcif.persons.filter(p => p.registrantId === result.personId)[0].name;
    certificate.place = this.getPlace(result['rankingAfterFiltering']);
    certificate.event = this.getEventName(eventId);
    certificate.resultType = this.getResultType(format, result);
    certificate.result = this.formatResultForEvent(result, eventId);
    certificate.resultUnit = this.getResultUnit(eventId);
    certificate.locationAndDate = ''; // todo
    return certificate;
  }

  private formatResultForEvent(result: Result, eventId: string): string {
    switch (eventId) {
      case '333fm':
        return (result['average'] > 0 ? this.formatFmcMean(result['average']) : isDnf(result['best']) ? 'DNF' : result['best']).toString();
      case '333bf':
      case '444bf':
      case '555bf':
        return formatCentiseconds(result['best']);
      case '333mbf': {
        const mbldResult = result['best'];
        return formatMultiResult(decodeMultiResult(mbldResult));
      }
      default:
        return formatCentiseconds(result['average'] > 0 ? result['average'] : result['best']);
    }
  }

  private formatFmcMean(mean: number) {
    if (mean === -1) {
      return 'DNF';
    }
    if (mean === null || mean === undefined) {
      return null;
    }
    return mean.toString().substring(0, 2) + '.' + mean.toString().substring(2);
  }

  private getPersonsWithRole(wcif: WCIF, role: string, language: string): string {
    const persons = wcif.persons.filter(p => p.roles.includes(role));
    persons.sort((a, b) => a.name.localeCompare(b.name));
    if (persons.length === 1) {
      return this.formatName(persons[0].name);
    } else {
      const last = persons.pop();
      return persons.map(p => this.formatName(p.name)).join(', ')
        + ' ' + TranslationHelper.getAnd(language) + ' ' + this.formatName(last.name);
    }
  }

  private getPlace(place: number) {
    if (place === 1) {
      return TranslationHelper.getFirst(this.language);
    }
    if (place === 2) {
      return TranslationHelper.getSecond(this.language);
    }
    if (place === 3) {
      return TranslationHelper.getThird(this.language);
    }
    console.warn('Not a podium place');
    return '';
  }

  private getOneCertificateContent(certificate: Certificate) {
    const jsonWithReplacedStrings = this.replaceStringsIn(this.podiumCertificateJson, certificate);
    const textObject = JSON.parse(jsonWithReplacedStrings);
    return {
      text: textObject,
      alignment: 'center',
      margin: [this.xOffset, 0, -this.xOffset, 0],
      pageBreak: 'after'
    };
  }

  private replaceStringsIn(s: string, certificate: Certificate): string {
    s = s.replace(/certificate.delegate/g, certificate.delegate);
    s = s.replace(/certificate.organizers/g, certificate.organizers);
    s = s.replace(/certificate.competitionName/g, certificate.competitionName);
    s = s.replace(/certificate.name/g, this.formatName(certificate.name));
    s = s.replace(/certificate.capitalisedPlace/g, certificate.place.charAt(0).toUpperCase() + certificate.place.slice(1));
    s = s.replace(/certificate.place/g, certificate.place);
    s = s.replace(/certificate.event/g, certificate.event);
    s = s.replace(/certificate.resultType/g, certificate.resultType);
    s = s.replace(/certificate.resultUnit/g, certificate.resultUnit);
    s = s.replace(/certificate.result/g, certificate.result);
    s = s.replace(/certificate.locationAndDate/g, certificate.locationAndDate);
    return s;
  }

  private formatName(name: string) {
    return this.showLocalNames ? name
      : (name).replace(new RegExp(' \\(.+\\)'), '');
  }

  public printCertificatesAsPdf(wcif: WCIF, events: string[]) {
    const certificates: Certificate[] = this.getCertificates(events, wcif);
    if (certificates.length > 0) {
      this.downloadAsPdf(certificates, wcif);
    }
  }

  private downloadAsPdf(certificates: Certificate[], wcif: WCIF) {
    const document = this.getDocument(this.pageOrientation, this.background, false);
    certificates.forEach(value => {
      document.content.push(this.getOneCertificateContent(value));
    });
    this.removeLastPageBreak(document);
    pdfMake.createPdf(document).download('Certificates ' + wcif.name + '.pdf');
  }

  public printCertificatesAsPreview(wcif: WCIF, events: string[]) {
    const certificates: Certificate[] = this.getCertificates(events, wcif);
    if (certificates.length > 0) {
      const document = this.getDocument(this.pageOrientation, this.background, true);
      certificates.forEach(value => {
        document.content.push(this.getOneCertificateContent(value));
      });
      this.removeLastPageBreak(document);
      pdfMake.createPdf(document).open();
    }
  }

  private getCertificates(events: string[], wcif: WCIF): Certificate[] {
    const revEvents = [...events].reverse();
    const certificates: Certificate[] = [];
    for (const eventId of revEvents) {
      const event: Event = wcif.events.filter(e => e.id === eventId)[0];
      const podiumPlaces = event['podiumPlaces'];
      const format = event.rounds[event.rounds.length - 1].format;

      for (const podiumPlace of podiumPlaces) {
        certificates.push(this.getNewCertificate(wcif, eventId, format, podiumPlace));
      }
    }
    if (certificates.length === 0) {
      alert('No results available. Please select at least one event that already has results in the final.');
    }
    return certificates;
  }

  public handleBackgroundSelected(files: FileList) {
    const reader = new FileReader();
    reader.readAsDataURL(files.item(0));
    reader.onloadend = (_e) => {
      this.background = reader.result as string;
    };
    this.backgroundForPreviewOnly = true;
  }

  public clearBackground() {
    this.background = null;
  }

  private removeLastPageBreak(document: PdfDocument): void {
    document.content[document.content.length - 1].pageBreak = '';
  }

  private getDocument(orientation: string, background: string | null, isPreview: boolean): PdfDocument {
    const document = {
      pageOrientation: orientation,
      content: [],
      pageMargins: [100, 60, 100, 60],
      styles: {
        tableOverview: {
          lineHeight: 0.8
        }
      },
      defaultStyle: {
        fontSize: 22
      }
    };
    if (this.podiumCertificateStyleJson !== '{}') {
      // append each style to the document
      const styles = JSON.parse(this.podiumCertificateStyleJson);
      for (const key in styles) {
        if (Object.prototype.hasOwnProperty.call(styles, key)) {
          document.defaultStyle[key] = styles[key];
        }
      }
    }
    if (background !== null && (this.backgroundForPreviewOnly === false || isPreview )) {
      document['background'] = {
        image: background,
        width: orientation === 'landscape' ? 840 : 594,
        alignment: 'center'
      };
    }
    return document;
  }

  private downloadFile(data: string, filename: string) {
    saveAs(new Blob([data]), filename);
  }

  public loadLanguageTemplate() {
    this.podiumCertificateJson = TranslationHelper.getTemplate(this.language);
  }

  private getResultUnit(eventId: string) {
    switch (eventId) {
      case '333fm':
        return TranslationHelper.getMoves(this.language);
      default:
        return '';
    }
  }

  private getResultType(format: string, result: Result) {
    switch (format) {
      case 'a':
        return (result['average'] > 0) ? TranslationHelper.getAnAverage(this.language)
          : TranslationHelper.getASingle(this.language);
      case 'm':
        return (result['average'] > 0) ? TranslationHelper.getAMean(this.language)
          : TranslationHelper.getASingle(this.language);
      case '1':
      case '2':
      case '3':
        return TranslationHelper.getASingle(this.language);
      default:
        return TranslationHelper.getAResult(this.language);
    }
  }

}
