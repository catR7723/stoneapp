const test = require('node:test');
const assert = require('node:assert/strict');
const { createCircleAlertEngine } = require('../utils/circleAlertEngine');
const { normalizePreferences, settingsKey } = require('../utils/circlePreferences');
function harness() {
  let now = 0, id = 0; const timers = new Map(), sounds = [], queued = [];
  const prefs = { A: normalizePreferences(), B: normalizePreferences() };
  const engine = createCircleAlertEngine({
    getSettings: circle => prefs[circle],
    play: (kind, valid) => { sounds.push(kind); queued.push(valid); },
    schedule: (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id; },
    cancel: key => timers.delete(key),
  });
  const tick = ms => {
    const until = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([,t]) => t.at <= until).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = until;
  };
  const receive = (kind = 'group', circleId = 'A', messageId, roomId = 'u1_u2') => engine.receive({ kind, circleId, messageId, roomId });
  return { engine, prefs, sounds, queued, timers, tick, receive };
}
test('Disattivato mantiene zero suoni e zero timer', () => {
  const h=harness();h.prefs.A.group.mode='off';h.receive();h.tick(300000);assert.equal(h.sounds.length,0);assert.equal(h.timers.size,0);
});
test('Una volta suona per ogni messaggio nuovo senza ripetizioni o doppioni', () => {
  const h=harness();h.prefs.A.group.mode='once';h.receive('group','A','1');h.receive('group','A','1');h.receive('group','A','2');h.tick(300000);assert.deepEqual(h.sounds,['group','group']);assert.equal(h.timers.size,0);
});
test('Ripeti rispetta l’intervallo anche se arrivano altri messaggi', () => {
  const h=harness();h.prefs.A.group={mode:'repeat',intervalSeconds:10};h.receive('group','A','1');h.tick(5000);h.receive('group','A','2');h.tick(4999);assert.equal(h.sounds.length,1);h.tick(1);assert.equal(h.sounds.length,2);h.tick(10000);assert.equal(h.sounds.length,3);assert.equal(h.timers.size,1);
});
test('Aprire la chat comune ferma soltanto i suoi avvisi', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.prefs.A.private.mode='repeat';h.receive();h.receive('private');h.engine.clearCircleChat('A');h.tick(60000);assert.deepEqual(h.sounds,['group','private','private']);assert.equal(h.queued[0](),false);
});
test('Leggere una conversazione privata ferma gli avvisi di tutte le sue origini', () => {
  const h=harness();h.prefs.A.private.mode='repeat';h.prefs.B.private.mode='repeat';h.receive('private','A','1');h.receive('private','B','2');h.receive('private','B','3','u1_u3');h.engine.clearPrivateRoom('u1_u2');h.tick(60000);assert.equal(h.sounds.length,4);assert.equal(h.timers.size,1);
});
test('Disattivare cancella subito un timer già attivo e invalida il suono in coda', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.receive();h.prefs.A.group.mode='off';h.engine.configure('A');h.tick(600000);assert.equal(h.sounds.length,1);assert.equal(h.timers.size,0);assert.equal(h.queued[0](),false);
});
test('Cambiare intervallo ricalcola la prossima ripetizione dal salvataggio', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.receive();h.tick(5000);h.prefs.A.group.intervalSeconds=10;h.engine.configure('A');h.tick(9999);assert.equal(h.sounds.length,1);h.tick(1);assert.equal(h.sounds.length,2);
});
test('Una cerchia silenziata non disattiva una cerchia diversa', () => {
  const h=harness();h.prefs.A.group.mode='off';h.receive('group','A','1');h.receive('group','B','2');assert.deepEqual(h.sounds,['group']);
});
test('Lettura, uscita o eliminazione non lasciano timer orfani', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.prefs.A.private.mode='repeat';h.receive();h.receive('private');h.engine.removeCircle('A');h.tick(300000);assert.equal(h.sounds.length,2);assert.equal(h.timers.size,0);assert.ok(h.queued.every(valid=>!valid()));
});
test('Background sospende; il ritorno riprende senza accumulare segnali arretrati', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.receive();h.engine.setActive(false);h.tick(300000);h.receive('group','A','2');assert.equal(h.sounds.length,1);h.engine.setActive(true);h.tick(59999);assert.equal(h.sounds.length,1);h.tick(1);assert.equal(h.sounds.length,2);
});
test('Logout azzera timer, memoria dei messaggi e riproduzioni accodate', () => {
  const h=harness();h.prefs.A.group.mode='repeat';h.receive('group','A','1');h.engine.reset();h.tick(300000);assert.equal(h.sounds.length,1);assert.equal(h.queued[0](),false);h.receive('group','A','1');assert.equal(h.sounds.length,2);
});
test('Le preferenze hanno chiavi diverse per account e recuperano valori sicuri', () => {
  assert.notEqual(settingsKey('gigio1'),settingsKey('gigi4'));
  const p=normalizePreferences({group:{mode:'repeat',intervalSeconds:0},private:{mode:'invalid'},background:{kind:'image',value:'file:///temporary/photo.jpg'}});
  assert.equal(p.group.intervalSeconds,60);assert.equal(p.private.mode,'once');assert.equal(p.board.mode,'once');assert.equal(p.document.mode,'once');assert.equal(p.background.kind,'color');
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(p))),p);
});
test('I quattro tipi partono su una volta e rispettano i silenziamenti salvati', () => {
  const h=harness();h.receive('group','A','g');h.receive('private','A','p');
  h.engine.receive({kind:'board',circleId:'A',boardId:'b',messageId:'b1'});
  h.engine.receive({kind:'document',circleId:'A',messageId:'d1'});
  assert.deepEqual(h.sounds,['group','private','board','document']);assert.equal(h.timers.size,0);
  assert.equal(normalizePreferences({board:{mode:'off'}}).board.mode,'off');
});
test('Leggere una bacheca ferma solo il suo promemoria, non documenti o altre bacheche', () => {
  const h=harness();h.prefs.A.board.mode='repeat';h.prefs.A.document.mode='repeat';
  h.engine.receive({kind:'board',circleId:'A',boardId:'b1',messageId:'p1'});
  h.engine.receive({kind:'board',circleId:'A',boardId:'b2',messageId:'p2'});
  h.engine.receive({kind:'document',circleId:'A',messageId:'d1'});
  assert.equal(h.timers.size,3);h.engine.clearBoard('A','b1');assert.equal(h.timers.size,2);
  h.engine.clearDocuments('A');assert.equal(h.timers.size,1);
  h.tick(60000);assert.deepEqual(h.sounds.slice(3),['board']);
});
