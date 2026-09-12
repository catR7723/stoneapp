import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, 
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, BackHandler, Modal 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

const API_BASE_URL = 'http://192.168.1.5:3001';


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
function HomeScreen({ navigation, currentUser, onDeleteAccount, onLogout, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('chats');
  const [users, setUsers] = useState([]);
  const [circles, setCircles] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);

  useEffect(() => {
    fetchUsersAndCircles();
    fetchInvites();

    const onPresence = ({ userId, online }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: online }));
    };
    const onInvitation = (invite) => {
      setInvites(prev => [invite, ...prev.filter(i => i.circleId !== invite.circleId)]);
      Alert.alert('Nuovo invito', `${invite.inviterName} ti ha invitato nella cerchia "${invite.circleName}".`);
    };

    socket.on('presence_update', onPresence);
    socket.on('circle_invitation', onInvitation);
    socket.emit('get_online_users');
    
return () => {
  socket.off('presence_update', onPresence);
  socket.off('circle_invitation', onInvitation);
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
        <TouchableOpacity style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]} onPress={() => setActiveTab('chats')}>
          <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'circles' && styles.tabButtonActive]} onPress={() => setActiveTab('circles')}>
          <Text style={[styles.tabText, activeTab === 'circles' && styles.tabTextActive]}>Cerchie ({circles.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {loading ? <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} /> : activeTab === 'chats' ? (
          <FlatList
            data={users}
            keyExtractor={item => item._id}
            ListEmptyComponent={<Text style={styles.emptyText}>Nessun contatto presente.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.chatCard} onPress={() => navigation.navigate('Chat', { recipient: item })}>
                <View>
                  <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                  {onlineUsers[item._id] && <View style={styles.avatarOnlineDot} />}
                </View>
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{item.username}</Text>
                  <Text style={styles.lastMessage}>{onlineUsers[item._id] ? '● Online' : 'Offline'}</Text>
                </View>
              </TouchableOpacity>
            )}
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
                  <View style={styles.circleIcon}><Text style={{ fontSize: 20 }}>🏢</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chatName}>{item.name}</Text>
                    <Text style={styles.circleTypeBadges}>{item.type}</Text>
                  </View>
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
                <Text style={styles.lastMessage}>{invite.inviterName} ti ha invitato come {invite.role}</Text>
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
  const [selectedType, setSelectedType] = useState('COOPERATIVA');
  const [users, setUsers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [addVisible, setAddVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = Object.entries(CIRCLE_CONFIG[selectedType].roles);

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
    if (!circleName.trim()) return Alert.alert('Errore', 'Inserisci un nome per la Cerchia');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/circles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: circleName.trim(), type: selectedType, adminId: currentUser._id, initialMembers: pendingMembers.map(m => ({ userId: m.userId, role: m.role })) }) });
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
      <Text style={styles.subSectionTitle}>Tipologia:</Text>
      <View style={styles.typeSelectorRow}>{Object.entries(CIRCLE_CONFIG).map(([type, cfg]) => <TouchableOpacity key={type} style={[styles.typeChip, selectedType === type && styles.typeChipActive]} onPress={() => { setSelectedType(type); setPendingMembers([]); }}><Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextActive]}>{cfg.label}</Text></TouchableOpacity>)}</View>
      <TouchableOpacity style={styles.createCircleBtn} onPress={openAdd}><Text style={styles.createCircleBtnText}>+ Inserisci utente</Text></TouchableOpacity>
      <Text style={styles.subSectionTitle}>Utenti da invitare:</Text>
    </View>} ListEmptyComponent={<Text style={styles.emptyText}>Nessun utente inserito.</Text>} renderItem={({ item }) => <View style={styles.memberRow}><View style={{ flex: 1 }}><Text style={styles.chatName}>{item.username}</Text><Text style={styles.lastMessage}>{roleLabel(selectedType, item.role)}</Text></View><TouchableOpacity onPress={() => removeMember(item.userId)}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Rimuovi</Text></TouchableOpacity></View>} ListFooterComponent={<TouchableOpacity style={styles.confirmBtn} onPress={handleCreate} disabled={loading}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>{loading ? 'Creazione...' : 'CREA CERCHIA'}</Text></TouchableOpacity>} />

    <Modal visible={addVisible} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Inserisci utente</Text><FlatList data={users.filter(u => !pendingMembers.some(m => m.userId === u._id))} keyExtractor={u => u._id} style={{ maxHeight: 260 }} renderItem={({ item }) => <TouchableOpacity style={[styles.selectUserRow, selectedUser?._id === item._id && styles.selectUserActive]} onPress={() => setSelectedUser(item)}><Text style={styles.chatName}>{item.username}</Text></TouchableOpacity>} /><Text style={styles.subSectionTitle}>Ruolo:</Text><View style={styles.typeSelectorRow}>{roles.map(([key, cfg]) => <TouchableOpacity key={key} style={[styles.typeChip, selectedRole === key && styles.typeChipActive]} onPress={() => setSelectedRole(key)}><Text style={[styles.typeChipText, selectedRole === key && styles.typeChipTextActive]}>{cfg.label}</Text></TouchableOpacity>)}</View><View style={styles.modalActions}><TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text></TouchableOpacity><TouchableOpacity style={styles.confirmBtn} onPress={addMember}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>Inserisci</Text></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}

