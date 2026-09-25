function createCircleLifecycle({ mongoose, User, Circle, Message, Announcement, DocumentModel, WorkShift, BoardPost, bcrypt, io }) {
  async function authenticate(req) {
    const { userId, password } = req.body || {};
    if (!/^[a-f0-9]{24}$/.test(String(userId)) || typeof password !== 'string' || !password) return null;
    const user = await User.findById(userId);
    return user && await bcrypt.compare(password, user.password) ? String(userId) : null;
  }
  const validId = value => /^[a-f0-9]{24}$/.test(String(value));
  return {
    async remove(req, res) {
      let session;
      try {
        if (!validId(req.params.circleId)) return res.status(400).json({ error: 'Cerchia non valida.' });
        const userId = await authenticate(req);
        if (!userId) return res.status(401).json({ error: 'Password non corretta.' });
        const circleId = req.params.circleId;
        let recipients = [];
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
          const circle = await Circle.findOne({ _id: circleId, adminId: userId, members: { $elemMatch: { userId, status: 'ACCEPTED' } } }).session(session);
          if (!circle) { const error = new Error('Solo il proprietario può eliminare questa cerchia.'); error.status = 403; throw error; }
          recipients = circle.members.map(member => `user_${member.userId}`);
          // Le chat private non vengono cancellate: appartengono alle due persone.
          await Message.deleteMany({ roomId: `circle_${circleId}` }, { session });
          await Announcement.deleteMany({ circleId }, { session });
          if (BoardPost) await BoardPost.deleteMany({ circleId }, { session });
          await DocumentModel.deleteMany({ circleId }, { session });
          await WorkShift.deleteMany({ circleId }, { session });
          await Circle.deleteOne({ _id: circleId, adminId: userId }, { session });
        });
        io.to(recipients).emit('circle_removed', { circleId, deleted: true });
        io.in(`circle_${circleId}`).socketsLeave(`circle_${circleId}`);
        res.json({ ok: true });
      } catch (error) {
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Eliminazione non riuscita. Nessuna eliminazione parziale è stata confermata.' });
      } finally { if (session) await session.endSession(); }
    },
    async leave(req, res) {
      try {
        if (!validId(req.params.circleId)) return res.status(400).json({ error: 'Cerchia non valida.' });
        const userId = await authenticate(req);
        if (!userId) return res.status(401).json({ error: 'Password non corretta.' });
        const circleId = req.params.circleId;
        const circle = await Circle.findOneAndUpdate({ _id: circleId, adminId: { $ne: userId }, members: { $elemMatch: { userId, status: 'ACCEPTED' } } }, { $pull: { members: { userId } } }, { new: true });
        if (!circle) return res.status(403).json({ error: 'Non puoi uscire: non sei membro oppure sei il proprietario della cerchia.' });
        io.to(`user_${userId}`).emit('circle_removed', { circleId, deleted: false });
        io.in(`user_${userId}`).socketsLeave(`circle_${circleId}`);
        io.to(circle.members.map(member => `user_${member.userId}`)).emit('circle_members_changed', { circleId });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: 'Uscita dalla cerchia non riuscita.' }); }
    },
  };
}
module.exports = { createCircleLifecycle };
