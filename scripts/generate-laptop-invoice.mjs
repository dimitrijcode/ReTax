import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const contentStream = [
  "BT",
  "/F1 18 Tf",
  "50 780 Td",
  "(TechHaus Berlin GmbH) Tj",
  "0 -22 Td",
  "/F1 10 Tf",
  "(Friedrichstr. 123 · 10117 Berlin · USt-IdNr. DE812345678) Tj",
  "0 -36 Td",
  "/F1 16 Tf",
  "(RECHNUNG) Tj",
  "0 -26 Td",
  "/F1 11 Tf",
  "(Rechnungsnummer: RE-2026-18472) Tj",
  "0 -16 Td",
  "(Datum: 12.09.2026) Tj",
  "0 -16 Td",
  "(Kunde: ReTax Demo UG) Tj",
  "0 -32 Td",
  "(Pos   Beschreibung                              Netto EUR) Tj",
  "0 -18 Td",
  "(1     Lenovo ThinkPad X1 Carbon Laptop            1259.66) Tj",
  "0 -28 Td",
  "(Netto                                            1259.66) Tj",
  "0 -16 Td",
  "(USt 19%                                           239.34) Tj",
  "0 -18 Td",
  "/F1 12 Tf",
  "(Brutto                                           1499.00) Tj",
  "0 -36 Td",
  "/F1 9 Tf",
  "(Laptop. Zahlbar sofort ohne Abzug. Vielen Dank fuer Ihren Einkauf.) Tj",
  "ET",
].join("\n");

const streamLength = Buffer.byteLength(contentStream, "latin1");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];

const header = "%PDF-1.4\n";
const chunks = [header];
const offsets = [0];
let offset = Buffer.byteLength(header, "latin1");

for (let i = 0; i < objects.length; i += 1) {
  offsets.push(offset);
  const body = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  chunks.push(body);
  offset += Buffer.byteLength(body, "latin1");
}

const xrefStart = offset;
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i < offsets.length; i += 1) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
chunks.push(xref, trailer);

const pdf = Buffer.from(chunks.join(""), "latin1");
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "laptop-invoice.pdf");
writeFileSync(outPath, pdf);
console.log(`Wrote ${outPath} (${pdf.length} bytes)`);
