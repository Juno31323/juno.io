import { marked } from 'marked';
import sanitize from 'sanitize-html';
import { external } from './model';
export function renderMarkdown(source: string, imageUrl: (source: string) => string = value => value) {
  return sanitize(marked.parse(source || '', { async: false, gfm: true }), {
    allowedTags: ['p','h2','h3','h4','h5','h6','ul','ol','li','strong','em','del','blockquote','pre','code','a','img','br','hr','table','thead','tbody','tr','th','td','dl','dt','dd','div','span'],
    allowedAttributes: { a: ['href','rel'], img: ['src','alt','loading','decoding'], code: ['class'], th: ['colspan'], td: ['colspan'], '*': [] },
    allowedSchemes: ['http','https'], allowProtocolRelative: false,
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src,
    transformTags: {
      h1: 'h2',
      a: (_tag, attrs) => ({ tagName: 'a', attribs: { href: attrs.href?.startsWith('/') && !attrs.href.startsWith('//') ? attrs.href : attrs.href?.startsWith('#') ? attrs.href : external(attrs.href), rel: 'noopener noreferrer' } }),
      img: (_tag, attrs) => { const src=imageUrl(attrs.src||''); return { tagName: 'img', attribs: { src: src.startsWith('/') && !src.startsWith('//') ? src : external(src), alt: attrs.alt || '본문 이미지', loading: 'lazy', decoding: 'async' } }; },
    },
  });
}