function SettingsModal({ visible, onClose, currentUser, onUserUpdated, onLogout, onDeleteAccount }) {
  const [editVisible, setEditVisible] = useState(false);
  const [mode, setMode] = useState('name');
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');

  const openEdit = (m) => { setMode(m); setValue(m === 'name' ? currentUser.username : m === 'email' ? currentUser.email : currentUser.avatar || ''); setPassword(''); setEditVisible(true); };
  const save = async () => {
    try {
      const body = mode === 'password' ? { password: value, currentPassword: password } : mode === 'name' ? { username: value } : mode === 'email' ? { email: value } : { avatar: value };
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Salvataggio non riuscito');
      onUserUpdated(data);
      setEditVisible(false);
      Alert.alert('StoneApp', 'Dati aggiornati.');
    } catch (err) { Alert.alert('Errore', err.message); }
  };

  return <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}><View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Impostazioni</Text>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('name')}><Text>👤 Cambia nome</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('avatar')}><Text>📷 Cambia foto</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('email')}><Text>✉️ Cambia email</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={() => openEdit('password')}><Text>🔐 Modifica password</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingsRow} onPress={onLogout}><Text>🚪 Logout</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.settingsRow, { borderColor: '#FECACA' }]} onPress={onDeleteAccount}><Text style={{ color: '#EF4444', fontWeight: 'bold' }}>🗑️ Elimina account</Text></TouchableOpacity>
      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Chiudi</Text></TouchableOpacity>

      <Modal visible={editVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{mode === 'name' ? 'Cambia nome' : mode === 'email' ? 'Cambia email' : mode === 'avatar' ? 'Cambia foto' : 'Modifica password'}</Text>
          <TextInput style={styles.authInput} value={value} onChangeText={setValue} placeholder={mode === 'avatar' ? 'URL della nuova foto' : mode === 'password' ? 'Nuova password' : ''} secureTextEntry={mode === 'password'} />
          {mode === 'password' && <TextInput style={styles.authInput} value={password} onChangeText={setPassword} placeholder="Password attuale" secureTextEntry />}
          <View style={styles.modalActions}><TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text></TouchableOpacity><TouchableOpacity style={styles.confirmBtn} onPress={save}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>Salva</Text></TouchableOpacity></View>
        </View></View>
      </Modal>
    </View></View>
  </Modal>;
}

