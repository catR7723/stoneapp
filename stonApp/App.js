import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, 
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, BackHandler, Modal 
} from 'react-native';
import { NavigationContainer, useIsFocused, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { io } from 'socket.io-client';
import { CircleLogo, LogoPicker } from './components/CircleLogo';
import { addUnreadOrigin } from './utils/chatOrigins';
import { privateAlertEvent } from './utils/privateAlertScope';
import { HomeAlertSettings } from './components/HomeAlertSettings';
import { useCircleTools, useCircleToolsContext, CircleToolsContext } from './hooks/useCircleTools';
import { CircleSettingsModal, CircleSettingsButton, CircleSurface, CircleUnreadNotice } from './components/CircleSettings';
import CustomCircleEditor, { INITIAL_ROLES, INITIAL_BOARDS } from './components/CustomCircleEditor';
import CustomBoards from './components/CustomBoards';
import CustomDocuments from './components/CustomDocuments';
//import { Audio } from 'expo-av';//


// In sviluppo usa lo stesso Mac che serve Expo; un URL esplicito può sovrascriverlo.
const expoHost = (Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '').split(':')[0];

//HOME//
//const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (/^(?:\d{1,3}\.){3}\d{1,3}$|^localhost$/.test(expoHost) ? `http://${expoHost}:3001` : 'http://192.168.0.150:3001');//

//QUARTIER//
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (/^(?:\d{1,3}\.){3}\d{1,3}$|^localhost$/.test(expoHost) ? `http://${expoHost}:3001` : 'http://192.168.1.9:3001');




const socket = io(API_BASE_URL, {
  transports: ['websocket'],
  autoConnect: true,
});





// Configurazione ufficiale delle Cerchie: tipologia -> ruoli -> selezioni/permessi.
const CIRCLE_CONFIG = {
  COOPERATIVA: {
    label: 'Cooperativa',
    roles: {
      AMMINISTRATORE: { label: 'Amministratore', selections: [
        ['Messaggi ai soci', true], ['Messaggi a tutti', true], ['Giorni di chiusura', true], ['Turni e orari', true], ['Trasporti', true], ['Documenti', true], ['Menu del giorno e del mese', true]
      ]},
      SOCIO_LAVORATORE: { label: 'Socio lavoratore', selections: [
        ['Messaggi ai soci', true], ['Giorni di chiusura', false], ['Turni e orari', true], ['Trasporti', true], ['Messaggi a tutti', true], ['Documenti', true], ['Menu del giorno e del mese', true], ['Foglio presenze degli utenti', false]
      ]},
      VOLONTARIO: { label: 'Volontario', selections: [['Messaggi a tutti', false], ['Giorni di chiusura', false], ['Orari', false]] },
      SOSTENITORE: { label: 'Sostenitore', selections: [['Messaggi a tutti', false], ['Giorni di chiusura', false], ['Orari', false]] },
      UTENTE: { label: 'Utente', selections: [['Messaggi a tutti', false], ['Giorni di chiusura', false], ['Trasporti', false], ['Menu del giorno', false], ['Documenti personali', true]] }
    }
  },
  IMPRESA: {
    label: 'Impresa',
    roles: {
      AMMINISTRATORE: { label: 'Amministratore', selections: [['Comunicazioni a tutti', true], ['Comunicazioni solo a quadro', true], ['Comunicazioni solo a impiegato', true], ['Comunicazioni a quadro e impiegati', true], ['Documenti specifici per persona', true], ['Giorni di chiusura', true], ['Turni e orari di tutti', true]] },
      QUADRO: { label: 'Quadro', selections: [['Comunicazioni a tutti', true], ['Comunicazione solo ad amministratore', true], ['Comunicazione ad amministratore e impiegato', true], ['Turni e orari di tutti', true], ['Giorni di chiusura', true], ['Documenti da inviare a singola persona', true]] },
      IMPIEGATO: { label: 'Impiegato', selections: [['Comunicazioni con quadro e amministratore', true], ['Turni e orari solo degli impiegati', false], ['Giorni di chiusura', false], ['Comunicazioni a tutti', false], ['Cartella documenti personale', true]] },
      OPERAIO: { label: 'Operaio', selections: [['Comunicazioni con quadro e amministratore', true], ['Turni e orari degli operai', false], ['Giorni di chiusura', false], ['Comunicazioni a tutti', false], ['Cartella documenti personale', true]] },
      SERVIZI: { label: 'Servizi', selections: [['Comunicazioni con quadro e amministratore', true], ['Turni e orari degli operai', false], ['Giorni di chiusura', false], ['Comunicazioni a tutti', false], ['Cartella documenti personale', true]] }
    }
  },
  GRUPPO: {
    label: 'Gruppo', roles: {
      AMMINISTRAZIONE: { label: 'Amministrazione', selections: [['Comunicazioni a tutti', true], ['Comunicazione ai responsabili', true], ['Eventi', true], ['Documenti specifici di ogni utente', true]] },
      RESPONSABILE: { label: 'Responsabile', selections: [['Comunicazione a tutti', true], ['Comunicazione con amministratore e responsabili', true], ['Eventi', true], ['Documenti propri di ogni utente', true]] },
      PARTECIPANTE: { label: 'Partecipante', selections: [['Comunicazione a tutti', false], ['Eventi', false], ['Documenti propri', true]] }
    }
  },
  SQUADRA: {
    label: 'Squadra', roles: {
      DIRIGENTE: { label: 'Dirigente', selections: [['Comunicazioni a tutti', true], ['Comunicazione agli amministratori', true], ['Comunicazioni agli atleti', true], ['Comunicazione alle famiglie', true], ['Orari allenamenti', true], ['Calendario', true], ['Documenti specifici', true], ['Eventi', true]] },
      AMMINISTRATORE: { label: 'Amministratore', selections: [['Comunicazione al dirigente', true], ['Comunicazione al dirigente e agli amministratori', true], ['Comunicazione agli atleti', true], ['Comunicazione a tutti', true], ['Documenti specifici', true], ['Orari allenamenti', true], ['Calendario', true], ['Eventi', true]] },
      ATLETA: { label: 'Atleta', selections: [['Comunicazione con dirigente e amministratori', true], ['Orari allenamenti', false], ['Calendario', false], ['Comunicazione con tutti', false], ['Documenti specifici', true], ['Eventi', true]] },
      GENITORE: { label: 'Genitore', selections: [['Comunicazione con dirigente e amministratori', true], ['Orari allenamenti', false], ['Calendario', false], ['Comunicazione con tutti', false], ['Documenti specifici', true], ['Eventi', true]] },
      SOSTENITORE: { label: 'Sostenitore', selections: [['Comunicazione con dirigente e amministratori', true], ['Calendario', false], ['Comunicazione con tutti', false], ['Eventi', true]] }
    }
  },
  NEGOZIO: {
    label: 'Negozio', roles: {
      CLIENTE: { label: 'Cliente', selections: [['Orari e chiusure', false], ['Promozioni', false], ['Comunicazioni', false], ['Comunicazione con il negozio', true]] },
      RESPONSABILE_VENDITE: { label: 'Responsabile vendite', selections: [['Comunicazione con venditori e dirigente', true], ['Comunicazione con clienti', true], ['Comunicazione specifica con singolo cliente', true], ['Comunicazione solo con dirigente', true], ['Turni e orari', false], ['Documenti specifici del dirigente', true]] },
      VENDITORE: { label: 'Venditore', selections: [['Turni e orari', false], ['Comunicazione con venditori e responsabile', true], ['Documenti specifici del venditore', true]] },
      DIRIGENTE: { label: 'Dirigente', selections: [['Comunicazione con venditori e responsabile', true], ['Comunicazione solo con responsabili', true], ['Comunicazione ai clienti', true], ['Comunicazione a singolo cliente', true], ['Turni e orari', true]] }
    }
  },
  SCUOLA: {
    label: 'Scuola', roles: {
      DIRIGENZA: { label: 'Dirigenza', selections: [['Orari e chiusure', true], ['Orari e turni', true], ['Comunicazioni', true], ['Documenti personali', true], ['La mia classe', true]] },
      GENITORE: { label: 'Genitore', selections: [['Comunicazioni con professori e dirigenza', false], ['Orari e chiusure', false], ['Comunicazioni con tutti', false], ['Comunicazione con la dirigenza', true], ['Comunicazione con i genitori', true], ['Comunicazione studenti e professori', false], ['Documenti del proprio figlio', true], ['La mia classe', true]] },
      STUDENTE: { label: 'Studente', selections: [['Orari e giorni di chiusura', false], ['Comunicazione con dirigenza', true], ['Comunicazione con professori e dirigenza', false], ['Comunicazioni con studenti', true], ['Comunicazione con tutti', false], ['Documenti personali', true], ['La mia classe', true]] },
      PROFESSORE: { label: 'Professore/Professoressa', selections: [['Orari e chiusure', false], ['Turni e orari di lavoro', false], ['Comunicazione con dirigenza', true], ['Comunicazione con dirigenza e professori', true], ['Comunicazioni a tutti', false], ['Comunicazione ai genitori e studenti', true], ['Comunicazione studenti', true], ['La mia classe', true]] },
      MAESTRO: { label: 'Maestro/Maestra', selections: [['Orari e chiusure', false], ['Turni e orari di lavoro', false], ['Comunicazione con dirigenza', true], ['Comunicazione con dirigenza e professori', true], ['Comunicazioni a tutti', false], ['Comunicazione ai genitori e studenti', true], ['Comunicazione studenti', true], ['La mia classe', true]] },
      IMPIEGATO: { label: 'Impiegato', selections: [['Orari e chiusure', true], ['Comunicazioni professori e dirigenza', false], ['Comunicazione dirigenza e impiegati', true], ['Comunicazione a tutti', false], ['Comunicazione a bidelli e dirigenza', true], ['Comunicazione a volontari e dirigenza', true], ['Documenti personali', true], ['La mia classe', true]] },
      BIDELLO: { label: 'Bidello', selections: [['Turni e orari', false], ['Chiusure', false], ['Comunicazione con dirigenza', true], ['Comunicazione tutti', false]] },
      VOLONTARIO: { label: 'Volontario', selections: [['Calendario scolastico', false], ['Comunicazione volontari dirigenza', true], ['Comunicazione volontari', true]] }
    }
  }
};

const CIRCLE_OWNER_ROLE = { COOPERATIVA: 'AMMINISTRATORE', IMPRESA: 'AMMINISTRATORE', GRUPPO: 'AMMINISTRAZIONE', SQUADRA: 'DIRIGENTE', NEGOZIO: 'DIRIGENTE', SCUOLA: 'DIRIGENZA' };
const roleLabel = (type, role) => CIRCLE_CONFIG[type]?.roles?.[role]?.label || role;

const getRoomId = (userId1, userId2) => {
  if (!userId1 || !userId2) return '';
  return [userId1, userId2].sort().join('_');
};

// -------------------------------------------------------------
// SCHERMATA LOGIN
// -------------------------------------------------------------
function LoginScreen({ navigation, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Errore Login', data.error || 'Credenziali errate');
      } else {
        await AsyncStorage.setItem('user', JSON.stringify(data));
        onLoginSuccess(data);
      }
    } catch (err) {
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <Text style={styles.authTitle}>stonApp</Text>
      <Text style={styles.authSubtitle}>Accedi al tuo account</Text>

      <TextInput
        style={styles.authInput}
        placeholder="Email o Username"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.authButton} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authButtonText}>Accedi</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ marginTop: 15 }}>
        <Text style={styles.authLink}>Non hai un account? Registrati</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// SCHERMATA REGISTRAZIONE
