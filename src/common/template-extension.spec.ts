import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {TemplateExtensionService} from './template-extension';
import {AuthService} from './auth';
import {PrintService} from './print';
import {WCIF, WcifExtension, PodiumTemplateExtensionData, CURRENT_TEMPLATE_VERSION} from './types';
import {environment} from '../environments/environment';

const EXTENSION_ID = 'io.github.speedcubing_ireland.podiumTemplate';

const CERTIFICATE_JSON = `[
"\\n\\n\\n\\n\\n",
{"text": "certificate.event", "fontSize": "40", "bold": "true"},
"\\n",
{"text": "certificate.capitalisedPlace Place", "fontSize": "32", "bold": "true"},
"\\n\\n",
{"text": "certificate.name", "fontSize": "40", "bold": "true"},
"\\n\\n",
"with certificate.resultType of ",
{"text": "certificate.result", "bold": "true"},
"  certificate.resultUnit"
]`;

const STYLE_JSON = JSON.stringify({
  font: 'Roboto',
  otherFonts: ['barriecito', 'mono']
}, null, 2);

function makeWcif(extensions: WcifExtension[] = []): WCIF {
  return {
    id: 'TestComp2024',
    name: 'Test Competition 2024',
    shortName: 'Test 2024',
    persons: [],
    events: [],
    schedule: {},
    competitorLimit: null,
    extensions
  };
}

function makeTemplateData(overrides: Partial<PodiumTemplateExtensionData> = {}): PodiumTemplateExtensionData {
  return {
    podiumCertificateJson: CERTIFICATE_JSON,
    podiumCertificateStyleJson: STYLE_JSON,
    pageOrientation: 'portrait',
    backgroundForPreviewOnly: false,
    countries: 'IE',
    xOffset: 15,
    yOffset: 0,
    ...overrides
  };
}

function makeExtension(data?: PodiumTemplateExtensionData): WcifExtension {
  return {
    id: EXTENSION_ID,
    specUrl: 'https://github.com/speedcubing-ireland/wca-certificates',
    data: (data || makeTemplateData()) as unknown as Record<string, unknown>
  };
}

