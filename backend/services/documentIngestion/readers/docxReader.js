/**
 * readers/docxReader.js
 * =======================
 *
 * DOCX files are converted to HTML by mammoth (which preserves
 * headings, tables, and lists as real tags) and then handed to
 * htmlReader.js. This is deliberate reuse: there is exactly ONE
 * structural-block extractor for tag-based markup (HTML and DOCX
 * both become HTML), rather than a second, subtly-different
 * table/heading/list detector maintained separately for DOCX.
 */

const mammoth = require("mammoth");
const { readHtml } = require("./htmlReader");

async function readDocx(buffer, { filename = "document.docx" } = {}) {
  const { value: html, messages } = await mammoth.convertToHtml({ buffer });

  const warnings = messages.filter((m) => m.type === "warning");
  if (warnings.length) {
    console.warn(`docxReader: ${warnings.length} conversion warning(s) for ${filename}`);
  }

  return readHtml(html, { filename });
}

module.exports = { readDocx };
