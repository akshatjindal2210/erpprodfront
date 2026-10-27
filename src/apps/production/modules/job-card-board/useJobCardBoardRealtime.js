"use client";

/**
 * Placeholder for future Socket.IO live board updates.
 * Call from Job Card Board when realtime is wired — no-op for now.
 *
 * @param {{ enabled?: boolean, onEvent?: (payload: unknown) => void }} [_opts]
 */
export function useJobCardBoardRealtime(_opts = {}) {
  // TODO: connect Socket.IO and push board/calendar patches via onEvent
  return { connected: false };
}