// -------------------------------------------------------------
function RegisterScreen({ navigation, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Errore Registrazione', data.error || 'Impossibile registrarsi');
      } else {
        await AsyncStorage.setItem('user', JSON.stringify(data));
        onLoginSuccess(data);
      }
    } catch (err) {
      Alert.alert('Errore', 'Impossibile connettersi al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <Text style={styles.authTitle}>Crea Account</Text>

      <TextInput
        style={styles.authInput}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.authInput}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.authButton} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.authButtonText}>Registrati</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 15 }}>
        <Text style={styles.authLink}>Hai già un account? Accedi</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// SCHERMATA HOME (CHAT + CERCHIE)
// -------------------------------------------------------------
function HomeScreen({
  navigation,
  route,
  currentUser,
  unreadPrivateRooms,
  unreadCircles,
  onDeleteAccount,
  onLogout,
  onUserUpdated
}) {
  const tools = useCircleToolsContext();
  const [activeTab, setActiveTab] = useState('chats');
  const [users, setUsers] = useState([]);
  const [circles, setCircles] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused && route.params?.openTab) {
      setActiveTab(route.params.openTab);
      navigation.setParams({ openTab: null });
    }
  }, [isFocused, route.params?.openTab, navigation]);
  useEffect(() => {
    if (isFocused) { fetchUsersAndCircles(); fetchInvites(); }
  }, [isFocused, currentUser._id]);

  useEffect(() => {

    const onPresence = ({ userId, online }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: online }));
    };
    const onOnlineUsers = (ids) => {
  const map = {};

  (ids || []).forEach(id => {
    map[String(id)] = true;
  });

  setOnlineUsers(map);
};
const onInvitation = (invite) => {
  // L'evento Socket.IO viene trasmesso a tutti.
  // Mostriamo l'invito solo all'utente destinatario.
  if (String(invite.userId) !== String(currentUser._id)) {
    return;
  }

  setInvites(prev => [
    invite,
    ...prev.filter(i => i.circleId !== invite.circleId)
  ]);

  Alert.alert(
    'Nuovo invito',
    `${invite.inviterName} ti ha invitato nella cerchia "${invite.circleName}" come ${invite.roleName || 'membro'}.`
  );
};

  socket.on('presence_update', onPresence);
  socket.on('online_users', onOnlineUsers);
  socket.on('circle_invitation', onInvitation);
  const refreshMemberships = () => { fetchUsersAndCircles(); fetchInvites(); };
  socket.on('connect', refreshMemberships);
  socket.on('circle_removed', refreshMemberships);
  socket.on('circle_members_changed', refreshMemberships);
  const onProfileAvatarUpdated = ({ userId, avatar }) => {
    setUsers(previous => previous.map(user => String(user._id) === String(userId) ? { ...user, avatar } : user));
  };
  socket.on('profile_avatar_updated', onProfileAvatarUpdated);

  socket.emit('get_online_users');
    
return () => {
  socket.off('presence_update', onPresence);
  socket.off('online_users', onOnlineUsers);
  socket.off('circle_invitation', onInvitation);
  socket.off('connect', refreshMemberships);
  socket.off('circle_removed', refreshMemberships);
  socket.off('circle_members_changed', refreshMemberships);
  socket.off('profile_avatar_updated', onProfileAvatarUpdated);
};

  }, [currentUser._id]);

  const fetchUsersAndCircles = async () => {
    setLoading(true);
    try {
      const [resUsers, resCircles] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users/${currentUser._id}`),
        fetch(`${API_BASE_URL}/api/circles/user/${currentUser._id}`)
      ]);
      const dataUsers = await resUsers.json();
      const dataCircles = await resCircles.json();
      setUsers(Array.isArray(dataUsers) ? dataUsers : []);
      setCircles(Array.isArray(dataCircles) ? dataCircles : []);
      if (Array.isArray(dataCircles)) tools.syncCircleLogos(dataCircles);
      // Entra automaticamente nelle stanze di tutte le cerchie
// dell'utente, così riceve i messaggi anche quando è nella Home.
if (Array.isArray(dataCircles)) {
  dataCircles.forEach(circle => {
    socket.emit('join_circle', {
      circleId: circle._id,
      history: false,
      userId: currentUser._id
    });
  });
}
    } catch (err) {
      console.error('Errore nel caricamento:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvites = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/circle-invitations/${currentUser._id}`);
      const data = await res.json();
      if (res.ok) setInvites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Errore inviti:', err);
    }
  };

  const respondInvite = async (invite, accepted) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/circles/${invite.circleId}/${accepted ? 'accept' : 'reject'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operazione non riuscita');
      setInvites(prev => prev.filter(i => i.circleId !== invite.circleId));
      if (accepted) fetchUsersAndCircles();
      Alert.alert('StoneApp', accepted ? 'Invito accettato.' : 'Invito rifiutato.');
    } catch (err) {
      Alert.alert('Errore', err.message);
    }
  };

  return (
    <SafeAreaView style={styles.homeContainer} edges={['bottom']}>
      <View style={styles.userHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={{ uri: currentUser.avatar }} style={{ width: 38, height: 38, borderRadius: 19, marginRight: 10 }} />
              <Text style={styles.userHeaderText}>{currentUser.username}</Text>
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.activeText}>Attivo</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setInviteVisible(true)} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>✉️{invites.length ? ` ${invites.length}` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.gearButton}>
          <Text style={{ fontSize: 22 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
<TouchableOpacity
  style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]}
  onPress={() => setActiveTab('chats')}
