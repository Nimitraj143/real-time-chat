# 💬 Real-Time Chat Application

A full-stack real-time chat application built with the **MERN Stack** and **Socket.io**, with secure JWT authentication, an in-app **AI Assistant powered by Google Gemini**, and production-level hardening (rate limiting, crash protection, database indexing).

🌐 **Live Demo:** [real-time-chat-1-ktb4.onrender.com](https://real-time-chat-1-ktb4.onrender.com)

> The backend runs on Render's free plan, so the first request after inactivity can take around 50 seconds while the server wakes up.

---

## 🚀 Features

### Messaging
- ⚡ **Real-Time Messaging**: instant delivery with Socket.io rooms (only conversation members receive a message)
- 💾 **Message History**: persistent chat history stored in MongoDB
- 📜 **Pagination**: loads the latest 30 messages, older ones load as you scroll up
- 📎 **File Upload**: share files up to 25 MB (multer)
- 📌 **Pin Message**: one pinned message per conversation, a new pin replaces the old one
- 🚫 **Block / Unblock**: blocked users can't message you, and the blocked person is never told they were blocked
- 🟢 **Online Status**: see who is online in real time
- 📱 **Responsive Design** with Dark / Light theme

### 🤖 AI Assistant (Gemini)
- ✨ **AI Chat**: click the ✨ icon in the sidebar to chat with an AI assistant. Follow-up questions work because earlier messages are sent along with each request
- 💡 **Explain**: open the `...` menu on any text message and tap **Explain** to get a simple explanation in a card below the chat
- 🔒 The Gemini API key stays on the server and is never exposed to the browser. AI routes require a valid JWT and have their own rate limiter

### 🔐 Security and Reliability
- **JWT authentication** for the REST API and for **Socket.io handshakes** (the server identifies users from the verified token, never from client-supplied names, which prevents impersonation)
- **Login with username or email**
- **Forgot password with email OTP**: OTPs are bcrypt-hashed, expire in 10 minutes, are invalidated after 5 wrong attempts, and the response is identical whether or not the email exists (prevents user enumeration)
- **Rate limiting** with `express-rate-limit` on login, register, OTP, upload, AI and general API routes
- **Crash protection**: every socket handler is wrapped in try/catch, plus global `unhandledRejection` and `uncaughtException` handlers
- **MongoDB compound index** on `{ conversationId, createdAt }` for fast pagination
- **React Error Boundary** shows a fallback UI with a reload button instead of a white screen

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite), Socket.io-client |
| Backend | Node.js, Express.js, Socket.io |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT, bcrypt |
| AI | Google Gemini (`@google/genai`) |
| Email (OTP) | Brevo API |
| Uploads | multer |
| Hosting | Render (server and client as separate services) |

---

## 📁 Project Structure

```
real-time-chat/
├── client/                    # React (Vite) frontend
│   └── src/
│       ├── components/
│       │   ├── Sidebar.jsx        # Navigation + ✨ AI icon
│       │   ├── Chat.jsx           # Chat window + message menu (Explain)
│       │   ├── AIChat.jsx         # AI Assistant chat
│       │   ├── AIAssistant.jsx    # Explain card
│       │   └── ErrorBoundary.jsx
│       ├── pages/
│       │   └── ChatPage.jsx
│       ├── socket.js              # connectSocket(token)
│       └── main.jsx
├── server/                    # Node.js + Express backend
│   ├── models/                # Mongoose models (User, Message, ...)
│   ├── routes/
│   │   ├── auth.js            # Login, register, OTP, rate limiters
│   │   └── ai.js              # POST /api/ai/chat (Gemini)
│   └── index.js               # Express + Socket.io + JWT socket middleware
└── .gitignore
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js v18 or higher
- MongoDB (local or Atlas)
- A [Google AI Studio](https://aistudio.google.com/) API key for the AI features
- npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Nimitraj143/real-time-chat.git
   cd real-time-chat
   ```

2. **Set up the server**
   ```bash
   cd server
   npm install
   ```

   Create a `.env` file in `server/`:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   GEMINI_API_KEY=your_gemini_api_key
   # Optional: override the default Gemini model
   GEMINI_MODEL=
   # Needed for the forgot-password OTP email
   BREVO_API_KEY=your_brevo_api_key
   ```

3. **Set up the client**
   ```bash
   cd ../client
   npm install
   ```

   The client reads the backend URL from a `const API = "..."` line at the top of `src/pages/ChatPage.jsx`, `src/components/Chat.jsx` and `src/components/Sidebar.jsx`. For local development set it to:
   ```js
   const API = "http://localhost:5000";
   ```

---

## ▶️ Running the App

Open two terminals.

**Terminal 1: backend**
```bash
cd server
npm run dev
```

**Terminal 2: frontend**
```bash
cd client
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## ☁️ Deployment (Render)

The server and the client are deployed as **two separate Render services**.

1. In all three client files, set `API` back to your live server URL (for example `https://real-time-chat-vt6f.onrender.com`).
2. On the **server** service, open the **Environment** tab and add `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY` (and `BREVO_API_KEY`). `.env` files are not pushed to GitHub, so Render needs them separately.
3. Commit **and push** your code:
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```
4. Deploy both services (**Manual Deploy → Deploy latest commit**) if auto-deploy is off, and check that the deploy's source commit matches your latest push.
5. Hard refresh the live site with `Ctrl + Shift + R` to avoid a stale cached client.

The server uses `app.set("trust proxy", 1)` so rate limiting sees each user's real IP behind Render's proxy.

---

## 🧯 Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| ✨ icon missing on the live site | Code committed but not pushed, or client not redeployed | `git push`, then redeploy the client service |
| AI chat returns 500 | Client points to a server without the AI code or key | Check the `API` URL and `GEMINI_API_KEY`, then look for `ask error:` in the server logs |
| "Too many AI requests" | AI rate limit reached | Wait a minute and try again |
| "Invalid or expired token" | Old or invalid JWT | Log out and log in again |
| First request is very slow | Render free plan was asleep | Wait about 50 seconds |

---

## 🗺️ Roadmap

- [ ] Refresh tokens with short-lived access tokens (httpOnly cookie)
- [ ] Redis adapter for horizontal Socket.io scaling
- [ ] Cloud file storage (Cloudinary / S3), since Render's disk resets on every deploy
- [ ] Streaming AI responses
- [ ] Save AI chat history in MongoDB
- [ ] Per-user AI quota and input length limit
- [ ] Move the API URL into an environment variable (`VITE_API_URL`)
- [ ] Unit tests with Jest

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.

---

Made with ❤️ by [Nimitraj143](https://github.com/Nimitraj143)
