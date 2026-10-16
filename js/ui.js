// 畫面渲染與事件。只碰 DOM,聊天規則在 chat.js,資料來源在 transport。
import {
  NICK_MAX, MSG_MAX, countChars, colorForNickname, initialOf, formatMessageTime, isTimeFixed,
} from './chat.js';

const $ = (id) => document.getElementById(id);
const el = {
  entry: $('entry'), entryForm: $('entry-form'), nick: $('nick'), nickMsg: $('nick-msg'),
  nickCount: $('nick-count'), enterBtn: $('enter-btn'),
  room: $('room'), status: $('status'), meName: $('me-name'), onlineCount: $('online-count'),
  log: $('log'), jump: $('jump'), composer: $('composer'), msg: $('msg'),
  msgCount: $('msg-count'), hint: $('hint'),
  roster: $('roster'), rosterList: $('roster-list'), rosterCount: $('roster-count'),
  backdrop: $('backdrop'),
};

const touchOnly = window.matchMedia('(pointer: coarse)');
const wideLayout = window.matchMedia('(min-width: 900px)');
let hintTimer = null;

// ---------- 進入頁 ----------

export function showEntry({ error = '' } = {}) {
  el.room.hidden = true;
  el.entry.hidden = false;
  el.nick.value = '';
  updateNickCount();
  setEntryError(error);
  el.enterBtn.textContent = '進入夜語';
  el.enterBtn.disabled = false;
  el.nick.focus();
}

// 重新整理後自動回到聊天室的等待畫面:顯示進入頁,但先不讓人操作
export function showEntryPending(text) {
  el.room.hidden = true;
  el.entry.hidden = false;
  el.nick.value = '';
  updateNickCount();
  setEntryError('');
  el.nickMsg.textContent = text;
  el.enterBtn.disabled = true;
}

