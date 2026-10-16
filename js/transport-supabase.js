// 階段二的真傳輸:Supabase Realtime。介面見 transport.js。
// 訊息走 Broadcast(不經資料庫,所以沒有歷史),線上名單走 Presence。
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { createEmitter, transportError, ERR_NICKNAME_TAKEN, ERR_NOT_CONNECTED } from './transport.js';
import { isNicknameTaken, NICK_MAX, MSG_MAX, countChars } from './chat.js';

const CHANNEL = 'lobby';
const SUBSCRIBE_TIMEOUT_MS = 8000;
const SYNC_TIMEOUT_MS = 3000;
const SETTLE_MS = 3000; // 實測新登記的名字約 2.3 秒才會傳開,留一點餘裕

const norm = (nickname) => nickname.trim().toLowerCase();

export function createSupabaseTransport() {
  const { on, emit } = createEmitter();
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  let channel = null;
  let myKey = null;
  let myMeta = null;
  let ready = false;   // 第一次訂閱成功
  let joined = false;  // join() 完成,之後的 sync 才對外發送
  let leaving = false;
  let syncWaiters = [];
  let pendingDispose = Promise.resolve();

  // 同一個代號若有多筆(同時搶名的競爭),最早加入的算數
  function readMembers() {
    const best = new Map();
    for (const [key, metas] of Object.entries(channel.presenceState())) {
      for (const m of metas) {
        if (typeof m.nickname !== 'string') continue;
        const cand = { nickname: m.nickname, joinedAt: Number(m.joinedAt) || 0, key };
        const cur = best.get(norm(m.nickname));
        if (!cur || cand.joinedAt < cur.joinedAt || (cand.joinedAt === cur.joinedAt && key < cur.key)) {
          best.set(norm(m.nickname), cand);
        }
      }
    }
    return [...best.values()];
  }
  const publicMembers = (list) => list.map(({ nickname, joinedAt }) => ({ nickname, joinedAt }));

  function waitForSync(ms) {
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => { syncWaiters = syncWaiters.filter((w) => w !== done); resolve(); }, ms);
      syncWaiters.push(done);
    });
  }

  function onSync() {
    const waiters = syncWaiters;
    syncWaiters = [];
    waiters.forEach((w) => w());
    if (joined) emit('presence', { members: publicMembers(readMembers()) });
  }

  // 不信任收到的內容:型別或長度不對的丟掉
  function onBroadcast({ payload }) {
    if (!payload || typeof payload.nickname !== 'string' || typeof payload.text !== 'string') return;
    if (countChars(payload.nickname) > NICK_MAX || countChars(payload.text) > MSG_MAX) return;
    emit('message', {
      id: String(payload.id ?? ''),
      nickname: payload.nickname,
      text: payload.text,
      ts: Number.isFinite(payload.ts) ? payload.ts : Date.now(),
    });
  }

  function subscribe() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(transportError(ERR_NOT_CONNECTED, 'subscribe timeout')), SUBSCRIBE_TIMEOUT_MS);
      channel.subscribe((status) => {
        if (leaving) return;
        if (status === 'SUBSCRIBED') {
          if (!ready) { ready = true; clearTimeout(timer); resolve(); return; }
          // 斷線後自動重連成功:名單在伺服器端已清空,要重新登記
          emit('status', 'connected');
          if (myMeta) channel.track(myMeta);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!ready) { clearTimeout(timer); reject(transportError(ERR_NOT_CONNECTED, status)); }
          else emit('status', 'reconnecting');
        }
      });
    });
  }

  async function dispose() {
    leaving = true;
    const ch = channel;
    channel = null; myMeta = null; myKey = null;
    ready = false; joined = false;
    syncWaiters = [];
    if (ch) { try { await client.removeChannel(ch); } catch { /* 略過 */ } }
    leaving = false;
  }

  return {
    on,

    async join(nickname) {
      await pendingDispose; // 剛按過離開時,等舊頻道關乾淨再建新的
      if (channel) await dispose();
      myKey = crypto.randomUUID();
      channel = client.channel(CHANNEL, {
        config: { broadcast: { self: true, ack: true }, presence: { key: myKey } },
      });
      channel.on('broadcast', { event: 'msg' }, onBroadcast);
      channel.on('presence', { event: 'sync' }, onSync);

      try {
        const firstSync = waitForSync(SYNC_TIMEOUT_MS);
        await subscribe();
        await firstSync;

        if (isNicknameTaken(nickname, readMembers())) throw transportError(ERR_NICKNAME_TAKEN);

        // 登記自己。新登記的名字要約 2.3 秒才會傳到其他人那邊,所以多等一下讓名單穩定,
        // 再檢查一次:若同時有人搶同一個代號,最早登記的留下,另一方退出。
        myMeta = { nickname, joinedAt: Date.now() };
        await channel.track(myMeta);
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        const winner = readMembers().find((m) => norm(m.nickname) === norm(nickname));
        if (!winner || winner.key !== myKey) throw transportError(ERR_NICKNAME_TAKEN);

        joined = true;
        return { members: publicMembers(readMembers()) };
      } catch (err) {
        await dispose();
        throw err;
      }
    },

    async send(text) {
      if (!channel || !joined || !myMeta) throw transportError(ERR_NOT_CONNECTED);
      const result = await channel.send({
        type: 'broadcast',
        event: 'msg',
        payload: { id: crypto.randomUUID(), nickname: myMeta.nickname, text, ts: Date.now() },
      });
      if (result !== 'ok') throw transportError(ERR_NOT_CONNECTED, String(result));
    },

    leave() {
      pendingDispose = dispose();
    },
  };
}
