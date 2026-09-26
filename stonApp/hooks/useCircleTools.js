import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { normalizePreferences, settingsKey } from '../utils/circlePreferences';
import { createCircleAlertEngine } from '../utils/circleAlertEngine';

export const CircleToolsContext = createContext(null);
export const useCircleToolsContext = () => useContext(CircleToolsContext);
export function useCircleTools(userId) {
  const groupPlayer = useAudioPlayer(require('../assets/alert-circle.wav'));
  const privatePlayer = useAudioPlayer(require('../assets/alert-private.wav'));
  const boardPlayer = useAudioPlayer(require('../assets/alert-board.wav'));
  const documentPlayer = useAudioPlayer(require('../assets/alert-document.wav'));
  const [store, setStore] = useState({ userId: null, values: {} });
  // Su iPhone currentState può essere null al primo avvio: in quel caso l'app è ancora visibile.
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const current = useRef({ userId, store, foreground, groupPlayer, privatePlayer, boardPlayer, documentPlayer });
  current.current = { userId, store, foreground, groupPlayer, privatePlayer, boardPlayer, documentPlayer };
  const writeQueue = useRef(Promise.resolve());
  const playbackQueue = useRef(Promise.resolve());
  const lastSound = useRef({});
  const engineRef = useRef(null);
  const audioReady = useRef(Promise.resolve());
  const play = useCallback((kind, valid = () => true, preview = false) => {
    const owner = current.current.userId;
    const run = async () => {
      if (!owner || current.current.userId !== owner || (!preview && !current.current.foreground) || !valid()) return;
      if (!preview && Date.now() - (lastSound.current[kind] || 0) < 700) return;
      await audioReady.current;
      const player = { group: current.current.groupPlayer, private: current.current.privatePlayer, board: current.current.boardPlayer, document: current.current.documentPlayer }[kind];
      if (!player.isLoaded) throw new Error('Audio in caricamento: riprova tra un momento.');
      await player.seekTo(0);
      if (current.current.userId !== owner || (!preview && !current.current.foreground) || !valid()) return;
      player.play();
      lastSound.current[kind] = Date.now();
      // Ogni tipo mantiene il suo segnale, anche quando gli eventi arrivano insieme.
      await new Promise(resolve => setTimeout(resolve, 850));
    };
    const job = playbackQueue.current.catch(() => {}).then(run);
    playbackQueue.current = job.catch(error => { if (preview) Alert.alert('Audio', error.message); else console.warn('Avviso audio:', error.message); });
    return playbackQueue.current;
  }, []);
  if (!engineRef.current) engineRef.current = createCircleAlertEngine({
    getSettings: circleId => current.current.store.userId === current.current.userId ? normalizePreferences(current.current.store.values[circleId]) : normalizePreferences(),
    play,
  });
  const engine = engineRef.current;
  useEffect(() => {
    audioReady.current = setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(error => { console.warn('Configurazione audio:', error.message); });
    return () => engine.reset();
  }, [engine]);
  useEffect(() => {
    let cancelled = false;
    engine.reset();
    lastSound.current = {};
    groupPlayer.pause(); privatePlayer.pause(); boardPlayer.pause(); documentPlayer.pause();
    setStore({ userId: null, values: {} });
    if (userId) (async () => {
      const prefix = `${settingsKey(userId)}:`;
      const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
      const rows = keys.length ? await AsyncStorage.multiGet(keys) : [];
      const values = {};
      for (const [key, raw] of rows) values[key.slice(prefix.length)] = normalizePreferences(raw ? JSON.parse(raw) : null);
      if (!cancelled) setStore({ userId, values });
    })().catch(() => { if (!cancelled) { setStore({ userId, values: {} }); Alert.alert('Impostazioni', 'Non riesco a leggere le preferenze della cerchia. Verranno usate quelle predefinite.'); } });
    return () => { cancelled = true; engine.reset(); };
  }, [userId, engine]);
  useEffect(() => {
    engine.setActive(foreground);
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      current.current.foreground = active;
      engine.setActive(active);
      if (!active) { groupPlayer.pause(); privatePlayer.pause(); boardPlayer.pause(); documentPlayer.pause(); }
      setForeground(active);
    });
    return () => subscription.remove();
  }, [engine, groupPlayer, privatePlayer, boardPlayer, documentPlayer, foreground]);
  useEffect(() => {
    if (store.userId === userId && userId) engine.configure();
  }, [store.userId, userId, engine]);
  const update = useCallback((circleId, value) => {
    const owner = current.current.userId;
    const job = writeQueue.current.catch(() => {}).then(async () => {
      if (!owner || current.current.userId !== owner || current.current.store.userId !== owner) throw new Error('Attendi il caricamento delle impostazioni.');
      const values = { ...current.current.store.values };
      if (value == null) delete values[circleId]; else values[circleId] = normalizePreferences(value);
      const key = `${settingsKey(owner)}:${circleId}`;
      if (value == null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, JSON.stringify(values[circleId]));
      if (current.current.userId !== owner) return;
      const next = { userId: owner, values };
      current.current.store = next;
      setStore(next);
      engine.configure(circleId);
    });
    writeQueue.current = job;
    return job;
  }, [engine]);
  return {
    ready: !!userId && store.userId === userId,
    foreground,
    isForeground: () => current.current.foreground,
    get: circleId => normalizePreferences(store.userId === userId ? store.values[circleId] : null),
    save: update,
    remove: circleId => { engine.removeCircle(circleId); return update(circleId, null); },
    preview: kind => play(kind, () => true, true),
    engine,
  };
}
