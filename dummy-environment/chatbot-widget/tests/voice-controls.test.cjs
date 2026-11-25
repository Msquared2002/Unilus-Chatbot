const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../voice.js'), 'utf8');

function decorateReply(speechSupported) {
    const controls = [];
    const answerTools = {
        appendChild(element) { controls.push(element); }
    };
    const bubble = {
        querySelector(selector) {
            if (selector === '.speak-btn') return { textContent: 'Helpful' };
            if (selector === '.answer-tools') return answerTools;
            return controls.find(element => '.' + element.className === selector);
        },
        cloneNode() { return { textContent: 'Class begins at nine.', querySelectorAll: () => [] }; },
        appendChild(element) { controls.push(element); }
    };
    const row = { classList: { contains: () => true }, querySelector: () => bubble };
    const box = { querySelectorAll: () => [row] };
    const document = {
        readyState: 'complete',
        createElement: () => ({ setAttribute() {}, addEventListener() {}, classList: { remove() {} } }),
        head: { appendChild() {} },
        getElementById: id => id === 'chat-box' ? box : null
    };
    vm.runInNewContext(source, {
        window: {
            ...(speechSupported ? { speechSynthesis: {}, SpeechSynthesisUtterance: function () {} } : {}),
            addEventListener() {}
        },
        document,
        MutationObserver: class { observe() {} }
    });
    return controls;
}

test('feedback controls do not suppress the read-aloud control', () => {
    assert.match(decorateReply(true)[0].innerHTML, /Listen/);
});

test('unsupported speech synthesis explains why read-aloud is unavailable', () => {
    assert.match(decorateReply(false)[0].textContent, /unavailable in this browser/);
});
