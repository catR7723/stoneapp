import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, 
  Image, KeyboardAvoidingView, Platform 
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';

// Indirizzo IP del tuo Mac per la connessione LAN
const SOCKET_URL = 'http://192.168.1.5:3000';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
});

// Utility per generare un ID stanza identico tra due interlocutori
// Genera SEMPRE lo stesso nome stanza indipendentemente dall ordine
const getRoomId = (userA, userB) => {
  const cleanA = userA.replace(/\s+/g, '').toLowerCase();
  const cleanB = userB.replace(/\s+/g, '').toLowerCase();
  return [cleanA, cleanB].sort().join('_');
};

const CHATS_DATA = [
  { id: 'Laura Bianchi', name: 'Laura Bianchi', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: 'Marco Rossi', name: 'Marco Rossi', avatar: 'https://i.pravatar.cc/150?img=3' },
];

function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.homeContainer} edges={['bottom']}>
      <View style={[styles.sectionContainer, { flex: 1 }]}>
        <Text style={[styles.sectionTitle, { paddingHorizontal: 15 }]}>Conversazioni</Text>
        <FlatList
          data={CHATS_DATA}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.chatCard}
              onPress={() => navigation.navigate('Chat', { recipientName: item.name })}
            >
              <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{item.name}</Text>
                <Text style={styles.lastMessage}>Tocca per chattare in tempo reale</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function ChatScreen({ route }) {
  const { recipientName } = route.params;
  
  const currentUserName = Platform.OS === 'ios' && !Platform.isPad
    ? 'Mio Utente'
    : 'Utente App';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  // Usa sempre il nome dell utente corrente e del destinatario pulito
const roomId = getRoomId('mioutente', recipientName);

  useEffect(() => {
    // 1. Entra nella stanza privata
    socket.emit('join_room', roomId);

    // 2. Ascolta il caricamento della cronologia da MongoDB Atlas
    const handleLoadHistory = (history) => {
      setMessages(history);
    };

    // 3. Ascolta i messaggi in tempo reale
    const handleReceiveMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    };

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
      id: Date.now().toString(),
      roomId: roomId,
      text: inputText,
      senderId: socket.id,
      senderName: currentUserName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socket.emit('send_message', messageData);
    setInputText('');
  };

  return (
    <SafeAreaView style={styles.chatContainer} edges={['bottom']}>
      <FlatList
        data={messages}
        keyExtractor={(item, index) => item._id || item.id || index.toString()}
        renderItem={({ item }) => {
          const isMyMessage = item.senderId === socket.id;
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

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0F172A' }, headerTintColor: '#FFFFFF' }}>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'stonApp' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.recipientName })} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  homeContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  chatContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  sectionContainer: { marginTop: 15 },
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