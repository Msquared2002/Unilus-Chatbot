/*
Changes: Turns a chatbot answer (Markdown) into a branded, downloadable PDF: headings, lists, tables, bold/italic, links, sources.
Affects: routes/chatRoutes.js (POST /api/chat/pdf). Needs the "pdfkit" package (npm install pdfkit).
Purpose: The PDF contains exactly the text the student already saw in the chat plus the sources the answer returned.
         No AI model is called here, so a PDF can never contain anything the chat did not already show.
*/

const PDFDocument = require("pdfkit");

const BRAND = "#0d5c3d";
const BRAND_SOFT = "#eaf5ef";
const TEXT = "#12271c";
const MUTED = "#5b6b62";
const RULE = "#dfe6e2";

const MARGIN = 50;
const MAX_MARKDOWN = 20000;

// The built-in PDF fonts cannot draw emoji or most symbols, so map the common ones and drop the rest.
function toPdfText(value = "") {
    return String(value)
        .replace(/\u2192/g, "->")
        .replace(/[\u2713\u2714]/g, "-")
        .replace(/[\u00a0\u2007\u202f]/g, " ")
        .replace(/[\u200b-\u200d\ufeff\ufe0f]/g, "")
        .replace(/[^\u0009\u000a\u0020-\u007e\u00a1-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/g, "");
}

// ---------- inline Markdown: **bold**, *italic*, `code`, [label](url) ----------

function parseInline(text) {
    const runs = [];
    const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
    let last = 0;
    let match;
    while ((match = re.exec(text))) {
        if (match.index > last) runs.push({ text: text.slice(last, match.index) });
        const token = match[0];
        if (token.startsWith("**") || token.startsWith("__")) runs.push({ text: token.slice(2, -2), bold: true });
        else if (token.startsWith("`")) runs.push({ text: token.slice(1, -1), code: true });
        else if (token.startsWith("[")) {
            const m = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
            runs.push({ text: m[1], link: m[2] });
        } else runs.push({ text: token.slice(1, -1), italic: true });
        last = match.index + token.length;
    }
    if (last < text.length) runs.push({ text: text.slice(last) });
    return runs;
}

function plain(text) {
    return parseInline(text).map((r) => r.text).join("");
}

function fontFor(run, base = "Helvetica") {
    if (run.code) return "Courier";
    if (base === "Helvetica-Bold" || run.bold) return run.italic ? "Helvetica-BoldOblique" : "Helvetica-Bold";
    return run.italic ? "Helvetica-Oblique" : "Helvetica";
}

function writeInline(doc, text, options = {}, baseFont = "Helvetica") {
    const runs = parseInline(toPdfText(text));
    if (!runs.length) { doc.text("", options); return; }
    runs.forEach((run, i) => {
        doc.font(fontFor(run, baseFont));
        doc.fillColor(run.link ? "#0b57d0" : TEXT);
        doc.text(run.text, i === 0 ? { ...options, continued: i < runs.length - 1, link: run.link, underline: Boolean(run.link) }
            : { continued: i < runs.length - 1, link: run.link, underline: Boolean(run.link) });
    });
    doc.fillColor(TEXT).font("Helvetica");
}

// ---------- Markdown blocks ----------

function parseBlocks(markdown) {
    const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    let para = [];
    const flush = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) { flush(); continue; }

        const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
        if (heading) { flush(); blocks.push({ type: "h", level: heading[1].length, text: heading[2] }); continue; }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); blocks.push({ type: "hr" }); continue; }

        if (trimmed.startsWith("|") && lines[i + 1] && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
            flush();
            const split = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
            const header = split(trimmed);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(split(lines[i])); i++; }
            i--;
            blocks.push({ type: "table", header, rows });
            continue;
        }

        const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (bullet) { flush(); blocks.push({ type: "li", indent: Math.min(Math.floor(bullet[1].length / 2), 3), marker: "\u2022", text: bullet[2] }); continue; }

        const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
        if (numbered) { flush(); blocks.push({ type: "li", indent: Math.min(Math.floor(numbered[1].length / 2), 3), marker: `${numbered[2]}.`, text: numbered[3] }); continue; }

        const quote = trimmed.match(/^>\s?(.*)$/);
        if (quote) { flush(); blocks.push({ type: "quote", text: quote[1] }); continue; }

        para.push(trimmed);
    }
    flush();
    return blocks;
}

