import {
  Component, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Input, Output, EventEmitter, NgZone, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {PrintService} from '../../common/print';
import {PdfjsLib} from '../../common/types';

declare const pdfjsLib: PdfjsLib;

const PDF_LANDSCAPE_WIDTH = 842;
const PDF_LANDSCAPE_HEIGHT = 595;
const PDF_PORTRAIT_WIDTH = 595;
const PDF_PORTRAIT_HEIGHT = 842;
const PREVIEW_WIDTH = 700;

@Component({
  selector: 'app-certificate-editor',
  templateUrl: './certificate-editor.component.html',
  styleUrls: ['./certificate-editor.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class CertificateEditorComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() orientation: 'landscape' | 'portrait' = 'landscape';
  @Input() backgroundImage: string | null = null;
  @Input() templateJson = '';
  @Input() styleJson = '';
  @Input() xOffset = 0;
  @Input() yOffset = 0;
  @Output() xOffsetChange = new EventEmitter<number>();
  @Output() yOffsetChange = new EventEmitter<number>();

  @ViewChild('previewCanvas') canvasRef: ElementRef<HTMLCanvasElement>;

  /** Whether the PDF is currently being regenerated */
  loading = true;
  /** Whether we have rendered at least once */
  hasRendered = false;

  /** Drag state */
  dragging = false;
  lockX = true;
  lockY = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;

  /** Bound event handlers (so we can remove them) */
  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);

  constructor(
    public printService: PrintService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    // Disable PDF.js web worker (use main thread — our PDFs are tiny, one page)
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }

  ngAfterViewInit(): void {
    this.regeneratePdf();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only regenerate the PDF when structural properties change (not offsets)
    const structuralKeys = ['orientation', 'templateJson', 'styleJson'];
    const hasStructural = structuralKeys.some(k => changes[k] && !changes[k].firstChange);
    if (hasStructural) {
      this.regeneratePdf();
    }
  }

  // --- Computed dimensions ---

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

  /** Max horizontal offset (half the page width) */
  get maxXOffset(): number {
    return Math.round(this.pdfWidth / 2);
  }

  /** Max vertical offset (half the page height) */
  get maxYOffset(): number {
    return Math.round(this.pdfHeight / 2);
  }

  /** CSS translate for the canvas, converting pt offsets to preview px */
  get canvasTranslate(): string {
    const px = this.xOffset * this.scale;
    const py = this.yOffset * this.scale;
    return `translate(${px}px, ${py}px)`;
  }

  // --- Offset controls ---

  onXOffsetChange(value: number): void {
    this.xOffset = Number(value);
    this.xOffsetChange.emit(this.xOffset);
  }

  onYOffsetChange(value: number): void {
    this.yOffset = Number(value);
    this.yOffsetChange.emit(this.yOffset);
  }

  // --- Drag support (offsets only — no PDF regeneration needed) ---

  onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartOffsetX = this.xOffset;
    this.dragStartOffsetY = this.yOffset;
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.dragging) return;
    const dx = (event.clientX - this.dragStartX) / this.scale;
    const dy = (event.clientY - this.dragStartY) / this.scale;

    if (!this.lockX) {
      const newX = Math.round(Math.max(-this.maxXOffset, Math.min(this.maxXOffset, this.dragStartOffsetX + dx)));
      if (newX !== this.xOffset) {
        this.xOffset = newX;
        this.xOffsetChange.emit(this.xOffset);
      }
    }
    if (!this.lockY) {
      const newY = Math.round(Math.max(-this.maxYOffset, Math.min(this.maxYOffset, this.dragStartOffsetY + dy)));
      if (newY !== this.yOffset) {
        this.yOffset = newY;
        this.yOffsetChange.emit(this.yOffset);
      }
    }
  }

  private onMouseUp(): void {
    this.dragging = false;
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
  }

  // --- PDF rendering to canvas via PDF.js ---

  /**
   * Regenerate the PDF buffer (text only, no background, offsets at 0,0)
   * and render it to the canvas with a transparent background.
   * Only called when template/style/orientation change — NOT on offset changes.
   */
  regeneratePdf(): void {
    if (!this.canvasRef) return;
    this.loading = true;

    this.ngZone.runOutsideAngular(() => {
      this.printService.generatePreviewBuffer((buffer: ArrayBuffer) => {
        this.renderBufferToCanvas(buffer).then(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.hasRendered = true;
          });
        });
      });
    });
  }

  private async renderBufferToCanvas(buffer: ArrayBuffer): Promise<void> {
    const canvas = this.canvasRef.nativeElement;
    const pdf = await pdfjsLib.getDocument({data: buffer}).promise;
    const page = await pdf.getPage(1);

    // Scale to fit PREVIEW_WIDTH
    const viewport = page.getViewport({scale: this.scale});
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    // Clear to transparent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      background: 'rgba(0,0,0,0)',
    }).promise;
  }
}
