import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import CustomCircleEditor from './CustomCircleEditor';

export default function CustomBoards({ circle, currentUser, apiBaseUrl, onRefresh, socket }) {
  const [activeBoard, setActiveBoard] = useState(null);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftRoles, setDraftRoles] = useState([]);
  const [draftBoards, setDraftBoards] = useState([]);
  const [saving, setSaving] = useState(false);
  const member = circle.members.find(item => item.status === 'ACCEPTED' && String(item.userId?._id || item.userId) === String(currentUser._id));
  const owner = String(circle.adminId?._id || circle.adminId) === String(currentUser._id);
  const allowed = (circle.boards || []).filter(board => owner || ['read', 'write'].includes(board.permissions?.[member?.role]));
  const board = allowed.find(item => item.id === activeBoard);
  const canWrite = owner || board?.permissions?.[member?.role] === 'write';
  const load = useCallback(async () => {
    if (!board) { setPosts([]); return; }
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/boards/${board.id}/posts?userId=${currentUser._id}`, { headers: { Authorization: `Bearer ${currentUser.sessionToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Bacheca non disponibile.');
      setPosts(data);
    } catch (error) { Alert.alert('Bacheca', error.message); }
  }, [board?.id, circle._id, currentUser._id, apiBaseUrl]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const changed = event => { if (String(event.circleId) === String(circle._id) && event.boardId === board?.id) load(); };
    socket.on('board_posts_changed', changed);
    return () => socket.off('board_posts_changed', changed);
  }, [board?.id, circle._id, load, socket]);
  const publish = async () => {
    if (!message.trim() || saving || !board) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/boards/${board.id}/posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.sessionToken}` }, body: JSON.stringify({ authorId: currentUser._id, text: message }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Pubblicazione non riuscita.');
      setMessage(''); await load();
    } catch (error) { Alert.alert('Bacheca', error.message); }
    finally { setSaving(false); }
  };
  const openEditor = () => { setDraftRoles(circle.roles.map(({ id, name, canAttachDocuments }) => ({ id, name, canAttachDocuments }))); setDraftBoards(circle.boards.map(({ id, name, permissions }) => ({ id, name, permissions: { ...permissions } }))); setEditing(true); };
  const saveConfig = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.sessionToken}` }, body: JSON.stringify({ userId: currentUser._id, roles: draftRoles, boards: draftBoards }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Modifica non riuscita.');
      setEditing(false); await onRefresh();
    } catch (error) { Alert.alert('Bacheche', error.message); }
    finally { setSaving(false); }
  };
  if (editing) return <ScrollView contentContainerStyle={{ padding: 15 }}>
    <CustomCircleEditor roles={draftRoles} boards={draftBoards} onRolesChange={setDraftRoles} onBoardsChange={setDraftBoards} lockedRoles={circle.members.map(member => member.role)} />
    <TouchableOpacity disabled={saving} onPress={saveConfig} style={{ padding: 15, backgroundColor: '#4F46E5', borderRadius: 10 }}><Text style={{ color: 'white' }}>{saving ? 'Salvataggio…' : 'Salva ruoli e bacheche'}</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => setEditing(false)} style={{ padding: 15 }}><Text>Annulla</Text></TouchableOpacity>
  </ScrollView>;
  return <FlatList data={board ? posts : []} keyExtractor={item => item._id} contentContainerStyle={{ padding: 15 }}
    ListHeaderComponent={<View>
      <Text style={{ fontSize: 17, fontWeight: '700', marginBottom: 8 }}>Bacheche disponibili</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{allowed.map(item => <TouchableOpacity key={item.id} onPress={() => setActiveBoard(item.id)} style={{ padding: 10, margin: 3, borderRadius: 9, backgroundColor: activeBoard === item.id ? '#C7D2FE' : '#E2E8F0' }}><Text>{item.name}</Text></TouchableOpacity>)}</View>
      {!allowed.length && <Text>Non hai bacheche disponibili per il tuo ruolo.</Text>}
      {owner && <TouchableOpacity onPress={openEditor} style={{ paddingVertical: 15 }}><Text style={{ color: '#4F46E5' }}>⚙️ Gestisci ruoli e bacheche</Text></TouchableOpacity>}
      {board && <View style={{ marginVertical: 15 }}><Text style={{ fontSize: 17, fontWeight: '700' }}>{board.name}</Text>
        {canWrite && <><TextInput value={message} onChangeText={setMessage} multiline placeholder="Scrivi sulla bacheca" maxLength={4000} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, marginVertical: 10 }} /><TouchableOpacity disabled={saving || !message.trim()} onPress={publish} style={{ padding: 12, backgroundColor: '#4F46E5', borderRadius: 10 }}><Text style={{ color: '#FFF' }}>Pubblica</Text></TouchableOpacity></>}
      </View>}
    </View>}
    ListEmptyComponent={board && <Text>Nessun messaggio in questa bacheca.</Text>}
    renderItem={({ item }) => <View style={{ padding: 12, marginVertical: 5, borderRadius: 10, backgroundColor: '#FFFFFF' }}><Text style={{ fontWeight: '700' }}>{item.authorName}</Text><Text>{item.text}</Text></View>}
  />;
}
