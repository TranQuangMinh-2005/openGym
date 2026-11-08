import { randomUUID } from 'node:crypto';
import { fold } from './normalize.js';
import { lexicon, durations, negations, regionPatterns, accentedRegions, exclusions } from './lexicon.js';

export const bounded = pattern => new RegExp('(?<![\\p{L}\\p{N}])(?:' + pattern + ')(?![\\p{L}\\p{N}])', 'gu');
const ranks = { none: 0, caution: 1, red_flag: 2 };
export function escalate(det, llmLabel) {
  return ranks[llmLabel] > ranks[det.level] ? llmLabel : det.level;
}
export function checkInput(text, { history } = {}) {
  const original = String(text ?? '').normalize('NFC').toLowerCase();
  const accented = /[đĐ]|[\u0300-\u036f]/u.test(original.normalize('NFD'));
  let normalized = accented ? original : fold(original);
  for (const exclusion of exclusions) normalized = normalized.replace(bounded(accented ? exclusion : fold(exclusion)), m => ' '.repeat(m.length));
  const matches = [];
  const collect = (pattern, entry, duration = false) => {
    for (const m of normalized.matchAll(bounded(pattern))) {
      const prefix = fold(normalized.slice(0, m.index));
      if (!(accented && /hông\s*$/u.test(normalized.slice(0, m.index)) && !/đau|nhói/.test(m[0])) && /(?:^|[^\p{L}])(?:khong|ko|k|hong|khg|chua|het|no|not|don't|never|without)(?: (?:bi|con|thay|have|any|feel|dau))*$/u.test(prefix)) continue;
      if (duration) {
        const before = normalized.slice(0, m.index).split(/[,.;!?]|\b(?:nhung|but)\b/u).at(-1);
        const after = normalized.slice(m.index + m[0].length).split(/[,.;!?]|\b(?:nhung|but)\b/u)[0];
        const local = before.trim().split(/\s+/).slice(-6).join(' ') + ' ' + after.trim().split(/\s+/).slice(0, 6).join(' ');
        if (!bounded('dau|nhoi|te|sung|nhuc|moi(?! tap| bat dau)|e|kho chiu|pain|hurts?|aches?|numb(?:ness)?|swelling|symptoms?').test(local)) continue;
      }
      if (duration && !(/tuan|thang|week|month|nhieu ngay/.test(m[0]) || Number(m[1]) >= 7)) continue;
      matches.push({ id: entry.id, category: entry.category, span: [m.index, m.index + m[0].length], level: entry.level });
    }
  };
  for (const entry of lexicon) for (const pattern of entry.patterns) collect(accented ? pattern.vi : pattern.folded, entry);
  for (const pattern of durations) {
    const saved = normalized; normalized = fold(normalized);
    collect(pattern, { id: 'duration', category: 'duration', level: 'red_flag' }, true); normalized = saved;
  }
  const level = matches.reduce((v, m) => escalate({ level: v }, m.level), 'none');
  const regions = Object.entries(accented ? accentedRegions : regionPatterns).filter(([id, patterns]) => patterns.some(p => {
    if (!accented && id === 'wrist' && p === 'co tay') return bounded('(?:dau|te|sung|trat) co tay').test(normalized);
    return bounded(p).test(normalized);
  })).map(([id]) => id);
  return { level, matches: matches.map(({ level, ...m }) => m), regions, needsClarification: level === 'caution' && matches.some(m => m.id === 'unspecified'), reason: level === 'none' ? 'No lexicon match.' : 'Unnegated safety lexicon match.' };
}
export function safetyResponse({ lang = 'vi', matches = [], regions = [] } = {}) {
  const urgent = matches.some(m => m.category === 'urgent');
  const labels = { shoulder: 'vai', back: 'lưng', knee: 'gối', wrist: 'cổ tay', elbow: 'khuỷu tay', hip: 'hông', ankle: 'cổ chân', neck: 'cổ', chest: 'ngực' };
  const confirmation = !regions.length ? '' : lang === 'en' ? ` I will record: temporarily avoid exercises loading ${regions.join(', ')}. Please confirm to save this restriction.` : ` Mình sẽ ghi nhận: tạm tránh các bài tác động lên ${regions.map(r => labels[r] ?? r).join(', ')}. Bạn xác nhận để mình lưu điều kiện này nhé.`;
  if (lang === 'en') return (urgent
    ? 'Stop training now and seek medical help urgently. See a doctor or physiotherapist.'
    : 'Stop exercises that load the affected region. See a doctor or physiotherapist before continuing.') + confirmation;
  return (urgent
    ? 'Dừng tập ngay và tìm trợ giúp y tế khẩn cấp. Hãy gặp bác sĩ hoặc chuyên viên vật lý trị liệu.'
    : 'Dừng các bài tập tác động lên vùng đang đau. Hãy gặp bác sĩ hoặc chuyên viên vật lý trị liệu trước khi tiếp tục.') + confirmation;
}
export function pendingPainConstraint({ regions, text, at }) {
  return { id: randomUUID(), type: 'avoid_region', value: { regions: [...regions] }, strength: 'hard',
    source: { kind: 'chat', text: String(text ?? '').slice(0, 200), at }, status: 'pending' };
}
