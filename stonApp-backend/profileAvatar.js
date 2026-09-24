const { normalizeLogo } = require('./circleLogos');

function normalizeProfileAvatar(value) {
  if (typeof value !== 'string') throw new Error('Foto profilo non valida.');
  const avatar = value.trim();
  if (avatar.startsWith('data:')) {
    try { return normalizeLogo({ kind: 'image', value: avatar }).value; }
    catch { throw new Error('Scegli una foto JPEG più piccola.'); }
  }
  if (avatar.length > 2048 || !/^https?:\/\/[^\s]+$/i.test(avatar)) {
    throw new Error('Inserisci un URL valido oppure scegli una foto dalla galleria.');
  }
  return avatar;
}

module.exports = { normalizeProfileAvatar };
