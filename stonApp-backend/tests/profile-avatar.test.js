const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProfileAvatar } = require('../profileAvatar');

test('Il profilo conserva le foto da URL e accetta una foto JPEG caricata', () => {
  assert.equal(normalizeProfileAvatar(' https://example.com/avatar.jpg '), 'https://example.com/avatar.jpg');
  const jpeg = Buffer.from([255, 216, 255, 0, 1, 2, 255, 217]);
  const photo = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  assert.equal(normalizeProfileAvatar(photo), photo);
});

test('Il profilo rifiuta dati non JPEG e immagini oltre il limite della richiesta', () => {
  assert.throws(() => normalizeProfileAvatar('data:image/png;base64,aGVsbG8='));
  assert.throws(() => normalizeProfileAvatar('data:image/jpeg;base64,' + 'a'.repeat(200000)));
  assert.throws(() => normalizeProfileAvatar('javascript:alert(1)'));
});
