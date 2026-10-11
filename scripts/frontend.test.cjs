const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function element() { return { content: '', textContent: '', style: {}, dataset: {}, value: '250', firstChild: { textContent: '' }, classList: { add(){}, remove(){}, toggle(){} }, addEventListener(){}, replaceChildren(){}, append(){}, appendChild(){}, children: [], setAttribute(){}, querySelectorAll(){return [];} }; }
test('casino script initializes without runtime exceptions', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = new Map();
  const document = { getElementById(id){if (!elements.has(id)) elements.set(id,element()); return elements.get(id);}, querySelector(){return {content: ''};}, querySelectorAll(){return [];}, createElement: element, createTextNode(text){return {textContent:text};} };
  const ctx = vm.createContext({ document, console, localStorage: {getItem(){return null;},setItem(){}}, setTimeout(){}, setInterval(){}, clearTimeout(){}, clearInterval(){}, URL, AbortSignal, window:{}, TextEncoder, requestAnimationFrame(){}, crypto: require('node:crypto').webcrypto });
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(() => { for (const match of scripts) { const src = /src="([^"]+)"/.exec(match[1]); const code = src ? fs.readFileSync(path.join(root,src[1]),'utf8') : match[2]; vm.runInContext(code,ctx); } });
});
