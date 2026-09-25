import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export default function CustomDocuments({ circle, currentUser, apiBaseUrl, socket }) {
  const [docs, setDocs] = useState([]);
  const [recipientId, setRecipientId] = useState('');
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const member = circle.members.find(item => item.status === 'ACCEPTED' && String(item.userId?._id || item.userId) === String(currentUser._id));
  const owner = String(circle.adminId?._id || circle.adminId) === String(currentUser._id);
  const canSend = owner || !!circle.roles.find(role => role.id === member?.role)?.canAttachDocuments;
  const recipients = circle.members.filter(item => item.status === 'ACCEPTED' && String(item.userId?._id || item.userId) !== String(currentUser._id));
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/documents/${currentUser._id}`, { headers: { Authorization: `Bearer ${currentUser.sessionToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Documenti non disponibili.');
      setDocs(data);
    } catch (error) { Alert.alert('Documenti', error.message); }
  }, [circle._id, currentUser._id, apiBaseUrl]);
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
    if (busy || !selectedFile || !title.trim() || !recipientId) return;
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
  return <FlatList data={docs} keyExtractor={item => item._id} contentContainerStyle={{ padding: 15 }}
    ListHeaderComponent={<View>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>I miei documenti</Text>
      <Text style={{ color: '#64748B', marginBottom: 12 }}>Qui trovi soltanto i documenti indirizzati a te.</Text>
      {canSend && <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', marginBottom: 12 }}>
        <Text style={{ fontWeight: '700' }}>Invia a un membro</Text>
        <Text style={{ marginVertical: 8 }}>Scegli un solo destinatario:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{recipients.map(item => {
          const id = String(item.userId?._id || item.userId);
          return <TouchableOpacity key={id} onPress={() => setRecipientId(id)} style={{ padding: 9, margin: 4, borderRadius: 8, backgroundColor: recipientId === id ? '#C7D2FE' : '#E2E8F0' }}><Text>{item.userId?.username || id}</Text></TouchableOpacity>;
        })}</View>
        <TextInput placeholder="Titolo documento" value={title} onChangeText={setTitle} maxLength={120} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, marginVertical: 8 }} />
        <TouchableOpacity disabled={busy} onPress={pick} style={{ padding: 10 }}><Text style={{ color: '#4F46E5' }}>📎 {selectedFile?.name || 'Scegli PDF, immagine o DOCX (fino a 2 MB)'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy || !selectedFile || !title.trim() || !recipientId} onPress={send} style={{ padding: 12, backgroundColor: '#4F46E5', borderRadius: 10 }}><Text style={{ color: '#FFF' }}>{busy ? 'Invio…' : 'Invia documento'}</Text></TouchableOpacity>
      </View>}
    </View>}
    ListEmptyComponent={<Text>Nessun documento ricevuto.</Text>}
    renderItem={({ item }) => <TouchableOpacity onPress={() => openDocument(item._id)} style={{ padding: 14, borderRadius: 10, backgroundColor: '#FFF', marginVertical: 5 }}><Text style={{ fontWeight: '700' }}>{item.title}</Text><Text>{item.fileName || 'Apri documento'}</Text></TouchableOpacity>}
  />;
}
