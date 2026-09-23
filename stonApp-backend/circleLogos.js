const PRESETS = new Set(['community', 'business', 'group', 'sport', 'shop', 'school', 'heart', 'star']);
const DEFAULTS = { COOPERATIVA: 'community', IMPRESA: 'business', GRUPPO: 'group', SQUADRA: 'sport', NEGOZIO: 'shop', SCUOLA: 'school' };
function normalizeLogo(logo, type) {
  if (logo == null || (!logo.kind && !logo.value)) return { kind: 'preset', value: DEFAULTS[type] || 'community' };
  if (logo.kind === 'preset' && PRESETS.has(logo.value)) return { kind: 'preset', value: logo.value };
  if (logo.kind === 'image' && typeof logo.value === 'string' && logo.value.length <= 180023) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo.value);
    if (match) {
      const bytes = Buffer.from(match[1], 'base64');
      if (bytes.length > 4 && bytes.toString('base64') === match[1] && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) {
        return { kind: 'image', value: logo.value };
      }
    }
  }
  throw new Error('Logo non valido: scegli un simbolo o una foto JPEG più piccola.');
}
module.exports = { normalizeLogo };
