const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

const PORT = 3001;
const MONGO_URI = 'mongodb+srv://davcattan_db_user:2STQVQ4DXWw17unx@cluster0.7havsn1.mongodb.net/?appName=Cluster0' 


// Connessione a MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('🍃 Connesso a MongoDB Atlas con successo'))
  .catch((err) => console.error('❌ Errore connessione MongoDB:', err));

// -------------------------------------------------------------
// SCHEMI MONGOOSE
// -------------------------------------------------------------

// 1. Schema Utente
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://i.pravatar.cc/150' },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Rubrica personale
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 2. Schema Messaggi Chat
const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  text: { type: String, required: true },
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// 3. Schema Cerchia (Circle)
const circleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['COOPERATIVA', 'NEGOZIO', 'IMPRESA', 'GRUPPO'], 
    default: 'COOPERATIVA' 
  },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { 
      type: String, 
      enum: ['AMMINISTRATORE', 'SOCIO_LAVORATORE', 'UTENTE', 'SOSTENITORE'],
      default: 'UTENTE'
    },
    status: { type: String, enum: ['PENDING', 'ACCEPTED'], default: 'ACCEPTED' }
  }],
  createdAt: { type: Date, default: Date.now }
});

const Circle = mongoose.model('Circle', circleSchema);

// 4. Schema Comunicazioni & Bacheca
const announcementSchema = new mongoose.Schema({
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  targetRole: { 
    type: String, 
    enum: ['ALL', 'SOCIO_LAVORATORE'], 
    default: 'ALL' 
  },
  createdAt: { type: Date, default: Date.now }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// 5. Schema Documenti & Cedolini Riservati
const documentSchema = new mongoose.Schema({
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  fileUrl: { type: String, required: true },
  docType: { type: String, enum: ['CEDOLINO', 'DOCUMENTO', 'CONTRATTO'], default: 'DOCUMENTO' },
  createdAt: { type: Date, default: Date.now }
});

const DocumentModel = mongoose.model('Document', documentSchema);

// 6. Schema Orari di Lavoro
const workShiftSchema = new mongoose.Schema({
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day: { type: String, required: true },
  shift: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const WorkShift = mongoose.model('WorkShift', workShiftSchema);

// -------------------------------------------------------------
// ROTTE AUTH & UTENTI
// -------------------------------------------------------------

// Registrazione
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email o Username già registrati' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      avatar: `https://i.pravatar.cc/150?u=${username}`
    });

    await newUser.save();
    res.status(201).json({ _id: newUser._id, username: newUser.username, email: newUser.email, avatar: newUser.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: email }] });
    if (!user) return res.status(400).json({ error: 'Utente non trovato' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Password errata' });

    res.json({ _id: user._id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// Verifica se un utente esiste ancora nel database
app.get('/api/user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json(user);
  } catch (err) {
    console.error('Errore verifica utente:', err);
    res.status(500).json({ error: 'Errore nel recupero dell’utente' });
  }
});

// Lista Utenti (escluso quello loggato)
app.get('/api/users/:currentUserId', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.params.currentUserId } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero utenti' });
  }
});

// Elimina Account Definitivamente
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Utente non trovato nel database' });
    }

    await Message.deleteMany({
      $or: [{ senderId: userId }, { roomId: { $regex: userId } }]
    });

    console.log(`🗑️ Account eliminato da MongoDB Atlas: ${deletedUser.username}`);
    res.json({ message: 'Account e dati eliminati con successo' });
  } catch (error) {
    res.status(500).json({ error: 'Errore del server durante l\'eliminazione' });
  }
});

// -------------------------------------------------------------
// ROTTE CERCHIE & COOPERATIVA
// -------------------------------------------------------------

// Crea Cerchia
app.post('/api/circles', async (req, res) => {
  try {
    const { name, type, adminId, initialMembers } = req.body;
    const members = [
      { userId: adminId, role: 'AMMINISTRATORE', status: 'ACCEPTED' },
      ...(initialMembers || [])
    ];

    const newCircle = new Circle({ name, type: type || 'COOPERATIVA', adminId, members });
    await newCircle.save();

    console.log(`✨ Nuova Cerchia creata: ${newCircle.name} (${newCircle.type})`);
    res.status(201).json(newCircle);
  } catch (error) {
    res.status(500).json({ error: 'Impossibile creare la cerchia' });
  }
});

// Recupera Cerchie dell'Utente
app.get('/api/circles/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const circles = await Circle.find({ 'members.userId': userId })
      .populate('members.userId', 'username avatar email');
    res.json(circles);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero delle cerchie' });
  }
});

// Invia Comunicazione
app.post('/api/circles/announcements', async (req, res) => {
  try {
    const { circleId, authorId, title, content, targetRole } = req.body;
    const announcement = new Announcement({ circleId, authorId, title, content, targetRole });
    await announcement.save();
    res.status(201).json(announcement);
  } catch (error) {
    res.status(500).json({ error: 'Errore invio comunicazione' });
  }
});

// Leggi Comunicazioni per la Cerchia in base al Ruolo Utente
app.get('/api/circles/:circleId/announcements/:role', async (req, res) => {
  try {
    const { circleId, role } = req.params;
    let query = { circleId };

    if (role !== 'SOCIO_LAVORATORE' && role !== 'AMMINISTRATORE') {
      query.targetRole = 'ALL';
    }

    const announcements = await Announcement.find(query).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    res.status(500).json({ error: 'Errore recupero comunicazioni' });
  }
});

// Recupera Documenti Personali
app.get('/api/circles/:circleId/documents/:userId', async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const docs = await DocumentModel.find({ circleId, targetUserId: userId });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Errore recupero documenti' });
  }
});

// -------------------------------------------------------------
// SOCKET.IO (CHAT REALTIME)
// -------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`🔌 Utente connesso: ${socket.id}`);

  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    try {
      const history = await Message.find({ roomId }).sort({ createdAt: 1 });
      socket.emit('load_history', history);
    } catch (err) {
      console.error('Errore nel caricamento della cronologia:', err);
    }
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        time: data.time
      });
      await newMessage.save();
      io.to(data.roomId).emit('receive_message', newMessage);
    } catch (err) {
      console.error('Errore nell\'invio del messaggio:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Utente disconnesso: ${socket.id}`);
  });
});

// AVVIO SERVER
server.listen(PORT, () => {
  console.log(`🚀 Server stonApp attivo e in ascolto sulla porta ${PORT}`);
});