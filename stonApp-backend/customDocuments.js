const MIME = new Map([
  ['application/pdf', [0x25, 0x50, 0x44, 0x46]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/png', [0x89, 0x50, 0x4e, 0x47]],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', [0x50, 0x4b, 0x03, 0x04]],
]);
function normalizeDocument({ fileName, mimeType, base64 } = {}) {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 120 || typeof mimeType !== 'string' || !MIME.has(mimeType)) throw new Error('Sono ammessi PDF, JPEG, PNG e DOCX.');
  if (typeof base64 !== 'string' || base64.length > 2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Documento non valido o troppo grande (massimo 2 MB).');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || bytes.toString('base64') !== base64 || !MIME.get(mimeType).every((byte, index) => bytes[index] === byte)) throw new Error('Documento non valido o troppo grande (massimo 2 MB).');
  return { fileName: fileName.trim(), mimeType, fileData: bytes };
}
module.exports = { normalizeDocument };
