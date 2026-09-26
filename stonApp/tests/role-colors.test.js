const test = require('node:test');
const assert = require('node:assert/strict');
const { roleColor, boardRoleId } = require('../utils/roleColors');

test('Ogni ruolo ha un colore distinto, condiviso fra bacheche, membri e documenti', () => {
  const roles = [{ id: 'admin' }, ...Array.from({ length: 29 }, (_, index) => ({ id: `role_${index}` }))];
  const colors = roles.map(role => roleColor(roles, role.id));
  assert.equal(new Set(colors).size, roles.length);
  assert.equal(roleColor([...roles, { id: 'new' }], 'role_3'), colors[4]);
  assert.equal(boardRoleId(roles, 'board_role_3'), 'role_3');
  assert.equal(boardRoleId(roles, 'board_extra'), null);
  assert.equal(roleColor(roles, 'missing'), null);
});
