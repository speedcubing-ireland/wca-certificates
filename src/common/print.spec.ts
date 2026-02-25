import {TestBed} from '@angular/core/testing';
import {PrintService, isVisualFormat, convertLegacyTemplate, DEFAULT_VISUAL_ELEMENTS} from './print';
import {Certificate} from './certificate';
import {WCIF, VisualElement} from './types';
import {Person} from '@wca/helpers';
import {Result} from '@wca/helpers/lib/models/result';

// Mock the global pdfMake before PrintService constructor runs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).pdfMake = {
  fonts: {},
  createPdf: () => ({download: () => { /* noop */ }, open: () => { /* noop */ }, getBlob: () => { /* noop */ }})
};

function makeResult(overrides: Partial<Result> & {best?: number; average?: number} = {}): Result {
  return {
    personId: 1,
    ranking: 1,
    attempts: [],
    best: 0,
    average: 0,
    ...overrides
  } as Result;
}

function makePerson(name: string, registrantId: number, roles: string[] = []): Person {
  return {name, registrantId, roles} as Person;
}

function makeWcif(persons: Person[] = []): WCIF {
  return {
    id: 'Test2024',
    name: 'Test Competition 2024',
    shortName: 'Test 2024',
    persons,
    events: [],
    schedule: {},
    competitorLimit: null,
    extensions: []
  };
}

