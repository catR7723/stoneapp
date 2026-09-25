const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBoardConfig, boardAccess, canSendDocument } = require('../customBoards');
const { normalizeDocument } = require('../customDocuments');

const ids = ['000000000000000000000001', '000000000000000000000002', '000000000000000000000003', '000000000000000000000004'];
const roles = [{ id: 'admin', name: 'Amministratore', canAttachDocuments: true }, { id: 'atleta', name: 'Atleta', canAttachDocuments: false }, { id: 'famiglia', name: 'Famiglia', canAttachDocuments: true }];
const boards = [{ id: 'famiglie', name: 'Famiglie', permissions: { admin: 'write', atleta: 'read', famiglia: 'write' } }, { id: 'atleti', name: 'Atleti', permissions: { admin: 'write', atleta: 'write', famiglia: 'none' } }];
const circle = { type: 'CUSTOM', adminId: ids[0], roles, boards, members: [
  { userId: ids[0], role: 'admin', status: 'ACCEPTED' },
  { userId: ids[1], role: 'atleta', status: 'ACCEPTED' },
  { userId: ids[2], role: 'famiglia', status: 'ACCEPTED' },
  { userId: ids[3], role: 'famiglia', status: 'PENDING' },
] };

test('Ogni ruolo può leggere o scrivere solo nelle bacheche autorizzate; inviti pendenti esclusi', () => {
  assert.equal(boardAccess(circle, 'famiglie', ids[1]), 'read');
  assert.equal(boardAccess(circle, 'famiglie', ids[2]), 'write');
  assert.equal(boardAccess(circle, 'atleti', ids[2]), 'none');
  assert.equal(boardAccess(circle, 'atleti', ids[0]), 'write');
  assert.equal(boardAccess(circle, 'famiglie', ids[3]), 'none');
  assert.equal(boardAccess(circle, 'inesistente', ids[0]), 'none');
});

test('Documenti solo da ruoli abilitati a membri accettati; nessun invio all’intero ruolo', () => {
  assert.equal(canSendDocument(circle, ids[1], ids[2]), false);
  assert.equal(canSendDocument(circle, ids[2], ids[1]), true);
  assert.equal(canSendDocument(circle, ids[0], ids[1]), true);
  assert.equal(canSendDocument(circle, ids[2], ids[3]), false);
  assert.equal(canSendDocument(circle, ids[3], ids[1]), false);
});

test('Configurazione non può concedere accesso a ruoli inesistenti o rimuovere il controllo amministratore', () => {
  assert.deepEqual(validateBoardConfig(roles, boards).boards[0].permissions, boards[0].permissions);
  assert.throws(() => validateBoardConfig(roles, [{ ...boards[0], permissions: { admin: 'none', atleta: 'write' } }]));
  assert.throws(() => validateBoardConfig(roles, [{ ...boards[0], permissions: { admin: 'write', intruso: 'write' } }]));
  assert.throws(() => validateBoardConfig([roles[0], { ...roles[1], id: 'admin' }], boards));
});

test('Gli allegati rifiutano formati falsificati e file troppo grandi', () => {
  const pdf = Buffer.from('%PDF-1.4\nProva');
  assert.deepEqual(normalizeDocument({ fileName: 'prova.pdf', mimeType: 'application/pdf', base64: pdf.toString('base64') }).fileData, pdf);
  assert.throws(() => normalizeDocument({ fileName: 'falso.pdf', mimeType: 'application/pdf', base64: Buffer.from('falso').toString('base64') }));
  assert.throws(() => normalizeDocument({ fileName: 'prova.pdf', mimeType: 'application/pdf', base64: '%PDF-1.4' }));
});
