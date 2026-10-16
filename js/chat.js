// 聊天規則:純函式,不碰 DOM、不碰網路,可以直接用 node 測試。

export const NICK_MAX = 12;
export const MSG_MAX = 500;
export const SEND_INTERVAL_MS = 1000;

export const ERR_NICK_EMPTY = '請輸入代號';
export const ERR_NICK_LONG = `代號最多 ${NICK_MAX} 個字`;
export const ERR_NICK_TAKEN = '這個代號已有人使用,請換一個';
export const ERR_MSG_LONG = `訊息最多 ${MSG_MAX} 個字`;
export const ERR_TOO_FAST = '送太快了,請稍等一下';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// 用 code point 計數,避免 emoji 被算成兩個字
export const countChars = (text) => Array.from(text).length;

const normalize = (nickname) => nickname.trim().toLowerCase();

export function isNicknameTaken(nickname, members) {
  const target = normalize(nickname);
  return members.some((m) => normalize(m.nickname) === target);
}

export function validateNickname(raw, members = []) {
  const nickname = raw.trim().replace(/\s+/g, ' ');
  if (!nickname) return { ok: false, error: ERR_NICK_EMPTY };
  if (countChars(nickname) > NICK_MAX) return { ok: false, error: ERR_NICK_LONG };
  if (isNicknameTaken(nickname, members)) return { ok: false, error: ERR_NICK_TAKEN };
  return { ok: true, nickname };
}

export function validateMessage(raw) {
  const text = raw.trim();
  if (!text) return { ok: false, empty: true };
  if (countChars(text) > MSG_MAX) return { ok: false, error: ERR_MSG_LONG };
  return { ok: true, text };
}

// 每人每秒最多一則。tryAcquire() 成功時才會記錄時間。
export function createSendLimiter({ intervalMs = SEND_INTERVAL_MS, now = Date.now } = {}) {
  let last = -Infinity;
  return {
    tryAcquire() {
      const t = now();
      if (t - last < intervalMs) return false;
      last = t;
      return true;
    },
  };
}

const pad = (n) => String(n).padStart(2, '0');

// 1 小時內:剛剛 / N 分鐘前。滿 1 小時:固定的 HH:mm。
export function formatMessageTime(ts, now = Date.now()) {
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return '剛剛';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分鐘前`;
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 滿 1 小時後文字固定,不必再更新
export const isTimeFixed = (ts, now = Date.now()) => now - ts >= HOUR;

// 線上名單依加入先後排列
export function sortMembers(members) {
  return [...members].sort(
    (a, b) => a.joinedAt - b.joinedAt || a.nickname.localeCompare(b.nickname),
  );
}

export function diffMembers(prev, next) {
  const before = new Set(prev.map((m) => m.nickname));
  const after = new Set(next.map((m) => m.nickname));
  return {
    joined: next.map((m) => m.nickname).filter((n) => !before.has(n)),
    left: prev.map((m) => m.nickname).filter((n) => !after.has(n)),
  };
}

// 同一個代號永遠同一種顏色
export const NICK_COLORS = ['#F4A3B5', '#F6B79A', '#C3A6E8', '#A8D5BA', '#E8C77C', '#9CC5E8'];

export function colorForNickname(nickname) {
  let hash = 5381;
  for (const ch of nickname) hash = ((hash * 33) ^ ch.codePointAt(0)) >>> 0;
  return NICK_COLORS[hash % NICK_COLORS.length];
}

export const initialOf = (nickname) => Array.from(nickname)[0] ?? '';
