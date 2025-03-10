declare module 'jspdf' {
  export class jsPDF {
    constructor(options?: any);
    text(text: string, x: number, y: number, options?: any): jsPDF;
    addPage(): jsPDF;
    line(x1: number, y1: number, x2: number, y2: number): jsPDF;
    setFont(fontName: string, fontStyle?: string): jsPDF;
    setFontSize(size: number): jsPDF;
    setTextColor(r: number, g: number, b: number): jsPDF;
    setDrawColor(r: number, g: number, b: number): jsPDF;
    output(type: string, options?: any): any;
    getNumberOfPages(): number;
    setPage(pageNumber: number): jsPDF;
    splitTextToSize(text: string, maxWidth: number): string[];
  }
} 