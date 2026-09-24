const ADMIN_ROLES = { COOPERATIVA: 'AMMINISTRATORE', IMPRESA: 'AMMINISTRATORE', GRUPPO: 'AMMINISTRAZIONE', SQUADRA: 'DIRIGENTE', NEGOZIO: 'DIRIGENTE', SCUOLA: 'DIRIGENZA' };
function canChangeCircleLogo(circle, userId) {
  const member = circle?.members?.find(m => m.status === 'ACCEPTED' && String(m.userId?._id || m.userId) === String(userId));
  if (!member) return false;
  return String(circle.adminId?._id || circle.adminId) === String(userId) || member.role === 'AMMINISTRATORE' || member.role === ADMIN_ROLES[circle.type];
}
module.exports = { canChangeCircleLogo };
