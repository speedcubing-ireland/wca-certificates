import {ComponentFixture, TestBed, fakeAsync, tick} from '@angular/core/testing';
import {CertificateEditorComponent} from './certificate-editor.component';
import {PrintService} from '../../common/print';

class MockPrintService {
  pageOrientation: 'landscape' | 'portrait' = 'landscape';
  background: string | null = null;
  backgroundForPreviewOnly = true;
  xOffset = 0;
  yOffset = 0;
  podiumCertificateJson = '[]';
  podiumCertificateStyleJson = '{}';
  previewCallCount = 0;

  generatePreviewBuffer(callback: (buffer: ArrayBuffer) => void): void {
    this.previewCallCount += 1;
    callback(new ArrayBuffer(0));
  }
}

(window as unknown as Record<string, unknown>)['pdfjsLib'] = {
  GlobalWorkerOptions: {workerSrc: ''},
  getDocument: () => ({
    promise: Promise.resolve({
      getPage: () => Promise.resolve({
        getViewport: () => ({width: 700, height: 495}),
        render: () => ({promise: Promise.resolve()}),
      }),
    }),
  }),
};

describe('CertificateEditorComponent', () => {
  let component: CertificateEditorComponent;
  let fixture: ComponentFixture<CertificateEditorComponent>;
  let mockPrint: MockPrintService;

  beforeEach(async () => {
    mockPrint = new MockPrintService();

    await TestBed.configureTestingModule({
      imports: [CertificateEditorComponent],
      providers: [
        {provide: PrintService, useValue: mockPrint},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateEditorComponent);
    component = fixture.componentInstance;
    component.xOffset = 0;
    component.yOffset = 0;
    fixture.detectChanges();
  });

  describe('preview dimensions', () => {
    it('should render a preview container with correct dimensions for landscape', () => {
      component.orientation = 'landscape';
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      expect(previewEl).toBeTruthy();
      expect(previewEl.style.width).toBe('700px');
      // landscape: 595 * (700/842) ≈ 494.77
      const expectedHeight = 595 * (700 / 842);
      expect(Math.abs(parseFloat(previewEl.style.height) - expectedHeight)).toBeLessThan(1);
    });

    it('should render a preview container with correct dimensions for portrait', () => {
      component.orientation = 'portrait';
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      expect(previewEl).toBeTruthy();
      expect(previewEl.style.width).toBe('700px');
      // portrait: 842 * (700/595) ≈ 990.76
      const expectedHeight = 842 * (700 / 595);
      expect(Math.abs(parseFloat(previewEl.style.height) - expectedHeight)).toBeLessThan(1);
    });
  });

  describe('canvas preview', () => {
    it('should display a canvas element for the text preview', () => {
      const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('[data-cy="preview-canvas"]');
      expect(canvas).toBeTruthy();
      expect(canvas.tagName).toBe('CANVAS');
    });

    it('should call generatePreviewBuffer on init', () => {
      expect(mockPrint.previewCallCount).toBe(1);
    });

    it('should show background image when provided', () => {
      component.backgroundImage = 'data:image/png;base64,ABC123';
      fixture.detectChanges();
      const bgImg: HTMLImageElement = fixture.nativeElement.querySelector('[data-cy="preview-background"]');
      expect(bgImg).toBeTruthy();
      expect(bgImg.src).toContain('data:image/png;base64,ABC123');
    });

    it('should not show background image when null', () => {
      component.backgroundImage = null;
      fixture.detectChanges();
      const bgImg = fixture.nativeElement.querySelector('[data-cy="preview-background"]');
      expect(bgImg).toBeFalsy();
    });

    it('should apply CSS translate for offsets on canvas', () => {
      component.xOffset = 100;
      component.yOffset = 50;
      fixture.detectChanges();
      const canvas: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-canvas"]');
      const transform = canvas.style.transform;
      expect(transform).toContain('translate(');
      expect(transform).toContain('px,');
    });
  });

  describe('offset sliders', () => {
    it('should display x and y offset sliders', () => {
      const xSlider = fixture.nativeElement.querySelector('[data-cy="x-offset-slider"]');
      const ySlider = fixture.nativeElement.querySelector('[data-cy="y-offset-slider"]');
      expect(xSlider).toBeTruthy();
      expect(ySlider).toBeTruthy();
    });

    it('should emit xOffsetChange when x slider changes', () => {
      spyOn(component.xOffsetChange, 'emit');
      component.onXOffsetChange(50);
      expect(component.xOffset).toBe(50);
      expect(component.xOffsetChange.emit).toHaveBeenCalledWith(50);
    });

    it('should emit yOffsetChange when y slider changes', () => {
      spyOn(component.yOffsetChange, 'emit');
      component.onYOffsetChange(-30);
      expect(component.yOffset).toBe(-30);
      expect(component.yOffsetChange.emit).toHaveBeenCalledWith(-30);
    });

    it('should display offset values in the UI', () => {
      component.xOffset = 25;
      component.yOffset = -10;
      fixture.detectChanges();
      const xValue: HTMLElement = fixture.nativeElement.querySelector('[data-cy="x-offset-value"]');
      const yValue: HTMLElement = fixture.nativeElement.querySelector('[data-cy="y-offset-value"]');
      expect(xValue.textContent).toContain('25pt');
      expect(yValue.textContent).toContain('-10pt');
    });

    it('should NOT regenerate PDF when offsets change (CSS only)', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.onXOffsetChange(50);
      component.onYOffsetChange(30);
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
    });
  });

  describe('drag support', () => {
    it('should update offsets on drag', () => {
      component.lockX = false; // unlock X for this test
      component.lockY = false;
      spyOn(component.xOffsetChange, 'emit');
      spyOn(component.yOffsetChange, 'emit');

      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      previewEl.dispatchEvent(new MouseEvent('mousedown', {clientX: 100, clientY: 100}));

      expect(component.dragging).toBeTrue();

      // Simulate mouse move
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 150, clientY: 120}));
      fixture.detectChanges();

      expect(component.xOffsetChange.emit).toHaveBeenCalled();
      expect(component.yOffsetChange.emit).toHaveBeenCalled();

      // Release
      document.dispatchEvent(new MouseEvent('mouseup'));
      expect(component.dragging).toBeFalse();
    });

    it('should not change x when lockX is true', () => {
      component.lockX = true;
      component.xOffset = 10;

      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      previewEl.dispatchEvent(new MouseEvent('mousedown', {clientX: 100, clientY: 100}));

      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 200, clientY: 100}));
      expect(component.xOffset).toBe(10); // unchanged

      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('should not change y when lockY is true', () => {
      component.lockY = true;
      component.yOffset = 10;

      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      previewEl.dispatchEvent(new MouseEvent('mousedown', {clientX: 100, clientY: 100}));

      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 100, clientY: 200}));
      expect(component.yOffset).toBe(10); // unchanged

      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('should NOT regenerate PDF during drag (CSS transform only)', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();

      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      previewEl.dispatchEvent(new MouseEvent('mousedown', {clientX: 100, clientY: 100}));
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 200, clientY: 200}));
      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
    });
  });

  describe('lock toggles', () => {
    it('should display lock-x and lock-y checkboxes', () => {
      const lockX = fixture.nativeElement.querySelector('[data-cy="lock-x"]');
      const lockY = fixture.nativeElement.querySelector('[data-cy="lock-y"]');
      expect(lockX).toBeTruthy();
      expect(lockY).toBeTruthy();
    });
  });

  describe('PDF regeneration', () => {
    it('should regenerate PDF when orientation changes', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.orientation = 'portrait';
      component.ngOnChanges({
        orientation: {currentValue: 'portrait', previousValue: 'landscape', firstChange: false, isFirstChange: () => false}
      });
      expect(mockPrint.generatePreviewBuffer).toHaveBeenCalled();
    });

    it('should regenerate PDF when templateJson changes', fakeAsync(() => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.ngOnChanges({
        templateJson: {currentValue: '["new"]', previousValue: '["old"]', firstChange: false, isFirstChange: () => false}
      });
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
      tick(400);
      expect(mockPrint.generatePreviewBuffer).toHaveBeenCalled();
    }));

    it('should regenerate PDF when styleJson changes', fakeAsync(() => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.ngOnChanges({
        styleJson: {currentValue: '{"font":"mono"}', previousValue: '{}', firstChange: false, isFirstChange: () => false}
      });
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
      tick(400);
      expect(mockPrint.generatePreviewBuffer).toHaveBeenCalled();
    }));

    it('should NOT regenerate on first change (handled by ngAfterViewInit)', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.ngOnChanges({
        orientation: {currentValue: 'landscape', previousValue: undefined, firstChange: true, isFirstChange: () => true}
      });
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
    });

    it('should NOT regenerate when only offsets change', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.ngOnChanges({
        xOffset: {currentValue: 50, previousValue: 0, firstChange: false, isFirstChange: () => false},
        yOffset: {currentValue: 30, previousValue: 0, firstChange: false, isFirstChange: () => false}
      });
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
    });

    it('should NOT regenerate when only backgroundImage changes', () => {
      spyOn(mockPrint, 'generatePreviewBuffer').and.callThrough();
      component.ngOnChanges({
        backgroundImage: {currentValue: 'data:image/png;base64,NEW', previousValue: null, firstChange: false, isFirstChange: () => false}
      });
      // Background is rendered as a separate CSS layer, not in the PDF
      expect(mockPrint.generatePreviewBuffer).not.toHaveBeenCalled();
    });
  });
});
