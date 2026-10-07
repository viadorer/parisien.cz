// Bezpečný mini-markup → HTML: odstavce, ## nadpis, **tučně**, - odrážky, [text](https://…). Vše se escapuje.
import { esc } from './layout.js';

function inline(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function toHtml(text) {
  return String(text || '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean).map((b) => {
    if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
    const lines = b.split('\n');
    if (lines.every((l) => l.startsWith('- '))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}