// ---------- layout helpers ----------

function pageWidth(doc) { return doc.page.width - MARGIN * 2; }

function ensureSpace(doc, height) {
    if (doc.y + height > doc.page.height - MARGIN - 24) doc.addPage();
}

function drawHeader(doc, title, subtitle) {
    doc.rect(0, 0, doc.page.width, 78).fill(BRAND);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text("University of Lusaka", MARGIN, 24, { width: pageWidth(doc) });
    doc.font("Helvetica").fontSize(10).fillColor("#cfeadc").text("Student Digital Companion", MARGIN, 44, { width: pageWidth(doc) });
    doc.y = 100;
    doc.x = MARGIN;
    doc.fillColor(TEXT).font("Helvetica-Bold").fontSize(17).text(toPdfText(title), MARGIN, doc.y, { width: pageWidth(doc) });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(toPdfText(subtitle), { width: pageWidth(doc) });
    doc.moveDown(0.6);
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(RULE).lineWidth(1).stroke();
    doc.moveDown(0.8);
    doc.x = MARGIN;
}

function drawTable(doc, header, rows) {
    const cols = Math.max(header.length, ...rows.map((r) => r.length), 1);
    const total = pageWidth(doc);
    const fontSize = cols > 5 ? 7.5 : 9;
    const pad = 4;

    // Every column gets at least enough room for its longest single word; the rest of the width is shared
    // in proportion to how much text each column holds.
    const charW = fontSize * 0.56;
    const cell = (r, c) => plain(r[c] || "");
    const minW = Array.from({ length: cols }, (_, c) => {
        const words = [header, ...rows].flatMap((r) => cell(r, c).split(/\s+/));
        return Math.min(Math.max(...words.map((w) => w.length), 3) * charW + pad * 2 + 2, total * 0.4);
    });
    const content = Array.from({ length: cols }, (_, c) => Math.min(Math.max(...[header, ...rows].map((r) => cell(r, c).length), 3), 45));
    const spare = Math.max(total - minW.reduce((a, b) => a + b, 0), 0);
    const contentSum = content.reduce((a, b) => a + b, 0);
    let widths = minW.map((m, c) => m + (spare * content[c]) / contentSum);
    const scale = total / widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => w * scale);

    const measure = (cells, bold) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
        return Math.max(...widths.map((w, c) => doc.heightOfString(toPdfText(plain(cells[c] || "")), { width: w - pad * 2 })), fontSize) + pad * 2;
    };

    const drawRow = (cells, bold, shade) => {
        const h = measure(cells, bold);
        let x = MARGIN;
        const y = doc.y;
        if (shade) doc.rect(MARGIN, y, total, h).fill(shade);
        widths.forEach((w, c) => {
            doc.fillColor(bold ? BRAND : TEXT).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize)
                .text(toPdfText(plain(cells[c] || "")), x + pad, y + pad, { width: w - pad * 2 });
            x += w;
        });
        doc.moveTo(MARGIN, y + h).lineTo(MARGIN + total, y + h).strokeColor(RULE).lineWidth(0.5).stroke();
        doc.x = MARGIN;
        doc.y = y + h;
    };

    ensureSpace(doc, measure(header, true) + 20);
    drawRow(header, true, BRAND_SOFT);
    rows.forEach((row, index) => {
        if (doc.y + measure(row, false) > doc.page.height - MARGIN - 24) {
            doc.addPage();
            drawRow(header, true, BRAND_SOFT); // repeat the header on the new page
        }
        drawRow(row, false, index % 2 ? "#f7faf8" : null);
    });
    doc.fillColor(TEXT).font("Helvetica").fontSize(10);
    doc.moveDown(0.8);
    doc.x = MARGIN;
}

