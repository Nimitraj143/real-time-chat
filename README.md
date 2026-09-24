💬 Real-Time Chat Application
A full-stack real-time chat application built with the MERN Stack and Socket.io, enabling instant messaging between users with a clean and responsive UI.

🚀 Features
⚡ Real-Time Messaging — Instant message delivery powered by Socket.io
🔐 User Authentication — Secure sign-up, login, and logout with JWT
💾 Message History — Persistent chat history stored in MongoDB
🟢 Online Status — See who's online in real time
📱 Responsive Design — Works seamlessly on desktop and mobile
🛠️ Tech Stack
Layer	Technology
Frontend	React.js, Socket.io-client
Backend	Node.js, Express.js, Socket.io
Database	MongoDB (Mongoose)
Auth	JWT (JSON Web Tokens), bcrypt
📁 Project Structure
real-time-chat/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   └── package.json
├── server/          # Node.js + Express backend
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   └── index.js
└── .gitignore
⚙️ Getting Started
Prerequisites
Node.js v14 or higher
MongoDB (local or Atlas)
npm or yarn
Installation
Clone the repository

git clone https://github.com/Nimitraj143/real-time-chat.git
cd real-time-chat
Set up the Server

cd server
npm install
Create a .env file in the server/ directory:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:3000
Set up the Client

cd ../client
npm install
Create a .env file in the client/ directory:

REACT_APP_SERVER_URL=http://localhost:5000
▶️ Running the App
Open two terminals:

Terminal 1 — Start the backend:

cd server
npm start
Terminal 2 — Start the frontend:

cd client
npm start
Then open http://localhost:3000 in your browser.

🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.

Fork the repository
Create your feature branch: git checkout -b feature/your-feature
Commit your changes: git commit -m 'Add some feature'
Push to the branch: git push origin feature/your-feature
Open a Pull Request
📄 License
This project is open source and available under the MIT License.

Made with ❤️ by Nimitraj143
