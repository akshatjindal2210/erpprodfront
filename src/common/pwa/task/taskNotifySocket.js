import { SOCKET } from "./taskNotifyConfig";
import { addInboxFromSocket, loadUnreadInbox } from "./taskInboxActions";
import { handleOsNotification } from "./taskPushNotify";
import { getInboxAppFilter, matchesInboxAppFilter } from "./inboxAppFilter";

export function bindTaskNotifySocket(socket) {
  if (!socket) return () => {};

  const onNewAlert = (payload) => {
    addInboxFromSocket(payload);
    if (matchesInboxAppFilter(payload.app_type, getInboxAppFilter())) {
      void handleOsNotification(payload);
    }
  };

  const onInboxSync = () => {
    void loadUnreadInbox(getInboxAppFilter()).catch(() => {});
  };

  socket.on(SOCKET.NEW_ALERT, onNewAlert);
  socket.on(SOCKET.INBOX_SYNC, onInboxSync);

  return () => {
    socket.off(SOCKET.NEW_ALERT, onNewAlert);
    socket.off(SOCKET.INBOX_SYNC, onInboxSync);
  };
}