// -------------------------------------------------------------
// SCHERMATA DETTAGLIO CERCHIA
// -------------------------------------------------------------
function CircleDetailScreen({ route, navigation, currentUser, onDeleteAccount, onLogout, onUserUpdated }) {
  const { circle: initialCircle } = route.params;
  const [circle, setCircle] = useState(initialCircle);
  const [tab, setTab] = useState('chat');
  const [onlineUsers, setOnlineUsers] = useState({});
  const [addVisible, setAddVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const acceptedMembers = (circle.members || []).filter(m => m.status === 'ACCEPTED' && m.userId);
  const myMember = acceptedMembers.find(m => String(m.userId?._id || m.userId) === String(currentUser._id));
  const canManageMembers = myMember?.role === CIRCLE_OWNER_ROLE[circle.type];
  const config = CIRCLE_CONFIG[circle.type] || CIRCLE_CONFIG.COOPERATIVA;
  const myRoleConfig = config.roles[myMember?.role];

  useEffect(() => {
    const onPresence = ({ userId, online }) => setOnlineUsers(prev => ({ ...prev, [userId]: online }));
    const onOnlineUsers = ids => { const map = {}; (ids || []).forEach(id => { map[String(id)] = true; }); setOnlineUsers(map); };
    socket.on('presence_update', onPresence); socket.on('online_users', onOnlineUsers); socket.emit('get_online_users');
    return () => { socket.off('presence_update', onPresence); socket.off('online_users', onOnlineUsers); };
  }, []);

  const refreshCircle = async () => { const res = await fetch(`${API_BASE_URL}/api/circles/${circle._id}/${currentUser._id}`); if (res.ok) setCircle(await res.json()); };
  const openAdd = async () => {
    try { const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`); const data = await res.json(); const memberIds = new Set((circle.members || []).map(m => String(m.userId?._id || m.userId))); setUsers((Array.isArray(data) ? data : []).filter(u => !memberIds.has(String(u._id)))); setSelectedUser(null); setSelectedRole(Object.keys(config.roles)[0] || null); setAddVisible(true); }
    catch { Alert.alert('Errore', 'Impossibile caricare gli utenti.'); }
  };
  const sendInvite = async () => {
    if (!selectedUser || !selectedRole) return Alert.alert('Errore', 'Seleziona utente e ruolo.');
    try { const res = await fetch(`${API_BASE_URL}/api/circles/${circle._id}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviterId: currentUser._id, userId: selectedUser._id, role: selectedRole }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Invito non inviato'); setAddVisible(false); await refreshCircle(); Alert.alert('StoneApp', 'Invito inviato.'); }
    catch (err) { Alert.alert('Errore', err.message); }
  };

  const chatMembers = acceptedMembers.filter(m => String(m.userId?._id || m.userId) !== String(currentUser._id));

  return <SafeAreaView style={styles.chatContainer} edges={['bottom']}>
    <View style={styles.circleHeaderLarge}><View style={{ flex: 1 }}><Text style={styles.circleTitle}>{circle.name}</Text><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.circleUserName}>{currentUser.username}</Text><View style={styles.onlineDot} /><Text style={styles.activeText}>Attivo</Text></View></View><TouchableOpacity style={styles.gearButton} onPress={() => setSettingsVisible(true)}><Text style={{ fontSize: 22 }}>⚙️</Text></TouchableOpacity></View>
    <Text style={styles.circleChatTitle}>Chat della cerchia</Text>
    <View style={styles.tabContainer}><TouchableOpacity style={[styles.tabButton, tab === 'chat' && styles.tabButtonActive]} onPress={() => setTab('chat')}><Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Chat</Text></TouchableOpacity><TouchableOpacity style={[styles.tabButton, tab === 'selections' && styles.tabButtonActive]} onPress={() => setTab('selections')}><Text style={[styles.tabText, tab === 'selections' && styles.tabTextActive]}>Selezioni</Text></TouchableOpacity></View>

    {tab === 'chat' ? <FlatList data={chatMembers} keyExtractor={item => String(item.userId?._id || item.userId)} ListEmptyComponent={<Text style={styles.emptyText}>Nessun altro membro accettato nella cerchia.</Text>} renderItem={({ item }) => { const u = item.userId; const id = String(u._id || u); return <TouchableOpacity style={styles.chatCard} onPress={() => navigation.navigate('Chat', { recipient: u })}><View><Image source={{ uri: u.avatar }} style={styles.chatAvatar} />{onlineUsers[id] && <View style={styles.avatarOnlineDot} />}</View><View style={styles.chatInfo}><Text style={styles.chatName}>{u.username}</Text><Text style={styles.lastMessage}>{roleLabel(circle.type, item.role)} {onlineUsers[id] ? '• Online' : '• Offline'}</Text></View></TouchableOpacity>; }} /> : <FlatList contentContainerStyle={{ padding: 15 }} data={myRoleConfig?.selections || []} keyExtractor={([name]) => name} ListHeaderComponent={<View>{myMember && <View style={styles.memberRoleBanner}><Text style={styles.circleRoleText}>Ruolo: {roleLabel(circle.type, myMember.role)}</Text></View>}{canManageMembers && <TouchableOpacity style={styles.addUserBtn} onPress={openAdd}><Text style={styles.createCircleBtnText}>+ Aggiungi utente</Text></TouchableOpacity>}<Text style={styles.subSectionTitle}>Funzioni disponibili</Text></View>} ListEmptyComponent={<Text style={styles.emptyText}>Nessuna selezione disponibile per questo ruolo.</Text>} renderItem={({ item }) => <TouchableOpacity style={styles.selectionCard}><View style={{ flex: 1 }}><Text style={styles.chatName}>{item[0]}</Text><Text style={styles.lastMessage}>{item[1] ? 'Modificabile' : 'Solo lettura'}</Text></View><Text style={{ fontSize: 18 }}>{item[1] ? '✏️' : '👁️'}</Text></TouchableOpacity>} />}

    <Modal visible={addVisible} transparent animationType="slide"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Aggiungi utente</Text><FlatList data={users} keyExtractor={u => u._id} style={{ maxHeight: 260 }} renderItem={({ item }) => <TouchableOpacity style={[styles.selectUserRow, selectedUser?._id === item._id && styles.selectUserActive]} onPress={() => setSelectedUser(item)}><Text style={styles.chatName}>{item.username}</Text>{onlineUsers[item._id] && <Text style={styles.lastMessage}>● Online</Text>}</TouchableOpacity>} /><Text style={styles.subSectionTitle}>Ruolo:</Text><View style={styles.typeSelectorRow}>{Object.entries(config.roles).map(([key, cfg]) => <TouchableOpacity key={key} style={[styles.typeChip, selectedRole === key && styles.typeChipActive]} onPress={() => setSelectedRole(key)}><Text style={[styles.typeChipText, selectedRole === key && styles.typeChipTextActive]}>{cfg.label}</Text></TouchableOpacity>)}</View><View style={styles.modalActions}><TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}><Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text></TouchableOpacity><TouchableOpacity style={styles.confirmBtn} onPress={sendInvite}><Text style={{ fontWeight: 'bold', color: '#FFF' }}>Invia invito</Text></TouchableOpacity></View></View></View></Modal>
    <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} currentUser={currentUser} onUserUpdated={onUserUpdated} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />
  </SafeAreaView>;
}

