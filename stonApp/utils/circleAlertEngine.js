const { normalizeAlert } = require('./circlePreferences');
// Scheduler indipendente dalle schermate: nessun timer viene creato dai menu.
function createCircleAlertEngine({ getSettings, play, schedule = setTimeout, cancel = clearTimeout }) {
  const pending = new Map();
  const seen = new Set();
  let active = true;
  const settings = entry => normalizeAlert(getSettings(entry.circleId)?.[entry.kind]);
  function stop(entry) { if (entry.timer != null) cancel(entry.timer); entry.timer = null; }
  function allowed(entry, mode) { return active && pending.get(entry.key) === entry && settings(entry).mode === mode; }
  function sound(entry, mode) { play(entry.kind, () => allowed(entry, mode)); }
  function arm(entry) {
    stop(entry);
    const config = settings(entry);
    if (!active || config.mode !== 'repeat') return;
    entry.timer = schedule(() => {
      entry.timer = null;
      if (!allowed(entry, 'repeat')) return;
      sound(entry, 'repeat');
      arm(entry);
    }, config.intervalSeconds * 1000);
  }
  function receive({ circleId, kind, roomId, boardId, messageId }) {
    if (!circleId || !['group', 'private', 'board', 'document'].includes(kind) || (kind === 'board' && !boardId)) return;
    if (messageId) {
      const identity = `${kind}:${messageId}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      if (seen.size > 2000) seen.delete(seen.values().next().value);
    }
    const key = `${kind}:${circleId}:${kind === 'private' ? roomId : kind === 'board' ? boardId : ''}`;
    let entry = pending.get(key);
    const fresh = !entry;
    if (!entry) { entry = { key, circleId: String(circleId), kind, roomId, boardId, timer: null }; pending.set(key, entry); }
    const config = settings(entry);
    if (active && (config.mode === 'once' || (config.mode === 'repeat' && fresh))) sound(entry, config.mode);
    if (fresh) arm(entry);
  }
  function removeWhere(predicate) {
    for (const [key, entry] of pending) if (predicate(entry)) { stop(entry); pending.delete(key); }
  }
  return {
    receive,
    clearPrivateRoom: roomId => removeWhere(entry => entry.kind === 'private' && entry.roomId === roomId),
    clearCircleChat: circleId => removeWhere(entry => entry.kind === 'group' && entry.circleId === String(circleId)),
    clearBoard: (circleId, boardId) => removeWhere(entry => entry.kind === 'board' && entry.circleId === String(circleId) && entry.boardId === String(boardId)),
    clearDocuments: circleId => removeWhere(entry => entry.kind === 'document' && entry.circleId === String(circleId)),
    removeCircle: circleId => removeWhere(entry => entry.circleId === String(circleId)),
    configure: circleId => { for (const entry of pending.values()) if (circleId == null || entry.circleId === String(circleId)) arm(entry); },
    setActive(value) { active = value; for (const entry of pending.values()) arm(entry); },
    reset() { removeWhere(() => true); seen.clear(); },
  };
}
module.exports = { createCircleAlertEngine };
