const test = require("node:test");
const assert = require("node:assert/strict");
const { readHtml } = require("../services/documentIngestion/readers/htmlReader");

test("extracts headings with correct level", () => {
  const html = "<html><body><h1>Registration</h1><p>Some intro text.</p></body></html>";
  const { blocks, firstHeading } = readHtml(html);
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[0].level, 1);
  assert.equal(firstHeading, "Registration");
});

test("extracts a table as one block with rows joined by pipes", () => {
  const html = `
    <html><body>
      <table>
        <tr><th>Programme</th><th>Fee</th></tr>
        <tr><td>BIT</td><td>15000</td></tr>
      </table>
    </body></html>`;
  const { blocks } = readHtml(html);
  const table = blocks.find((b) => b.type === "table");
  assert.ok(table);
  assert.match(table.text, /Programme \| Fee/);
  assert.match(table.text, /BIT \| 15000/);
});

test("extracts a list as one block", () => {
  const html = "<html><body><ul><li>Item one</li><li>Item two</li></ul></body></html>";
  const { blocks } = readHtml(html);
  const list = blocks.find((b) => b.type === "list");
  assert.ok(list);
  assert.equal(list.text.split("\n").length, 2);
});

test("removes script and nav noise", () => {
  const html = `
    <html><body>
      <nav>Home | About</nav>
      <script>trackPageview();</script>
      <p>Real content paragraph.</p>
    </body></html>`;
  const { blocks } = readHtml(html);
  const allText = blocks.map((b) => b.text).join(" ");
  assert.ok(!allText.includes("trackPageview"));
  assert.ok(!allText.includes("Home | About"));
  assert.match(allText, /Real content paragraph/);
});

test("does not duplicate text from container divs wrapping headings/paragraphs", () => {
  const html = `
    <html><body>
      <div>
        <h2>Deferment</h2>
        <p>Students may defer for one year.</p>
      </div>
    </body></html>`;
  const { blocks } = readHtml(html);
  const paragraphBlocks = blocks.filter((b) => b.type === "paragraph");
  assert.equal(paragraphBlocks.length, 1);
});
