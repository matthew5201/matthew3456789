// 啟動與串接。預設連 Supabase;網址加 ?mock 則改用本機模擬(開發與測試用)。
import { ERR_NICKNAME_TAKEN } from './transport.js';
import * as ui from './ui.js';
import {
  validateNickname, validateMessage, createSendLimiter, sortMembers, diffMembers,
  ERR_NICK_TAKEN, ERR_TOO_FAST,
} from './chat.js';

const params = new URLSearchParams(location.search);
const transport = params.has('mock')
  ? (await import('./transport-mock.js')).createMockTransport()
  : (await import('./transport-supabase.js')).createSupabaseTransport();

const SESSION_KEY = 'yeyu.nick';
const BASE_TITLE = '夜語';

const limiter = createSendLimiter();
let me = null;
let members = [];
let unread = 0;

// sessionStorage 在無痕或封鎖網站資料時可能丟錯,失敗就當作沒有
const session = {
  get() { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(SESSION_KEY, v); } catch { /* 略過 */ } },
  clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* 略過 */ } },
};

function setUnread(n) {
  unread = n;
  document.title = n > 0 ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
}

function applyMembers(next) {
  members = sortMembers(next);
  ui.renderRoster(members, me);
  if (ui.hasWelcome()) ui.showWelcome(me, members.length);
}

async function enter(raw) {
  const check = validateNickname(raw);
  if (!check.ok) return check;

  try {
    const joined = await transport.join(check.nickname);
    me = check.nickname;
    session.set(me);
    ui.showRoom(me);
    applyMembers(joined.members);
    ui.showWelcome(me, members.length);
    return { ok: true };
  } catch (err) {
    if (err.code === ERR_NICKNAME_TAKEN) return { ok: false, error: ERR_NICK_TAKEN };
    return { ok: false, error: '連不上聊天室,請稍後再試' };
  }
}

function send(raw) {
  const check = validateMessage(raw);
  if (!check.ok) return check.empty ? { ok: false } : check;
  if (!limiter.tryAcquire()) return { ok: false, error: ERR_TOO_FAST };

  transport.send(check.text).catch(() => ui.addNotice('訊息未送出,請再試一次', { alert: true }));
  return { ok: true };
}

function leave() {
  transport.leave();
  session.clear();
  me = null;
  members = [];
  setUnread(0);
  ui.showEntry();
}

transport.on('message', (msg) => {
  const mine = msg.nickname === me;
  ui.removeWelcome();
  ui.addMessage(msg, mine);
  if (!mine && document.hidden) setUnread(unread + 1);
});

transport.on('presence', ({ members: next }) => {
  if (!me) return;
  const { joined, left } = diffMembers(members, next);
  applyMembers(next);
  joined.filter((n) => n !== me).forEach((n) => ui.addNotice(`${n} 加入了聊天室`));
  left.filter((n) => n !== me).forEach((n) => ui.addNotice(`${n} 離開了`));
});

transport.on('status', (status) => ui.setStatus(status === 'connected'));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setUnread(0);
});

ui.init({ onEnter: enter, onSend: send, onLeave: leave });

// 重新整理時沿用原代號直接回到聊天室。
// 伺服器可能還留著舊分頁的「殘影」(幾秒內才會消失),所以代號被占用時先等一下再試,
// 幾次都不行才放棄、請使用者換一個。
const RESUME_TRIES = 8;
const RESUME_WAIT_MS = 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resume(nickname) {
  ui.showEntryPending('正在回到聊天室…');
  for (let i = 0; i < RESUME_TRIES; i++) {
    const result = await enter(nickname);
    if (result.ok) return;
    if (result.error !== ERR_NICK_TAKEN) break;
    await sleep(RESUME_WAIT_MS);
  }
  session.clear();
  ui.showEntry({ error: `原本的代號「${nickname}」無法使用,請換一個` });
}

const saved = session.get();
if (saved) resume(saved);
else ui.showEntry();

// 測試用:網址加 ?debug 後,可在主控台呼叫 __transport.simulateDisconnect()
if (params.has('debug')) window.__transport = transport;
