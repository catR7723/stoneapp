import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCircleToolsContext } from '../hooks/useCircleTools';
import { normalizePreferences } from '../utils/circlePreferences';
import { canChangeCircleLogo } from '../utils/circlePermissions';
import { CircleLogo, LogoPicker } from './CircleLogo';

const COLORS = [ ['Chiaro', '#F8FAFC'], ['Azzurro', '#E0F2FE'], ['Verde', '#DCFCE7'], ['Lilla', '#EDE9FE'], ['Pesca', '#FFEDD5'], ['Rosa', '#FCE7F3'] ];
function Button({ children, onPress, disabled, selected, danger }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled, selected: !!selected }} disabled={disabled} onPress={onPress} style={[s.button, selected && s.selected, disabled && { opacity: 0.45 }]}><Text style={{ color: danger ? '#B91C1C' : selected ? '#FFFFFF' : '#334155', fontWeight: '600' }}>{children}</Text></TouchableOpacity>;
}
export function AlertOptions({ title, value, onChange, onPreview }) {
  return <View style={s.section}>
    <Text style={s.heading}>{title}</Text>
    <View style={s.row}>{[['off', 'Disattivato'], ['once', 'Una volta'], ['repeat', 'Ripeti']].map(([mode, label]) => <Button key={mode} selected={value.mode === mode} onPress={() => onChange({ ...value, mode })}>{label}</Button>)}</View>
    <Text style={s.help}>{value.mode === 'once' ? 'Un segnale per ogni nuovo messaggio non letto.' : value.mode === 'repeat' ? 'Un segnale all’arrivo, poi a intervalli fino alla lettura.' : 'Il pallino resta visibile, senza suono.'}</Text>
    {value.mode === 'repeat' && <View>
      <Text style={s.help}>Ripeti ogni (secondi, da 10 a 86400):</Text>
      <TextInput accessibilityLabel={`Intervallo ${title}`} keyboardType="number-pad" value={String(value.intervalSeconds)} onChangeText={text => onChange({ ...value, intervalSeconds: text })} style={s.input} />
      <View style={s.row}>{[30, 60, 300].map(seconds => <Button key={seconds} onPress={() => onChange({ ...value, intervalSeconds: seconds })}>{seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`}</Button>)}</View>
    </View>}
    <Button onPress={onPreview}>▶ Ascolta il suono</Button>
  </View>;
}
export function CircleSurface({ circleId, children, style, ...props }) {
  const tools = useCircleToolsContext();
  const background = tools.get(circleId).background;
  return <SafeAreaView {...props} style={[{ flex: 1 }, style, { backgroundColor: background.kind === 'color' ? background.value : '#F8FAFC' }]}>
    {background.kind === 'image' && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={{ uri: background.value }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
    </View>}
    {children}
  </SafeAreaView>;
}
export function CircleSettingsModal({ visible, onClose, circle, currentUser, apiBaseUrl, onRemoved }) {
  const tools = useCircleToolsContext();
  const [draft, setDraft] = useState(normalizePreferences());
  const [busy, setBusy] = useState(false);
  const [removal, setRemoval] = useState(false);
  const [password, setPassword] = useState('');
  const [editingLogo, setEditingLogo] = useState(false);
  const [logoDraft, setLogoDraft] = useState(null);
  const [logoPassword, setLogoPassword] = useState('');
  const canEditLogo = canChangeCircleLogo(circle, currentUser._id);
  const owner = String(circle.adminId?._id || circle.adminId) === String(currentUser._id);
  useEffect(() => {
    if (visible) { setDraft(tools.get(circle._id)); setRemoval(false); setPassword(''); setEditingLogo(false); setLogoPassword(''); }
  }, [visible, circle._id, tools.ready]);
  const openLogoEditor = () => {
    setLogoDraft(tools.circleLogos?.[String(circle._id)] || circle.logo || null);
    setLogoPassword('');
    setEditingLogo(true);
  };
  const saveLogo = async () => {
    if (busy || !logoPassword || !logoDraft) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}/logo`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, password: logoPassword, logo: logoDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Salvataggio non riuscito.');
      tools.onLogoUpdated(data);
      setLogoPassword('');
      setEditingLogo(false);
      Alert.alert('Logo aggiornato', 'Il nuovo logo è visibile a tutti i membri della cerchia.');
    } catch (error) { Alert.alert('Logo', error.message); }
    finally { setBusy(false); }
  };
  const chooseBackground = async () => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize(asset.width >= asset.height ? { width: 960 } : { height: 960 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.65, base64: true });
      if (!image.base64 || image.base64.length > 1400000) throw new Error('Questa immagine è troppo grande: scegli un’altra foto.');
      setDraft(prev => ({ ...prev, background: { kind: 'image', value: `data:image/jpeg;base64,${image.base64}` } }));
    } catch (error) { Alert.alert('Sfondo', error.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    for (const kind of ['group', 'private']) {
      const interval = Number(draft[kind].intervalSeconds);
      if (draft[kind].mode === 'repeat' && (!Number.isInteger(interval) || interval < 10 || interval > 86400)) return Alert.alert('Intervallo', 'Inserisci un numero intero tra 10 e 86400 secondi.');
    }
    setBusy(true);
    try { await tools.save(circle._id, draft); onClose(); }
    catch (error) { Alert.alert('Salvataggio non riuscito', error.message); }
    finally { setBusy(false); }
  };
  const removeCircle = async () => {
    if (!password || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circle._id}${owner ? '' : '/leave'}`, { method: owner ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser._id, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Operazione non riuscita.');
      setPassword('');
      onClose();
      onRemoved(String(circle._id));
    } catch (error) { Alert.alert('Cerchia', error.message); }
    finally { setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={s.overlay}><View style={s.panel}>
      <Text style={s.title}>Impostazioni di {circle.name}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        {editingLogo && canEditLogo ? <View>
          <Text style={s.heading}>Cambia logo della cerchia</Text>
          <Text style={s.help}>Il logo è condiviso con tutti i membri. Scegli un simbolo oppure carica una foto.</Text>
          <CircleLogo logo={logoDraft} type={circle.type} size={72} label="Anteprima del logo" />
          <LogoPicker value={logoDraft} onChange={setLogoDraft} busy={busy} onBusyChange={setBusy} />
          <Text style={s.help}>Per salvare, conferma con la password del tuo account amministratore.</Text>
          <TextInput accessibilityLabel="Password amministratore per cambiare logo" placeholder="Password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={logoPassword} onChangeText={setLogoPassword} style={s.input} />
          <Button selected disabled={busy || !logoPassword || !logoDraft} onPress={saveLogo}>{busy ? 'Attendi…' : 'Salva logo per tutti'}</Button>
          <Button disabled={busy} onPress={() => { setEditingLogo(false); setLogoPassword(''); }}>Annulla</Button>
        </View> : removal ? <View>
          <Text style={s.heading}>{owner ? 'Elimina cerchia' : 'Abbandona cerchia'}</Text>
          <Text style={s.help}>{owner ? 'La cerchia e la sua chat comune saranno eliminate per tutti, insieme a comunicazioni, documenti registrati e turni. Le conversazioni private resteranno. Questa operazione è definitiva.' : 'Uscirai da questa cerchia e non riceverai più i suoi messaggi. Le conversazioni private resteranno.'}</Text>
          <Text style={s.help}>Conferma con la password del tuo account.</Text>
          <TextInput accessibilityLabel="Password di conferma" placeholder="Password" secureTextEntry autoCapitalize="none" autoCorrect={false} value={password} onChangeText={setPassword} style={s.input} />
          <Button danger disabled={busy || !password} onPress={removeCircle}>{busy ? 'Attendi…' : owner ? 'Conferma eliminazione per tutti' : 'Conferma uscita'}</Button>
          <Button disabled={busy} onPress={() => { setRemoval(false); setPassword(''); }}>Annulla</Button>
        </View> : <View pointerEvents={busy || !tools.ready ? 'none' : 'auto'}>
          {canEditLogo && <View style={s.section}>
            <Text style={s.heading}>Logo della cerchia</Text>
            <CircleLogo logo={tools.circleLogos?.[String(circle._id)] || circle.logo} type={circle.type} size={56} label="Logo attuale" />
            <Button onPress={openLogoEditor}>Cambia logo</Button>
          </View>}
          <Text style={s.help}>Preferenze personali, salvate per il tuo account su questo dispositivo.</Text>
          <Text style={s.heading}>Attiva alert</Text>
          <AlertOptions title="Chat della cerchia" value={draft.group} onChange={group => setDraft(prev => ({ ...prev, group }))} onPreview={() => tools.preview('group')} />
          <AlertOptions title="Messaggi privati dalla cerchia" value={draft.private} onChange={value => setDraft(prev => ({ ...prev, private: value }))} onPreview={() => tools.preview('private')} />
          <Text style={s.help}>Gli avvisi suonano mentre StonApp è aperta. Leggere la conversazione ferma le ripetizioni.</Text>
          <View style={s.section}>
            <Text style={s.heading}>Cambia sfondo</Text>
            <View style={s.row}>{COLORS.map(([label, color]) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Sfondo ${label}`} accessibilityState={{ selected: draft.background.value === color }} key={color} onPress={() => setDraft(prev => ({ ...prev, background: { kind: 'color', value: color } }))} style={{ width: 42, height: 42, backgroundColor: color, borderRadius: 21, borderWidth: draft.background.value === color ? 3 : 1, borderColor: draft.background.value === color ? '#6366F1' : '#CBD5E1' }} />)}</View>
            <Button onPress={chooseBackground}>Scegli una foto dalla galleria</Button>
            {draft.background.kind === 'image' && <Image source={{ uri: draft.background.value }} style={{ height: 130, borderRadius: 12, marginTop: 8 }} />}
            <Button onPress={() => setDraft(prev => ({ ...prev, background: normalizePreferences().background }))}>Ripristina sfondo</Button>
          </View>
          <Button danger onPress={() => setRemoval(true)}>{owner ? 'Elimina cerchia' : 'Abbandona cerchia'}</Button>
        </View>}
      </ScrollView>
      {!removal && !editingLogo && <View style={s.row}><Button disabled={busy} onPress={onClose}>Annulla</Button><Button selected disabled={busy || !tools.ready} onPress={save}>{busy ? 'Attendi…' : 'Salva impostazioni'}</Button></View>}
    </View></View>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)', padding: 18 },
  panel: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, maxHeight: '90%' },
  title: { fontSize: 19, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  help: { fontSize: 13, color: '#475569', lineHeight: 19, marginVertical: 8 },
  section: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 5 },
  button: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F1F5F9', marginVertical: 3 },
  selected: { backgroundColor: '#6366F1' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 12, color: '#0F172A', marginVertical: 8 },
});

