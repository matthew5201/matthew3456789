// 傳輸介面。UI 與聊天規則只認這組介面,不知道訊息從哪裡來。
// 階段一:transport-mock.js(本地模擬)。階段二:transport-supabase.js,只在 main.js 換掉。
//
// transport.join(nickname) -> Promise<{ members }>
//     成功時回傳目前的線上名單(含自己)。代號已被使用時 reject,error.code === ERR_NICKNAME_TAKEN。
// transport.send(text)     -> Promise<void>   送不出去時 reject。
// transport.leave()        -> void
// transport.on(event, fn)  -> 取消訂閱的函式
//
// 事件:
//   'message'  { id, nickname, text, ts }       包含自己送出的訊息
//   'presence' { members: [{ nickname, joinedAt }] }   名單變動(完整名單)
//   'status'   'connected' | 'reconnecting'

export const ERR_NICKNAME_TAKEN = 'NICKNAME_TAKEN';
export const ERR_NOT_CONNECTED = 'NOT_CONNECTED';

export function transportError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

export function createEmitter() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event).delete(fn);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((fn) => fn(payload));
    },
  };
}
