export type Asset = { id: string; alt: string };
export type Project = { id: string; owner_id?: string; slug: string; title: string; summary: string; problem: string; role: string; contribution: string; approach: string; result: string; body: string; tech: string[]; period: string; links: Link[]; image_ids: string[]; included: boolean; discoverable: boolean; featured: boolean; position: number; legacy: Record<string, any>; updated_at: string };
export type Link = { label: string; url: string };
export type Profile = { id?: string; handle: string; name: string; intro: string; about: string; photo_id?: string; links: Link[]; theme: Theme; legacy: Record<string, any>; updated_at?: string };
export type RecordEntry = { id: string; kind: string; slug: string; title: string; summary: string; body: string; metadata: Record<string, any>; published_at: string; position: number };
export type Snapshot = { profile: Profile; projects: Project[]; records: RecordEntry[]; assets: Asset[] };
export type Theme = { accent: string; mode: string; order: string[]; hidden: string[] };
export const sections: Record<string, string> = { projects: '만든 것들', about: '저에 대해', research: '연구와 발표', timeline: '전체 이력', posts: '글' };
export const accents: Record<string, { label: string; light: string; dark: string }> = { blue: { label: '블루', light: '#465ed0', dark: '#aebcff' }, green: { label: '포레스트', light: '#18704c', dark: '#8bdbb4' }, violet: { label: '바이올렛', light: '#7441b6', dark: '#d0b0ff' }, coral: { label: '코랄', light: '#b33d39', dark: '#ffb5ac' } };
export function themeOf(value: any): Theme { const valid = (items: any) => Array.isArray(items) ? [...new Set(items.filter((s: unknown): s is string => typeof s === 'string' && s in sections))] : []; return { accent: value?.accent in accents ? value.accent : 'blue', mode: value?.mode === 'dark' ? 'dark' : 'light', order: [...valid(value?.order), ...Object.keys(sections).filter(k => !valid(value?.order).includes(k))], hidden: valid(value?.hidden) }; }
export const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const external = (value: unknown) => { if (typeof value !== 'string') return ''; try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
export const dateLabel = (value: string) => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
export const pathFor = (kind: string, slug: string) => `${kind === 'projects' ? 'projects' : kind === 'posts' ? 'blog' : 'records'}/${encodeURIComponent(slug)}/`;
