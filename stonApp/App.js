import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, 
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, BackHandler 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

const API_BASE_URL = 'http://192.168.0.150:3001';

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
// SCHERMATA HOME
// -------------------------------------------------------------
function HomeScreen({ navigation, currentUser, onDeleteAccount }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`);
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Errore nel caricamento utenti:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseApp = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      Alert.alert('Chiudi App', 'Puoi ridurre l\'app ad icona o scorrerla via per chiuderla.');
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Elimina Account',
      'Sei sicuro di voler eliminare definitivamente il tuo profilo? Il tuo utente e la tua cronologia verranno cancellati da MongoDB Atlas.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: onDeleteAccount },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.homeContainer} edges={['bottom']}>
      <View style={styles.userHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: currentUser.avatar }} style={{ width: 38, height: 38, borderRadius: 19, marginRight: 10 }} />
          <View>
            <Text style={styles.userHeaderText}>{currentUser.username}</Text>
            <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>● Attivo</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={handleCloseApp} style={styles.closeBadge}>
            <Text style={styles.closeBadgeText}>Chiudi</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={confirmDeleteAccount} style={styles.deleteBadge}>
            <Text style={styles.deleteBadgeText}>Elimina Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.sectionContainer, { flex: 1 }]}>
        <Text style={[styles.sectionTitle, { paddingHorizontal: 15 }]}>Conversazioni</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', marginTop: 30, color: '#94A3B8' }}>
                Nessun altro utente registrato.
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.chatCard}
                onPress={() => navigation.navigate('Chat', { recipient: item })}
              >
                <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
                <View style={styles.chatInfo}>
                  <Text style={styles.chatName}>{item.username}</Text>
                  <Text style={styles.lastMessage}>Tocca per chattare in tempo reale</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// SCHERMATA CHAT
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
      roomId: roomId,
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
// MAIN APP
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
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser._id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await AsyncStorage.removeItem('user');
        setCurrentUser(null);
        Alert.alert('Account Eliminato', 'Il tuo account e i relativi dati sono stati cancellati da MongoDB Atlas.');
      } else {
        Alert.alert('Errore', 'Impossibile eliminare l\'account dal server.');
      }
    } catch (err) {
      Alert.alert('Errore', 'Errore di connessione al server.');
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
                {(props) => <HomeScreen {...props} currentUser={currentUser} onDeleteAccount={handleDeleteAccount} />}
              </Stack.Screen>
              <Stack.Screen name="Chat" options={({ route }) => ({ title: route.params?.recipient.username })}>
                {(props) => <ChatScreen {...props} currentUser={currentUser} />}
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
  chatContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  sectionContainer: { marginTop: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 10 },
  chatCard: { flexDirection: 'row', padding: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  chatAvatar: { width: 50, height: 50, borderRadius: 25 },
  chatInfo: { flex: 1, marginLeft: 15 },
  chatName: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  lastMessage: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
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