describe('PrintService', () => {
  let service: PrintService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrintService);
  });

  describe('formatResultForEvent', () => {
    // Access private method via bracket notation
    function formatResult(result: Result, eventId: string): string {
      return service['formatResultForEvent'](result, eventId);
    }

    it('should format FMC with mean when average is available', () => {
      const result = makeResult({average: 2867, best: 27});
      const formatted = formatResult(result, '333fm');
      expect(formatted).toBe('28.67');
    });

    it('should format FMC with best when no average', () => {
      const result = makeResult({average: 0, best: 31});
      const formatted = formatResult(result, '333fm');
      expect(formatted).toBe('31');
    });

    it('should format FMC as DNF when best is DNF', () => {
      const result = makeResult({average: 0, best: -1});
      const formatted = formatResult(result, '333fm');
      expect(formatted).toBe('DNF');
    });

    it('should format 3x3 blindfolded with best time', () => {
      const result = makeResult({best: 6543, average: 7200});
      const formatted = formatResult(result, '333bf');
      // formatCentiseconds(6543) = "1:05.43"
      expect(formatted).toBe('1:05.43');
    });

    it('should format 4x4 blindfolded with best time', () => {
      const result = makeResult({best: 30000});
      const formatted = formatResult(result, '444bf');
      expect(formatted).toBe('5:00.00');
    });

    it('should format 5x5 blindfolded with best time', () => {
      const result = makeResult({best: 60000});
      const formatted = formatResult(result, '555bf');
      expect(formatted).toBe('10:00.00');
    });

    it('should format 3x3 multi-blind result', () => {
      // Multi-blind encoding: 99-points followed by time and missed
      const result = makeResult({best: 580345602});
      const formatted = formatResult(result, '333mbf');
      // This encodes to a multi-blind result string
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should format default events with average when available', () => {
      const result = makeResult({average: 1234, best: 1100});
      const formatted = formatResult(result, '333');
      // formatCentiseconds(1234) = "12.34"
      expect(formatted).toBe('12.34');
    });

    it('should format default events with best when no average', () => {
      const result = makeResult({average: 0, best: 1100});
      const formatted = formatResult(result, '333');
      expect(formatted).toBe('11.00');
    });

    it('should format default events with negative average using best', () => {
      const result = makeResult({average: -1, best: 987});
      const formatted = formatResult(result, '333');
      expect(formatted).toBe('9.87');
    });
  });

  describe('formatFmcMean', () => {
    function formatFmcMean(mean: number): string | null {
      return service['formatFmcMean'](mean);
    }

    it('should format a normal FMC mean', () => {
      expect(formatFmcMean(2867)).toBe('28.67');
    });

    it('should format a short FMC mean', () => {
      expect(formatFmcMean(2500)).toBe('25.00');
    });

    it('should return DNF for -1', () => {
      expect(formatFmcMean(-1)).toBe('DNF');
    });

    it('should return null for null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(formatFmcMean(null as any)).toBeNull();
    });

    it('should return null for undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(formatFmcMean(undefined as any)).toBeNull();
    });
  });

  describe('getPersonsWithRole', () => {
    function getPersonsWithRole(wcif: WCIF, role: string): string {
      return service['getPersonsWithRole'](wcif, role);
    }

    it('should return single delegate name', () => {
      const wcif = makeWcif([makePerson('John Doe', 1, ['delegate'])]);
      expect(getPersonsWithRole(wcif, 'delegate')).toBe('John Doe');
    });

    it('should join two persons with "and"', () => {
      const wcif = makeWcif([
        makePerson('Alice Smith', 1, ['organizer']),
        makePerson('Bob Jones', 2, ['organizer'])
      ]);
      expect(getPersonsWithRole(wcif, 'organizer')).toBe('Alice Smith and Bob Jones');
    });

    it('should join three persons with commas and "and"', () => {
      const wcif = makeWcif([
        makePerson('Charlie Brown', 3, ['organizer']),
        makePerson('Alice Smith', 1, ['organizer']),
        makePerson('Bob Jones', 2, ['organizer'])
      ]);
      // Sorted alphabetically: Alice, Bob, Charlie -> "Alice Smith, Bob Jones and Charlie Brown"
      expect(getPersonsWithRole(wcif, 'organizer')).toBe('Alice Smith, Bob Jones and Charlie Brown');
    });

    it('should only include persons with the specified role', () => {
      const wcif = makeWcif([
        makePerson('Alice Smith', 1, ['delegate']),
        makePerson('Bob Jones', 2, ['organizer']),
        makePerson('Charlie Brown', 3, ['delegate'])
      ]);
      expect(getPersonsWithRole(wcif, 'delegate')).toBe('Alice Smith and Charlie Brown');
    });

    it('should strip local names in parentheses by default', () => {
      service.showLocalNames = false;
      const wcif = makeWcif([makePerson('John Doe (ジョン)', 1, ['delegate'])]);
      expect(getPersonsWithRole(wcif, 'delegate')).toBe('John Doe');
    });

    it('should keep local names when showLocalNames is true', () => {
      service.showLocalNames = true;
      const wcif = makeWcif([makePerson('John Doe (ジョン)', 1, ['delegate'])]);
      expect(getPersonsWithRole(wcif, 'delegate')).toBe('John Doe (ジョン)');
    });
  });

  describe('getPlace', () => {
    function getPlace(place: number): string {
      return service['getPlace'](place);
    }

    it('should return "first" for place 1', () => {
      expect(getPlace(1)).toBe('first');
    });

    it('should return "second" for place 2', () => {
      expect(getPlace(2)).toBe('second');
    });

    it('should return "third" for place 3', () => {
      expect(getPlace(3)).toBe('third');
    });

    it('should return empty string for non-podium places', () => {
      expect(getPlace(4)).toBe('');
      expect(getPlace(0)).toBe('');
    });
  });

  describe('replaceStringsIn', () => {
    function replaceStringsIn(template: string, certificate: Certificate): string {
      return service['replaceStringsIn'](template, certificate);
    }

    function makeCertificate(): Certificate {
      const cert = new Certificate();
      cert.delegate = 'Jane Delegate';
      cert.organizers = 'Org One and Org Two';
      cert.competitionName = 'Irish Open 2024';
      cert.name = 'Max Solver';
      cert.place = 'first';
      cert.event = '3x3x3';
      cert.resultType = 'an average';
      cert.result = '8.45';
      cert.resultUnit = '';
      cert.locationAndDate = 'Dublin, 2024';
      return cert;
    }

    it('should replace all certificate placeholders', () => {
      const cert = makeCertificate();
      const template = 'certificate.name won certificate.capitalisedPlace at certificate.competitionName in certificate.event with certificate.resultType of certificate.result certificate.resultUnit';
      const result = replaceStringsIn(template, cert);
      expect(result).toBe('Max Solver won First at Irish Open 2024 in 3x3x3 with an average of 8.45 ');
    });

    it('should replace certificate.delegate and certificate.organizers', () => {
      const cert = makeCertificate();
      const template = 'Delegate: certificate.delegate, Organizers: certificate.organizers';
      const result = replaceStringsIn(template, cert);
      expect(result).toBe('Delegate: Jane Delegate, Organizers: Org One and Org Two');
    });

    it('should replace certificate.place (lowercase) and certificate.capitalisedPlace separately', () => {
      const cert = makeCertificate();
      cert.place = 'second';
      const template = 'certificate.capitalisedPlace Place - certificate.place';
      const result = replaceStringsIn(template, cert);
      expect(result).toBe('Second Place - second');
    });

    it('should replace certificate.locationAndDate', () => {
      const cert = makeCertificate();
      const template = 'certificate.locationAndDate';
      const result = replaceStringsIn(template, cert);
      expect(result).toBe('Dublin, 2024');
    });
  });

  describe('getResultType', () => {
    function getResultType(format: string, result: Result): string {
      return service['getResultType'](format, result);
    }

    it('should return "an average" for format "a" with positive average', () => {
      expect(getResultType('a', makeResult({average: 1234}))).toBe('an average');
    });

    it('should return "a best result" for format "a" with no average', () => {
      expect(getResultType('a', makeResult({average: 0}))).toBe('a best result');
    });

    it('should return "a mean" for format "m" with positive average', () => {
      expect(getResultType('m', makeResult({average: 1234}))).toBe('a mean');
    });

    it('should return "a best result" for format "m" with no average', () => {
      expect(getResultType('m', makeResult({average: 0}))).toBe('a best result');
    });

    it('should return "a best result" for best-of formats', () => {
      expect(getResultType('1', makeResult())).toBe('a best result');
      expect(getResultType('2', makeResult())).toBe('a best result');
      expect(getResultType('3', makeResult())).toBe('a best result');
    });

    it('should return "a result" for unknown format', () => {
      expect(getResultType('x', makeResult())).toBe('a result');
    });
  });

  describe('getResultUnit', () => {
    function getResultUnit(eventId: string): string {
      return service['getResultUnit'](eventId);
    }

    it('should return "moves" for FMC', () => {
      expect(getResultUnit('333fm')).toBe('moves');
    });

    it('should return empty string for other events', () => {
      expect(getResultUnit('333')).toBe('');
      expect(getResultUnit('222')).toBe('');
      expect(getResultUnit('pyram')).toBe('');
    });
  });

  describe('getEventName', () => {
    it('should strip " Cube" from event names', () => {
      expect(service.getEventName('333')).toBe('3x3x3');
      expect(service.getEventName('222')).toBe('2x2x2');
    });

    it('should return full name for non-cube events', () => {
      expect(service.getEventName('pyram')).toBe('Pyraminx');
      expect(service.getEventName('clock')).toBe('Clock');
    });
  });

  describe('getOneCertificateContentFromVisualElements', () => {
    function makeCertificate(): Certificate {
      const cert = new Certificate();
      cert.delegate = 'Jane Delegate';
      cert.organizers = 'Org One and Org Two';
      cert.competitionName = 'Irish Open 2024';
      cert.name = 'Max Solver';
      cert.place = 'first';
      cert.event = '3x3x3';
      cert.resultType = 'an average';
      cert.result = '8.45';
      cert.resultUnit = '';
      cert.locationAndDate = 'Dublin, 2024';
      return cert;
    }

    it('should generate content with absolutePosition matching element x and y', () => {
      const elements: VisualElement[] = [
        {id: 'event', text: 'certificate.event', x: 421, y: 180, fontSize: 40, bold: true},
        {id: 'name', text: 'certificate.name', x: 300, y: 320, fontSize: 40, bold: true},
      ];
      service.podiumCertificateJson = JSON.stringify(elements);
      service.pageOrientation = 'landscape';

      const cert = makeCertificate();
      const result = service.getOneCertificateContentFromVisualElements(cert);

      expect(result.length).toBe(2);
      expect(result[0].absolutePosition).toEqual({x: 421, y: 180});
      expect(result[0].fontSize).toBe(40);
      expect(result[0].bold).toBeTrue();
      expect(result[1].absolutePosition).toEqual({x: 300, y: 320});
    });

    it('should replace certificate placeholders in element text', () => {
      const elements: VisualElement[] = [
        {id: 'event', text: 'certificate.event', x: 421, y: 180, fontSize: 40, bold: true},
        {id: 'name', text: 'certificate.name', x: 421, y: 320, fontSize: 40, bold: true},
      ];
      service.podiumCertificateJson = JSON.stringify(elements);
      service.pageOrientation = 'landscape';

      const cert = makeCertificate();
      const result = service.getOneCertificateContentFromVisualElements(cert);

      expect(result[0].text).toBe('3x3x3');
      expect(result[1].text).toBe('Max Solver');
    });

    it('should not set alignment or width', () => {
      const elements: VisualElement[] = [
        {id: 'event', text: 'certificate.event', x: 421, y: 180, fontSize: 40, bold: true},
      ];
      service.podiumCertificateJson = JSON.stringify(elements);
      service.pageOrientation = 'landscape';

      const cert = makeCertificate();
      const result = service.getOneCertificateContentFromVisualElements(cert);

      expect(result[0].alignment).toBeUndefined();
      expect(result[0].width).toBeUndefined();
    });
  });

  describe('resetPodiumCertificateJson', () => {
    it('should reset to DEFAULT_VISUAL_ELEMENTS JSON', () => {
      service.podiumCertificateJson = '[]';
      service.resetPodiumCertificateJson();
      const parsed = JSON.parse(service.podiumCertificateJson);
      expect(parsed).toEqual(DEFAULT_VISUAL_ELEMENTS);
    });
  });
});