>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
      Chat
    </Text>

    {Object.keys(unreadPrivateRooms || {}).length > 0 && (
      <View style={styles.unreadDot} />
    )}
  </View>
</TouchableOpacity>
<TouchableOpacity
  style={[styles.tabButton, activeTab === 'circles' && styles.tabButtonActive]}
  onPress={() => setActiveTab('circles')}
>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Text style={[styles.tabText, activeTab === 'circles' && styles.tabTextActive]}>
      Cerchie ({circles.length})
    </Text>

    {Object.keys(unreadCircles || {}).length > 0 && (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: '#22C55E',
          marginLeft: 6
        }}
      />
    )}
  </View>
</TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} /> : activeTab === 'chats' ? (
          <FlatList
            data={users}
            keyExtractor={item => item._id}
            ListEmptyComponent={<Text style={styles.emptyText}>Nessun contatto presente.</Text>}
renderItem={({ item }) => {
  const roomId = getRoomId(currentUser._id, item._id);
  const hasUnread = unreadPrivateRooms?.[roomId];

  return (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() =>
        navigation.navigate('Chat', { recipient: item, sourceCircle: null })
      }
    >
      <View>
        <Image
          source={{ uri: item.avatar }}
          style={styles.chatAvatar}
        />

        {onlineUsers[item._id] && (
          <View style={styles.avatarOnlineDot} />
        )}
      </View>

      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>
          {item.username}
        </Text>

        <Text style={styles.lastMessage}>
          {onlineUsers[item._id] ? '● Online' : 'Offline'}
        </Text>
      </View>

      {hasUnread && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 110, gap: 5 }}>
          {Object.entries(typeof hasUnread === 'object' ? hasUnread : { direct: null }).map(([key, origin]) => origin ? (
            <TouchableOpacity key={key} accessibilityLabel={`Messaggi da ${origin.name}`} onPress={() => navigation.navigate('Chat', { recipient: item, sourceCircle: origin })}>
              <CircleLogo logo={tools.circleLogos?.[String(origin._id)] || origin.logo} type={origin.type} size={32} label={`Messaggi da ${origin.name}`} />
            </TouchableOpacity>
          ) : <Image key={key} accessibilityLabel="Messaggi diretti" source={require('./assets/bustina-alata.png')} style={{ width: 38, height: 32, resizeMode: 'contain' }} />)}
        </View>
      )}
    </TouchableOpacity>
  );
}}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.createCircleBtn} onPress={() => navigation.navigate('CreateCircle', { onCreated: fetchUsersAndCircles })}>
              <Text style={styles.createCircleBtnText}>+ Crea Nuova Cerchia</Text>
            </TouchableOpacity>
            <FlatList
              data={circles}
              keyExtractor={item => item._id}
              ListEmptyComponent={<Text style={styles.emptyText}>Non fai ancora parte di nessuna Cerchia.</Text>}
              
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.circleCard} onPress={() => navigation.navigate('CircleDetail', { circle: item })}>
                  <View style={styles.circleIcon}><CircleLogo logo={tools.circleLogos?.[String(item._id)] || item.logo} type={item.type} label={item.name} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  <Text style={styles.circleTypeBadges}>{item.type}</Text>
                </View>
                  {unreadCircles?.[String(item._id)] && (
                    <Image
                      source={require('./assets/bustina-alata.png')}
                      style={{
                        width: 34,
                        height: 24,
                        resizeMode: 'contain'
                      }}
                    />
                  )}


                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} currentUser={currentUser} onUserUpdated={onUserUpdated} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />

      <Modal visible={inviteVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Inviti alle Cerchie</Text>
            {invites.length === 0 ? <Text style={styles.emptyText}>Non hai inviti in sospeso.</Text> : invites.map(invite => (
              <View key={invite.circleId} style={styles.inviteCard}>
                <Text style={styles.chatName}>{invite.circleName}</Text>
                <Text style={styles.lastMessage}>{invite.inviterName} ti ha invitato come {invite.roleName || roleLabel(invite.circleType, invite.role)}</Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => respondInvite(invite, false)}><Text style={{ fontWeight: 'bold', color: '#EF4444' }}>Rifiuta</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={() => respondInvite(invite, true)}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>Accetta</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setInviteVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Chiudi</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CreateCircleScreen({ navigation, currentUser }) {
  const [circleName, setCircleName] = useState('');
  const [logo, setLogo] = useState({ kind: 'preset', value: 'community' });
  const [logoBusy, setLogoBusy] = useState(false);
  const [selectedType, setSelectedType] = useState('CUSTOM');
  const [customRoles, setCustomRoles] = useState(INITIAL_ROLES);
  const [customBoards, setCustomBoards] = useState(INITIAL_BOARDS);
  const [users, setUsers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [addVisible, setAddVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = selectedType === 'CUSTOM' ? customRoles.filter(role => role.id !== 'admin').map(role => [role.id, { label: role.name }]) : Object.entries(CIRCLE_CONFIG[selectedType].roles);
  const displayRole = role => selectedType === 'CUSTOM' ? customRoles.find(entry => entry.id === role)?.name || role : roleLabel(selectedType, role);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/users/${currentUser._id}`).then(r => r.json()).then(data => setUsers(Array.isArray(data) ? data : [])).catch(() => {});
  }, [currentUser._id]);

  const openAdd = () => { setSelectedUser(null); setSelectedRole(roles[0]?.[0] || null); setAddVisible(true); };
  const addMember = () => {
    if (!selectedUser || !selectedRole) return Alert.alert('Errore', 'Seleziona utente e ruolo.');
    if (pendingMembers.some(m => m.userId === selectedUser._id)) return Alert.alert('Errore', 'Questo utente è già stato inserito.');
    setPendingMembers(prev => [...prev, { userId: selectedUser._id, username: selectedUser.username, role: selectedRole }]);
    setAddVisible(false);
  };
  const removeMember = (userId) => setPendingMembers(prev => prev.filter(m => m.userId !== userId));

  const handleCreate = async () => {
    if (loading || logoBusy) return;
    if (!circleName.trim()) return Alert.alert('Errore', 'Inserisci un nome per la Cerchia');
    if (selectedType === 'CUSTOM' && customRoles.length < 2) return Alert.alert('Ruoli', 'Aggiungi almeno un ruolo oltre all’amministratore.');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/circles`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(selectedType === 'CUSTOM' ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {}) }, body: JSON.stringify({ name: circleName.trim(), logo, type: selectedType, adminId: currentUser._id, initialMembers: pendingMembers.map(m => ({ userId: m.userId, role: m.role })), ...(selectedType === 'CUSTOM' ? { roles: customRoles, boards: customBoards } : {}) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile creare la Cerchia');
      Alert.alert('StoneApp', pendingMembers.length ? 'Cerchia creata e inviti inviati.' : 'Cerchia creata.');
      navigation.goBack();
    } catch (err) { Alert.alert('Errore', err.message); } finally { setLoading(false); }
  };

  return <SafeAreaView style={styles.homeContainer}>
    <FlatList data={pendingMembers} keyExtractor={item => item.userId} contentContainerStyle={{ padding: 20 }} ListHeaderComponent={<View>
      <Text style={styles.modalTitle}>Crea Nuova Cerchia</Text>
      <TextInput style={styles.authInput} placeholder="Nome Cerchia" value={circleName} onChangeText={setCircleName} />
      <LogoPicker value={logo} onChange={setLogo} busy={logoBusy || loading} onBusyChange={setLogoBusy} />
      <Text style={styles.subSectionTitle}>Tipologia:</Text>
      <View style={styles.typeSelectorRow}>{[['CUSTOM', { label: 'Personalizzata' }], ...Object.entries(CIRCLE_CONFIG)].map(([type, cfg]) => <TouchableOpacity key={type} style={[styles.typeChip, selectedType === type && styles.typeChipActive]} onPress={() => { setSelectedType(type); setPendingMembers([]); }}><Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextActive]}>{cfg.label}</Text></TouchableOpacity>)}</View>
      {selectedType === 'CUSTOM' && <CustomCircleEditor roles={customRoles} boards={customBoards} onRolesChange={setCustomRoles} onBoardsChange={setCustomBoards} lockedRoles={pendingMembers.map(member => member.role)} />}
      <TouchableOpacity style={styles.createCircleBtn} onPress={openAdd}><Text style={styles.createCircleBtnText}>+ Inserisci utente</Text></TouchableOpacity>
      <Text style={styles.subSectionTitle}>Utenti da invitare:</Text>
    </View>} ListEmptyComponent={<Text style={styles.emptyText}>Nessun utente inserito.</Text>} renderItem={({ item }) => <View style={styles.memberRow}><View style={{ flex: 1 }}><Text style={styles.chatName}>{item.username}</Text><Text style={styles.lastMessage}>{displayRole(item.role)}</Text></View><TouchableOpacity onPress={() => removeMember(item.userId)}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Rimuovi</Text></TouchableOpacity></View>} ListFooterComponent={<TouchableOpacity style={styles.confirmBtn} onPress={handleCreate} disabled={loading || logoBusy}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>{loading ? 'Creazione...' : 'CREA CERCHIA'}</Text></TouchableOpacity>} />

    <Modal visible={addVisible} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Inserisci utente</Text><FlatList data={users.filter(u => !pendingMembers.some(m => m.userId === u._id))} keyExtractor={u => u._id} style={{ maxHeight: 260 }} renderItem={({ item }) => <TouchableOpacity style={[styles.selectUserRow, selectedUser?._id === item._id && styles.selectUserActive]} onPress={() => setSelectedUser(item)}><Text style={styles.chatName}>{item.username}</Text></TouchableOpacity>} /><Text style={styles.subSectionTitle}>Ruolo:</Text><View style={styles.typeSelectorRow}>{roles.map(([key, cfg]) => <TouchableOpacity key={key} style={[styles.typeChip, selectedRole === key && styles.typeChipActive]} onPress={() => setSelectedRole(key)}><Text style={[styles.typeChipText, selectedRole === key && styles.typeChipTextActive]}>{cfg.label}</Text></TouchableOpacity>)}</View><View style={styles.modalActions}><TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text></TouchableOpacity><TouchableOpacity style={styles.confirmBtn} onPress={addMember}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>Inserisci</Text></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}

function SettingsModal({ visible, onClose, currentUser, onUserUpdated, onLogout, onDeleteAccount }) {
  const tools = useCircleToolsContext();
  const [alertsVisible, setAlertsVisible] = useState(false);
  useEffect(() => { if (!visible) setAlertsVisible(false); }, [visible]);
  const [editVisible, setEditVisible] = useState(false);
  const [mode, setMode] = useState('name');
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEdit = (m) => { setMode(m); setValue(m === 'name' ? currentUser.username : m === 'email' ? currentUser.email : currentUser.avatar || ''); setPassword(''); setEditVisible(true); };
  const pickProfilePhoto = async () => {
    if (photoBusy || saving) return;
    setPhotoBusy(true);
    try {
      // Il selettore deve aprirsi direttamente dal tocco dell'utente anche sul web.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      if (asset.width && asset.height) {
        const side = Math.min(asset.width, asset.height);
        context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
      }
      context.resize({ width: 256, height: 256 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!image.base64 || image.base64.length > 180000) throw new Error('Foto troppo grande: scegli un’altra immagine.');
      setValue(`data:image/jpeg;base64,${image.base64}`);
    } catch (error) { Alert.alert('Foto profilo', error.message || 'Non riesco a preparare la foto.'); }
    finally { setPhotoBusy(false); }
  };
  const save = async () => {
    if (photoBusy || saving) return;
    setSaving(true);
    try {
      const body = mode === 'password' ? { password: value, currentPassword: password } : mode === 'name' ? { username: value } : mode === 'email' ? { email: value } : { avatar: value };
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Salvataggio non riuscito');
      onUserUpdated(data);
      setEditVisible(false);
      Alert.alert('StoneApp', 'Dati aggiornati.');
    } catch (err) { Alert.alert('Errore', err.message); }
    finally { setSaving(false); }
  };

  if (alertsVisible) return <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setAlertsVisible(false)}>
    <View style={styles.modalOverlay}><HomeAlertSettings onBack={() => setAlertsVisible(false)} /></View>
  </Modal>;

  return <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}><View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Impostazioni</Text>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('name')}><Text>👤 Cambia nome</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('avatar')}><Text>📷 Cambia foto</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('email')}><Text>✉️ Cambia email</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('password')}><Text>🔐 Modifica password</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} disabled={!tools.ready} onPress={() => setAlertsVisible(true)}><Text>🔔 Attiva alert — chat private</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={onLogout}><Text>🚪 Logout</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.settingsRow, { borderColor: '#FECACA' }]} onPress={onDeleteAccount}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>🗑️ Elimina account</Text></TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Chiudi</Text></TouchableOpacity>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{mode === 'name' ? 'Cambia nome' : mode === 'email' ? 'Cambia email' : mode === 'avatar' ? 'Cambia foto' : 'Modifica password'}</Text>
          {mode === 'avatar' && <>
            <TouchableOpacity style={styles.settingsRow} disabled={photoBusy || saving} onPress={pickProfilePhoto}>
              <Text style={{ color: '#4F46E5', fontWeight: '600' }}>{photoBusy ? 'Preparazione foto…' : '📷 Scegli dalla galleria'}</Text>
            </TouchableOpacity>
            {!!value && <Image source={{ uri: value }} style={{ width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginVertical: 10 }} />}
          </>}
          {mode === 'avatar' && value.startsWith('data:image/') ? (
            <TouchableOpacity disabled={saving || photoBusy} onPress={() => setValue('')}>
              <Text style={{ color: '#4F46E5', marginVertical: 8 }}>Foto selezionata · Usa un URL invece</Text>
            </TouchableOpacity>
          ) : (
            <TextInput style={styles.authInput} value={value} onChangeText={setValue} placeholder={mode === 'avatar' ? 'Oppure incolla URL della foto' : mode === 'password' ? 'Nuova password' : ''} secureTextEntry={mode === 'password'} />
          )}
          {mode === 'password' && <TextInput style={styles.authInput} value={password} onChangeText={setPassword} placeholder="Password attuale" secureTextEntry />}
          <View style={styles.modalActions}><TouchableOpacity style={styles.cancelBtn} disabled={saving} onPress={() => setEditVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text></TouchableOpacity><TouchableOpacity style={styles.confirmBtn} disabled={saving || photoBusy} onPress={save}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>{saving ? 'Salvataggio…' : 'Salva'}</Text></TouchableOpacity></View>
        </View></View>
      </Modal>
    </View></View>
  </Modal>;
}

