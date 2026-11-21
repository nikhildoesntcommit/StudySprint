// Markdown rendering with math (KaTeX), wiki-links and inline flashcard syntax.
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';

const marked = new Marked({ gfm: true, breaks: true });

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const CARD_LINE = /^(\s*[-*]?\s*)(.+?)\s(:{2,3})\s(.+)$/;

export function renderMarkdown(src: string, opts: { inline?: boolean } = {}): string {
  const stash: string[] = [];
  const keep = (html: string) => `%%SS${stash.push(html) - 1}SS%%`;
  let text = src;

  // protect fenced/inline code from math processing
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) =>
    `\n\n${keep(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)}\n\n`);
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => keep(`<code>${escapeHtml(code)}</code>`));
  // display then inline math
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex) => keep(renderMath(tex, true)));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, tex) => keep(renderMath(tex, true)));
  text = text.replace(/(^|[^\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (_m, pre, tex) => pre + keep(renderMath(tex, false)));
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_m, tex) => keep(renderMath(tex, false)));

  if (!opts.inline) {
    // flashcard lines "Term :: Definition" get a subtle visual treatment
    text = text.split('\n').map((line) => {
      const m = line.match(CARD_LINE);
      if (!m || /^\s*\|/.test(line)) return line;
      return `${m[1]}<span class="md-card"><span class="md-card-q">${m[2]}</span><span class="md-card-sep">${m[3] === ':::' ? '⇄' : '→'}</span><span class="md-card-a">${m[4]}</span></span>`;
    }).join('\n');
  }
  // cloze deletions
  text = text.replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g, (_m, _n, ans) => `<mark class="cloze">${ans}</mark>`);
  // wiki links
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_m, title) => `<a href="#" class="wikilink" data-note="${escapeHtml(title.trim())}">${escapeHtml(title.trim())}</a>`);

  let html = opts.inline ? (marked.parseInline(text, { async: false }) as string) : (marked.parse(text, { async: false }) as string);
  html = html.replace(/<p>%%SS(\d+)SS%%<\/p>/g, (_m, i) => stash[Number(i)]);
  html = html.replace(/%%SS(\d+)SS%%/g, (_m, i) => stash[Number(i)]);
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-note', 'target'], ADD_TAGS: ['semantics', 'annotation'] });
}

export interface ExtractedCard { type: 'basic' | 'cloze'; front: string; back: string; reverse?: boolean }

/** Pull flashcards out of a note: "Q :: A", "Term ::: Definition" (both ways), and {{c1::cloze}} lines. */
export function extractCards(src: string): ExtractedCard[] {
  const out: ExtractedCard[] = [];
  let inFence = false;
  for (const raw of src.split('\n')) {
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const line = raw.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').trim();
    if (!line) continue;
    if (/\{\{c\d+::/.test(line)) { out.push({ type: 'cloze', front: line, back: '' }); continue; }
    const m = line.match(/^(.+?)\s(:{2,3})\s(.+)$/);
    if (m) out.push({ type: 'basic', front: m[1].trim(), back: m[3].trim(), reverse: m[2] === ':::' });
  }
  return out;
}

export function plainText(md: string, max = 160): string {
  const t = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [math] ')
    .replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1')
    .replace(/[#>*_`~\[\]()|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

export function wordCount(md: string): number {
  return (md.match(/[\p{L}\p{N}']+/gu) || []).length;
}