function setEntryError(message) {
  el.nickMsg.textContent = message;
  el.nick.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function updateNickCount() {
  el.nickCount.textContent = `${countChars(el.nick.value)} / ${NICK_MAX}`;
}

// ---------- 聊天室 ----------

export function showRoom(me) {
  el.entry.hidden = true;
  el.room.hidden = false;
  el.meName.textContent = me;
  el.log.replaceChildren();
  el.jump.hidden = true;
  el.msg.value = '';
  resizeComposer();
  updateMsgCount();
  setHint('');
  setStatus(true);
  closeRoster();
  if (!touchOnly.matches) el.msg.focus();
}

export function setStatus(connected) {
  el.status.hidden = connected;
}

export function renderRoster(members, me) {
  el.onlineCount.textContent = `${members.length} 人在線`;
  el.rosterCount.textContent = `${members.length} 人`;
  el.rosterList.replaceChildren(...members.map((m) => {
    const isMe = m.nickname === me;
    const li = document.createElement('li');
    li.className = isMe ? 'member is-me' : 'member';
    li.style.setProperty('--c', isMe ? 'var(--rose)' : colorForNickname(m.nickname));

    const avatar = document.createElement('span');
    avatar.className = 'member__avatar';
    avatar.textContent = initialOf(m.nickname);
    avatar.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'member__name';
    name.textContent = m.nickname;

    li.append(avatar, name);
    if (isMe) {
      const you = document.createElement('span');
      you.className = 'member__you';
      you.textContent = '(你)';
      li.append(you);
    }
    return li;
  }));
}

// ---------- 訊息串 ----------

const nearBottom = () => el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 48;
function scrollToBottom() {
  el.log.scrollTop = el.log.scrollHeight;
  el.jump.hidden = true;
}

export function showWelcome(me, onlineCount) {
  let card = $('welcome');
  if (!card) {
    card = document.createElement('div');
    card.id = 'welcome';
    card.className = 'welcome';
    card.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#i-heart"/></svg>' +
      '<p class="welcome__title"></p><p class="welcome__body"></p>';
    el.log.prepend(card);
  }
  card.querySelector('.welcome__title').textContent = `歡迎,${me}`;
  card.querySelector('.welcome__body').textContent =
    `目前有 ${onlineCount} 人在線,還沒有訊息。說點什麼吧。`;
}

export const hasWelcome = () => Boolean($('welcome'));
export function removeWelcome() { $('welcome')?.remove(); }

export function addNotice(text, { alert = false } = {}) {
  const stick = nearBottom();
  const div = document.createElement('div');
  div.className = alert ? 'notice notice--alert' : 'notice';
  div.textContent = text;
  el.log.append(div);
  if (stick) scrollToBottom();
}

export function addMessage({ nickname, text, ts }, isMine) {
  const stick = nearBottom();
  const wrap = document.createElement('div');
  wrap.className = isMine ? 'msg msg--mine' : 'msg';

  const head = document.createElement('div');
  head.className = 'msg__head';
  if (!isMine) {
    const name = document.createElement('span');
    name.className = 'msg__name';
    name.style.setProperty('--c', colorForNickname(nickname));
    name.textContent = nickname;
    head.append(name);
  }
  const time = document.createElement('time');
  time.className = 'msg__time';
  time.dateTime = new Date(ts).toISOString();
  time.dataset.ts = String(ts);
  time.textContent = formatMessageTime(ts);
  head.append(time);

  const body = document.createElement('p');
  body.className = 'msg__body';
  body.textContent = text; // 純文字,不解析 HTML、不轉連結

  wrap.append(head, body);
  el.log.append(wrap);

  if (isMine || stick) scrollToBottom();
  else el.jump.hidden = false;
}

// 相對時間會隨時間變化;滿 1 小時後文字固定,不再更新
function refreshTimes() {
  const now = Date.now();
  el.log.querySelectorAll('time[data-ts]').forEach((t) => {
    const ts = Number(t.dataset.ts);
    t.textContent = formatMessageTime(ts, now);
    if (isTimeFixed(ts, now)) delete t.dataset.ts;
  });
}

// ---------- 輸入列 ----------

export function setHint(text, { autoClear = true } = {}) {
  clearTimeout(hintTimer);
  el.hint.textContent = text;
  if (text && autoClear) hintTimer = setTimeout(() => { el.hint.textContent = ''; }, 2500);
}

function updateMsgCount() {
  const n = countChars(el.msg.value);
  el.msgCount.textContent = `${n} / ${MSG_MAX}`;
  el.msgCount.classList.toggle('is-over', n > MSG_MAX);
}

function resizeComposer() {
  el.msg.style.height = 'auto';
  el.msg.style.height = `${el.msg.scrollHeight + 2}px`;
}

function updatePlaceholder() {
  el.msg.placeholder = touchOnly.matches
    ? '寫下想說的話…'
    : '寫下想說的話…(Enter 送出,Shift+Enter 換行)';
}

// ---------- 名單抽屜(手機) ----------

export function openRoster() {
  if (wideLayout.matches) return;
  el.roster.classList.add('is-open');
  el.backdrop.hidden = false;
  $('roster-close').focus();
}

export function closeRoster() {
  el.roster.classList.remove('is-open');
  el.backdrop.hidden = true;
}

// ---------- 綁定事件 ----------

// handlers: { onEnter(raw) -> Promise<{ok, error?}>, onSend(text) -> {ok, error?}, onLeave() }
export function init(handlers) {
  updatePlaceholder();
  setInterval(refreshTimes, 30_000);

  el.nick.addEventListener('input', () => {
    updateNickCount();
    if (el.nickMsg.textContent) setEntryError('');
  });

  el.entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.enterBtn.disabled = true;
    const label = el.enterBtn.textContent;
    el.enterBtn.textContent = '進入中…';
    const result = await handlers.onEnter(el.nick.value);
    if (!result.ok) {
      el.enterBtn.textContent = label;
      el.enterBtn.disabled = false;
      setEntryError(result.error);
      el.nick.focus();
    }
  });

  el.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = handlers.onSend(el.msg.value);
    if (result.ok) {
      el.msg.value = '';
      resizeComposer();
      updateMsgCount();
      setHint('');
    } else if (result.error) {
      setHint(result.error);
    }
    if (!touchOnly.matches) el.msg.focus();
  });

  el.msg.addEventListener('input', () => { resizeComposer(); updateMsgCount(); });
  el.msg.addEventListener('keydown', (e) => {
    // 手機的 Enter 是換行;輸入法選字中的 Enter 不算送出
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    if (touchOnly.matches) return;
    e.preventDefault();
    el.composer.requestSubmit();
  });

  el.jump.addEventListener('click', scrollToBottom);
  el.log.addEventListener('scroll', () => { if (nearBottom()) el.jump.hidden = true; });

  $('roster-open').addEventListener('click', openRoster);
  $('roster-close').addEventListener('click', closeRoster);
  el.backdrop.addEventListener('click', closeRoster);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.roster.classList.contains('is-open')) {
      closeRoster();
      $('roster-open').focus();
    }
  });
  wideLayout.addEventListener('change', closeRoster);

  const leave = () => { closeRoster(); handlers.onLeave(); };
  $('leave-btn').addEventListener('click', leave);
  $('roster-leave').addEventListener('click', leave);
}
