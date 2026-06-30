import { io, Socket } from 'socket.io-client';

let SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || '';

if (SOCKET_URL.endsWith('/api')) {
  SOCKET_URL = SOCKET_URL.slice(0, -4);
}

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