export function CircleSettingsButton({ circleId, currentUser, apiBaseUrl }) {
  const tools = useCircleToolsContext();
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/circles/${circleId}/${currentUser._id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cerchia non disponibile.');
      tools.syncCircleLogos([data]);
      setCircle(data);
    } catch (error) { Alert.alert('Cerchia', error.message); }
    finally { setLoading(false); }
  };
  return <View>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Impostazioni della cerchia" disabled={loading} onPress={open} style={{ padding: 8 }}><Text style={{ fontSize: 22 }}>{loading ? '…' : '⚙️'}</Text></TouchableOpacity>
    {circle && <CircleSettingsModal visible onClose={() => setCircle(null)} circle={circle} currentUser={currentUser} apiBaseUrl={apiBaseUrl} onRemoved={tools.onRemoved} />}
  </View>;
}
export function CircleUnreadNotice() {
  const tools = useCircleToolsContext();
  const count = Object.keys(tools.unreadCircles || {}).length;
  if (!count) return null;
  return <TouchableOpacity accessibilityRole="button" onPress={tools.openCircles} style={{ backgroundColor: '#DCFCE7', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
    <Text style={{ color: '#166534', fontWeight: '600' }}>Cerchie: {count} {count === 1 ? 'chat da leggere' : 'chat da leggere'}</Text>
  </TouchableOpacity>;
}
