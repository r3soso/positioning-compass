/* ===== 格式化工具 ===== */

/** 生成唯一ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 日期格式化 */
function formatDate(ts, fmt = 'YYYY-MM-DD HH:mm') {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return fmt
    .replace('YYYY', d.getFullYear())
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()));
}

/** 相对时间 */
function relativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}天前`;
  return formatDate(ts);
}

/** 文本截断 */
function truncate(text, maxLen = 50) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

/** 转义HTML */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
