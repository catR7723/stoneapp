const test = require('node:test');
const assert = require('node:assert/strict');
const { HOME_ALERT_SCOPE, privateAlertEvent } = require('../utils/privateAlertScope');
const { normalizePreferences } = require('../utils/circlePreferences');
const { createCircleAlertEngine } = require('../utils/circleAlertEngine');
function fixture() {
  const prefs = { [HOME_ALERT_SCOPE]: normalizePreferences(), circle: normalizePreferences() };
  const sounds = [], timers = new Map(); let id = 0;
  const engine = createCircleAlertEngine({getSettings: scope => prefs[scope], play: kind => sounds.push(kind), schedule: (fn,ms) => {timers.set(++id,{fn,ms});return id;},cancel: key => timers.delete(key)});
  const receive = (sourceCircle, roomId='a_b', messageId='1') => engine.receive(privateAlertEvent({_id:messageId,roomId,sourceCircle}));
  return {prefs,sounds,timers,engine,receive};
}
test('Il messaggio diretto usa le preferenze Home, quello di cerchia conserva la propria origine',()=>{
  assert.equal(privateAlertEvent({roomId:'a_b'}).circleId,HOME_ALERT_SCOPE);
  assert.equal(privateAlertEvent({sourceCircle:{_id:'circle'},roomId:'a_b'}).circleId,'circle');
});
test('Home una volta: un segnale per messaggio diretto, senza timer',()=>{
  const h=fixture();h.prefs[HOME_ALERT_SCOPE].private.mode='once';h.receive(null);h.receive(null,'a_b','2');h.receive(null,'a_b','2');assert.deepEqual(h.sounds,['private','private']);assert.equal(h.timers.size,0);
});
test('L’alert Home non attiva i privati di una cerchia silenziata',()=>{
  const h=fixture();h.prefs.circle.private.mode='off';h.receive({_id:'circle'});assert.equal(h.sounds.length,0);
});
test('Disattivare Home non disattiva i privati abilitati nella cerchia',()=>{
  const h=fixture();h.prefs[HOME_ALERT_SCOPE].private.mode='off';h.receive(null);h.receive({_id:'circle'},'a_b','2');assert.equal(h.sounds.length,1);
});
test('Il promemoria diretto rispetta l’intervallo e si ferma alla lettura',()=>{
  const h=fixture();h.prefs[HOME_ALERT_SCOPE].private={mode:'repeat',intervalSeconds:30};h.receive(null);assert.equal(h.sounds.length,1);const [key,timer]=[...h.timers][0];assert.equal(timer.ms,30000);h.timers.delete(key);timer.fn();assert.equal(h.sounds.length,2);h.engine.clearPrivateRoom('a_b');assert.equal(h.timers.size,0);
});
test('Leggere una chat cancella sia il timer diretto sia quello della cerchia, lasciando gli altri',()=>{
  const h=fixture();h.prefs[HOME_ALERT_SCOPE].private.mode='repeat';h.prefs.circle.private.mode='repeat';h.receive(null);h.receive({_id:'circle'},'a_b','2');h.receive(null,'a_c','3');assert.equal(h.timers.size,3);h.engine.clearPrivateRoom('a_b');assert.equal(h.timers.size,1);
});
