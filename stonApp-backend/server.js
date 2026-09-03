const path = require('path');
// Carica le variabili da atlas-credentials.env
require('dotenv').config({ path: path.join(__dirname, 'atlas-credentials.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// Costruisce l URI per MongoDB Atlas puntando al database 'stonapp'
const rawUri = process.env.MONGODB_URI;
const MONGO_URI = rawUri ? `${rawUri.replace(/\/$/, '')}/stonapp?retryWrites=true&w=majority` : null;

if (!MONGO_URI) {
  console.error('❌ ERRORE: MONGODB_URI non definita nel file env.');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 Connesso a MongoDB Atlas con successo!'))
    .catch((err) => console.error('❌ Errore connessione MongoDB Atlas:', err.message));
}

// Modello dei Messaggi
const MessageSchema = new mongoose.Schema({
  roomId: String,
  senderId: String,
  senderName: String,
  text: String,
  time: String,
  createdAt: { type: Date, default: Date.now },
});

const Message = mongoose.model('Message', MessageSchema);

// Server HTTP + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connesso: ${socket.id}`);

  // Quando un utente entra in una stanza, carica la cronologia dal Cloud Database
  socket.on('join_room', async (roomId) => {
    socket.join(roomId);
    console.log(`[Socket] Client ${socket.id} entrato nella stanza: ${roomId}`);

    try {
      const history = await Message.find({ roomId }).sort({ createdAt: 1 });
      socket.emit('load_history', history);
    } catch (error) {
      console.error('Errore nel recupero della cronologia:', error);
    }
  });

  // Riceve, salva su MongoDB Atlas e invia in tempo reale
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
      console.log(`[Stanza ${data.roomId}] Salvato su Atlas: ${savedMessage.text}`);

      io.to(data.roomId).emit('receive_message', savedMessage);
    } catch (error) {
      console.error('Errore nel salvataggio del messaggio:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnesso: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server stonApp attivo sulla porta ${PORT}`);
});