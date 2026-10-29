export function timeAgo(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export const isDemoItem = (item) => String(item?._id || '').startsWith('demo');
export const itemCode = (item) => (isDemoItem(item) ? 'SAMPLE' : `TM-${String(item._id || '').slice(-4).toUpperCase()}`);
