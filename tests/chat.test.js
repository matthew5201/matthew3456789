import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNickname, validateMessage, createSendLimiter, formatMessageTime, isTimeFixed,
  sortMembers, diffMembers, colorForNickname, NICK_COLORS, NICK_MAX, MSG_MAX,
  ERR_NICK_EMPTY, ERR_NICK_LONG, ERR_NICK_TAKEN, ERR_MSG_LONG,
} from '../js/chat.js';

test('代號:去掉前後空白', () => {
  assert.deepEqual(validateNickname('  月光  '), { ok: true, nickname: '月光' });
});

test('代號:不能是空的', () => {
  assert.deepEqual(validateNickname('   '), { ok: false, error: ERR_NICK_EMPTY });
});

test('代號:12 字可以,13 字不行', () => {
  assert.equal(validateNickname('一'.repeat(NICK_MAX)).ok, true);
  assert.deepEqual(validateNickname('一'.repeat(NICK_MAX + 1)), { ok: false, error: ERR_NICK_LONG });
});

test('代號:emoji 算一個字', () => {
  assert.equal(validateNickname('🌙'.repeat(NICK_MAX)).ok, true);
});

test('代號:不可與線上的人重複,不分大小寫', () => {
  const members = [{ nickname: 'Luna', joinedAt: 1 }];
  assert.deepEqual(validateNickname('luna', members), { ok: false, error: ERR_NICK_TAKEN });
  assert.equal(validateNickname('Luna2', members).ok, true);
});

test('訊息:空白訊息被忽略', () => {
  assert.deepEqual(validateMessage('  \n '), { ok: false, empty: true });
});

test('訊息:500 字可以,501 字不行', () => {
  assert.equal(validateMessage('a'.repeat(MSG_MAX)).ok, true);
  assert.deepEqual(validateMessage('a'.repeat(MSG_MAX + 1)), { ok: false, error: ERR_MSG_LONG });
});

test('頻率:同一秒內第二則被擋,過了一秒才放行', () => {
  let t = 10_000;
  const limiter = createSendLimiter({ now: () => t });
  assert.equal(limiter.tryAcquire(), true);
  t += 999;
  assert.equal(limiter.tryAcquire(), false);
  t += 1;
  assert.equal(limiter.tryAcquire(), true);
});

test('時間:相對時間規則', () => {
  const now = new Date(2026, 9, 16, 15, 0, 0).getTime();
  assert.equal(formatMessageTime(now - 30_000, now), '剛剛');
  assert.equal(formatMessageTime(now - 3 * 60_000, now), '3 分鐘前');
  assert.equal(formatMessageTime(now - 59 * 60_000, now), '59 分鐘前');
});

test('時間:滿 1 小時改顯示固定時間', () => {
  const now = new Date(2026, 9, 16, 15, 0, 0).getTime();
  const ts = new Date(2026, 9, 16, 13, 5, 0).getTime();
  assert.equal(formatMessageTime(ts, now), '13:05');
  assert.equal(isTimeFixed(ts, now), true);
  assert.equal(isTimeFixed(now - 10_000, now), false);
});

test('名單:依加入先後排列', () => {
  const sorted = sortMembers([
    { nickname: 'b', joinedAt: 30 },
    { nickname: 'a', joinedAt: 10 },
    { nickname: 'c', joinedAt: 20 },
  ]);
  assert.deepEqual(sorted.map((m) => m.nickname), ['a', 'c', 'b']);
});

test('名單:找出加入與離開的人', () => {
  const prev = [{ nickname: 'a' }, { nickname: 'b' }];
  const next = [{ nickname: 'b' }, { nickname: 'c' }];
  assert.deepEqual(diffMembers(prev, next), { joined: ['c'], left: ['a'] });
});

test('顏色:同一代號永遠同色,且在色盤內', () => {
  assert.equal(colorForNickname('星河'), colorForNickname('星河'));
  assert.ok(NICK_COLORS.includes(colorForNickname('小滿')));
});
