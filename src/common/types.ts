import { Event, Person } from '@wca/helpers';

/**
 * Competition summary from the unofficial WCA API
 */
export interface Competition {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
}

/**
 * Raw competition data from the unofficial API
 */
export interface RawCompetition {
  id: string;
  name: string;
  date: {
    from: string;
    till: string;
  };
  city: string;
  country: string;
}

/**
 * Response from the unofficial competitions API
 */
export interface CompetitionsApiResponse {
  items?: RawCompetition[];
}

/**
 * WCIF (WCA Competition Interchange Format) structure
 */
export interface WCIF {
  id: string;
  name: string;
  shortName: string;
  persons: Person[];
  events: Event[];
  schedule: unknown;
  competitorLimit: number | null;
  extensions: unknown[];
}

/**
 * PDFMake document definition (minimal typing for this project)
 */
export interface PdfDocument {
  pageOrientation: 'landscape' | 'portrait' | string;
  pageMargins: number[];
  content: PdfContentItem[];
  styles: Record<string, unknown>;
  defaultStyle: Record<string, unknown>;
  background?: {
    image: string;
    width: number;
    alignment: string;
  };
}

export interface PdfContentItem {
  text?: unknown;
  alignment?: string;
  margin?: number[];
  pageBreak?: string;
  columns?: PdfContentItem[];
  width?: string | number;
  style?: string;
  table?: unknown;
  layout?: string;
}

/**
 * PdfMake library interface (minimal typing for usage in this project)
 */
export interface PdfMakeStatic {
  fonts: Record<string, { normal: string; bold: string; italics?: string; bolditalics?: string }>;
  createPdf(document: PdfDocument): {
    download(filename: string): void;
    open(): void;
    getBlob(callback: (blob: Blob) => void): void;
  };
}
