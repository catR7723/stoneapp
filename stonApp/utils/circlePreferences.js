const DEFAULT_BACKGROUND = '#F8FAFC';
const MODES = ['off', 'once', 'repeat'];
function normalizeAlert(value) {
  const seconds = Number(value?.intervalSeconds);
  return { mode: MODES.includes(value?.mode) ? value.mode : 'once', intervalSeconds: Number.isInteger(seconds) && seconds >= 10 && seconds <= 86400 ? seconds : 60 };
}
function normalizePreferences(value) {
  const background = value?.background;
  const validColor = background?.kind === 'color' && /^#[0-9a-f]{6}$/i.test(background.value);
  const validImage = background?.kind === 'image' && typeof background.value === 'string' && background.value.length < 1500000 && background.value.startsWith('data:image/jpeg;base64,');
  return { group: normalizeAlert(value?.group), private: normalizeAlert(value?.private), board: normalizeAlert(value?.board), document: normalizeAlert(value?.document), background: validColor || validImage ? background : { kind: 'color', value: DEFAULT_BACKGROUND } };
}
function settingsKey(userId) { return `circle-preferences-v1:${userId}`; }
module.exports = { normalizePreferences, normalizeAlert, settingsKey, DEFAULT_BACKGROUND };
