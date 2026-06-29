import { io, Socket } from 'socket.io-client';

// Resolve backend Socket server URL (fallback to localhost:5000 in dev)
const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let socketInstance: Socket | null = null;

/**
 * Retrieve the active global Socket.IO client instance
 */
export const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true
    });
  }
  return socketInstance;
};
