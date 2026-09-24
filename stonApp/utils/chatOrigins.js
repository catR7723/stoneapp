// Una conversazione privata può contenere messaggi da più cerchie.
function addUnreadOrigin(previous, message) {
  const sources = previous && typeof previous === 'object' ? previous : {};
  const circle = message.sourceCircle;
  const key = circle?._id ? String(circle._id) : 'direct';
  return { ...sources, [key]: circle?._id ? circle : null };
}
module.exports = { addUnreadOrigin };