// -------------------------------------------------------------
// SCHERMATA DETTAGLIO CERCHIA
// -------------------------------------------------------------
function CircleDetailScreen({  route,
  navigation,
  currentUser,
  unreadCircles,
  onDeleteAccount,
  onLogout,
  onUserUpdated  }) {
  const tools = useCircleToolsContext();
  const { circle: initialCircle } = route.params;
  const [circle, setCircle] = useState(initialCircle);
  console.log(
  '🔎 CIRCLE DETAIL UNREAD:',
  circle._id,
  unreadCircles
);
  const [tab, setTab] = useState('chat');
  const [onlineUsers, setOnlineUsers] = useState({});
  const [addVisible, setAddVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const acceptedMembers = (circle.members || []).filter(m => m.status === 'ACCEPTED' && m.userId);
  const myMember = acceptedMembers.find(m => String(m.userId?._id || m.userId) === String(currentUser._id));
  const canManageMembers = String(circle.adminId?._id || circle.adminId) === String(currentUser._id) || (circle.type !== 'CUSTOM' && myMember?.role === CIRCLE_OWNER_ROLE[circle.type]);
  const config = CIRCLE_CONFIG[circle.type] || CIRCLE_CONFIG.COOPERATIVA;
  const myRoleConfig = config.roles[myMember?.role];
  const circleRoleLabel = role => circle.type === 'CUSTOM' ? circle.roles?.find(entry => entry.id === role)?.name || role : roleLabel(circle.type, role);

  useEffect(() => {
    const onPresence = ({ userId, online }) => {
      setOnlineUsers(prev => ({
        ...prev,
        [String(userId)]: online
      }));
    };

    const onOnlineUsers = (ids) => {
      const map = {};

      (ids || []).forEach(id => {
        map[String(id)] = true;
      });

      setOnlineUsers(map);
    };

    const onMembersChanged = event => { if (String(event.circleId) === String(circle._id)) refreshCircle(); };
    socket.on('circle_members_changed', onMembersChanged);
    socket.on('presence_update', onPresence);
    socket.on('online_users', onOnlineUsers);

    socket.emit('get_online_users');

    return () => {
      socket.off('circle_members_changed', onMembersChanged);
      socket.off('presence_update', onPresence);
      socket.off('online_users', onOnlineUsers);
    };
  }, []);


  const refreshCircle = async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/circles/${circle._id}/${currentUser._id}`
    );

    if (res.ok) {
      const data = await res.json();
      setCircle(data);
      tools.syncCircleLogos([data]);
    }
  };


  const openAdd = async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/users/${currentUser._id}`
      );

      const data = await res.json();

      const memberIds = new Set(
        (circle.members || []).map(m =>
          String(m.userId?._id || m.userId)
        )
      );

      setUsers(
        (Array.isArray(data) ? data : []).filter(
          u => !memberIds.has(String(u._id))
        )
      );

      setSelectedUser(null);
      setSelectedRole(circle.type === 'CUSTOM' ? circle.roles?.find(entry => entry.id !== 'admin')?.id || null : Object.keys(config.roles)[0] || null);
      setAddVisible(true);

    } catch {
      Alert.alert(
        'Errore',
        'Impossibile caricare gli utenti.'
      );
    }
  };


  const sendInvite = async () => {
    if (!selectedUser || !selectedRole) {
      return Alert.alert(
        'Errore',
        'Seleziona utente e ruolo.'
      );
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/circles/${circle._id}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(circle.type === 'CUSTOM' ? { Authorization: `Bearer ${currentUser.sessionToken}` } : {})
          },
          body: JSON.stringify({
            inviterId: currentUser._id,
            userId: selectedUser._id,
            role: selectedRole
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || 'Invito non inviato'
        );
      }

      setAddVisible(false);

      await refreshCircle();

      Alert.alert(
        'StoneApp',
        'Invito inviato.'
      );

    } catch (err) {
      Alert.alert(
        'Errore',
        err.message
      );
    }
  };


  const chatMembers = acceptedMembers.filter(
    m =>
      String(m.userId?._id || m.userId) !==
      String(currentUser._id)
  );


  return (
    <CircleSurface
      circleId={circle._id}
      style={styles.chatContainer}
      edges={['bottom']}
    >

      <CircleUnreadNotice />
      {/* HEADER CERCHIA */}

      <View style={styles.circleHeaderLarge}>
        <View style={{ marginRight: 12 }}><CircleLogo logo={tools.circleLogos?.[String(circle._id)] || circle.logo} type={circle.type} label={circle.name} /></View>

        <View style={{ flex: 1 }}>

          <Text style={styles.circleTitle}>
            {circle.name}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >

            <Text style={styles.circleUserName}>
              {currentUser.username}
            </Text>

            <View style={styles.onlineDot} />

            <Text style={styles.activeText}>
              Attivo
            </Text>

          </View>

        </View>

        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => setSettingsVisible(true)}
        >
          <Text style={{ fontSize: 22 }}>
            ⚙️
          </Text>
        </TouchableOpacity>

      </View>


      <Text style={styles.circleChatTitle}>
        Chat della cerchia
      </Text>


      {/* TAB CHAT / SELEZIONI */}

      <View style={styles.tabContainer}>

        <TouchableOpacity
          style={[
            styles.tabButton,
            tab === 'chat' && styles.tabButtonActive
          ]}
          onPress={() => setTab('chat')}
        >

          <Text
            style={[
              styles.tabText,
              tab === 'chat' && styles.tabTextActive
            ]}
          >
            Chat
          </Text>

        </TouchableOpacity>


        <TouchableOpacity
          style={[
            styles.tabButton,
            tab === 'selections' && styles.tabButtonActive
          ]}
          onPress={() => setTab('selections')}
        >

          <Text
            style={[
              styles.tabText,
              tab === 'selections' &&
                styles.tabTextActive
            ]}
          >
            Bacheche
          </Text>

        </TouchableOpacity>
        {circle.type === 'CUSTOM' && <TouchableOpacity style={[styles.tabButton, tab === 'documents' && styles.tabButtonActive]} onPress={() => setTab('documents')}><Text style={[styles.tabText, tab === 'documents' && styles.tabTextActive]}>Documenti</Text></TouchableOpacity>}

      </View>


      {/* ============================= */}
      {/* CHAT                           */}
      {/* ============================= */}

      {tab === 'chat' ? (

        <FlatList
          data={chatMembers}

          keyExtractor={item =>
            String(item.userId?._id || item.userId)
          }

          /* CHAT GENERALE DELLA CERCHIA */

          ListHeaderComponent={
            <TouchableOpacity
              style={styles.chatCard}

            onPress={() => {
              navigation.navigate('CircleChat', {
                circle
              });
            }}
            >

<View style={styles.circleIcon}>
  {unreadCircles?.[String(circle._id)] ? (
    <Image
      source={require('./assets/bustina-alata.png')}
      style={{
        width: 42,
        height: 32,
        resizeMode: 'contain'
      }}
    />
  ) : (
    <Text style={{ fontSize: 20 }}>💬</Text>
  )}
</View>

              <View style={styles.chatInfo}>

                <Text style={styles.chatName}>
                  Chat di {circle.name}
                </Text>

                <Text style={styles.lastMessage}>
                  Messaggi della cerchia
                </Text>

              </View>

            </TouchableOpacity>
          }


          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nessun altro membro accettato nella cerchia.
            </Text>
          }


          /* CHAT PRIVATE CON I MEMBRI */

          renderItem={({ item }) => {

            const u = item.userId;
            const id = String(u._id || u);

            return (

              <TouchableOpacity
                style={styles.chatCard}

                onPress={() =>
                  navigation.navigate(
                    'Chat',
                    { recipient: u, sourceCircle: { _id: circle._id, name: circle.name, type: circle.type, logo: circle.logo } }
                  )
                }
              >

                <View>

                  <Image
                    source={{ uri: u.avatar }}
                    style={styles.chatAvatar}
                  />

                  {onlineUsers[id] && (
                    <View
                      style={styles.avatarOnlineDot}
                    />
                  )}

                </View>


                <View style={styles.chatInfo}>

                  <Text style={styles.chatName}>
                    {u.username}
                  </Text>

                  <Text style={styles.lastMessage}>

                    {circleRoleLabel(item.role)}

                    {onlineUsers[id]
                      ? ' • Online'
                      : ' • Offline'}

                  </Text>

                </View>

              </TouchableOpacity>

            );
          }}
        />

      ) : circle.type === 'CUSTOM' && tab === 'documents' ? (
        <CustomDocuments circle={circle} currentUser={currentUser} apiBaseUrl={API_BASE_URL} socket={socket} />
      ) : circle.type === 'CUSTOM' ? (
        <View style={{ flex: 1 }}>
          {canManageMembers && <TouchableOpacity style={styles.addUserBtn} onPress={openAdd}><Text style={styles.createCircleBtnText}>+ Aggiungi utente</Text></TouchableOpacity>}
          <CustomBoards circle={circle} currentUser={currentUser} apiBaseUrl={API_BASE_URL} onRefresh={refreshCircle} socket={socket} />
        </View>
      ) : (

        /* ============================= */
        /* SELEZIONI                     */
        /* ============================= */

        <FlatList
          contentContainerStyle={{
            padding: 15
          }}

          data={
            myRoleConfig?.selections || []
          }

          keyExtractor={([name]) => name}


          ListHeaderComponent={
            <View>

              {myMember && (

                <View
                  style={styles.memberRoleBanner}
                >

                  <Text
                    style={styles.circleRoleText}
                  >
                    Ruolo:{' '}
                    {circleRoleLabel(myMember.role)}
                  </Text>

                </View>

              )}


              {canManageMembers && (

                <TouchableOpacity
                  style={styles.addUserBtn}
                  onPress={openAdd}
                >

                  <Text
                    style={
                      styles.createCircleBtnText
                    }
                  >
                    + Aggiungi utente
                  </Text>

                </TouchableOpacity>

              )}


              <Text
                style={styles.subSectionTitle}
              >
                Funzioni disponibili
              </Text>

            </View>
          }


          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nessuna selezione disponibile
              per questo ruolo.
            </Text>
          }


          renderItem={({ item }) => (

            <TouchableOpacity
              style={styles.selectionCard}
            >

              <View style={{ flex: 1 }}>

                <Text style={styles.chatName}>
                  {item[0]}
                </Text>

                <Text
                  style={styles.lastMessage}
                >
                  {item[1]
                    ? 'Modificabile'
                    : 'Solo lettura'}
                </Text>

              </View>


              <Text style={{ fontSize: 18 }}>
                {item[1] ? '✏️' : '👁️'}
              </Text>

            </TouchableOpacity>

          )}

        />

      )}


      {/* ============================= */}
      {/* MODAL AGGIUNGI UTENTE         */}
      {/* ============================= */}

      <Modal
        visible={addVisible}
        transparent
        animationType="slide"
      >

        <View style={styles.modalOverlay}>

          <View style={styles.modalContent}>

            <Text style={styles.modalTitle}>
              Aggiungi utente
            </Text>


            <FlatList
              data={users}
              keyExtractor={u => u._id}
              style={{ maxHeight: 260 }}

              renderItem={({ item }) => (

                <TouchableOpacity
                  style={[
                    styles.selectUserRow,
                    selectedUser?._id ===
                      item._id &&
                      styles.selectUserActive
                  ]}

                  onPress={() =>
                    setSelectedUser(item)
                  }
                >

                  <Text style={styles.chatName}>
                    {item.username}
                  </Text>

                  {onlineUsers[item._id] && (

                    <Text
                      style={styles.lastMessage}
                    >
                      ● Online
                    </Text>

                  )}

                </TouchableOpacity>

              )}

            />


            <Text
              style={styles.subSectionTitle}
            >
              Ruolo:
            </Text>


            <View
              style={styles.typeSelectorRow}
            >

              {(circle.type === 'CUSTOM' ? (circle.roles || []).filter(role => role.id !== 'admin').map(role => [role.id, { label: role.name }]) : Object.entries(config.roles)).map(([key, cfg]) => (

                <TouchableOpacity
                  key={key}

                  style={[
                    styles.typeChip,
                    selectedRole === key &&
                      styles.typeChipActive
                  ]}

                  onPress={() =>
                    setSelectedRole(key)
                  }
                >

                  <Text
                    style={[
                      styles.typeChipText,
                      selectedRole === key &&
                        styles.typeChipTextActive
                    ]}
                  >
                    {cfg.label}
                  </Text>

                </TouchableOpacity>

              ))}

            </View>


            <View style={styles.modalActions}>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() =>
                  setAddVisible(false)
                }
              >

                <Text
                  style={{
                    fontWeight: 'bold',
                    color: '#64748B'
                  }}
                >
                  Annulla
                </Text>

              </TouchableOpacity>


              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={sendInvite}
              >

                <Text
                  style={{
                    fontWeight: 'bold',
                    color: '#FFF'
                  }}
                >
                  Invia invito
                </Text>

              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>


      {/* IMPOSTAZIONI */}

      <CircleSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        circle={circle}
        currentUser={currentUser}
        apiBaseUrl={API_BASE_URL}
        onRemoved={tools.onRemoved}
      />

    </CircleSurface>
  );
}

