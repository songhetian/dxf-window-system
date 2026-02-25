import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { WindowItem } from '../../shared/schemas';
import { formatUnit, getUnitSymbol, getAreaSymbol } from '../stores/windowStore';

export const usePdfExport = () => {
  const generateThumbnail = (points: {x: number, y: number}[]): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx || points.length === 0) return '';

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });

    const w = maxX - minX, h = maxY - minY;
    const scale = 80 / (Math.max(w, h) || 1);
    
    ctx.translate(50, 50);
    ctx.scale(scale, -scale);
    ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);

    ctx.beginPath();
    ctx.strokeStyle = '#228BE6';
    ctx.lineWidth = 2 / scale;
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    return canvas.toDataURL('image/png');
  };

  const exportPdf = (windows: WindowItem[], unit: 'mm' | 'm') => {
    const doc = new jsPDF() as any;
    const date = new Date().toLocaleDateString();

    doc.setFontSize(22);
    doc.text('门窗生产精细算料报表', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`导出日期: ${date} | 单位: ${unit.toUpperCase()}`, 105, 30, { align: 'center' });

    const body = windows.map((win, index) => [
      index + 1,
      '',
      win.name,
      `${formatUnit(win.width, unit)}×${formatUnit(win.height, unit)}`,
      `${formatUnit(win.area, unit)}`,
      `${formatUnit(win.glassArea || 0, unit)}`,
      `${(win.frameWeight || 0).toFixed(2)} kg`,
    ]);

    doc.autoTable({
      startY: 40,
      head: [['序号', '示意图', '名称', `尺寸(${getUnitSymbol(unit)})`, `总面(${getAreaSymbol(unit)})`, `玻璃面(${getAreaSymbol(unit)})`, '预估重量']],
      body: body,
      theme: 'grid',
      headStyles: { fillStyle: '#228BE6' },
      styles: { minCellHeight: 25, verticalAlign: 'middle', halign: 'center', fontSize: 9 },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          const imgData = generateThumbnail(windows[data.row.index].points);
          doc.addImage(imgData, 'PNG', data.cell.x + 2, data.cell.y + 2, 20, 20);
        }
      }
    });

    doc.save(`门窗精细报表_${date}.pdf`);
  };

  const exportExcel = (windows: WindowItem[], unit: 'mm' | 'm') => {
    const date = new Date().toLocaleDateString();
    const data = windows.map((win, index) => ({
      '序号': index + 1,
      '窗户名称': win.name,
      '分类': win.category,
      '宽度': formatUnit(win.width, unit),
      '高度': formatUnit(win.height, unit),
      '总面积': formatUnit(win.area, unit),
      '玻璃面积': formatUnit(win.glassArea || 0, unit),
      '预估重量(kg)': (win.frameWeight || 0).toFixed(2),
      '单位': unit.toUpperCase()
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '精细算料');
    XLSX.writeFile(workbook, `门窗精细清单_${date}.xlsx`);
  };

  return { exportPdf, exportExcel };
};
