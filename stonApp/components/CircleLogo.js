import React from 'react';
import { Image, Text, View, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const LOGOS = [
  { id: 'community', symbol: '🤝', label: 'Comunità' },
  { id: 'business', symbol: '🏢', label: 'Impresa' },
  { id: 'group', symbol: '👥', label: 'Gruppo' },
  { id: 'sport', symbol: '⚽', label: 'Squadra' },
  { id: 'shop', symbol: '🛍️', label: 'Negozio' },
  { id: 'school', symbol: '🎓', label: 'Scuola' },
  { id: 'heart', symbol: '💚', label: 'Cuore' },
  { id: 'star', symbol: '⭐', label: 'Stella' },
];
const DEFAULTS = { COOPERATIVA: 'community', IMPRESA: 'business', GRUPPO: 'group', SQUADRA: 'sport', NEGOZIO: 'shop', SCUOLA: 'school' };

export function CircleLogo({ logo, type, size = 42, label = 'Logo della cerchia' }) {
  const fallback = LOGOS.find(item => item.id === (logo?.value || DEFAULTS[type])) || LOGOS[0];
  return <View accessible accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {logo?.kind === 'image'
      ? <Image source={{ uri: logo.value }} style={{ width: size, height: size }} resizeMode="cover" />
      : <Text style={{ fontSize: size * 0.56 }}>{fallback.symbol}</Text>}
  </View>;
}

export function LogoPicker({ value, onChange, busy, onBusyChange }) {
  const pickImage = async () => {
    onBusyChange(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      const side = Math.min(asset.width, asset.height);
      context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
      context.resize({ width: 256, height: 256 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!image.base64 || image.base64.length > 180000) throw new Error('Immagine troppo grande. Scegli un’altra foto.');
      onChange({ kind: 'image', value: `data:image/jpeg;base64,${image.base64}` });
    } catch (error) {
      Alert.alert('Logo', error.message || 'Non riesco ad aprire questa immagine.');
    } finally { onBusyChange(false); }
  };
  return <View style={{ marginVertical: 12 }}>
    <Text style={{ fontWeight: '700', marginBottom: 10 }}>Logo della cerchia</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {LOGOS.map(logo => <TouchableOpacity key={logo.id} disabled={busy} accessibilityRole="button" accessibilityLabel={logo.label} accessibilityState={{ selected: value?.kind === 'preset' && value.value === logo.id }} onPress={() => onChange({ kind: 'preset', value: logo.id })} style={{ padding: 5, borderWidth: 2, borderRadius: 30, borderColor: value?.kind === 'preset' && value.value === logo.id ? '#6366F1' : 'transparent' }}>
        <CircleLogo logo={{ kind: 'preset', value: logo.id }} label={logo.label} />
      </TouchableOpacity>)}
    </View>
    <TouchableOpacity disabled={busy} onPress={pickImage} style={{ paddingVertical: 14 }}>
      <Text style={{ color: '#4F46E5', fontWeight: '600' }}>{busy ? 'Preparazione immagine…' : '📷 Carica un’immagine'}</Text>
    </TouchableOpacity>
    {value?.kind === 'image' && <CircleLogo logo={value} size={64} label="Immagine scelta" />}
  </View>;
}