// -------------------------------------------------------------
// CHAT SCREEN
// -------------------------------------------------------------
function ChatScreen({
  route,
  currentUser,
  onClearUnread,
  onSetActivePrivateRoom
}) {
  const tools = useCircleToolsContext();
  const { recipient, sourceCircle = null } = route.params;
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);

  const roomId = getRoomId(currentUser._id, recipient._id);
  const isFocused = useIsFocused();

// Tiene traccia della chat privata realmente visibile
useEffect(() => {
  if (isFocused && tools.foreground) {
    console.log('🟢 CHAT PRIVATA ATTIVA:', roomId);
    onSetActivePrivateRoom(roomId);
} else {
  console.log(
    '⚪ CHAT PRIVATA NON ATTIVA:',
    roomId
  );

  onSetActivePrivateRoom(null);
}

  return () => {
    onSetActivePrivateRoom(null);
  };
}, [isFocused, tools.foreground, roomId, onSetActivePrivateRoom]);


// Gestisce i messaggi solo mentre questa chat è visibile
useEffect(() => {
  if (!isFocused || !tools.foreground) return;

  // Quando apro la chat, la considero letta
  onClearUnread(roomId);



  const handleLoadHistory = (history) => {
    setMessages(history);
  };

  const handleReceiveMessage = (newMessage) => {
    if (newMessage.roomId !== roomId) return;

    setMessages(prev => prev.some(message => message._id === newMessage._id) ? prev : [...prev, newMessage]);
  };

  socket.on('load_history', handleLoadHistory);
  socket.on('receive_message', handleReceiveMessage);
  const requestHistory = () => {
    socket.emit('set_online', { userId: currentUser._id });
    socket.emit('join_room', roomId);
  };
  socket.on('connect', requestHistory);
  requestHistory();

  return () => {
    console.log('🔴 CHIUDO CHAT PRIVATA:', roomId);

    socket.off('connect', requestHistory);
    socket.off('load_history', handleLoadHistory);
    socket.off('receive_message', handleReceiveMessage);
  };
}, [isFocused, tools.foreground, roomId, onClearUnread]);




  const sendMessage = () => {
    if (sending || inputText.trim().length === 0) return;
    if (!socket.connected) return Alert.alert('Connessione', 'Attendi la riconnessione prima di inviare.');
    const messageData = {
      roomId,
      sourceCircleId: sourceCircle?._id || null,
      text: inputText,
      senderId: currentUser._id,
      senderName: currentUser.username,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSending(true);
    socket.timeout(10000).emit('send_message', messageData, (error, result) => {
      setSending(false);
      if (error || !result?.ok) return Alert.alert('Invio', result?.error || 'Conferma non ricevuta: controlla la chat prima di riprovare.');
      setInputText(previous => previous === messageData.text ? '' : previous);
    });
  };

  return (
    <CircleSurface circleId={sourceCircle?._id} style={styles.chatContainer} edges={['bottom']}>
      <CircleUnreadNotice />
      {sourceCircle && <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, backgroundColor: '#EEF2FF' }}>
        <CircleLogo logo={tools.circleLogos?.[String(sourceCircle._id)] || sourceCircle.logo} type={sourceCircle.type} size={28} />
        <Text style={{ flex: 1 }}>Messaggio privato da {sourceCircle.name}</Text>
        <CircleSettingsButton circleId={sourceCircle._id} currentUser={currentUser} apiBaseUrl={API_BASE_URL} />
      </View>}
      <FlatList
        data={messages}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item }) => {
          const isMyMessage = item.senderId === currentUser._id;
          return (
            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
              {!!item.sourceCircleName && <Text style={{ fontSize: 11, marginBottom: 4, color: isMyMessage ? '#E0E7FF' : '#4F46E5' }}>{item.sourceCircleName}</Text>}
              <Text style={[styles.messageText, isMyMessage && { color: '#FFFFFF' }]}>{item.text}</Text>
              <Text style={[styles.messageTime, isMyMessage && { color: '#E0E7FF' }]}>{item.time}</Text>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 15 }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Scrivi..."
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
            <Text style={styles.sendButtonText}>{sending ? 'Invio…' : 'Invia'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </CircleSurface>
  );
}