describe('isVisualFormat', () => {
  it('should return true for new-format JSON (array of objects with x/y)', () => {
    const json = JSON.stringify([
      {id: 'event', text: 'certificate.event', x: 421, y: 180, fontSize: 40, bold: true}
    ]);
    expect(isVisualFormat(json)).toBeTrue();
  });

  it('should return false for old-format JSON (array with strings and text objects)', () => {
    const json = JSON.stringify([
      '\\n\\n\\n',
      {text: 'certificate.event', fontSize: '40', bold: 'true'},
      '\\n',
      'some text'
    ]);
    expect(isVisualFormat(json)).toBeFalse();
  });

  it('should return false for invalid JSON', () => {
    expect(isVisualFormat('not json')).toBeFalse();
  });

  it('should return false for empty array', () => {
    expect(isVisualFormat('[]')).toBeFalse();
  });

  it('should return false for non-array JSON', () => {
    expect(isVisualFormat('{"x": 1, "y": 2}')).toBeFalse();
  });

  it('should return false for array of strings', () => {
    expect(isVisualFormat('["hello", "world"]')).toBeFalse();
  });
});

describe('convertLegacyTemplate', () => {
  it('should convert old-format JSON to VisualElement array', () => {
    const json = JSON.stringify([
      '\\n\\n\\n\\n\\n',
      {text: 'certificate.event', fontSize: '40', bold: 'true'},
      '\\n',
      {text: 'certificate.name', fontSize: '32', bold: 'true'},
    ]);
    const result = convertLegacyTemplate(json, 0);
    expect(result.length).toBe(2);
    expect(result[0].text).toBe('certificate.event');
    expect(result[0].fontSize).toBe(40);
    expect(result[0].bold).toBeTrue();
    expect(result[1].text).toBe('certificate.name');
    expect(result[1].fontSize).toBe(32);
  });

  it('should apply xOffset to x positions', () => {
    const json = JSON.stringify([
      {text: 'certificate.event', fontSize: '40', bold: 'true'},
    ]);
    const result = convertLegacyTemplate(json, 25);
    expect(result[0].x).toBe(421 + 25);
  });

  it('should return defaults for invalid JSON', () => {
    const result = convertLegacyTemplate('not json', 0);
    expect(result).toEqual(DEFAULT_VISUAL_ELEMENTS);
  });

  it('should return defaults for empty array', () => {
    const result = convertLegacyTemplate('[]', 0);
    // no elements parsed from empty array -> falls back to defaults
    expect(result).toEqual(DEFAULT_VISUAL_ELEMENTS);
  });

  it('should return defaults for non-array JSON', () => {
    const result = convertLegacyTemplate('{"foo": "bar"}', 0);
    expect(result).toEqual(DEFAULT_VISUAL_ELEMENTS);
  });

  it('should handle string items with text content', () => {
    const json = JSON.stringify([
      'some visible text',
    ]);
    const result = convertLegacyTemplate(json, 0);
    expect(result.length).toBe(1);
    expect(result[0].text).toBe('some visible text');
    expect(result[0].x).toBe(421);
  });

  it('should handle object items with boolean bold', () => {
    const json = JSON.stringify([
      {text: 'Bold text', fontSize: '28', bold: true},
    ]);
    const result = convertLegacyTemplate(json, 0);
    expect(result[0].bold).toBeTrue();
  });
});
