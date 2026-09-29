import { io } from "socket.io-client";

export const socket = io("https://real-time-chat-vt6f.onrender.com", {
  autoConnect: false,
});

// Login ke baad ye function call karke token set karo, phir connect karo
export function connectSocket(token) {
  socket.auth = { token };
  socket.connect();
}