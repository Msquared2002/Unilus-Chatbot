// Offline, source-only extraction. Never writes to the knowledge database.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PDFParse } = require('pdf-parse');
const directory = path.join(__dirname, '../data/documents/pdfs');
const output = path.join(__dirname, '../data/tuition-fees.json');
async function build() {
  const schedules = [], sources = {};
  async function read(name) {
    const bytes = fs.readFileSync(path.join(directory, name));
    const parser = new PDFParse({ data: bytes });
    try {
      const { pages } = await parser.getText();
      sources[name] = crypto.createHash('sha256').update(bytes).digest('hex');
      return pages.map(p => p.text);
    } finally { await parser.destroy(); }
  }
  function add(programme, academicYear, currency, source, page, rawRow, amounts, yearBasis = 'document heading') {
    if (!amounts.length || amounts.some(n => !Number.isFinite(n) || n <= 0)) throw Error('Invalid fee row');
    schedules.push({ programme, academicYear, category: currency === 'ZMW' ? 'local_sadc' : 'foreign', currency,
      amountType: 'published semester fees', source, page, yearBasis, rawRow,
      semesters: amounts.map((amount, i) => ({ studyYear: Math.floor(i / 2) + 1, semester: i % 2 + 1, amount })) });
  }
  const numbers = row => (row.match(/\b\d[\d,]*(?:\.\d+)?\b/g) || []).map(n => Number(n.replaceAll(',', '')));
  for (const currency of ['ZMW', 'USD']) {
    const name = `UNDERGRADUATE-FEES-${currency}.pdf`, [text] = await read(name);
    if (!text.includes('2025 FEES SCHEDULE')) throw Error('Unexpected schedule year');
    for (const line of text.split('\n')) {
      const match = line.match(/^((?:BACHELOR|BSC)\D+?)\s+(\d[\d,]*\s+.*)$/);
      if (!match) continue;
      const amounts = numbers(match[2]);
      if (amounts.length !== 8) throw Error('Unexpected semester columns');
      add(match[1].trim(), 2025, currency, name, 1, line, amounts);
    }
  }
  const prospectus = 'UNILUS-PROSPECTUS-2026-11.pdf', pages = await read(prospectus);
  const mappings = [
    [13, 'Bachelor of Science in Computer Science', 0],
    [13, 'Bachelor of Science in Cyber Security', 1],
    [14, 'Bachelor of Science in Information Systems and Technology', 1],
    [21, 'Bachelor of Laws', 0],
  ];
  for (const [page, programme, index] of mappings) {
    const rows = [...pages[page - 1].matchAll(/Students \(ZMW\)\s*([\d, \t]+)\nInternational\s*\nstudent \(USD\)\s*([\d, \t]+)/g)];
    if (!rows[index]) throw Error('Prospectus table layout changed');
    for (const [column, currency] of [[1, 'ZMW'], [2, 'USD']]) {
      const amounts = numbers(rows[index][column]);
      if (amounts.length !== 8) throw Error('Unexpected prospectus columns');
      add(programme, 2026, currency, prospectus, page, `${currency}: ${rows[index][column].trim()}`, amounts, '2026 prospectus edition');
    }
  }
  for (const currency of ['ZMW', 'USD']) {
    const name = `BACHELOR-OF-MEDICINE-AND-SURGERY-${currency}-FEES-UNILUS-2026-1.pdf`, [text] = await read(name);
    const row = text.split('\n').find(line => line.startsWith('Total Fees per Semester'));
    const amounts = numbers(row || '');
    if (amounts.length !== 12) throw Error('Unexpected medicine columns');
    add('Bachelor of Medicine and Surgery', 2026, currency, name, 1, row, amounts,
      currency === 'USD' ? 'official 2026 source filename; body omits calendar year' : 'document heading');
  }
  return { version: 1, sources, schedules };
}
if (require.main === module) build().then(data => {
  const value = JSON.stringify(data, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== value) throw Error('Tuition catalogue differs from source PDFs');
  } else fs.writeFileSync(output, value);
  console.log(`Verified ${data.schedules.length} source-backed fee schedules`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { build };