function CircleChatScreen({
  route,
  currentUser,
  onClearCircleUnread,
  onSetActiveCircle
}) {
  const tools = useCircleToolsContext();
  const { circle } = route.params;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const isFocused = useIsFocused();
  const circleId = String(circle._id);

  useEffect(() => {
    if (!isFocused || !tools.foreground) {
      onSetActiveCircle(null);
      return;
    }

    // Questa è la cerchia attualmente aperta
    onSetActiveCircle(circleId);

    // Aprendo la chat della cerchia, i messaggi diventano letti
    if (onClearCircleUnread) {
      onClearCircleUnread(circleId);
    }

    const handleCircleHistory = (payload) => {
      if (String(payload.circleId) === circleId) setMessages(payload.messages);
    };

    const handleCircleMessage = (newMessage) => {
      // Accettiamo soltanto messaggi di questa cerchia
      if (newMessage.roomId !== `circle_${circleId}`) {
        return;
      }

      setMessages(prev => prev.some(message => message._id === newMessage._id) ? prev : [...prev, newMessage]);
    };

    socket.on('circle_history', handleCircleHistory);
    socket.on('circle_message', handleCircleMessage);
    const requestHistory = () => {
      socket.emit('set_online', { userId: currentUser._id });
      socket.emit('join_circle', { circleId, userId: currentUser._id });
    };
    socket.on('connect', requestHistory);
    requestHistory();

    return () => {
      socket.off('connect', requestHistory);
      socket.off('circle_history', handleCircleHistory);
      socket.off('circle_message', handleCircleMessage);

      onSetActiveCircle(null);
    };
  }, [
    isFocused,
    tools.foreground,
    circleId,
    currentUser._id,
    onClearCircleUnread,
    onSetActiveCircle
  ]);


  const sendMessage = () => {
    if (inputText.trim().length === 0) return;

    const messageData = {
      circleId,
      text: inputText.trim(),
      senderId: currentUser._id,
      senderName: currentUser.username,
      time: new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )
    };

    socket.emit(
      'send_circle_message',
      messageData
    );

    setInputText('');
  };


  return (
    <CircleSurface
      circleId={circleId}
      style={styles.chatContainer}
      edges={['bottom']}
    >
      <CircleUnreadNotice />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.9)' }}>
        <Text style={{ flex: 1, fontWeight: '600' }}>{circle.name}</Text>
        <CircleSettingsButton circleId={circleId} currentUser={currentUser} apiBaseUrl={API_BASE_URL} />
      </View>

      <FlatList
        data={messages}

        keyExtractor={(item, index) =>
          item._id || index.toString()
        }

        renderItem={({ item }) => {
          const isMyMessage =
            String(item.senderId) ===
            String(currentUser._id);

          return (
            <View
              style={[
                styles.messageBubble,
                isMyMessage
                  ? styles.myMessage
                  : styles.otherMessage
              ]}
            >

              {/* Nella chat di gruppo mostriamo
                  chi ha scritto */}

              {!isMyMessage && (
                <Text
                  style={{
                    fontWeight: 'bold',
                    marginBottom: 3
                  }}
                >
                  {item.senderName}
                </Text>
              )}

              <Text
                style={[
                  styles.messageText,
                  isMyMessage && {
                    color: '#FFFFFF'
                  }
                ]}
              >
                {item.text}
              </Text>

              <Text
                style={[
                  styles.messageTime,
                  isMyMessage && {
                    color: '#E0E7FF'
                  }
                ]}
              >
                {item.time}
              </Text>

            </View>
          );
        }}

        contentContainerStyle={{
          padding: 15
        }}
      />


      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        keyboardVerticalOffset={90}
      >

        <View style={styles.inputContainer}>

          <TextInput
            style={styles.textInput}
            placeholder={`Scrivi a ${circle.name}...`}
            value={inputText}
            onChangeText={setInputText}
          />

          <TouchableOpacity
            style={styles.sendButton}
            onPress={sendMessage}
          >
            <Text style={styles.sendButtonText}>
              Invia
            </Text>
          </TouchableOpacity>

        </View>

      </KeyboardAvoidingView>

    </CircleSurface>
  );
}

