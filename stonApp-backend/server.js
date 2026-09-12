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

// Presenza online: più socket possono appartenere allo stesso utente.
const onlineUsers = new Map();
const broadcastPresence = (userId, online) => io.emit('presence_update', { userId: String(userId), online });

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

// Modifica dati personali
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, avatar, password, currentPassword } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });

    if (username !== undefined) {
      const clean = String(username).trim();
      if (!clean) return res.status(400).json({ error: 'Il nome non può essere vuoto' });
      const exists = await User.findOne({ username: clean, _id: { $ne: userId } });
      if (exists) return res.status(400).json({ error: 'Username già utilizzato' });
      user.username = clean;
    }
    if (email !== undefined) {
      const clean = String(email).trim().toLowerCase();
      if (!clean) return res.status(400).json({ error: 'L’email non può essere vuota' });
      const exists = await User.findOne({ email: clean, _id: { $ne: userId } });
      if (exists) return res.status(400).json({ error: 'Email già utilizzata' });
      user.email = clean;
    }
    if (avatar !== undefined) user.avatar = String(avatar).trim();
    if (password !== undefined) {
      if (!currentPassword) return res.status(400).json({ error: 'Inserisci la password attuale' });
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) return res.status(400).json({ error: 'Password attuale non corretta' });
      if (String(password).length < 6) return res.status(400).json({ error: 'La nuova password deve avere almeno 6 caratteri' });
      user.password = await bcrypt.hash(String(password), 10);
    }
    await user.save();
    res.json({ _id: user._id, username: user.username, email: user.email, avatar: user.avatar });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Email o Username già utilizzati' });
    console.error('Errore modifica dati personali:', error);
    res.status(500).json({ error: 'Errore durante l’aggiornamento dei dati' });
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

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        error: 'Amministratore non trovato'
      });
    }

    // L'amministratore entra subito nella cerchia
    const members = [
      {
        userId: adminId,
        role: 'AMMINISTRATORE',
        status: 'ACCEPTED'
      }
    ];

    // Aggiunge gli utenti invitati come PENDING
    if (Array.isArray(initialMembers)) {
      for (const member of initialMembers) {
        if (!member.userId) continue;

        // Evita di aggiungere l'amministratore due volte
        if (String(member.userId) === String(adminId)) continue;

        members.push({
          userId: member.userId,
          role: member.role || 'UTENTE',
          status: 'PENDING'
        });
      }
    }

    const newCircle = new Circle({
      name,
      type: type || 'COOPERATIVA',
      adminId,
      members
    });

    await newCircle.save();

    console.log(
      `✨ Nuova Cerchia creata: ${newCircle.name} (${newCircle.type})`
    );

    console.log(
      `📨 Inviti pendenti: ${members.filter(m => m.status === 'PENDING').length}`
    );

    // Notifica realtime agli utenti invitati
    if (Array.isArray(initialMembers)) {
      for (const member of initialMembers) {
        if (!member.userId) continue;
        if (String(member.userId) === String(adminId)) continue;

        io.emit('circle_invitation', {
          circleId: String(newCircle._id),
          circleName: newCircle.name,
          inviterName: admin.username,
          role: member.role || 'UTENTE',
          userId: String(member.userId)
        });

        console.log(
          `📨 Invito inviato a ${member.userId} come ${member.role || 'UTENTE'}`
        );
      }
    }

    res.status(201).json(newCircle);

  } catch (error) {
    console.error('❌ Errore creazione cerchia:', error);

    res.status(500).json({
      error: 'Impossibile creare la cerchia'
    });
  }
});

// Recupera Cerchie dell'Utente
app.get('/api/circles/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const circles = await Circle.find({ members: { $elemMatch: { userId, status: 'ACCEPTED' } } })
      .populate('members.userId', 'username avatar email');
    res.json(circles);
  } catch (error) {
    res.status(500).json({ error: 'Errore nel recupero delle cerchie' });
  }
});

// Dettaglio Cerchia per un utente autorizzato
app.get('/api/circles/:circleId/:userId', async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const circle = await Circle.findOne({ _id: circleId, members: { $elemMatch: { userId, status: 'ACCEPTED' } } }).populate('members.userId', 'username avatar email');
    if (!circle) return res.status(404).json({ error: 'Cerchia non trovata o accesso negato' });
    res.json(circle);
  } catch (error) { res.status(500).json({ error: 'Errore nel recupero della cerchia' }); }
});

