const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Connessione a MongoDB Atlas
const rawUri = process.env.MONGODB_URI;
const MONGO_URI = rawUri ? `${rawUri.replace(/\/$/, '')}/stonapp?retryWrites=true&w=majority` : null;

if (!MONGO_URI) {
  console.error('❌ ERRORE: MONGODB_URI non definita nel file env.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 Connesso a MongoDB Atlas con successo!'))
    .catch((err) => console.error('❌ Errore connessione MongoDB Atlas:', err.message));
}

// -------------------------------------------------------------
// SCHEMI MONGOOSE
// -------------------------------------------------------------

// Modello Utente (User Model)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://i.pravatar.cc/150' },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);

// Modello Messaggi
const MessageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true },
  time: String,
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', MessageSchema);

// -------------------------------------------------------------
// ROTTE REST API (Autenticazione & Utenti)
// -------------------------------------------------------------

// Rotta 1: Registrazione
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.toLowerCase().trim();

    // Verifica se l'utente esiste già
    const existingUser = await User.findOne({
      $or: [
        { email: cleanEmail },
        { username: cleanUsername }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username o Email già in uso' });
    }

    // Hash della password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      avatar: `https://i.pravatar.cc/150?u=${cleanUsername}`,
    });

    const savedUser = await newUser.save();

    console.log(`👤 Nuovo utente registrato: ${savedUser.username}`);
    res.status(201).json({
      _id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
      avatar: savedUser.avatar,
    });
  } catch (error) {
    console.error('Errore durante la registrazione:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// Rotta 2: Login (Email o Username)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Compila tutti i campi' });
    }

    const inputClean = email.trim();

    const user = await User.findOne({
      $or: [
        { email: inputClean.toLowerCase() },
        { username: inputClean }
      ]
    });

    if (!user) {
      return res.status(400).json({ error: 'Credenziali non valide' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenziali non valide' });
    }

    console.log(`🔑 Login effettuato: ${user.username}`);
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('Errore durante il login:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// Rotta 3: Lista di tutti gli utenti registrati (escludendo se stessi)
app.get('/api/users/:currentUserId', async (req, res) => {
  try {
    const { currentUserId } = req.params;
    const users = await User.find({ _id: { $ne: currentUserId } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero utenti' });
  }
});
// Rotta 4: Elimina Definitivamente l'Account dell'Utente
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Rimuovi l'utente dalla collezione Users
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // 2. Rimuovi tutti i messaggi inviati da questo utente
    await Message.deleteMany({ senderId: userId });

    console.log(`🗑️ Account eliminato da MongoDB Atlas: ${deletedUser.username}`);
    res.json({ message: 'Account e dati correlati eliminati con successo' });
  } catch (error) {
    console.error('Errore durante l\'eliminazione dell\'account:', error);
    res.status(500).json({ error: 'Errore del server durante l\'eliminazione' });
  }
});

// -------------------------------------------------------------
// EVENTI SOCKET.IO (Tempo Reale)
// -------------------------------------------------------------

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connesso: ${socket.id}`);

  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    console.log(`[Socket] ${socket.id} entrato nella stanza: ${roomId}`);

    try {
      const history = await Message.find({ roomId }).sort({ createdAt: 1 });
      socket.emit('load_history', history);
    } catch (error) {
      console.error('Errore nel recupero della cronologia:', error);
    }
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        time: data.time,
      });

      const savedMessage = await newMessage.save();
      console.log(`[Stanza ${data.roomId}] Salvato su Atlas da ${data.senderName}: ${savedMessage.text}`);

      io.to(data.roomId).emit('receive_message', savedMessage);
    } catch (error) {
      console.error('Errore nel salvataggio del messaggio:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnesso: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server stonApp attivo sulla porta ${PORT}`);
});