describe('TemplateExtensionService', () => {
  let service: TemplateExtensionService;
  let httpMock: HttpTestingController;
  let mockPrintService: Partial<PrintService>;
  let mockAuthService: {getValidAccessToken: jasmine.Spy};

  beforeEach(() => {
    localStorage.clear();

    // Create a mock PrintService that doesn't depend on pdfMake
    mockPrintService = {
      podiumCertificateJson: CERTIFICATE_JSON,
      defaultPodiumCertificateJson: CERTIFICATE_JSON,
      podiumCertificateStyleJson: STYLE_JSON,
      pageOrientation: 'landscape' as const,
      backgroundForPreviewOnly: true,
      countries: '',
      xOffset: 0,
      yOffset: 0,
    };

    mockAuthService = {
      getValidAccessToken: jasmine.createSpy('getValidAccessToken').and.returnValue('fake-token')
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        TemplateExtensionService,
        {provide: PrintService, useValue: mockPrintService},
        {provide: AuthService, useValue: mockAuthService}
      ]
    });

    service = TestBed.inject(TemplateExtensionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('hasTemplate', () => {
    it('should return true when WCIF has our extension', () => {
      const wcif = makeWcif([makeExtension()]);
      expect(service.hasTemplate(wcif)).toBeTrue();
    });

    it('should return false when extension is absent or unrelated', () => {
      expect(service.hasTemplate(makeWcif([]))).toBeFalse();

      const otherExt: WcifExtension = {
        id: 'some.other.extension',
        specUrl: 'https://example.com',
        data: {}
      };
      expect(service.hasTemplate(makeWcif([otherExt]))).toBeFalse();
    });

    it('should handle undefined extensions gracefully', () => {
      const wcif = makeWcif();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wcif as any).extensions = undefined;
      expect(service.hasTemplate(wcif)).toBeFalse();
    });
  });

  describe('extractTemplate', () => {
    it('should return template data when extension exists', () => {
      const templateData = makeTemplateData();
      const wcif = makeWcif([makeExtension(templateData)]);
      const result = service.extractTemplate(wcif);
      expect(result).toEqual(templateData);
    });

    it('should return null when no extension exists', () => {
      const wcif = makeWcif([]);
      expect(service.extractTemplate(wcif)).toBeNull();
    });

    it('should return null when extensions is undefined', () => {
      const wcif = makeWcif();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wcif as any).extensions = undefined;
      expect(service.extractTemplate(wcif)).toBeNull();
    });
  });

  describe('buildExtension', () => {
    it('should build extension from current PrintService values', () => {
      // Customised template with competition-specific text added
      const customJson = `[
"\\n\\n",
{"text": "Irish Open 2024", "fontSize": "28", "bold": "true"},
"\\n",
{"text": "certificate.event", "fontSize": "40", "bold": "true"},
"\\n",
{"text": "certificate.capitalisedPlace Place", "fontSize": "32", "bold": "true"},
"\\n\\n",
{"text": "certificate.name", "fontSize": "40", "bold": "true"},
"\\n\\n",
"with certificate.resultType of ",
{"text": "certificate.result", "bold": "true"},
"  certificate.resultUnit"
]`;
      const customStyleJson = JSON.stringify({font: 'barriecito', otherFonts: ['mono']}, null, 2);
      mockPrintService.podiumCertificateJson = customJson;
      mockPrintService.podiumCertificateStyleJson = customStyleJson;
      mockPrintService.pageOrientation = 'portrait';
      mockPrintService.backgroundForPreviewOnly = false;
      mockPrintService.countries = 'IE;GB';
      mockPrintService.xOffset = 42;
      mockPrintService.yOffset = -10;

      const ext = service.buildExtension();

      expect(ext.id).toBe(EXTENSION_ID);
      expect(ext.specUrl).toBe('https://github.com/speedcubing-ireland/wca-certificates');
      const data = ext.data as unknown as PodiumTemplateExtensionData;
      expect(data.templateVersion).toBe(CURRENT_TEMPLATE_VERSION);
      expect(data.podiumCertificateJson).toBe(customJson);
      expect(data.podiumCertificateStyleJson).toBe(customStyleJson);
      expect(data.pageOrientation).toBe('portrait');
      expect(data.backgroundForPreviewOnly).toBeFalse();
      expect(data.countries).toBe('IE;GB');
      expect(data.xOffset).toBe(42);
      expect(data.yOffset).toBe(-10);
    });
  });

  describe('applyTemplate', () => {
    it('should set all PrintService properties and not migrate when version is current', () => {
      // A simplified template with fewer newlines and a different font
      const appliedJson = `[
"\\n\\n",
{"text": "certificate.event", "fontSize": "36", "bold": "true"},
"\\n",
{"text": "certificate.capitalisedPlace Place", "fontSize": "28", "bold": "true"},
"\\n",
{"text": "certificate.name", "fontSize": "36", "bold": "true"},
"\\n",
"with certificate.resultType of ",
{"text": "certificate.result", "bold": "true"}
]`;
      const appliedStyleJson = JSON.stringify({font: 'barriecito', otherFonts: ['mono']}, null, 2);
      const data = makeTemplateData({
        templateVersion: CURRENT_TEMPLATE_VERSION,
        podiumCertificateJson: appliedJson,
        podiumCertificateStyleJson: appliedStyleJson,
        pageOrientation: 'portrait',
        backgroundForPreviewOnly: false,
        countries: 'GB',
        xOffset: -10,
        yOffset: 20
      });

      const migrated = service.applyTemplate(data);

      expect(migrated).toBeFalse();
      expect(mockPrintService.podiumCertificateJson).toBe(appliedJson);
      expect(mockPrintService.podiumCertificateStyleJson).toBe(appliedStyleJson);
      expect(mockPrintService.pageOrientation).toBe('portrait');
      expect(mockPrintService.backgroundForPreviewOnly).toBeFalse();
      expect(mockPrintService.countries).toBe('GB');
      expect(mockPrintService.xOffset).toBe(-10);
      expect(mockPrintService.yOffset).toBe(20);
    });

    it('should migrate old template (no version) by resetting JSON to default', () => {
      const oldJson = '["old visual elements format"]';
      const data = makeTemplateData({
        podiumCertificateJson: oldJson,
        countries: 'IE'
      });
      
      const migrated = service.applyTemplate(data);
      expect(migrated).toBeTrue();
      expect(mockPrintService.podiumCertificateJson).toBe(mockPrintService.defaultPodiumCertificateJson);
      expect(mockPrintService.countries).toBe('IE');
    });

    it('should migrate template with old version number', () => {
      const data = makeTemplateData({
        templateVersion: 1,
        podiumCertificateJson: '["version 1 format"]',
        xOffset: 42
      });

      const migrated = service.applyTemplate(data);

      expect(migrated).toBeTrue();
      expect(mockPrintService.podiumCertificateJson).toBe(mockPrintService.defaultPodiumCertificateJson);
      expect(mockPrintService.xOffset).toBe(42);
    });
  });

  describe('loadTemplate', () => {
    it('should apply template and return "loaded" when current-version extension exists', () => {
      const templateData = makeTemplateData({templateVersion: CURRENT_TEMPLATE_VERSION, countries: 'IE'});
      const wcif = makeWcif([makeExtension(templateData)]);

      const result = service.loadTemplate(wcif);

      expect(result).toBe('loaded');
      expect(mockPrintService.countries).toBe('IE');
    });

    it('should return "migrated" when template has no version (old format)', () => {
      const oldData = makeTemplateData({countries: 'IE'});
      // No templateVersion
      const wcif = makeWcif([makeExtension(oldData)]);

      const result = service.loadTemplate(wcif);

      expect(result).toBe('migrated');
      expect(mockPrintService.podiumCertificateJson).toBe(mockPrintService.defaultPodiumCertificateJson);
      expect(mockPrintService.countries).toBe('IE');
    });

    it('should return "migrated" when template has old version', () => {
      const oldData = makeTemplateData({templateVersion: 1, countries: 'GB'});
      const wcif = makeWcif([makeExtension(oldData)]);

      const result = service.loadTemplate(wcif);

      expect(result).toBe('migrated');
      expect(mockPrintService.countries).toBe('GB');
    });

    it('should return null when no extension exists', () => {
      const wcif = makeWcif([]);

      const result = service.loadTemplate(wcif);

      expect(result).toBeNull();
    });

    it('should not modify PrintService when no extension exists', () => {
      mockPrintService.countries = 'original';
      const wcif = makeWcif([]);

      service.loadTemplate(wcif);

      expect(mockPrintService.countries).toBe('original');
    });
  });

  describe('saveTemplate', () => {
    it('should PATCH the WCIF endpoint with correct payload', () => {
      const wcif = makeWcif();

      service.saveTemplate('TestComp2024', wcif).subscribe(result => {
        expect(result).toBeTrue();
      });

      const req = httpMock.expectOne(
        `${environment.wcaUrl}/api/v0/competitions/TestComp2024/wcif`
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');

      const body = req.request.body;
      expect(body.extensions).toBeDefined();
      expect(body.extensions.length).toBe(1);
      expect(body.extensions[0].id).toBe(EXTENSION_ID);
      const data = body.extensions[0].data as PodiumTemplateExtensionData;
      expect(data.podiumCertificateJson).toBe(CERTIFICATE_JSON);

      req.flush({});
    });

    it('should preserve other extensions when saving', () => {
      const otherExt: WcifExtension = {
        id: 'other.extension',
        specUrl: 'https://example.com',
        data: {foo: 'bar'}
      };
      const wcif = makeWcif([otherExt]);

      service.saveTemplate('TestComp2024', wcif).subscribe();

      const req = httpMock.expectOne(
        `${environment.wcaUrl}/api/v0/competitions/TestComp2024/wcif`
      );
      const body = req.request.body;
      expect(body.extensions.length).toBe(2);
      expect(body.extensions[0].id).toBe('other.extension');
      expect(body.extensions[1].id).toBe(EXTENSION_ID);

      req.flush({});
    });

    it('should replace existing template extension when saving', () => {
      const oldExt = makeExtension(makeTemplateData({xOffset: 0}));
      const wcif = makeWcif([oldExt]);

      mockPrintService.xOffset = 99;
      service.saveTemplate('TestComp2024', wcif).subscribe();

      const req = httpMock.expectOne(
        `${environment.wcaUrl}/api/v0/competitions/TestComp2024/wcif`
      );
      const body = req.request.body;
      expect(body.extensions.length).toBe(1);
      const data = body.extensions[0].data as PodiumTemplateExtensionData;
      expect(data.xOffset).toBe(99);

      req.flush({});
    });

    it('should throw when not authenticated', () => {
      mockAuthService.getValidAccessToken.and.returnValue(null);
      const wcif = makeWcif();

      expect(() => service.saveTemplate('TestComp2024', wcif)).toThrowError('Not authenticated');
    });
  });

  describe('backward compatibility', () => {
    it('should handle loading a template without yOffset (old format)', () => {
      const oldFormatData = makeTemplateData({
        templateVersion: CURRENT_TEMPLATE_VERSION,
        podiumCertificateJson: CERTIFICATE_JSON,
        xOffset: 15
      });
      // Simulate old data that doesn't have yOffset
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (oldFormatData as any).yOffset;

      const migrated = service.applyTemplate(oldFormatData);

      expect(migrated).toBeFalse();
      expect(mockPrintService.podiumCertificateJson).toBe(CERTIFICATE_JSON);
      expect(mockPrintService.xOffset).toBe(15);
      expect(mockPrintService.yOffset).toBe(0);
    });

    it('should round-trip template through save and load', () => {
      mockPrintService.podiumCertificateJson = CERTIFICATE_JSON;
      mockPrintService.podiumCertificateStyleJson = '{"font": "mono"}';
      mockPrintService.pageOrientation = 'landscape';
      mockPrintService.backgroundForPreviewOnly = true;
      mockPrintService.countries = 'IE;GB';
      mockPrintService.xOffset = 10;
      mockPrintService.yOffset = -5;

      const ext = service.buildExtension();
      const wcif = makeWcif([ext]);

      // Clear and reload
      mockPrintService.podiumCertificateJson = '';
      mockPrintService.countries = '';
      mockPrintService.xOffset = 0;
      mockPrintService.yOffset = 0;
      const loaded = service.loadTemplate(wcif);

      expect(loaded).toBe('loaded');
      expect(mockPrintService.podiumCertificateJson).toBe(CERTIFICATE_JSON);
      expect(mockPrintService.countries).toBe('IE;GB');
      expect(mockPrintService.xOffset).toBe(10);
      expect(mockPrintService.yOffset).toBe(-5);
    });
  });

  describe('isCurrentVersion', () => {
    it('should return true for current version', () => {
      const data = makeTemplateData({templateVersion: CURRENT_TEMPLATE_VERSION});
      expect(service.isCurrentVersion(data)).toBeTrue();
    });

    it('should return false when version is missing', () => {
      const data = makeTemplateData();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (data as any).templateVersion;
      expect(service.isCurrentVersion(data)).toBeFalse();
    });

    it('should return false for old version', () => {
      const data = makeTemplateData({templateVersion: 1});
      expect(service.isCurrentVersion(data)).toBeFalse();
    });

    it('should return true for future version', () => {
      const data = makeTemplateData({templateVersion: CURRENT_TEMPLATE_VERSION + 1});
      expect(service.isCurrentVersion(data)).toBeTrue();
    });
  });
});
