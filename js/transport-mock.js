// 階段一用的假傳輸:在本機模擬幾個會說話、會進出的人。介面見 transport.js。
import { createEmitter, transportError, ERR_NICKNAME_TAKEN, ERR_NOT_CONNECTED } from './transport.js';
import { isNicknameTaken } from './chat.js';

const LATENCY_MS = 120;
const HOUR = 60 * 60 * 1000;

const LINES = {
  星河: ['今晚的月亮好圓。', '有人在聽雨嗎?', '我剛下班,終於能坐下來了。'],
  小滿: ['哇,你們聊得好浪漫。', '我喜歡這裡,不用留名字。', '晚安之前,先說一件今天開心的事吧。'],
  晚風: ['真的,抬頭就看到了。', '這首歌一直在我腦子裡轉。', '明天會是好天氣。'],
  夜行: ['剛路過,打個招呼。', '你們都還沒睡嗎?'],
};
const REPLIES = ['我也這麼覺得。', '真好。', '然後呢?', '哈哈,說得對。', '再多說一點吧。'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);

export function createMockTransport() {
  const { on, emit } = createEmitter();
  const resident = [
    { nickname: '星河', joinedAt: Date.now() - 2 * HOUR },
    { nickname: '小滿', joinedAt: Date.now() - HOUR },
    { nickname: '晚風', joinedAt: Date.now() - 30 * 60 * 1000 },
  ];
  let members = [];
  let me = null;
  let online = true;
  let nextId = 1;
  const timers = new Set();

  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };
  const publish = () => emit('presence', { members: members.map((m) => ({ ...m })) });
  const say = (nickname, text) =>
    emit('message', { id: nextId++, nickname, text, ts: Date.now() });

  function botChatter() {
    later(() => {
      if (me && online) {
        const speakers = members.filter((m) => m.nickname !== me && LINES[m.nickname]);
        if (speakers.length) {
          const who = pick(speakers).nickname;
          say(who, pick(LINES[who]));
        }
      }
      if (me) botChatter();
    }, between(7000, 15000));
  }

  // 「夜行」會不時進來又離開,讓進出提示看得到
  function visitor() {
    later(() => {
      if (!me) return;
      if (online) {
        const here = members.some((m) => m.nickname === '夜行');
        members = here
          ? members.filter((m) => m.nickname !== '夜行')
          : [...members, { nickname: '夜行', joinedAt: Date.now() }];
        publish();
      }
      visitor();
    }, between(20000, 35000));
  }

  return {
    on,

    async join(nickname) {
      await new Promise((r) => setTimeout(r, LATENCY_MS));
      if (isNicknameTaken(nickname, resident)) throw transportError(ERR_NICKNAME_TAKEN);
      me = nickname;
      members = [...resident.map((m) => ({ ...m })), { nickname, joinedAt: Date.now() }];
      botChatter();
      visitor();
      return { members: members.map((m) => ({ ...m })) };
    },

    async send(text) {
      if (!me || !online) throw transportError(ERR_NOT_CONNECTED);
      await new Promise((r) => setTimeout(r, LATENCY_MS));
      say(me, text);
      if (Math.random() < 0.6) {
        const others = members.filter((m) => m.nickname !== me && LINES[m.nickname]);
        if (others.length) later(() => online && me && say(pick(others).nickname, pick(REPLIES)), between(1500, 3000));
      }
    },

    leave() {
      me = null;
      members = [];
      timers.forEach(clearTimeout);
      timers.clear();
    },

    // 測試用:網址加 ?debug 時,可在主控台呼叫 __transport.simulateDisconnect()
    simulateDisconnect(ms = 4000) {
      online = false;
      emit('status', 'reconnecting');
      later(() => { online = true; emit('status', 'connected'); }, ms);
    },
  };
}
