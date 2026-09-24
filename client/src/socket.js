import { io } from "socket.io-client";
export const socket = io("https://real-time-chat-vt6f.onrender.com", { autoConnect: false });