function drawBlocks(doc, blocks) {
    const sizes = { 1: 15, 2: 13, 3: 11.5, 4: 10.5 };
    for (const block of blocks) {
        doc.x = MARGIN;
        if (block.type === "h") {
            ensureSpace(doc, 40);
            doc.moveDown(0.4);
            doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(sizes[block.level] || 11).text(toPdfText(plain(block.text)), MARGIN, doc.y, { width: pageWidth(doc) });
            doc.moveDown(0.3);
        } else if (block.type === "p") {
            ensureSpace(doc, 30);
            doc.fontSize(10.5);
            writeInline(doc, block.text, { width: pageWidth(doc), lineGap: 2 });
            doc.moveDown(0.6);
        } else if (block.type === "li") {
            ensureSpace(doc, 24);
            const indent = block.indent * 16;
            const markerWidth = 18;
            const startY = doc.y;
            doc.fontSize(10.5).fillColor(BRAND).font("Helvetica-Bold").text(block.marker, MARGIN + indent, startY, { width: markerWidth, lineBreak: false });
            doc.fillColor(TEXT).font("Helvetica");
            doc.x = MARGIN + indent + markerWidth;
            doc.y = startY;
            writeInline(doc, block.text, { width: pageWidth(doc) - indent - markerWidth, lineGap: 2 }, "Helvetica");
            doc.x = MARGIN;
            doc.moveDown(0.25);
        } else if (block.type === "quote") {
            ensureSpace(doc, 30);
            const y = doc.y;
            doc.fontSize(10).fillColor(MUTED).font("Helvetica-Oblique").text(toPdfText(plain(block.text)), MARGIN + 12, y, { width: pageWidth(doc) - 12 });
            doc.moveTo(MARGIN + 3, y).lineTo(MARGIN + 3, doc.y).strokeColor(BRAND).lineWidth(2).stroke();
            doc.fillColor(TEXT).font("Helvetica");
            doc.moveDown(0.5);
        } else if (block.type === "hr") {
            doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(RULE).lineWidth(1).stroke();
            doc.moveDown(0.6);
        } else if (block.type === "table") {
            drawTable(doc, block.header, block.rows);
        }
    }
}

function drawSources(doc, sources) {
    if (!sources.length) return;
    ensureSpace(doc, 60);
    doc.moveDown(0.6);
    doc.x = MARGIN;
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10.5).text("Sources", MARGIN, doc.y, { width: pageWidth(doc) });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    for (const source of sources) {
        ensureSpace(doc, 14);
        doc.text(`\u2022 ${toPdfText(source)}`, MARGIN, doc.y, { width: pageWidth(doc) });
    }
    doc.fillColor(TEXT);
}

function drawFooters(doc) {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const y = doc.page.height - 36;
        doc.page.margins.bottom = 0; // allow drawing in the bottom margin without adding a page
        doc.moveTo(MARGIN, y - 6).lineTo(doc.page.width - MARGIN, y - 6).strokeColor(RULE).lineWidth(0.5).stroke();
        doc.font("Helvetica").fontSize(8).fillColor(MUTED)
            .text("Generated by the UNILUS Student Digital Companion. Please confirm important details with the relevant UNILUS office.", MARGIN, y, { width: pageWidth(doc) - 60, lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - MARGIN - 60, y, { width: 60, align: "right", lineBreak: false });
    }
}

/**
 * @param {{title?: string, markdown: string, sources?: string[], note?: string}} input
 * @returns {Promise<Buffer>}
 */
function renderAnswerPdf({ title, markdown, sources = [], note = "" }) {
    const body = String(markdown || "").slice(0, MAX_MARKDOWN);
    if (!body.trim()) return Promise.reject(new Error("Nothing to put in the PDF."));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: "A4",
            margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
            bufferPages: true,
            info: { Title: toPdfText(title || "UNILUS answer").slice(0, 120), Author: "UNILUS Student Digital Companion" },
        });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        try {
            const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
            drawHeader(doc, title || "UNILUS answer", [`Generated ${date}`, note].filter(Boolean).join("  |  "));
            doc.fontSize(10.5).fillColor(TEXT).font("Helvetica");
            drawBlocks(doc, parseBlocks(body));
            drawSources(doc, sources.slice(0, 12));
            drawFooters(doc);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { renderAnswerPdf, parseBlocks, parseInline, toPdfText, MAX_MARKDOWN };
