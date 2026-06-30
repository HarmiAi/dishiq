import { io, Socket } from 'socket.io-client';

let SOCKET_URL = process.env.NEXT_PUBLIC_API_URL;

if (!SOCKET_URL) {
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    SOCKET_URL = 'https://dishiq-zabl.onrender.com';
  } else {
    SOCKET_URL = 'http://localhost:5000';
  }
}

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
