import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CdkDrag, CdkDragEnd} from '@angular/cdk/drag-drop';
import {VisualElement} from '../../common/types';

const PDF_LANDSCAPE_WIDTH = 842;
const PDF_LANDSCAPE_HEIGHT = 595;
const PDF_PORTRAIT_WIDTH = 595;
const PDF_PORTRAIT_HEIGHT = 842;
const PREVIEW_WIDTH = 700;

const SAMPLE_VALUES: Record<string, string> = {
  'certificate.delegate': 'John Smith',
  'certificate.organizers': 'Jane Doe and Bob Wilson',
  'certificate.competitionName': 'Example Open 2025',
  'certificate.name': 'John Doe',
  'certificate.capitalisedPlace': 'First',
  'certificate.place': 'first',
  'certificate.event': '3x3x3 Cube',
  'certificate.resultType': 'an average',
  'certificate.resultUnit': '',
  'certificate.result': '1:23.45',
  'certificate.locationAndDate': '',
};

@Component({
  selector: 'app-certificate-editor',
  templateUrl: './certificate-editor.component.html',
  styleUrls: ['./certificate-editor.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDrag],
})
export class CertificateEditorComponent {
  @Input() orientation: 'landscape' | 'portrait' = 'landscape';
  @Input() backgroundImage: string | null = null;
  @Input() elements: VisualElement[] = [];
  @Output() elementsChange = new EventEmitter<VisualElement[]>();

  selectedElementId: string | null = null;

  get pdfWidth(): number {
    return this.orientation === 'landscape' ? PDF_LANDSCAPE_WIDTH : PDF_PORTRAIT_WIDTH;
  }

  get pdfHeight(): number {
    return this.orientation === 'landscape' ? PDF_LANDSCAPE_HEIGHT : PDF_PORTRAIT_HEIGHT;
  }

  get scale(): number {
    return PREVIEW_WIDTH / this.pdfWidth;
  }

  get previewHeight(): number {
    return this.pdfHeight * this.scale;
  }

  get selectedElement(): VisualElement | null {
    if (!this.selectedElementId) return null;
    return this.elements.find(el => el.id === this.selectedElementId) || null;
  }

  selectElement(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedElementId = id;
  }

  deselectAll(): void {
    this.selectedElementId = null;
  }

  onDragEnded(event: CdkDragEnd, element: VisualElement): void {
    const delta = event.distance;
    element.x += delta.x / this.scale;
    element.y += delta.y / this.scale;
    event.source.reset();
    this.emitChange();
  }

  resolvePreviewText(text: string): string {
    let resolved = text;
    // Replace longer placeholders first to avoid partial matches
    const keys = Object.keys(SAMPLE_VALUES).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      resolved = resolved.replace(new RegExp(key.replace('.', '\\.'), 'g'), SAMPLE_VALUES[key]);
    }
    return resolved;
  }

  onFontSizeChange(value: number): void {
    const el = this.selectedElement;
    if (el) {
      el.fontSize = value;
      this.emitChange();
    }
  }

  onBoldChange(value: boolean): void {
    const el = this.selectedElement;
    if (el) {
      el.bold = value;
      this.emitChange();
    }
  }

  onTextChange(value: string): void {
    const el = this.selectedElement;
    if (el) {
      el.text = value;
      this.emitChange();
    }
  }

  private emitChange(): void {
    this.elementsChange.emit([...this.elements]);
  }
}
