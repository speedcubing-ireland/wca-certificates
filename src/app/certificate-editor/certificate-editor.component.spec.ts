import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CertificateEditorComponent} from './certificate-editor.component';
import {VisualElement} from '../../common/types';
import {CdkDragEnd} from '@angular/cdk/drag-drop';

function makeElements(): VisualElement[] {
  return [
    {id: 'event', text: 'certificate.event', x: 421, y: 180, fontSize: 40, bold: true},
    {id: 'place', text: 'certificate.capitalisedPlace Place', x: 421, y: 240, fontSize: 32, bold: true},
    {id: 'name', text: 'certificate.name', x: 421, y: 320, fontSize: 40, bold: true},
    {id: 'result', text: 'with certificate.resultType of certificate.result certificate.resultUnit', x: 421, y: 400, fontSize: 22, bold: false},
  ];
}

describe('CertificateEditorComponent', () => {
  let component: CertificateEditorComponent;
  let fixture: ComponentFixture<CertificateEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateEditorComponent);
    component = fixture.componentInstance;
    component.elements = makeElements();
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
      const expectedHeight = Math.round(595 * (700 / 842));
      expect(Math.round(parseFloat(previewEl.style.height))).toBeCloseTo(expectedHeight, 0);
    });

    it('should render a preview container with correct dimensions for portrait', () => {
      component.orientation = 'portrait';
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      expect(previewEl).toBeTruthy();
      expect(previewEl.style.width).toBe('700px');
      // portrait: 842 * (700/595) ≈ 990.76
      const expectedHeight = Math.round(842 * (700 / 595));
      expect(Math.round(parseFloat(previewEl.style.height))).toBeCloseTo(expectedHeight, 0);
    });
  });

  describe('element rendering', () => {
    it('should display all visual elements with resolved placeholder text', () => {
      const elementDivs = fixture.nativeElement.querySelectorAll('[data-cy="visual-element"]');
      expect(elementDivs.length).toBe(4);
      expect(elementDivs[0].textContent.trim()).toContain('3x3x3 Cube');
      expect(elementDivs[1].textContent.trim()).toContain('First Place');
      expect(elementDivs[2].textContent.trim()).toContain('John Doe');
      expect(elementDivs[3].textContent.trim()).toContain('an average');
    });

    it('should show background image when provided', () => {
      component.backgroundImage = 'data:image/png;base64,ABC123';
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      expect(previewEl.style.backgroundImage).toContain('data:image/png;base64,ABC123');
    });

    it('should not set background image when null', () => {
      component.backgroundImage = null;
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      expect(previewEl.style.backgroundImage).toBe('none');
    });
  });

  describe('element selection', () => {
    it('should select an element on click', () => {
      const elementDiv = fixture.nativeElement.querySelector('[data-cy="visual-element"]');
      elementDiv.click();
      fixture.detectChanges();
      expect(component.selectedElementId).toBe('event');
      expect(elementDiv.classList.contains('selected')).toBeTrue();
    });

    it('should show controls panel when an element is selected', () => {
      component.selectedElementId = 'event';
      fixture.detectChanges();
      const controlsPanel = fixture.nativeElement.querySelector('[data-cy="controls-panel"]');
      expect(controlsPanel).toBeTruthy();
    });

    it('should not show controls panel when no element is selected', () => {
      component.selectedElementId = null;
      fixture.detectChanges();
      const controlsPanel = fixture.nativeElement.querySelector('[data-cy="controls-panel"]');
      expect(controlsPanel).toBeFalsy();
    });

    it('should deselect all when clicking the preview area', () => {
      component.selectedElementId = 'event';
      fixture.detectChanges();
      const previewEl: HTMLElement = fixture.nativeElement.querySelector('[data-cy="preview-area"]');
      previewEl.click();
      fixture.detectChanges();
      expect(component.selectedElementId).toBeNull();
    });
  });

  describe('drag handling', () => {
    it('should update element position on drag end', () => {
      const element = component.elements[0];
      const originalX = element.x;
      const originalY = element.y;

      const mockDragEnd = {
        distance: {x: 50, y: 30},
        source: {reset: jasmine.createSpy('reset')}
      } as unknown as CdkDragEnd;

      component.onDragEnded(mockDragEnd, element);

      const expectedDeltaX = 50 / component.scale;
      const expectedDeltaY = 30 / component.scale;
      expect(element.x).toBeCloseTo(originalX + expectedDeltaX, 1);
      expect(element.y).toBeCloseTo(originalY + expectedDeltaY, 1);
      expect(mockDragEnd.source.reset).toHaveBeenCalled();
    });

    it('should emit elementsChange after drag', () => {
      spyOn(component.elementsChange, 'emit');
      const element = component.elements[0];

      const mockDragEnd = {
        distance: {x: 10, y: 10},
        source: {reset: jasmine.createSpy('reset')}
      } as unknown as CdkDragEnd;

      component.onDragEnded(mockDragEnd, element);

      expect(component.elementsChange.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('controls panel', () => {
    it('should update fontSize and emit change', () => {
      spyOn(component.elementsChange, 'emit');
      component.selectedElementId = 'event';
      fixture.detectChanges();

      component.onFontSizeChange(50);

      expect(component.elements[0].fontSize).toBe(50);
      expect(component.elementsChange.emit).toHaveBeenCalledTimes(1);
    });

    it('should update bold and emit change', () => {
      spyOn(component.elementsChange, 'emit');
      component.selectedElementId = 'result';
      fixture.detectChanges();

      component.onBoldChange(true);

      expect(component.elements[3].bold).toBeTrue();
      expect(component.elementsChange.emit).toHaveBeenCalledTimes(1);
    });

    it('should update text template and emit change', () => {
      spyOn(component.elementsChange, 'emit');
      component.selectedElementId = 'event';
      fixture.detectChanges();

      component.onTextChange('Custom Text');

      expect(component.elements[0].text).toBe('Custom Text');
      expect(component.elementsChange.emit).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolvePreviewText', () => {
    it('should replace certificate placeholders with sample values', () => {
      expect(component.resolvePreviewText('certificate.event')).toBe('3x3x3 Cube');
      expect(component.resolvePreviewText('certificate.name')).toBe('John Doe');
    });

    it('should handle text with multiple placeholders', () => {
      const result = component.resolvePreviewText('with certificate.resultType of certificate.result');
      expect(result).toBe('with an average of 1:23.45');
    });

    it('should replace certificate.capitalisedPlace before certificate.place', () => {
      const result = component.resolvePreviewText('certificate.capitalisedPlace Place');
      expect(result).toBe('First Place');
    });

    it('should return plain text unchanged', () => {
      expect(component.resolvePreviewText('Hello World')).toBe('Hello World');
    });
  });
});
