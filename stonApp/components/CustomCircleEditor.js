import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export const INITIAL_ROLES = [{ id: 'admin', name: 'Amministratore', canAttachDocuments: true }];
export const INITIAL_BOARDS = [{ id: 'admin_board', name: 'Amministrazione', permissions: { admin: 'write' } }];
const identifier = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const choices = [['none', 'Non vede'], ['read', 'Può leggere'], ['write', 'Legge e scrive']];

function Action({ label, onPress, selected, danger }) {
  return <TouchableOpacity onPress={onPress} style={{ padding: 9, borderRadius: 9, margin: 3, backgroundColor: selected ? '#4F46E5' : '#F1F5F9' }}>
    <Text style={{ color: selected ? 'white' : danger ? '#B91C1C' : '#334155' }}>{label}</Text>
  </TouchableOpacity>;
}
export default function CustomCircleEditor({ roles, boards, onRolesChange, onBoardsChange, lockedRoles = [] }) {
  const [roleName, setRoleName] = useState('');
  const [boardName, setBoardName] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const addRole = () => {
    const name = roleName.trim();
    if (!name || name.length > 60 || roles.some(role => role.name.toLowerCase() === name.toLowerCase())) return Alert.alert('Ruolo', 'Inserisci un nome diverso (massimo 60 caratteri).');
    const id = identifier('role');
    onRolesChange([...roles, { id, name, canAttachDocuments: false }]);
    onBoardsChange([...boards, { id: `board_${id}`, name, permissions: { ...Object.fromEntries(roles.map(role => [role.id, 'none'])), admin: 'write', [id]: 'write' } }]);
    setRoleName('');
  };
  const removeRole = role => {
    if (lockedRoles.includes(role.id)) return Alert.alert('Ruolo in uso', 'Rimuovi o cambia prima gli utenti e gli inviti con questo ruolo.');
    onRolesChange(roles.filter(item => item.id !== role.id));
    onBoardsChange(boards.filter(board => board.id !== `board_${role.id}`).map(board => ({ ...board, permissions: Object.fromEntries(Object.entries(board.permissions).filter(([id]) => id !== role.id)) })));
    if (selectedRole === role.id) setSelectedRole(null);
  };
  const addBoard = () => {
    const name = boardName.trim();
    if (!name || name.length > 60) return Alert.alert('Bacheca', 'Inserisci un nome (massimo 60 caratteri).');
    onBoardsChange([...boards, { id: identifier('board'), name, permissions: { ...Object.fromEntries(roles.map(role => [role.id, 'none'])), admin: 'write' } }]);
    setBoardName('');
  };
  const setPermission = (boardId, roleId, permission) => onBoardsChange(boards.map(board => board.id === boardId ? { ...board, permissions: { ...board.permissions, [roleId]: permission } } : board));
  const activeRole = roles.find(role => role.id === selectedRole);
  return <View style={{ paddingVertical: 12 }}>
    <Text style={{ fontSize: 18, fontWeight: '700', marginVertical: 8 }}>Ruoli della cerchia</Text>
    <Text style={{ color: '#64748B', marginBottom: 8 }}>Tu sei l’amministratore. Aggiungi i ruoli dei membri e scegli chi può inviare documenti personali.</Text>
    {roles.map(role => <View key={role.id} style={{ padding: 9, marginBottom: 8, backgroundColor: '#F8FAFC', borderRadius: 10 }}>
      <Text style={{ fontWeight: '700' }}>{role.name}</Text>
      {role.id !== 'admin' && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Action label={role.canAttachDocuments ? '📎 Può inviare documenti' : '📎 Non invia documenti'} onPress={() => onRolesChange(roles.map(item => item.id === role.id ? { ...item, canAttachDocuments: !item.canAttachDocuments } : item))} />
        <Action label="Elimina ruolo" danger onPress={() => removeRole(role)} />
      </View>}
    </View>)}
    <TextInput placeholder="Nuovo ruolo, per esempio Atleta" value={roleName} onChangeText={setRoleName} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12 }} />
    <Action label="+ Aggiungi ruolo e la sua bacheca" onPress={addRole} />
    <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 18 }}>Bacheche</Text>
    <Text style={{ color: '#64748B', marginVertical: 8 }}>Una bacheca nasce per ogni ruolo. Puoi crearne altre e decidere chi le vede.</Text>
    {boards.map(board => <View key={board.id} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      <TextInput value={board.name} onChangeText={name => onBoardsChange(boards.map(item => item.id === board.id ? { ...item, name } : item))} style={{ flexGrow: 1, minWidth: 150, borderBottomWidth: 1, borderColor: '#CBD5E1', padding: 8 }} />
      {boards.length > 1 && <Action label="Elimina" danger onPress={() => Alert.alert('Elimina bacheca', `Eliminare “${board.name}” e tutti i suoi messaggi?`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => onBoardsChange(boards.filter(item => item.id !== board.id)) }])} />}
    </View>)}
    <TextInput placeholder="Nuova bacheca, per esempio Eventi" value={boardName} onChangeText={setBoardName} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, marginTop: 10 }} />
    <Action label="+ Aggiungi bacheca" onPress={addBoard} />
    <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 18 }}>Chi può accedere?</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{roles.filter(role => role.id !== 'admin').map(role => <Action key={role.id} label={role.name} selected={selectedRole === role.id} onPress={() => setSelectedRole(role.id)} />)}</View>
    {activeRole && <View>
      <Text style={{ fontWeight: '700', marginVertical: 10 }}>A quali bacheche può accedere {activeRole.name}?</Text>
      {boards.map(board => <View key={board.id} style={{ paddingVertical: 7, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
        <Text>{board.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{choices.map(([level, label]) => <Action key={level} label={label} selected={(board.permissions?.[activeRole.id] || 'none') === level} onPress={() => setPermission(board.id, activeRole.id, level)} />)}</View>
      </View>)}
    </View>}
  </View>;
}
