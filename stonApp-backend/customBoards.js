const VALID_ID = /^[a-z][a-z0-9_-]{0,47}$/;
const LEVELS = new Set(['none', 'read', 'write']);
const cleanName = value => typeof value === 'string' ? value.trim() : '';
function validName(value) { return value.length > 0 && value.length <= 60; }

function validateBoardConfig(roles, boards) {
  if (!Array.isArray(roles) || roles.length < 2 || roles.length > 30 || !Array.isArray(boards) || boards.length < 1 || boards.length > 60) throw new Error('Inserisci ruoli e bacheche validi.');
  const roleIds = new Set();
  const roleNames = new Set();
  const savedRoles = roles.map(role => {
    const id = role?.id;
    const name = cleanName(role?.name);
    if (!VALID_ID.test(id) || !validName(name) || roleIds.has(id) || roleNames.has(name.toLocaleLowerCase('it')) || typeof role.canAttachDocuments !== 'boolean') throw new Error('Ruoli non validi o duplicati.');
    roleIds.add(id); roleNames.add(name.toLocaleLowerCase('it'));
    return { id, name, canAttachDocuments: role.canAttachDocuments };
  });
  if (savedRoles[0].id !== 'admin' || savedRoles[0].canAttachDocuments !== true) throw new Error('La cerchia deve avere un ruolo amministratore.');
  const boardIds = new Set();
  const savedBoards = boards.map(board => {
    const id = board?.id;
    const name = cleanName(board?.name);
    if (!VALID_ID.test(id) || !validName(name) || boardIds.has(id) || typeof board.permissions !== 'object' || !board.permissions || Array.isArray(board.permissions)) throw new Error('Bacheche non valide o duplicate.');
    boardIds.add(id);
    if (Object.keys(board.permissions).some(roleId => !roleIds.has(roleId) || !LEVELS.has(board.permissions[roleId]))) throw new Error('Permessi non validi.');
    if (board.permissions.admin !== 'write') throw new Error('L’amministratore deve poter gestire ogni bacheca.');
    return { id, name, permissions: Object.fromEntries(savedRoles.map(role => [role.id, board.permissions[role.id] || 'none'])) };
  });
  return { roles: savedRoles, boards: savedBoards };
}
function membership(circle, userId) {
  return circle?.members?.find(member => String(member.userId?._id || member.userId) === String(userId) && member.status === 'ACCEPTED');
}
function boardAccess(circle, boardId, userId) {
  const member = membership(circle, userId);
  if (!member || circle.type !== 'CUSTOM') return 'none';
  const board = circle.boards.find(item => item.id === boardId);
  if (!board) return 'none';
  if (String(circle.adminId?._id || circle.adminId) === String(userId)) return 'write';
  return board.permissions?.[member.role] || 'none';
}
function canSendDocument(circle, userId, targetUserId) {
  const sender = membership(circle, userId);
  const recipient = membership(circle, targetUserId);
  if (!sender || !recipient || circle.type !== 'CUSTOM') return false;
  return String(circle.adminId?._id || circle.adminId) === String(userId) || !!circle.roles.find(role => role.id === sender.role)?.canAttachDocuments;
}
module.exports = { validateBoardConfig, membership, boardAccess, canSendDocument };
