import { SOCKET } from "./taskNotifyConfig";
import { addInboxFromSocket, loadUnreadInbox, getInboxAppFilterScope } from "./taskInboxActions";
import { handleOsNotification } from "./taskPushNotify";
import { matchesInboxAppFilter } from "./inboxAppFilter";

export function bindTaskNotifySocket(socket) {
  if (!socket) return () => {};

  const onNewAlert = (payload) => {
    const filter = getInboxAppFilterScope();
    if (!matchesInboxAppFilter(payload.app_type, filter)) return;
    addInboxFromSocket(payload);
    void handleOsNotification(payload);
  };

  const onInboxSync = () => {
    void loadUnreadInbox().catch(() => {});
  };

  socket.on(SOCKET.NEW_ALERT, onNewAlert);
  socket.on(SOCKET.INBOX_SYNC, onInboxSync);

  return () => {
    socket.off(SOCKET.NEW_ALERT, onNewAlert);
    socket.off(SOCKET.INBOX_SYNC, onInboxSync);
  };
}