// Invia invito a una persona della rubrica. L'utente resta PENDING finché non accetta.
app.post('/api/circles/:circleId/invite', async (req, res) => {
  try {
    const { circleId } = req.params;
    const { inviterId, userId, role } = req.body;
    const circle = await Circle.findById(circleId);
    if (!circle) return res.status(404).json({ error: 'Cerchia non trovata' });
    const inviter = circle.members.find(m => String(m.userId) === String(inviterId) && m.status === 'ACCEPTED');
    if (!inviter) return res.status(403).json({ error: 'Non sei membro della cerchia' });
    if (inviter.role !== 'AMMINISTRATORE') return res.status(403).json({ error: 'Solo l’amministratore può invitare utenti' });
    const user = await User.findById(userId).select('username avatar email');
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (String(userId) === String(inviterId)) return res.status(400).json({ error: 'Non puoi invitare te stesso' });
    const existing = circle.members.find(m => String(m.userId) === String(userId));
    if (existing?.status === 'ACCEPTED') return res.status(400).json({ error: 'L’utente è già nella cerchia' });
    if (existing) { existing.role = role || 'UTENTE'; existing.status = 'PENDING'; }
    else circle.members.push({ userId, role: role || 'UTENTE', status: 'PENDING' });
    await circle.save();
    const payload = { circleId: String(circle._id), circleName: circle.name, inviterName: (await User.findById(inviterId).select('username')).username, role: role || 'UTENTE' };
    io.emit('circle_invitation', { ...payload, userId: String(userId) });
    res.status(201).json({ message: 'Invito inviato', invitation: payload });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Errore invio invito' }); }
});

// Recupera gli inviti pendenti dell'utente.
app.get('/api/circle-invitations/:userId', async (req, res) => {
  try {
    const circles = await Circle.find({ members: { $elemMatch: { userId: req.params.userId, status: 'PENDING' } } }).populate('adminId', 'username');
    const invitations = circles.map(c => { const m = c.members.find(x => String(x.userId) === String(req.params.userId) && x.status === 'PENDING'); return { circleId: String(c._id), circleName: c.name, inviterName: c.adminId?.username || 'Un amministratore', role: m?.role || 'UTENTE' }; });
    res.json(invitations);
  } catch (error) { res.status(500).json({ error: 'Errore recupero inviti' }); }
});

async function updateInvitation(circleId, userId, accepted) {
  const circle = await Circle.findById(circleId);
  if (!circle) return { error: 'Cerchia non trovata', status: 404 };
  const member = circle.members.find(m => String(m.userId) === String(userId) && m.status === 'PENDING');
  if (!member) return { error: 'Invito non trovato', status: 404 };
  if (accepted) member.status = 'ACCEPTED';
  else circle.members = circle.members.filter(m => String(m.userId) !== String(userId));
  await circle.save();
  return { circle };
}

app.post('/api/circles/:circleId/accept', async (req, res) => {
  try { const result = await updateInvitation(req.params.circleId, req.body.userId, true); if (result.error) return res.status(result.status).json({ error: result.error }); res.json({ message: 'Invito accettato', circle: result.circle }); }
  catch (error) { res.status(500).json({ error: 'Errore accettazione invito' }); }
});

app.post('/api/circles/:circleId/reject', async (req, res) => {
  try { const result = await updateInvitation(req.params.circleId, req.body.userId, false); if (result.error) return res.status(result.status).json({ error: result.error }); res.json({ message: 'Invito rifiutato' }); }
  catch (error) { res.status(500).json({ error: 'Errore rifiuto invito' }); }
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

  socket.on('set_online', ({ userId }) => {
    if (!userId) return;
    const id = String(userId);
    const count = (onlineUsers.get(id) || 0) + 1;
    onlineUsers.set(id, count);
    broadcastPresence(id, true);
    socket.data.userId = id;
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('set_offline', ({ userId }) => {
    if (!userId) return;
    const id = String(userId);
    onlineUsers.delete(id);
    broadcastPresence(id, false);
  });

  socket.on('get_online_users', () => socket.emit('online_users', Array.from(onlineUsers.keys())));

  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    try { socket.emit('load_history', await Message.find({ roomId }).sort({ createdAt: 1 })); }
    catch (err) { console.error('Errore nel caricamento della cronologia:', err); }
  });

  socket.on('join_circle', async ({ circleId, userId }) => {
    try {
      const circle = await Circle.findOne({ _id: circleId, members: { $elemMatch: { userId, status: 'ACCEPTED' } } });
      if (!circle) return socket.emit('circle_error', { error: 'Non sei membro della cerchia' });
      const roomId = `circle_${circleId}`;
      socket.join(roomId);
      socket.emit('circle_history', await Message.find({ roomId }).sort({ createdAt: 1 }));
    } catch (err) { console.error('Errore ingresso cerchia:', err); }
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message({ roomId: data.roomId, senderId: data.senderId, senderName: data.senderName, text: data.text, time: data.time });
      await newMessage.save();
      io.to(data.roomId).emit('receive_message', newMessage);
    } catch (err) { console.error('Errore nell’invio del messaggio:', err); }
  });

  socket.on('send_circle_message', async (data) => {
    try {
      const circle = await Circle.findOne({ _id: data.circleId, members: { $elemMatch: { userId: data.senderId, status: 'ACCEPTED' } } });
      if (!circle) return socket.emit('circle_error', { error: 'Non sei autorizzato a scrivere in questa cerchia' });
      const roomId = `circle_${data.circleId}`;
      const newMessage = new Message({ roomId, senderId: data.senderId, senderName: data.senderName, text: data.text, time: data.time });
      await newMessage.save();
      io.to(roomId).emit('circle_message', newMessage);
    } catch (err) { console.error('Errore messaggio cerchia:', err); }
  });

  socket.on('disconnect', () => {
    const id = socket.data.userId;
    if (id) {
      const count = (onlineUsers.get(id) || 1) - 1;
      if (count <= 0) { onlineUsers.delete(id); broadcastPresence(id, false); }
      else onlineUsers.set(id, count);
    }
    console.log(`❌ Utente disconnesso: ${socket.id}`);
  });
});

// AVVIO SERVER
server.listen(PORT, () => {
  console.log(`🚀 Server stonApp attivo e in ascolto sulla porta ${PORT}`);
});