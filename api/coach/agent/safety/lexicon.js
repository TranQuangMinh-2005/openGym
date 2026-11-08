export const lexicon = [
  { id: 'sharp', level: 'red_flag', category: 'pain', patterns: ['dau nhoi', 'sharp pain', 'stabbing'] },
  { id: 'numb', level: 'red_flag', category: 'sensation', patterns: ['te bi', 'te tay', 'numb', 'tingling', 'mat cam giac'] },
  { id: 'swelling', level: 'red_flag', category: 'swelling', patterns: ['sung', 'bam tim', 'swelling', 'swollen'] },
  { id: 'persistent', level: 'red_flag', category: 'duration', patterns: ['dau keo dai'] },
  { id: 'impact', level: 'red_flag', category: 'impact', patterns: ['dau sau khi nga', 'after a fall', 'after impact'] },
  { id: 'pop', level: 'red_flag', category: 'impact', patterns: ['nghe tieng rac', 'nghe tieng bup', 'popped', 'heard a pop', 'snap'] },
  { id: 'urgent', level: 'red_flag', category: 'urgent', patterns: ['dau nguc', 'chong mat', 'ngat', 'chest pain', 'dizzy', 'faint'] },
  { id: 'radiating', level: 'red_flag', category: 'sensation', patterns: ['dau lan xuong', 'radiating', 'shooting pain', 'yeu dot ngot', 'khong cu dong duoc', "can't move"] },
  { id: 'soreness', level: 'caution', category: 'soreness', patterns: ['moi co', 'dau co sau tap', 'nhuc', 'sore', 'doms', 'tight', 'uncomfortable', 'hoi dau', 'dau nhe'] }
];
export const durations = ['dau (?:da |duoc )?(\\d+) (ngay|tuan)', 'for (\\d+) (days|weeks)', '(\\d+) (ngay|tuan|thang|days|weeks|months)', '(?:ca|may|nhieu|a) (tuan|weeks?|thang)', 'nhieu ngay'];
export const negations = ['khong', 'chua', 'het', 'no', 'not', "don't", 'never', 'without'];
export const regionPatterns = {
  shoulder: ['vai', 'shoulders?'], back: ['lung', 'lower back', 'back'],
  knee: ['goi', 'knee'], wrist: ['co tay', 'wrist'], elbow: ['khuyu', 'elbow'],
  hip: ['hong', 'hip'], ankle: ['co chan', 'ankle'],
  neck: ['neck', 'dau co(?! (?:bap|tay|chan|sau tap))'], chest: ['nguc', 'chest']
};
export const regionCatalogue = {
  shoulder: { bp: ['shoulders'], tg: ['delts'] },
  back: { bp: ['back'], tg: ['lats', 'upper back', 'spine', 'traps'] },
  knee: { bp: ['upper legs', 'lower legs'], tg: ['quads', 'hamstrings', 'calves'] },
  wrist: { bp: ['lower arms'], tg: ['forearms'] },
  elbow: { bp: ['upper arms', 'lower arms'], tg: ['biceps', 'triceps', 'forearms'] },
  hip: { bp: ['upper legs'], tg: ['glutes', 'adductors', 'abductors'] },
  ankle: { bp: ['lower legs'], tg: ['calves'] },
  neck: { bp: ['neck'], tg: ['levator scapulae'] },
  chest: { bp: ['chest'], tg: ['pectorals', 'serratus anterior'] }
};
export const diagnosisPatterns = ['ban bi (?:rach|viem|thoat vi|dut|gian day chang|trat khop|ton thuong)', 'chan doan', 'you have (?:a )?(?:torn|tendinitis|herniat\\w*|tear|sprain|strain|impingement|bursitis)', 'rotator cuff tear', 'herniated', 'tendinitis', 'bai phuc hoi', 'rehab protocol', 'vat ly tri lieu tai nha theo'];
export const exclusions = ['bổ sung', 'bắt đầu', 'đầu tiên', 'đầu hàng', 'đầu giờ', 'vài hiệp', 'vài lần', 'vài buổi', 'vài ngày', 'ngắt quãng', 'ngắt nghỉ', 'súng bắn', 'no pain no gain'];
const accents = {'dau nhoi':'đau nhói','te bi':'tê bì','te tay':'tê tay','mat cam giac':'mất cảm giác','sung':'sưng','bam tim':'bầm tím','dau keo dai':'đau kéo dài','dau sau khi nga':'đau sau khi ngã','nghe tieng rac':'nghe tiếng rắc','nghe tieng bup':'nghe tiếng bụp','dau nguc':'đau ngực','chong mat':'chóng mặt','ngat':'ngất','dau lan xuong':'đau lan xuống','yeu dot ngot':'yếu đột ngột','khong cu dong duoc':'không cử động được','moi co':'mỏi cơ','dau co sau tap':'đau cơ sau tập','nhuc':'nhức','hoi dau':'hơi đau','dau nhe':'đau nhẹ'};
lexicon.push({id:'unspecified',level:'caution',category:'pain',patterns:[...'đau|chấn thương|bị thương|trật|trẹo|nhức nhối|mỏi|ê ẩm'.split('|').map(vi=>({vi})), ...['pain','hurt','hurts','injury','injured','tweaked','strained','sprained','ache']]}, {id:'sprain',level:'red_flag',category:'impact',patterns:[{vi:'trật khớp'},'sprained','dislocated']});
lexicon.push(
 {id:'expanded-red',level:'red_flag',category:'sensation',patterns:['nhói','tê','hoa mắt','xỉu','choáng','tức ngực','shortness of breath','bruising','worsening','chưa khỏi','not going away','felt(?: \\w+){0,4} (?:pop|popped|snap)','heard(?: \\w+){0,4} (?:pop|popped|snap)','something(?: \\w+){0,4} (?:pop|popped|snap)'].map(vi=>({vi}))},
 {id:'tightness',level:'caution',category:'soreness',patterns:['căng','cứng'].map(vi=>({vi}))}
);
for (const entry of lexicon) entry.patterns = entry.patterns.map(p => typeof p === 'string' ? {vi:accents[p] ?? p, folded:p} : {...p, folded:p.vi.normalize('NFD').replace(/\p{M}/gu,'').replaceAll('đ','d')});
export const accentedRegions = {shoulder:['vai','shoulders?'],back:['lưng','lower back','back'],knee:['gối','knee'],wrist:['cổ tay','wrist'],elbow:['khuỷu','elbow'],hip:['hông','hip'],ankle:['cổ chân','ankle'],neck:['neck','đau cổ(?! (?:bắp|tay|chân|sau tập))'],chest:['ngực','chest']};
