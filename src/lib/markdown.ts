import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { safeUrl } from './cms';

export function markdown(source: string) {
  const clean = DOMPurify.sanitize(marked.parse(source, { async: false, gfm: true }), {
    USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'],
    FORBID_ATTR: ['style', 'id', 'name'],
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('h1').forEach(element => { const heading = document.createElement('h2'); heading.append(...element.childNodes); element.replaceWith(heading); });
  template.content.querySelectorAll('a, img').forEach(element => {
    const attribute = element.tagName === 'IMG' ? 'src' : 'href';
    const value = element.getAttribute(attribute) || '';
    if (attribute === 'href' && value.startsWith('#')) return;
    const url = safeUrl(value);
    if (!url && attribute === 'src') { element.remove(); return; }
    if (!url) element.removeAttribute(attribute); else element.setAttribute(attribute, url);
    if (element instanceof HTMLImageElement) { element.loading = 'lazy'; element.decoding = 'async'; if (!element.alt) element.alt = '본문 이미지'; }
    if (element instanceof HTMLAnchorElement) element.rel = 'noopener noreferrer';
  });
  return template.innerHTML;
}
