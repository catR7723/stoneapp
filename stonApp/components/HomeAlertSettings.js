import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AlertOptions } from './CircleSettings';
import { useCircleToolsContext } from '../hooks/useCircleTools';
import { HOME_ALERT_SCOPE } from '../utils/privateAlertScope';

export function HomeAlertSettings({ onBack }) {
  const tools = useCircleToolsContext();
  const [draft, setDraft] = useState(() => tools.get(HOME_ALERT_SCOPE).private);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const interval = Number(draft.intervalSeconds);
    if (draft.mode === 'repeat' && (!Number.isInteger(interval) || interval < 10 || interval > 86400)) {
      return Alert.alert('Intervallo', 'Inserisci un numero intero tra 10 e 86400 secondi.');
    }
    setSaving(true);
    try {
      await tools.save(HOME_ALERT_SCOPE, { ...tools.get(HOME_ALERT_SCOPE), private: draft });
      onBack();
    } catch (error) { Alert.alert('Salvataggio non riuscito', error.message); }
    finally { setSaving(false); }
  };
  return <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, maxHeight: '90%' }}>
    <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Alert delle chat private</Text>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
      <View pointerEvents={saving || !tools.ready ? 'none' : 'auto'}>
        <AlertOptions title="Messaggi privati diretti" value={draft} onChange={setDraft} onPreview={() => tools.preview('private')} />
      </View>
      <Text style={{ color: '#475569', lineHeight: 20 }}>Vale per i messaggi ricevuti dalle chat personali. I messaggi provenienti da una cerchia seguono le impostazioni di quella cerchia.</Text>
      <Text style={{ color: '#475569', lineHeight: 20, marginTop: 10 }}>Aprire la conversazione ferma il promemoria. Gli avvisi funzionano mentre StonApp è aperta, anche se stai guardando un’altra schermata.</Text>
    </ScrollView>
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
      <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={onBack} style={{ padding: 12 }}><Text style={{ color: '#475569' }}>Annulla</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" disabled={saving || !tools.ready} onPress={save} style={{ padding: 12, borderRadius: 10, backgroundColor: '#6366F1', opacity: saving || !tools.ready ? 0.5 : 1 }}><Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{saving ? 'Salvataggio…' : 'Salva'}</Text></TouchableOpacity>
    </View>
  </View>;
}
