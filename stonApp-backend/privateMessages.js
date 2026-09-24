const { normalizeLogo } = require('./circleLogos');
function participants(roomId) {
  if (typeof roomId !== 'string') return [];
  const ids = roomId.split('_');
  return ids.length === 2 && ids[0] !== ids[1] && ids.every(id => /^[a-f0-9]{24}$/.test(id)) && [...ids].sort().join('_') === roomId ? ids : [];
}
function registerPrivateMessaging({ socket, io, Circle, Message }) {
  socket.on('join_room', async roomId => {
    if (!participants(roomId).includes(socket.data.userId)) return;
    try {
      await socket.join(roomId);
      socket.emit('load_history', await Message.find({ roomId }).sort({ createdAt: 1 }));
    } catch { socket.emit('private_message_error', { error: 'Impossibile caricare la cronologia.' }); }
  });
  socket.on('send_message', async (data, ack) => {
    const reply = typeof ack === 'function' ? ack : result => { if (!result.ok) socket.emit('private_message_error', result); };
    try {
      const ids = participants(data?.roomId);
      if (!ids.includes(socket.data.userId) || String(data?.senderId) !== socket.data.userId) throw new Error('Riaccedi per inviare il messaggio.');
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('Scrivi un messaggio.');
      let circle = null;
      if (data.sourceCircleId) {
        if (!/^[a-f0-9]{24}$/.test(String(data.sourceCircleId))) throw new Error('Cerchia non valida.');
        circle = await Circle.findOne({ _id: data.sourceCircleId, $and: ids.map(userId => ({ members: { $elemMatch: { userId, status: 'ACCEPTED' } } })) });
        if (!circle) throw new Error('Entrambi gli utenti devono appartenere alla cerchia.');
      }
      const newMessage = new Message({ roomId: data.roomId, senderId: socket.data.userId, senderName: data.senderName, text: data.text.trim(), time: data.time, sourceCircleId: circle?._id || null, sourceCircleName: circle?.name || '' });
      await newMessage.save();
      const payload = { ...newMessage.toObject(), sourceCircle: circle ? { _id: String(circle._id), name: circle.name, type: circle.type, logo: normalizeLogo(circle.logo, circle.type) } : null };
      // Ogni utente riceve anche il primo messaggio, senza aver aperto la chat.
      io.to(ids.map(id => `user_${id}`)).emit('receive_message', payload);
      reply({ ok: true });
    } catch (error) { reply({ ok: false, error: error.message || 'Invio non riuscito.' }); }
  });
}
module.exports = { participants, registerPrivateMessaging };
