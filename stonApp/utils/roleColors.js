const COLORS = [
  '#7C3AED', '#D97706', '#0284C7', '#DC2626', '#059669',
  '#BE185D', '#4F46E5', '#A16207', '#0D9488', '#EA580C',
  '#4338CA', '#65A30D', '#C026D3', '#0369A1', '#B45309',
];

function roleColor(roles, roleId) {
  const index = Array.isArray(roles) ? roles.findIndex(role => role.id === roleId) : -1;
  if (index < 0) return null;
  return COLORS[index] || `hsl(${Math.round(((index - COLORS.length) * 137.508 + 20) % 360)}, 73%, 38%)`;
}

function boardRoleId(roles, boardId) {
  return Array.isArray(roles) ? roles.find(role => boardId === `board_${role.id}`)?.id || null : null;
}

module.exports = { roleColor, boardRoleId };
