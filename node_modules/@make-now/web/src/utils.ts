export function uuid(): string {
  const chars = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += chars[((Math.random() * 16) | 8) & 0xf];
    } else {
      uuid += chars[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
