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
function HomeScreen({ navigation, currentUser, onDeleteAccount, onLogout }) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' o 'circles'
  const [users, setUsers] = useState([]);
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stato Modale Crea Cerchia
  const [modalVisible, setModalVisible] = useState(false);
  const [circleName, setCircleName] = useState('');
  const [selectedType, setSelectedType] = useState('COOPERATIVA');
  const [selectedMembers, setSelectedMembers] = useState({}); // { userId: role }

  useEffect(() => {
    fetchUsersAndCircles();
  }, []);

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

 const confirmDeleteAccount = () => {
    Alert.alert(
      'Elimina Account',
      'Sei sicuro di voler eliminare definitivamente il tuo profilo e tutti i dati correlati?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive', 
          onPress: async () => {
            
            await onDeleteAccount();
          } 
        },
      ]
    );
  };

  const toggleUserMemberRole = (userId, role) => {
    setSelectedMembers(prev => {
      const copy = { ...prev };
      if (copy[userId] === role) {
        delete copy[userId];
      } else {
        copy[userId] = role;
      }
      return copy;
    });
  };

  const handleCreateCircle = async () => {
    if (!circleName.trim()) {
      Alert.alert('Errore', 'Inserisci un nome per la Cerchia');
      return;
    }

    const initialMembers = Object.keys(selectedMembers).map(userId => ({
      userId,
      role: selectedMembers[userId],
      status: 'ACCEPTED'
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/circles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: circleName.trim(),
          type: selectedType,
          adminId: currentUser._id,
          initialMembers
        }),
      });

      if (res.ok) {
        Alert.alert('Successo', 'Cerchia creata con successo!');
        setModalVisible(false);
        setCircleName('');
        setSelectedMembers({});
        fetchUsersAndCircles();
      } else {
        Alert.alert('Errore', 'Impossibile creare la Cerchia');
      }
    } catch (err) {
      Alert.alert('Errore', 'Connessione al server fallita');
    }
  };

  return (
    <SafeAreaView style={styles.homeContainer} edges={['bottom']}>
      {/* Header Profilo */}
      <View style={styles.userHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: currentUser.avatar }} style={{ width: 38, height: 38, borderRadius: 19, marginRight: 10 }} />
          <View>
            <Text style={styles.userHeaderText}>{currentUser.username}</Text>
            <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>● Attivo</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onLogout} style={styles.closeBadge}>
            <Text style={styles.closeBadgeText}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmDeleteAccount} style={styles.deleteBadge}>
            <Text style={styles.deleteBadgeText}>Elimina Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Selettore Chat / Cerchie */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'chats' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>Chat Singole</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'circles' && styles.tabButtonActive]}
          onPress={() => setActiveTab('circles')}
        >
          <Text style={[styles.tabText, activeTab === 'circles' && styles.tabTextActive]}>Cerchie ({circles.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Contenuto Principale */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
        ) : activeTab === 'chats' ? (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={<Text style={styles.emptyText}>Nessun contatto presente.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.chatCard} onPress={() => navigation.navigate('Chat', { recipient: item })}>
                <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{item.username}</Text>
                  <Text style={styles.lastMessage}>Tocca per chattare in tempo reale</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <TouchableOpacity style={styles.createCircleBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.createCircleBtnText}>+ Crea Nuova Cerchia</Text>
            </TouchableOpacity>

            <FlatList
              data={circles}
              keyExtractor={(item) => item._id}
              ListEmptyComponent={<Text style={styles.emptyText}>Non fai ancora parte di nessuna Cerchia.</Text>}
              renderItem={({ item }) => {
                const myMemberInfo = item.members.find(m => m.userId?._id === currentUser._id || m.userId === currentUser._id);
                return (
                  <TouchableOpacity 
                    style={styles.circleCard}
                    onPress={() => navigation.navigate('CircleDetail', { circle: item, myRole: myMemberInfo?.role || 'UTENTE' })}
                  >
                    <View style={styles.circleIcon}>
                      <Text style={{ fontSize: 20 }}>🏢</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chatName}>{item.name}</Text>
                      <Text style={styles.circleTypeBadges}>{item.type} • Ruolo: {myMemberInfo?.role || 'UTENTE'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* MODALE CREA CERCHIA */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crea Nuova Cerchia</Text>

            <TextInput
              style={styles.authInput}
              placeholder="Nome Cerchia (es. Cooperativa Aurora)"
              value={circleName}
              onChangeText={setCircleName}
            />

            <Text style={styles.subSectionTitle}>Tipologia:</Text>
            <View style={styles.typeSelectorRow}>
              {['COOPERATIVA', 'NEGOZIO', 'IMPRESA', 'GRUPPO'].map((type) => (
                <TouchableOpacity 
                  key={type} 
                  style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text style={[styles.typeChipText, selectedType === type && styles.typeChipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subSectionTitle}>Aggiungi Utenti e Assegna Ruolo:</Text>
            <FlatList
              data={users}
              style={{ maxHeight: 200 }}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => {
                const currentAssignedRole = selectedMembers[item._id];
                return (
                  <View style={styles.userRoleRow}>
                    <Text style={{ flex: 1, fontWeight: '600' }}>{item.username}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {['UTENTE', 'SOCIO_LAVORATORE', 'SOSTENITORE'].map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleMiniBadge, currentAssignedRole === r && styles.roleMiniBadgeActive]}
                          onPress={() => toggleUserMemberRole(item._id, r)}
                        >
                          <Text style={{ fontSize: 10, color: currentAssignedRole === r ? '#FFF' : '#475569' }}>
                            {r === 'SOCIO_LAVORATORE' ? 'SOCIO' : r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={{ fontWeight: 'bold', color: '#64748B' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateCircle}>
                <Text style={{ fontWeight: 'bold', color: '#FFF' }}>Crea Cerchia</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// SCHERMATA DETTAGLIO CERCHIA (MENU DINAMICO RUOLI)
// -------------------------------------------------------------
function CircleDetailScreen({ route }) {
  const { circle, myRole } = route.params;

  return (
    <SafeAreaView style={styles.chatContainer}>
      <View style={styles.circleRoleHeader}>
        <Text style={styles.circleRoleText}>Il tuo ruolo: <Text style={{ fontWeight: 'bold', color: '#6366F1' }}>{myRole}</Text></Text>
      </View>

      <Text style={styles.sectionTitleStyle}>Pulsanti e Sezioni disponibili:</Text>

      {/* MENU UTENTE */}
      {myRole === 'UTENTE' && (
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard}><Text>📍 Oggi al Centro</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>📄 I miei Documenti</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>🍽️ Menu del Giorno</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>📅 Giorni di Chiusura</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>📢 Comunicazioni</Text></TouchableOpacity>
        </View>
      )}

      {/* MENU SOCIO LAVORATORE */}
      {myRole === 'SOCIO_LAVORATORE' && (
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard}><Text>📄 I miei Documenti</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>💶 Cedolini e Varie</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>🚌 Trasporti</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>⏰ Orario</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>📢 Comunicazioni</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>🔒 Bacheca Amministratore</Text></TouchableOpacity>
        </View>
      )}

      {/* MENU SOSTENITORE */}
      {myRole === 'SOSTENITORE' && (
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCard}><Text>📢 Comunicazioni</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCard}><Text>📅 Giorni di Chiusura</Text></TouchableOpacity>
        </View>
      )}

      {/* MENU AMMINISTRATORE */}
      {myRole === 'AMMINISTRATORE' && (
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuCardAdmin}><Text style={{ color: '#FFF' }}>📊 Gestione Soci & Orari</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCardAdmin}><Text style={{ color: '#FFF' }}>📢 Invia Avviso Generale</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCardAdmin}><Text style={{ color: '#FFF' }}>🔒 Invia Avviso Riservato Soci</Text></TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// CHAT SCREEN
// -------------------------------------------------------------
function ChatScreen({ route, currentUser }) {
  const { recipient } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

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
              <Stack.Screen name="Home" options={{ title: 'stonApp' }}>
                {(props) => (
                  <HomeScreen 
                    {...props} 
                    currentUser={currentUser} 
                    onDeleteAccount={handleDeleteAccount} 
                    onLogout={handleLogout}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen name="Chat" options={({ route }) => ({ title: route.params?.recipient.username })}>
                {(props) => <ChatScreen {...props} currentUser={currentUser} />}
              </Stack.Screen>
              <Stack.Screen name="CircleDetail" options={({ route }) => ({ title: route.params?.circle.name })}>
                {(props) => <CircleDetailScreen {...props} currentUser={currentUser} />}
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