import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import RoleCorner from './RoleCorner';

export default function CustomDocuments({ circle, currentUser, apiBaseUrl, socket, isFocused, onViewed }) {
  const [docs, setDocs] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const member = circle.members.find(item => item.status === 'ACCEPTED' && String(item.userId?._id || item.userId) === String(currentUser._id));
  const owner = String(circle.adminId?._id || circle.adminId) === String(currentUser._id);
  const canSend = owner || !!circle.roles.find(role => role.id === member?.role)?.canAttachDocuments;
  const recipients = circle.members.filter(item => item.status === 'ACCEPTED' && String(item.userId?._id || item.userId) !== String(currentUser._id));
  const missingFields = [!recipientId && 'un destinatario', !title.trim() && 'un titolo', !selectedFile && 'un file'].filter(Boolean);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/documents/${currentUser._id}`, { headers: { Authorization: `Bearer ${currentUser.sessionToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Documenti non disponibili.');
      setDocs(data);
      if (isFocused) onViewed(circle._id);
    } catch (error) { Alert.alert('Documenti', error.message); }
  }, [circle._id, currentUser._id, apiBaseUrl, isFocused, onViewed]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const received = event => { if (String(event.circleId) === String(circle._id)) load(); };
    socket.on('circle_document_received', received);
    return () => socket.off('circle_document_received', received);
  }, [circle._id, load, socket]);
  const pick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.size || asset.size > 2 * 1024 * 1024) throw new Error('Scegli un file fino a 2 MB.');
      setSelectedFile(asset);
    } catch (error) { Alert.alert('Documento', error.message); }
  };
  const send = async () => {
    if (busy) return;
    if (missingFields.length) return Alert.alert('Invia documento', `Manca ${missingFields.join(', ')}.`);
    setBusy(true);
    try {
      const raw = Platform.OS === 'web' ? selectedFile.base64 : await new File(selectedFile.uri).base64();
      const base64 = raw?.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.sessionToken}` }, body: JSON.stringify({ authorId: currentUser._id, targetUserId: recipientId, title: title.trim(), fileName: selectedFile.name, mimeType: selectedFile.mimeType, base64 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invio non riuscito.');
      setTitle(''); setRecipientId(''); setSelectedFile(null);
      Alert.alert('Documenti', 'Documento inviato al destinatario scelto.');
    } catch (error) { Alert.alert('Documenti', error.message); }
    finally { setBusy(false); }
  };
  const openDocument = async documentId => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/documents/${documentId}/access`, { headers: { Authorization: `Bearer ${currentUser.sessionToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Documento non disponibile.');
      await Linking.openURL(`${apiBaseUrl}${data.url}`);
    } catch (error) { Alert.alert('Documento', error.message); }
  };
  return <FlatList data={docs} keyExtractor={item => item._id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 15 }}
    ListHeaderComponent={<View>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>I miei documenti</Text>
      <Text style={{ color: '#64748B', marginBottom: 12 }}>Qui trovi soltanto i documenti indirizzati a te.</Text>
      {canSend && <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700' }}>Invia a un membro</Text>
        <Text style={{ marginVertical: 8 }}>Scegli un solo destinatario:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{recipients.map(item => {
          const id = String(item.userId?._id || item.userId);
          const roleName = circle.roles.find(role => role.id === item.role)?.name || item.role;
          return <TouchableOpacity key={id} accessibilityLabel={`${item.userId?.username || id}, ruolo ${roleName}`} onPress={() => setRecipientId(id)} style={{ padding: 9, paddingRight: 19, margin: 4, borderRadius: 8, overflow: 'hidden', backgroundColor: recipientId === id ? '#C7D2FE' : '#E2E8F0' }}>
            <RoleCorner roles={circle.roles} roleId={item.role} size={15} />
            <Text>{item.userId?.username || id}</Text><Text style={{ fontSize: 11, color: '#475569' }}>{roleName}</Text>
          </TouchableOpacity>;
        })}</View>
        <TextInput placeholder="Titolo documento" value={title} onChangeText={setTitle} maxLength={120} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, marginVertical: 8 }} />
        <TouchableOpacity disabled={busy} onPress={pick} style={{ padding: 10 }}><Text style={{ color: '#4F46E5' }}>📎 {selectedFile?.name || 'Scegli PDF, immagine o DOCX (fino a 2 MB)'}</Text></TouchableOpacity>
        {!!missingFields.length && <Text style={{ color: '#64748B', marginVertical: 7 }}>Per inviare, scegli {missingFields.join(', ')}.</Text>}
        <TouchableOpacity disabled={busy} onPress={send} accessibilityRole="button" style={{ padding: 12, backgroundColor: '#4F46E5', borderRadius: 10 }}><Text style={{ color: '#FFF' }}>{busy ? 'Invio…' : 'Invia documento'}</Text></TouchableOpacity>
      </View>}
    </View>}
    ListEmptyComponent={<Text>Nessun documento ricevuto.</Text>}
    renderItem={({ item }) => {
      const sender = circle.members.find(member => String(member.userId?._id || member.userId) === String(item.authorId));
      const roleName = circle.roles.find(role => role.id === sender?.role)?.name;
      return <TouchableOpacity onPress={() => openDocument(item._id)} style={{ padding: 14, paddingRight: 22, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFF', marginVertical: 5 }}>
        <RoleCorner roles={circle.roles} roleId={sender?.role} />
        <Text style={{ fontWeight: '700' }}>{item.title}</Text><Text>{item.fileName || 'Apri documento'}</Text>
        {sender && <Text style={{ fontSize: 12, color: '#475569' }}>Da {sender.userId?.username || 'membro'}{roleName ? ` · ${roleName}` : ''}</Text>}
      </TouchableOpacity>;
    }}
  />;
}
