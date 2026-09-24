// Una chiave riservata, distinta dagli ObjectId MongoDB delle cerchie.
const HOME_ALERT_SCOPE = '__home_direct__';
function privateAlertEvent(message) {
  return {
    kind: 'private',
    circleId: message.sourceCircle?._id ? String(message.sourceCircle._id) : HOME_ALERT_SCOPE,
    roomId: message.roomId,
    messageId: message._id,
  };
}
module.exports = { HOME_ALERT_SCOPE, privateAlertEvent };