// -------------------------------------------------------------
// MAIN NAVIGATION
// -------------------------------------------------------------
const Stack = createNativeStackNavigator();

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const circleTools = useCircleTools(currentUser?._id);
  const toolsRef = useRef(circleTools);
  toolsRef.current = circleTools;
  const navigationRef = useNavigationContainerRef();
  const [unreadPrivateRooms, setUnreadPrivateRooms] = useState({});
  const [unreadCircles, setUnreadCircles] = useState({});
  const [circleLogos, setCircleLogos] = useState({});
  const syncCircleLogos = useCallback(circles => {
    setCircleLogos(prev => {
      const next = { ...prev };
      for (const circle of circles) next[String(circle._id)] = circle.logo || null;
      return next;
    });
  }, []);
  const handleLogoUpdated = useCallback(({ circleId, logo }) => {
    setCircleLogos(prev => ({ ...prev, [String(circleId)]: logo }));
    setUnreadPrivateRooms(prev => {
      const next = { ...prev };
      for (const [roomId, origins] of Object.entries(prev)) {
        if (origins[circleId]) next[roomId] = { ...origins, [circleId]: { ...origins[circleId], logo } };
      }
      return next;
    });
  }, []);

  const activePrivateRoom = useRef(null);
  const activeCircle = useRef(null);
  const engine = circleTools.engine;

  const clearUnreadPrivateRoom = useCallback(roomId => {
    engine.clearPrivateRoom(roomId);
    setUnreadPrivateRooms(prev => {
      if (!prev[roomId]) return prev;
      const next = { ...prev }; delete next[roomId]; return next;
    });
  }, [engine]);
  const clearUnreadCircle = useCallback(circleId => {
    engine.clearCircleChat(circleId);
    setUnreadCircles(prev => {
      if (!prev[circleId]) return prev;
      const next = { ...prev }; delete next[circleId]; return next;
    });
  }, [engine]);
  const setActivePrivateRoomId = useCallback(roomId => {
    activePrivateRoom.current = roomId;
    if (roomId) clearUnreadPrivateRoom(roomId);
  }, [clearUnreadPrivateRoom]);
  const setActiveCircleId = useCallback(circleId => {
    activeCircle.current = circleId;
    if (circleId) clearUnreadCircle(circleId);
  }, [clearUnreadCircle]);
  const handleCircleRemoved = useCallback(circleId => {
    engine.removeCircle(circleId);
    clearUnreadCircle(circleId);
    setUnreadPrivateRooms(prev => {
      const next = {};
      for (const [roomId, origins] of Object.entries(prev)) {
        const remaining = { ...origins }; delete remaining[circleId];
        if (Object.keys(remaining).length) next[roomId] = remaining;
      }
      return next;
    });
    toolsRef.current.remove(circleId).catch(error => console.warn('Preferenze cerchia:', error.message));
    const route = navigationRef.getCurrentRoute();
    const openId = route?.params?.circle?._id || route?.params?.sourceCircle?._id;
    if (String(openId) === String(circleId)) navigationRef.reset({ index: 0, routes: [{ name: 'Home', params: { openTab: 'circles' } }] });
  }, [engine, clearUnreadCircle, navigationRef]);

  useEffect(() => {
    setUnreadPrivateRooms({}); setUnreadCircles({}); setCircleLogos({});
    activePrivateRoom.current = null; activeCircle.current = null;
    engine.reset();
  }, [currentUser?._id, engine]);

  useEffect(() => {
    if (!currentUser?._id) return;
    const onPrivate = message => {
      if (String(message.senderId) === String(currentUser._id)) return;
      if (toolsRef.current.isForeground() && message.roomId === activePrivateRoom.current) return;
      setUnreadPrivateRooms(prev => ({ ...prev, [message.roomId]: addUnreadOrigin(prev[message.roomId], message) }));
      engine.receive(privateAlertEvent(message));
    };
    const onGroup = message => {
      if (String(message.senderId) === String(currentUser._id) || !String(message.roomId).startsWith('circle_')) return;
      const circleId = String(message.roomId).slice(7);
      if (!circleId || (toolsRef.current.isForeground() && circleId === activeCircle.current)) return;
      setUnreadCircles(prev => ({ ...prev, [circleId]: true }));
      engine.receive({ kind: 'group', circleId, messageId: message._id });
    };
    const onRemoved = event => handleCircleRemoved(String(event.circleId));
    const announceOnline = () => socket.emit('set_online', { userId: currentUser._id });
    socket.on('receive_message', onPrivate);
    socket.on('circle_message', onGroup);
    socket.on('circle_removed', onRemoved);
    socket.on('circle_logo_updated', handleLogoUpdated);
    socket.on('connect', announceOnline);
    if (socket.connected) announceOnline();
    return () => {
      socket.off('receive_message', onPrivate);
      socket.off('circle_message', onGroup);
      socket.off('circle_removed', onRemoved);
      socket.off('circle_logo_updated', handleLogoUpdated);
      socket.off('connect', announceOnline);
    };
  }, [currentUser?._id, engine, handleCircleRemoved, handleLogoUpdated]);

 const checkSavedUser = async () => {
  try {
    const savedUser = await AsyncStorage.getItem('user');

    if (!savedUser) {
      setCurrentUser(null);
      return;
    }

    const user = JSON.parse(savedUser);
    if (!user.sessionToken) {
      await AsyncStorage.removeItem('user');
      setCurrentUser(null);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/user/${user._id}`);

    if (response.ok) {
      const userFromServer = await response.json();

      const refreshed = { ...userFromServer, sessionToken: user.sessionToken };
      await AsyncStorage.setItem('user', JSON.stringify(refreshed));

      setCurrentUser(refreshed);
    } else {
      console.log('Utente locale non presente nel database.');

      await AsyncStorage.removeItem('user');
      setCurrentUser(null);
    }
  } catch (error) {
    console.error('Errore nel controllo dell’utente:', error);

    await AsyncStorage.removeItem('user');
    setCurrentUser(null);
  } finally {
    setLoadingAuth(false);
  }
};

useEffect(() => {
  checkSavedUser();
}, []);



const handleLogout = async () => {
  try {
    if (currentUser?._id) socket.emit('set_offline', { userId: currentUser._id });
    await AsyncStorage.removeItem('user');
    setCurrentUser(null);
  } catch (err) {
    console.error('Errore durante il logout:', err);
    Alert.alert('Errore', 'Impossibile effettuare il logout.');
  }
};

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`, { method: 'DELETE' });
      if (res.ok) {
        await AsyncStorage.removeItem('user');
        setCurrentUser(null);
        Alert.alert('Account Eliminato', 'I tuoi dati sono stati rimossi da MongoDB.');
      } else {
        Alert.alert('Errore', 'Impossibile eliminare l\'account.');
      }
    } catch (err) {
      Alert.alert('Errore', 'Errore di connessione.');
    }
  };

  if (loadingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <CircleToolsContext.Provider value={{ ...circleTools, circleLogos, syncCircleLogos, onLogoUpdated: handleLogoUpdated, unreadCircles, onRemoved: handleCircleRemoved, openCircles: () => navigationRef.navigate('Home', { openTab: 'circles' }) }}>
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#FFFFFF' }}>
          {currentUser ? (
            <>
              <Stack.Screen name="Home" options={{ headerShown: false }}>
                {(props) => (
                 <HomeScreen
                    {...props}
                    currentUser={currentUser}
                    unreadPrivateRooms={unreadPrivateRooms}
                    onDeleteAccount={handleDeleteAccount}
                    unreadCircles={unreadCircles}
                    onLogout={handleLogout}
                    onUserUpdated={async (u) => {
                      const updated = { ...u, sessionToken: currentUser.sessionToken };
                      await AsyncStorage.setItem('user', JSON.stringify(updated));
                      setCurrentUser(updated);
                    }}
                  />
                  )}
              </Stack.Screen>
              <Stack.Screen name="CreateCircle" options={{ title: 'Nuova Cerchia' }}>
                {(props) => <CreateCircleScreen {...props} currentUser={currentUser} />}
              </Stack.Screen>
              <Stack.Screen
                name="Chat"
                options={({ route }) => ({
                  title: route.params?.recipient.username
                })}
              >
                {(props) => (
                  <ChatScreen
                    {...props}
                    currentUser={currentUser}
                    onClearUnread={clearUnreadPrivateRoom}
                    onSetActivePrivateRoom={setActivePrivateRoomId}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen
                name="CircleChat"
                options={({ route }) => ({
                  title: `Chat di ${route.params?.circle?.name || 'Cerchia'}`
                })}
              >
                {(props) => (
                  <CircleChatScreen
                    {...props}
                    currentUser={currentUser}
                    onClearCircleUnread={clearUnreadCircle}
                    onSetActiveCircle={setActiveCircleId}
                  />
                )}
              </Stack.Screen>

              <Stack.Screen name="CircleDetail" options={({ route }) => ({ title: route.params?.circle.name })}>
                {(props) => (
  <CircleDetailScreen
    {...props}
    currentUser={currentUser}
    unreadCircles={unreadCircles}
    onDeleteAccount={handleDeleteAccount}
    onLogout={handleLogout}
    onUserUpdated={async (u) => {
      const updated = { ...u, sessionToken: currentUser.sessionToken };
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      setCurrentUser(updated);
    }}
  />
)}
              </Stack.Screen>
            </>
          ) : (
            <>
              <Stack.Screen name="Login" options={{ headerShown: false }}>
                {(props) => <LoginScreen {...props} onLoginSuccess={setCurrentUser} />}
              </Stack.Screen>
              <Stack.Screen name="Register" options={{ title: 'Registrazione' }}>
                {(props) => <RegisterScreen {...props} onLoginSuccess={setCurrentUser} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </CircleToolsContext.Provider>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 25, backgroundColor: '#F8FAFC' },
  authTitle: { fontSize: 32, fontWeight: 'bold', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  authSubtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 25 },
  authInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 15 },
  authButton: { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  authButtonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  authLink: { color: '#6366F1', textAlign: 'center', fontWeight: '600' },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10 },
  userHeaderText: { fontSize: 17, fontWeight: 'bold', color: '#0F172A' },
  closeBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  closeBadgeText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  deleteBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteBadgeText: { color: '#EF4444', fontWeight: '700', fontSize: 12 },
  homeContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 15, marginVertical: 10 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#E2E8F0' },
  tabButtonActive: { borderBottomColor: '#6366F1' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#6366F1', fontWeight: 'bold' },
  unreadDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#22C55E',
  marginLeft: 6,
},
  chatCard: { flexDirection: 'row', padding: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  chatAvatar: { width: 50, height: 50, borderRadius: 25 },
  chatInfo: { flex: 1, marginLeft: 15 },
  chatName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  lastMessage: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#94A3B8' },
  createCircleBtn: { backgroundColor: '#6366F1', marginHorizontal: 15, marginVertical: 10, padding: 14, borderRadius: 12, alignItems: 'center' },
  createCircleBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  circleCard: { flexDirection: 'row', padding: 15, backgroundColor: '#FFFFFF', marginHorizontal: 15, marginBottom: 10, borderRadius: 12, alignItems: 'center', elevation: 1 },
  circleIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  circleTypeBadges: { fontSize: 12, color: '#6366F1', fontWeight: '600', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F172A', marginBottom: 15, textAlign: 'center' },
  subSectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 10, marginBottom: 8 },
  typeSelectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F1F5F9' },
  typeChipActive: { backgroundColor: '#6366F1' },
  typeChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  typeChipTextActive: { color: '#FFF' },
  userRoleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  roleMiniBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, backgroundColor: '#E2E8F0' },
  roleMiniBadgeActive: { backgroundColor: '#6366F1' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { padding: 10 },
  confirmBtn: { backgroundColor: '#6366F1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  chatContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#10B981', marginLeft: 6 },
  avatarOnlineDot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFF' },
  avatarOnlineDotSmall: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#10B981', marginLeft: 8 },
  activeText: { fontSize: 11, color: '#10B981', fontWeight: '600', marginLeft: 4 },
  gearButton: { padding: 7, marginLeft: 8 },
  iconButton: { padding: 7, marginRight: 2 },
  iconButtonText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  circleHeaderLarge: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  circleTitle: { fontSize: 19, fontWeight: 'bold', color: '#0F172A' },
  circleUserName: { fontSize: 13, fontWeight: '600', color: '#334155', marginTop: 3 },
  circleChatTitle: { fontSize: 14, fontWeight: '700', color: '#475569', paddingHorizontal: 15, paddingTop: 12 },
  memberRoleBanner: { backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10, marginBottom: 10 },
  selectionCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  addUserBtn: { backgroundColor: '#6366F1', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  memberRow: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  selectUserRow: { padding: 10, borderRadius: 10, marginBottom: 5, backgroundColor: '#F8FAFC' },
  selectUserActive: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#6366F1' },
  inviteCard: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, marginBottom: 10 },
  settingsRow: { padding: 15, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 8, backgroundColor: '#FFF' },
  rejectBtn: { borderWidth: 1, borderColor: '#FCA5A5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  messageSender: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 3 },

  circleRoleHeader: { backgroundColor: '#EEF2FF', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E0E7FF' },
  circleRoleText: { fontSize: 14, color: '#334155' },
  sectionTitleStyle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', margin: 15 },
  menuGrid: { paddingHorizontal: 15, gap: 10 },
  menuCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  menuCardAdmin: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12 },
  messageBubble: { padding: 12, borderRadius: 12, marginVertical: 4, maxWidth: '80%' },
  myMessage: { backgroundColor: '#6366F1', alignSelf: 'flex-end' },
  otherMessage: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#0F172A' },
  messageTime: { fontSize: 10, color: '#94A3B8', alignSelf: 'flex-end', marginTop: 4 },
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#FFFFFF', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 },
  sendButton: { backgroundColor: '#6366F1', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 },
  sendButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
});
