// Groq Free currently allows 8K TPM for these models, below their 131K context.
// UTF-8 bytes upper-bound byte-level tokens; include framing and output reserve.
// This deliberately avoids claiming a characters/4 heuristic is exact tokenization.
const INPUT_BUDGET = 7000;
const OUTPUT_TOKENS = 800;
const cost = messages => messages.reduce((sum, m) => sum + Buffer.byteLength(String(m.content || ''), 'utf8') + 32, 32);
function clip(text, bytes) {
  let result = '', used = 0;
  for (const character of String(text || '')) {
    used += Buffer.byteLength(character);
    if (used > Math.max(0, bytes)) break;
    result += character;
  }
  return result;
}
function fits(messages) { return cost(messages) <= INPUT_BUDGET; }
function isSizeError(error) {
  return error?.status === 413 || /context_length_exceeded|request_too_large/i.test(String(error?.code || error?.error?.code || '')) || /(?:request|context|payload).*(?:too (?:large|long)|length exceeded)|reduce.*(?:tokens|message)|requested.*tokens.*limit/i.test(String(error?.message || ''));
}
module.exports = { INPUT_BUDGET, OUTPUT_TOKENS, cost, clip, fits, isSizeError };
