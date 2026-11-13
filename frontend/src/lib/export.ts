import type { Khs, MhsRingkas, NilaiRow, Transkrip } from './types';

/**
 * Ekspor dokumen di browser. Library dimuat secara dinamis agar tidak membebani
 * bundle utama (jspdf + xlsx cukup besar) — hanya diunduh saat tombol ekspor diklik.
 */

const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '-' : n.toFixed(d));
const tanggalCetak = () => new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');

async function pdfDoc() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { doc: new jsPDF({ unit: 'mm', format: 'a4' }), autoTable };
}

type Doc = Awaited<ReturnType<typeof pdfDoc>>['doc'];

function kop(doc: Doc, judul: string, sub?: string) {
  doc.setFont('helvetica', 'bold').setFontSize(14).text('SISTEM INFORMASI AKADEMIK', 105, 16, { align: 'center' });
  doc.setFontSize(12).text(judul, 105, 23, { align: 'center' });
  if (sub) doc.setFont('helvetica', 'normal').setFontSize(10).text(sub, 105, 29, { align: 'center' });
  doc.setLineWidth(0.5).line(14, 33, 196, 33);
}

function identitas(doc: Doc, m: MhsRingkas, y = 40) {
  doc.setFont('helvetica', 'normal').setFontSize(10);
  const rows: [string, string][] = [
    ['Nama', m.namaMhs],
    ['NIM', m.nim],
    ['Program Studi', m.jurusan],
    ['Angkatan', m.angkatan],
  ];
  rows.forEach(([k, v], i) => {
    doc.text(k, 14, y + i * 5.5);
    doc.text(`: ${v}`, 45, y + i * 5.5);
  });
  return y + rows.length * 5.5 + 2;
}

function tabelNilai(autoTable: Awaited<ReturnType<typeof pdfDoc>>['autoTable'], doc: Doc, items: NilaiRow[], startY: number, periodeKolom: boolean) {
  autoTable(doc, {
    startY,
    head: [['No', 'Kode', 'Mata Kuliah', 'SKS', ...(periodeKolom ? ['Periode'] : []), 'Nilai', 'Huruf', 'Bobot', 'SKS×Bobot']],
    body: items.map((r, i) => [
      i + 1,
      r.kodeMk,
      r.namaMk,
      r.sks,
      ...(periodeKolom ? [`${r.semester} ${r.tahunAjaran}`] : []),
      fmt(r.nilaiAkhir),
      r.grade ?? '-',
      fmt(r.bobot),
      r.bobot === null ? '-' : fmt(r.bobot * r.sks),
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], halign: 'center' },
    columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'center' } },
  });
  return (doc as Doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function ringkasan(doc: Doc, y: number, rows: [string, string][]) {
  doc.setFont('helvetica', 'bold').setFontSize(10);
  rows.forEach(([k, v], i) => {
    doc.text(k, 130, y + 8 + i * 5.5);
    doc.text(`: ${v}`, 165, y + 8 + i * 5.5);
  });
  doc.setFont('helvetica', 'normal').setFontSize(9).text(`Dicetak ${tanggalCetak()}`, 14, 287);
}

export async function exportKhsPdf(khs: Khs) {
  if (!khs.periode) return;
  const { doc, autoTable } = await pdfDoc();
  kop(doc, 'KARTU HASIL STUDI', `Semester ${khs.periode.semester} ${khs.periode.tahunAjaran}`);
  const y = tabelNilai(autoTable, doc, khs.items, identitas(doc, khs.mahasiswa), false);
  ringkasan(doc, y, [
    ['Total SKS', String(khs.totalSks)],
    ['IPS', fmt(khs.ips)],
  ]);
  doc.save(safe(`KHS_${khs.mahasiswa.nim}_${khs.periode.semester}_${khs.periode.tahunAjaran}.pdf`));
}

export async function exportTranskripPdf(t: Transkrip) {
  const { doc, autoTable } = await pdfDoc();
  kop(doc, 'TRANSKRIP NILAI');
  const y = tabelNilai(autoTable, doc, t.items, identitas(doc, t.mahasiswa), true);
  ringkasan(doc, y, [
    ['Total SKS', String(t.totalSks)],
    ['IPK', fmt(t.ipk)],
  ]);
  doc.save(safe(`Transkrip_${t.mahasiswa.nim}.pdf`));
}

/** Satu file .xlsx; setiap entri `sheets` menjadi satu worksheet (`headers` = urutan & judul kolom, kunci pada `rows`). */
export async function exportExcel(filename: string, sheets: { name: string; headers: string[]; rows: Record<string, unknown>[] }[]) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    // Header eksplisit agar sheet kosong tetap memiliki judul kolom.
    const headers = s.headers;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...s.rows.map((r) => headers.map((h) => r[h] ?? null))]);
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length, ...s.rows.map((r) => String(r[h] ?? '').length)) + 2 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, safe(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`));
}
