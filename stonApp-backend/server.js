const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const crypto = require('crypto');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const { normalizeLogo } = require('./circleLogos');
const { registerPrivateMessaging } = require('./privateMessages');
const { createCircleLifecycle } = require('./circleLifecycle');
const { createCircleLogoUpdate } = require('./circleLogoUpdate');
const { normalizeProfileAvatar } = require('./profileAvatar');
const { validateBoardConfig, membership, boardAccess, canSendDocument } = require('./customBoards');
const { normalizeDocument } = require('./customDocuments');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(cors());
app.use('/api/circles/:circleId/documents', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '256kb' }));

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
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
const Session = mongoose.model('Session', sessionSchema);
const createSession = async userId => {
  const token = crypto.randomBytes(32).toString('hex');
  await Session.create({ userId, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });
  return token;
};
const authenticatedUser = async req => {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '')?.[1];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await Session.findOne({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: { $gt: new Date() } });
  return session ? String(session.userId) : null;
};

// 2. Schema Messaggi Chat
const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceCircleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', default: null },
  sourceCircleName: { type: String, default: '' },
  senderName: String,
  text: { type: String, required: true },
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// 3. Schema Cerchia (Circle)
// 3. Schema Cerchia (Circle)
const LEGACY_ROLES = new Set([
  'AMMINISTRATORE', 'UTENTE', 'SOSTENITORE', 'SOCIO_LAVORATORE', 'VOLONTARIO', 'DIPENDENTE',
  'QUADRO', 'IMPIEGATO', 'OPERAIO', 'SERVIZI', 'AMMINISTRAZIONE', 'RESPONSABILE', 'PARTECIPANTE',
  'DIRIGENTE', 'ATLETA', 'GENITORE', 'CLIENTE', 'RESPONSABILE_VENDITE', 'VENDITORE',
  'STUDENTE', 'IMPIEGATO_SCOLASTICO', 'BIDELLO', 'VOLONTARIO_SCOLASTICO',
  'PROFESSORE', 'PROFESSORESSA', 'MAESTRO', 'MAESTRA', 'DIRIGENZA'
]);
const circleSchema = new mongoose.Schema({
  logo: { kind: { type: String, enum: ['preset', 'image'] }, value: String },
  name: {
    type: String,
    required: true
  },

  type: {
    type: String,
    enum: [
      'COOPERATIVA',
      'IMPRESA',
      'GRUPPO',
      'SQUADRA',
      'NEGOZIO',
      'SCUOLA',
      'CUSTOM'
    ],
    default: 'COOPERATIVA'
  },

  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roles: [{ id: String, name: String, canAttachDocuments: Boolean }],
  boards: [{ id: String, name: String, permissions: mongoose.Schema.Types.Mixed }],

  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    role: {
      type: String,
      maxLength: 60,
      validate: {
        validator(value) {
          const circle = this.ownerDocument();
          return circle?.type === 'CUSTOM' ? circle.roles.some(role => role.id === value) : LEGACY_ROLES.has(value);
        },
        message: 'Ruolo non valido per questa cerchia.'
      },
      default: 'UTENTE'
    },

    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED'],
      default: 'ACCEPTED'
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Circle = mongoose.model('Circle', circleSchema);
const invitationRoleName = (circle, role) => circle.type === 'CUSTOM'
  ? circle.roles.find(item => item.id === role)?.name || 'Ruolo della cerchia'
  : String(role).toLowerCase().replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());

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
const boardPostSchema = new mongoose.Schema({
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
  boardId: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  text: { type: String, required: true, maxlength: 4000 },
  createdAt: { type: Date, default: Date.now }
});
const BoardPost = mongoose.model('BoardPost', boardPostSchema);

// 5. Schema Documenti & Cedolini Riservati
const documentSchema = new mongoose.Schema({
  circleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Circle', required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  fileUrl: String,
  fileName: String,
  mimeType: String,
  fileData: Buffer,
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
    res.status(201).json({ _id: newUser._id, username: newUser.username, email: newUser.email, avatar: newUser.avatar, sessionToken: await createSession(newUser._id) });
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

    res.json({ _id: user._id, username: user.username, email: user.email, avatar: user.avatar, sessionToken: await createSession(user._id) });
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
    if (avatar !== undefined) {
      try { user.avatar = normalizeProfileAvatar(avatar); }
      catch (error) { return res.status(400).json({ error: error.message }); }
    }
    if (password !== undefined) {
      if (!currentPassword) return res.status(400).json({ error: 'Inserisci la password attuale' });
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) return res.status(400).json({ error: 'Password attuale non corretta' });
      if (String(password).length < 6) return res.status(400).json({ error: 'La nuova password deve avere almeno 6 caratteri' });
      user.password = await bcrypt.hash(String(password), 10);
    }
    await user.save();
    if (avatar !== undefined) io.emit('profile_avatar_updated', { userId: String(user._id), avatar: user.avatar });
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
    let customConfig;
    if (type === 'CUSTOM') {
      if (await authenticatedUser(req) !== String(adminId)) return res.status(401).json({ error: 'Accedi di nuovo per creare una cerchia personalizzata.' });
      try { customConfig = validateBoardConfig(req.body.roles, req.body.boards); }
      catch (error) { return res.status(400).json({ error: error.message }); }
    }
    let logo;
    try { logo = normalizeLogo(req.body.logo, type); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    const admin = await User.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        error: 'Amministratore non trovato'
      });
    }
    if (type === 'CUSTOM' && (!Array.isArray(initialMembers) || initialMembers.some(member => !customConfig.roles.some(role => role.id === member.role)))) return res.status(400).json({ error: 'Assegna a ogni invitato un ruolo della cerchia.' });

    // L'amministratore entra subito nella cerchia
    const members = [
      {
        userId: adminId,
        role: type === 'CUSTOM' ? 'admin' : 'AMMINISTRATORE',
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
      logo,
      name,
      type: type || 'COOPERATIVA',
      ...(customConfig || {}),
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
          roleName: invitationRoleName(newCircle, member.role || 'UTENTE'),
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

const circleLifecycle = createCircleLifecycle({ mongoose, User, Circle, Message, Announcement, DocumentModel, WorkShift, BoardPost, bcrypt, io });
app.put('/api/circles/:circleId/logo', createCircleLogoUpdate({ User, Circle, bcrypt, io }));
app.delete('/api/circles/:circleId', circleLifecycle.remove);
app.post('/api/circles/:circleId/leave', circleLifecycle.leave);

// Ruoli e bacheche delle sole cerchie personalizzate.
app.put('/api/circles/:circleId/config', async (req, res) => {
  try {
    const { userId, roles, boards } = req.body || {};
    if (await authenticatedUser(req) !== String(userId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    const circle = await Circle.findById(req.params.circleId);
    if (!circle || circle.type !== 'CUSTOM') return res.status(404).json({ error: 'Cerchia personalizzata non trovata.' });
    if (String(circle.adminId) !== String(userId) || !membership(circle, userId)) return res.status(403).json({ error: 'Solo il proprietario può modificare ruoli e bacheche.' });
    let config;
    try { config = validateBoardConfig(roles, boards); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    if (circle.members.some(member => !config.roles.some(role => role.id === member.role))) return res.status(400).json({ error: 'Non eliminare un ruolo finché ha membri o inviti.' });
    const removedBoards = circle.boards.filter(board => !config.boards.some(item => item.id === board.id)).map(board => board.id);
    circle.roles = config.roles;
    circle.boards = config.boards;
    await circle.save();
    if (removedBoards.length) await BoardPost.deleteMany({ circleId: circle._id, boardId: { $in: removedBoards } });
    io.to(circle.members.filter(member => member.status === 'ACCEPTED').map(member => `user_${member.userId}`)).emit('circle_members_changed', { circleId: String(circle._id) });
    res.json({ roles: circle.roles, boards: circle.boards });
  } catch { res.status(500).json({ error: 'Impossibile aggiornare le bacheche.' }); }
});

app.get('/api/circles/:circleId/boards/:boardId/posts', async (req, res) => {
  try {
    if (await authenticatedUser(req) !== String(req.query.userId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    const circle = await Circle.findById(req.params.circleId);
    if (boardAccess(circle, req.params.boardId, req.query.userId) === 'none') return res.status(403).json({ error: 'Accesso alla bacheca negato.' });
    res.json(await BoardPost.find({ circleId: circle._id, boardId: req.params.boardId }).sort({ createdAt: -1 }).limit(100));
  } catch { res.status(500).json({ error: 'Impossibile caricare la bacheca.' }); }
});
app.post('/api/circles/:circleId/boards/:boardId/posts', async (req, res) => {
  try {
    const circle = await Circle.findById(req.params.circleId);
    const { authorId, text } = req.body || {};
    if (await authenticatedUser(req) !== String(authorId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    if (boardAccess(circle, req.params.boardId, authorId) !== 'write') return res.status(403).json({ error: 'Non puoi scrivere su questa bacheca.' });
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) return res.status(400).json({ error: 'Scrivi un testo (massimo 4000 caratteri).' });
    const author = await User.findById(authorId).select('username');
    if (!author) return res.status(404).json({ error: 'Utente non trovato.' });
    const post = await BoardPost.create({ circleId: circle._id, boardId: req.params.boardId, authorId, authorName: author.username, text: text.trim() });
    const permitted = circle.members.filter(member => member.status === 'ACCEPTED' && boardAccess(circle, req.params.boardId, member.userId) !== 'none').map(member => `user_${member.userId}`);
    io.to(permitted).emit('board_posts_changed', { circleId: String(circle._id), boardId: req.params.boardId });
    res.status(201).json(post);
  } catch { res.status(500).json({ error: 'Impossibile pubblicare sulla bacheca.' }); }
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
    if (circle.type === 'CUSTOM' && await authenticatedUser(req) !== String(inviterId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    const inviter = circle.members.find(m => String(m.userId) === String(inviterId) && m.status === 'ACCEPTED');
    if (!inviter) return res.status(403).json({ error: 'Non sei membro della cerchia' });
    if (circle.type === 'CUSTOM' ? String(circle.adminId) !== String(inviterId) : inviter.role !== 'AMMINISTRATORE') return res.status(403).json({ error: 'Solo l’amministratore può invitare utenti' });
    if (circle.type === 'CUSTOM' && !circle.roles.some(entry => entry.id === role)) return res.status(400).json({ error: 'Scegli un ruolo della cerchia.' });
    const user = await User.findById(userId).select('username avatar email');
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    if (String(userId) === String(inviterId)) return res.status(400).json({ error: 'Non puoi invitare te stesso' });
    const existing = circle.members.find(m => String(m.userId) === String(userId));
    if (existing?.status === 'ACCEPTED') return res.status(400).json({ error: 'L’utente è già nella cerchia' });
    if (existing) { existing.role = role || 'UTENTE'; existing.status = 'PENDING'; }
    else circle.members.push({ userId, role: role || 'UTENTE', status: 'PENDING' });
    await circle.save();
    const payload = { circleId: String(circle._id), circleName: circle.name, inviterName: (await User.findById(inviterId).select('username')).username, role: role || 'UTENTE', roleName: invitationRoleName(circle, role || 'UTENTE') };
    io.emit('circle_invitation', { ...payload, userId: String(userId) });
    res.status(201).json({ message: 'Invito inviato', invitation: payload });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Errore invio invito' }); }
});

// Recupera gli inviti pendenti dell'utente.
app.get('/api/circle-invitations/:userId', async (req, res) => {
  try {
    const circles = await Circle.find({ members: { $elemMatch: { userId: req.params.userId, status: 'PENDING' } } }).populate('adminId', 'username');
    const invitations = circles.map(c => { const m = c.members.find(x => String(x.userId) === String(req.params.userId) && x.status === 'PENDING'); return { circleId: String(c._id), circleName: c.name, inviterName: c.adminId?.username || 'Un amministratore', role: m?.role || 'UTENTE', roleName: invitationRoleName(c, m?.role || 'UTENTE') }; });
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
app.post('/api/circles/:circleId/documents', async (req, res) => {
  try {
    const { authorId, targetUserId, title } = req.body || {};
    if (await authenticatedUser(req) !== String(authorId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    const circle = await Circle.findById(req.params.circleId);
    if (!canSendDocument(circle, authorId, targetUserId)) return res.status(403).json({ error: 'Non puoi inviare un documento a questo membro.' });
    if (typeof title !== 'string' || !title.trim() || title.length > 120) return res.status(400).json({ error: 'Inserisci un titolo valido.' });
    let file;
    try { file = normalizeDocument(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const document = await DocumentModel.create({ circleId: circle._id, authorId, targetUserId, title: title.trim(), ...file });
    io.to(`user_${targetUserId}`).emit('circle_document_received', { circleId: String(circle._id), documentId: String(document._id) });
    res.status(201).json({ _id: document._id, title: document.title, fileName: document.fileName, createdAt: document.createdAt });
  } catch { res.status(500).json({ error: 'Impossibile inviare il documento.' }); }
});
app.get('/api/circles/:circleId/documents/:userId', async (req, res) => {
  try {
    const { circleId, userId } = req.params;
    const circle = await Circle.findById(circleId);
    if (circle?.type === 'CUSTOM' && await authenticatedUser(req) !== String(userId)) return res.status(401).json({ error: 'Accesso richiesto.' });
    if (circle?.type === 'CUSTOM' && !membership(circle, userId)) return res.status(403).json({ error: 'Non sei membro della cerchia.' });
    const docs = await DocumentModel.find({ circleId, targetUserId: userId }).select('-fileData');
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: 'Errore recupero documenti' });
  }
});
const documentTickets = new Map();
app.get('/api/circles/:circleId/documents/:documentId/access', async (req, res) => {
  try {
    const userId = await authenticatedUser(req);
    const circle = await Circle.findById(req.params.circleId);
    if (!userId || circle?.type !== 'CUSTOM' || !membership(circle, userId)) return res.status(403).json({ error: 'Accesso negato.' });
    const document = await DocumentModel.findOne({ _id: req.params.documentId, circleId: circle._id, targetUserId: userId }).select('_id');
    if (!document) return res.status(404).json({ error: 'Documento non trovato.' });
    const ticket = crypto.randomBytes(24).toString('hex');
    documentTickets.set(ticket, { circleId: String(circle._id), documentId: String(document._id), userId, expiresAt: Date.now() + 60_000 });
    setTimeout(() => documentTickets.delete(ticket), 60_000).unref();
    res.json({ url: `/api/circles/${circle._id}/documents/${document._id}/file?ticket=${ticket}` });
  } catch { res.status(500).json({ error: 'Impossibile aprire il documento.' }); }
});
app.get('/api/circles/:circleId/documents/:documentId/file', async (req, res) => {
  try {
    const { circleId, documentId } = req.params;
    const ticket = documentTickets.get(req.query.ticket);
    if (!ticket || ticket.expiresAt < Date.now() || ticket.circleId !== circleId || ticket.documentId !== documentId) return res.status(403).end();
    const { userId } = ticket;
    const circle = await Circle.findById(circleId);
    if (!circle || circle.type !== 'CUSTOM' || !membership(circle, userId)) return res.status(403).end();
    const document = await DocumentModel.findOne({ _id: documentId, circleId, targetUserId: userId });
    if (!document?.fileData) return res.status(404).end();
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', `attachment; filename="${document.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
    res.type(document.mimeType).send(document.fileData);
  } catch { res.status(500).end(); }
});

// -------------------------------------------------------------
// SOCKET.IO (CHAT REALTIME)
// -------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`🔌 Utente connesso: ${socket.id}`);

  const clearPresence = () => {
    const id = socket.data.userId;
    if (id) {
      const count = (onlineUsers.get(id) || 1) - 1;
      if (count <= 0) { onlineUsers.delete(id); broadcastPresence(id, false); }
      else onlineUsers.set(id, count);
    }
    socket.data.userId = null;
    for (const room of socket.rooms) if (room !== socket.id) socket.leave(room);
  };
  socket.on('set_online', ({ userId }) => {
    if (!userId || !mongoose.isValidObjectId(userId)) return;
    const id = String(userId);
    if (socket.data.userId !== id) {
      clearPresence();
      onlineUsers.set(id, (onlineUsers.get(id) || 0) + 1);
      socket.data.userId = id;
    }
    socket.join(`user_${id}`);
    broadcastPresence(id, true);
    socket.emit('online_users', Array.from(onlineUsers.keys()));

  });
  socket.on('set_offline', () => clearPresence());

  socket.on('get_online_users', () => socket.emit('online_users', Array.from(onlineUsers.keys())));

  registerPrivateMessaging({ socket, io, Circle, Message });

  socket.on('join_circle', async ({ circleId, userId, history = true }) => {
    try {
      if (String(userId) !== socket.data.userId) return;
      const circle = await Circle.findOne({ _id: circleId, members: { $elemMatch: { userId, status: 'ACCEPTED' } } });
      if (!circle) return socket.emit('circle_error', { error: 'Non sei membro della cerchia' });
      const roomId = `circle_${circleId}`;
      socket.join(roomId);
      if (history) socket.emit('circle_history', { circleId: String(circleId), messages: await Message.find({ roomId }).sort({ createdAt: 1 }) });
    } catch (err) { console.error('Errore ingresso cerchia:', err); }
  });

  socket.on('send_circle_message', async (data) => {
    try {
      if (String(data.senderId) !== socket.data.userId) return;
      const circle = await Circle.findOne({ _id: data.circleId, members: { $elemMatch: { userId: data.senderId, status: 'ACCEPTED' } } });
      if (!circle) return socket.emit('circle_error', { error: 'Non sei autorizzato a scrivere in questa cerchia' });
      const roomId = `circle_${data.circleId}`;
      const newMessage = new Message({ roomId, senderId: data.senderId, senderName: data.senderName, text: data.text, time: data.time });
      await newMessage.save();
      const recipients = circle.members.filter(member => member.status === 'ACCEPTED').map(member => `user_${member.userId}`);
      io.to(recipients).emit('circle_message', newMessage);
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
