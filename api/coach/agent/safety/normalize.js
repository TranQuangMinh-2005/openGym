export function fold(text) {
  return String(text ?? '').normalize('NFC').toLowerCase().replaceAll('đ', 'd')
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ').trim();
}
