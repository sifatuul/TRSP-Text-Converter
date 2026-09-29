const $ = id => document.getElementById(id);
const inputEditor = $('inputEditor');
const outputEditor = $('outputEditor');

function toast(message) {
  const t = $('toast'); if (!t) return;
  t.textContent = message; t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}

function isBanglaChar(ch) { return /[\u0980-\u09FF]/.test(ch); }

function convertTextNode(node) {
  const text = node.nodeValue || ''; if (!text) return;
  const parts = text.split(/([\u0980-\u09FF]+)/g);
  const frag = document.createDocumentFragment();
  for (const part of parts) {
    if (!part) continue;
    const span = document.createElement('span');
    if (isBanglaChar(part)) {
      span.className = 'bijoy-segment';
      span.textContent = unicodeToBijoy(part);
      span.style.cssText = "font-family:'SutonnyMJ';font-size:12pt;background:none !important;background-color:transparent !important;";
    } else {
      span.className = 'english-segment';
      span.textContent = part;
      span.style.cssText = "font-family:'Times New Roman';font-size:12pt;background:none !important;background-color:transparent !important;";
    }
    frag.appendChild(span);
  }
  node.parentNode.replaceChild(frag, node);
}

function cleanBackgrounds(root) {
  root.querySelectorAll('*').forEach(el => {
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('background-image');
    el.style.removeProperty('box-shadow');
    el.removeAttribute('bgcolor');
    if (el.tagName === 'MARK') {
      const span = document.createElement('span');
      span.innerHTML = el.innerHTML;
      el.replaceWith(...span.childNodes);
    }
  });
  root.style.background = 'transparent';
  root.style.backgroundColor = 'transparent';
}

function convert() {
  if (!inputEditor.innerText.trim()) { toast('Paste some Unicode text first'); return; }
  const clone = inputEditor.cloneNode(true);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach(convertTextNode);
  cleanBackgrounds(clone);
  outputEditor.innerHTML = clone.innerHTML;
  outputEditor.style.background = 'var(--surface)';
  stats();
  toast('Converted to Bijoy');
}

function stats() {
  $('inputStats').textContent = `${(inputEditor.innerText || '').length} characters`;
  $('outputStats').textContent = `${(outputEditor.innerText || '').length} characters`;
}

function sanitizeClone(root) {
  root.removeAttribute('contenteditable');
  root.removeAttribute('id');
  cleanBackgrounds(root);
  root.querySelectorAll('*').forEach(el => {
    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.removeProperty('background-image');
    el.style.removeProperty('box-shadow');
  });
  return root;
}

function makeWordHtml() {
  const clone = sanitizeClone(outputEditor.cloneNode(true));
  clone.style.cssText = "font-family:'Times New Roman';font-size:12pt;line-height:1.5;margin:0;padding:0;background:transparent !important;background-color:transparent !important;";
  clone.querySelectorAll('.bijoy-segment').forEach(el => {
    el.style.fontFamily = 'SutonnyMJ'; el.style.fontSize = '12pt';
    el.style.background = 'transparent'; el.style.backgroundColor = 'transparent';
  });
  clone.querySelectorAll('.english-segment').forEach(el => {
    el.style.fontFamily = 'Times New Roman'; el.style.fontSize = '12pt';
    el.style.background = 'transparent'; el.style.backgroundColor = 'transparent';
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman';font-size:12pt;line-height:1.5;margin:0;background:transparent!important;}*{background:transparent!important;box-shadow:none!important;}.bijoy-segment{font-family:'SutonnyMJ';font-size:12pt;}.english-segment{font-family:'Times New Roman';font-size:12pt;}</style></head><body>${clone.innerHTML}</body></html>`;
}

function makeWordRtf() {
  const root = sanitizeClone(outputEditor.cloneNode(true)); let body = '';
  function esc(s) { return s.replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}').replace(/\r?\n/g,'\\line '); }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) { body += esc(node.nodeValue || ''); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const f = node.classList.contains('bijoy-segment') ? 1 : 0;
    body += `{\\f${f} `; node.childNodes.forEach(walk); body += '}';
  }
  root.childNodes.forEach(walk);
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}{\\f1 SutonnyMJ;}}\\viewkind4\\fs24 ${body}}`;
}

async function copyRichClipboard() {
  const html = makeWordHtml(); const plain = outputEditor.innerText || ''; const rtf = makeWordRtf();
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'}),'text/rtf':new Blob([rtf],{type:'text/rtf'})});
      await navigator.clipboard.write([item]); return true;
    } catch (err) { console.warn('Rich clipboard failed:',err); }
  }
  return false;
}

async function copyWord() {
  if (!outputEditor.innerHTML.trim()) { toast('Convert something first'); return; }
  if (await copyRichClipboard()) { toast('Copied — Bijoy + Word formatting'); return; }
  const holder=document.createElement('div'); holder.contentEditable='true'; holder.style.cssText='position:fixed;left:-100000px;top:0;width:1000px;opacity:0;'; holder.innerHTML=makeWordHtml(); document.body.appendChild(holder);
  const range=document.createRange(); range.selectNodeContents(holder); const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  try { document.execCommand('copy'); toast('Copied — Bijoy + Word formatting'); } catch(err) { toast('Copy failed — try again'); }
  sel.removeAllRanges(); holder.remove();
}

function copySelection(event) {
  if (!outputEditor.innerHTML.trim()) return;
  event.preventDefault(); const html=makeWordHtml(), plain=outputEditor.innerText||'', rtf=makeWordRtf();
  try { event.clipboardData.setData('text/html',html); event.clipboardData.setData('text/plain',plain); try{event.clipboardData.setData('text/rtf',rtf)}catch(_){} toast('Copied — Bijoy + Word formatting'); } catch(err){ toast('Copy failed'); }
}

$('convertBtn').onclick=convert;
$('copyBtn').onclick=copyWord;
$('copyPlainBtn').onclick=async()=>{try{await navigator.clipboard.writeText(outputEditor.innerText||'');toast('Bijoy plain text copied')}catch(_){toast('Clipboard permission denied')}};
$('clearBtn').onclick=()=>{inputEditor.innerHTML='';outputEditor.innerHTML='';stats();inputEditor.focus();};
$('pasteBtn').onclick=async()=>{try{inputEditor.innerText=await navigator.clipboard.readText();stats();inputEditor.focus();}catch(_){toast('Clipboard permission denied')}};
inputEditor.addEventListener('input',stats); outputEditor.addEventListener('copy',copySelection);
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();convert()}});
