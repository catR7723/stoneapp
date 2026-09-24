const { normalizeLogo } = require('./circleLogos');
const ADMIN_ROLES = { COOPERATIVA: 'AMMINISTRATORE', IMPRESA: 'AMMINISTRATORE', GRUPPO: 'AMMINISTRAZIONE', SQUADRA: 'DIRIGENTE', NEGOZIO: 'DIRIGENTE', SCUOLA: 'DIRIGENZA' };
function createCircleLogoUpdate({ User, Circle, bcrypt, io }) {
  return async (req, res) => {
    try {
      const { userId, password, logo: requestedLogo } = req.body || {};
      const { circleId } = req.params;
      if (![userId, circleId].every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id))) return res.status(400).json({ error: 'Utente o cerchia non validi.' });
      if (typeof password !== 'string' || !password) return res.status(401).json({ error: 'Inserisci la password del tuo account.' });
      const user = await User.findById(userId);
      if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Password non corretta.' });
      if (!requestedLogo?.kind || !requestedLogo?.value) return res.status(400).json({ error: 'Scegli un logo.' });
      let logo;
      try { logo = normalizeLogo(requestedLogo); }
      catch (error) { return res.status(400).json({ error: error.message }); }
      // Autorizzazione nella stessa scrittura: un membro rimosso nel frattempo non può aggiornare.
      const roles = Object.entries(ADMIN_ROLES).map(([type, role]) => ({ type, members: { $elemMatch: { userId, status: 'ACCEPTED', role } } }));
      const circle = await Circle.findOneAndUpdate({
        _id: circleId,
        members: { $elemMatch: { userId, status: 'ACCEPTED' } },
        $or: [{ adminId: userId }, { members: { $elemMatch: { userId, status: 'ACCEPTED', role: 'AMMINISTRATORE' } } }, ...roles],
      }, { $set: { logo } }, { new: true, runValidators: true });
      if (!circle) return res.status(403).json({ error: 'Solo un amministratore della cerchia può cambiarne il logo.' });
      const result = { circleId: String(circle._id), logo: circle.logo };
      io.to(circle.members.filter(m => m.status === 'ACCEPTED').map(m => `user_${m.userId}`)).emit('circle_logo_updated', result);
      res.json(result);
    } catch { res.status(500).json({ error: 'Impossibile aggiornare il logo. Riprova.' }); }
  };
}
module.exports = { createCircleLogoUpdate };