// -------------------------------------------------------------
// CHAT SCREEN
// -------------------------------------------------------------
function ChatScreen({ route, currentUser }) {
  const { recipient } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);

  const roomId = getRoomId(currentUser._id, recipient._id);

  useEffect(() => {
    socket.emit('join_room', roomId);
    const handleLoadHistory = (history) => setMessages(history);
    const handleReceiveMessage = (newMessage) => setMessages((prev) => [...prev, newMessage]);

    socket.on('load_history', handleLoadHistory);
    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('load_history', handleLoadHistory);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [roomId]);

  const sendMessage = () => {
    if (inputText.trim().length === 0) return;
    const messageData = {
      roomId,
      text: inputText,
      senderId: currentUser._id,
      senderName: currentUser.username,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    socket.emit('send_message', messageData);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.chatContainer} edges={['bottom']}>
      <FlatList
        data={messages}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item }) => {
          const isMyMessage = item.senderId === currentUser._id;
          return (
            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
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
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Invia</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// MAIN NAVIGATION
// -------------------------------------------------------------
const Stack = createNativeStackNavigator();

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    checkSavedUser();
  }, []);

  useEffect(() => {
    if (!currentUser?._id) return;
    const announceOnline = () => socket.emit('set_online', { userId: currentUser._id });
    if (socket.connected) announceOnline();
    socket.on('connect', announceOnline);
    return () => socket.off('connect', announceOnline);
  }, [currentUser?._id]);

const checkSavedUser = async () => {
  try {
    const savedUser = await AsyncStorage.getItem('user');

    if (!savedUser) {
      setCurrentUser(null);
      return;
    }

    const user = JSON.parse(savedUser);

    // Controlla se l'utente esiste ancora nel database
    const response = await fetch(`${API_BASE_URL}/api/user/${user._id}`);

    if (response.ok) {
      const userFromServer = await response.json();

      // Aggiorna i dati locali con quelli del database
      await AsyncStorage.setItem('user', JSON.stringify(userFromServer));

      setCurrentUser(userFromServer);
    } else {
      // Utente presente nel telefono ma non più nel database
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
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#FFFFFF' }}>
          {currentUser ? (
            <>
              <Stack.Screen name="Home" options={{ headerShown: false }}>
                {(props) => (
                  <HomeScreen {...props} currentUser={currentUser} onDeleteAccount={handleDeleteAccount} onLogout={handleLogout} onUserUpdated={async (u) => { await AsyncStorage.setItem('user', JSON.stringify(u)); setCurrentUser(u); }} />
                )}
              </Stack.Screen>
              <Stack.Screen name="CreateCircle" options={{ title: 'Nuova Cerchia' }}>
                {(props) => <CreateCircleScreen {...props} currentUser={currentUser} />}
              </Stack.Screen>
              <Stack.Screen name="Chat" options={({ route }) => ({ title: route.params?.recipient.username })}>
                {(props) => <ChatScreen {...props} currentUser={currentUser} />}
              </Stack.Screen>
              <Stack.Screen name="CircleDetail" options={({ route }) => ({ title: route.params?.circle.name })}>
                {(props) => <CircleDetailScreen {...props} currentUser={currentUser} onDeleteAccount={handleDeleteAccount} onLogout={handleLogout} onUserUpdated={async (u) => { await AsyncStorage.setItem('user', JSON.stringify(u)); setCurrentUser(u); }} />}
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