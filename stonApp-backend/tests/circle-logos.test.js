const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLogo } = require('../circleLogos');
const { participants, registerPrivateMessaging } = require('../privateMessages');
const { addUnreadOrigin } = require('../../stonApp/utils/chatOrigins');
const A = '111111111111111111111111', B = '222222222222222222222222', C = '333333333333333333333333';
const roomId = `${A}_${B}`;
function setup(circle) {
  const handlers = {}, deliveries = [], saved = [];
  const socket = { data: { userId: A }, on: (event, fn) => { handlers[event] = fn; }, emit() {}, join() {} };
  class Message {
    constructor(data) { Object.assign(this, data); this._id = 'message1'; }
    async save() { saved.push(this); }
    toObject() { return { ...this }; }
  }
  let query;
  const Circle = { findOne: async value => { query = value; return circle; } };
  const io = { to: rooms => ({ emit: (event, message) => deliveries.push({ rooms, event, message }) }) };
  registerPrivateMessaging({ socket, io, Circle, Message });
  return { handlers, deliveries, saved, query: () => query };
}
const message = { roomId, senderId: A, text: 'Ciao', senderName: 'Anna', time: '10:30' };
test('Le vecchie cerchie ricevono un logo predefinito coerente con la tipologia', () => {
  assert.deepEqual(normalizeLogo(undefined, 'SCUOLA'), { kind: 'preset', value: 'school' });
  assert.equal(normalizeLogo({}, 'SQUADRA').value, 'sport');
});
test('Il logo accetta JPEG limitati e rifiuta URL, tipi sconosciuti e immagini troppo grandi', () => {
  const value = 'data:image/jpeg;base64,' + Buffer.from([255,216,255,224,0,255,217]).toString('base64');
  assert.equal(normalizeLogo({ kind: 'image', value }).value, value);
  for (const logo of [{ kind: 'image', value: 'https://example.com/logo.jpg' }, { kind: 'preset', value: 'fake' }, { kind: 'image', value: 'data:image/jpeg;base64,' + 'A'.repeat(180004) }, { kind: 'image', value: 'data:image/jpeg;base64,aGVsbG8=' }]) assert.throws(() => normalizeLogo(logo));
});
test('Il primo messaggio raggiunge entrambi gli utenti nelle loro stanze personali', async () => {
  const f = setup(null); let result;
  await f.handlers.send_message(message, value => { result = value; });
  assert.equal(result.ok, true);
  assert.deepEqual(f.deliveries[0].rooms, [`user_${A}`, `user_${B}`]);
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].message.sourceCircle, null);
});
test('Il server usa il logo salvato e richiede due membri accettati', async () => {
  const circle = { _id: C, name: 'Squadra', type: 'SQUADRA', logo: { kind: 'preset', value: 'sport' } };
  const f = setup(circle); let result;
  await f.handlers.send_message({ ...message, sourceCircleId: C, sourceCircle: { name: 'Falso' } }, value => { result = value; });
  assert.equal(result.ok, true);
  assert.equal(f.saved[0].sourceCircleId, C);
  assert.equal(f.saved[0].sourceCircleName, 'Squadra');
  assert.deepEqual(f.query().$and.map(x => x.members.$elemMatch), [{ userId: A, status: 'ACCEPTED' }, { userId: B, status: 'ACCEPTED' }]);
  assert.equal(f.deliveries[0].message.sourceCircle.logo.value, 'sport');
});
test('Una cerchia non condivisa non salva né invia il messaggio', async () => {
  const f = setup(null); let result;
  await f.handlers.send_message({ ...message, sourceCircleId: C }, value => { result = value; });
  assert.equal(result.ok, false); assert.equal(f.saved.length, 0); assert.equal(f.deliveries.length, 0);
});
test('Rifiuta mittente incoerente e stanza non valida', async () => {
  for (const data of [{ ...message, senderId: B }, { ...message, roomId: `${B}_${C}` }, { ...message, roomId: 'circle_123' }]) {
    const f = setup(null); let result;
    await f.handlers.send_message(data, value => { result = value; });
    assert.equal(result.ok, false); assert.equal(f.saved.length, 0);
  }
  assert.deepEqual(participants(`${B}_${A}`), []);
});
test('I loghi di cerchie diverse e la bustina diretta rimangono insieme, senza duplicati', () => {
  const circle1 = { _id: 'one', name: 'Uno' }, circle2 = { _id: 'two', name: 'Due' };
  let state = addUnreadOrigin(null, { sourceCircle: circle1 });
  state = addUnreadOrigin(state, { sourceCircle: circle2 });
  state = addUnreadOrigin(state, { sourceCircle: circle1 });
  state = addUnreadOrigin(state, { sourceCircle: null });
  assert.deepEqual(Object.keys(state), ['one', 'two', 'direct']);
  assert.equal(state.one.name, 'Uno'); assert.equal(state.direct, null);
});
