# 💬 Nexus Chat

A full-stack real-time chat application built with React, Node.js, Socket.IO, and MongoDB.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)
- (Optional) Cloudinary, Groq, Gmail accounts for full features

---

### 1. Clone / Extract the project
```bash
cd nexus-chat
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Edit `.env` and fill in your credentials:
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexus-chat
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=30d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

CLIENT_URL=http://localhost:3000
```

Start the backend:
```bash
npm run dev     # development (with nodemon)
# or
npm start       # production
```

Backend runs on → http://localhost:5000

---

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Edit `.env` (defaults are fine for local dev):
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

Start the frontend:
```bash
npm start
```

Frontend runs on → http://localhost:3000

---

## ✅ Features

| Feature | Status |
|---|---|
| Real-time messaging (Socket.IO) | ✅ |
| JWT Authentication | ✅ |
| 1-on-1 & Group chats | ✅ |
| Typing indicators | ✅ |
| Read receipts | ✅ |
| Emoji reactions | ✅ |
| Reply / Edit / Delete messages | ✅ |
| Pin messages | ✅ |
| File & image sharing (Cloudinary) | ✅ |
| AI assistant (@AI mentions) | ✅ |
| Email notifications for offline users | ✅ |
| Scheduled messages | ✅ |
| Disappearing messages (MongoDB TTL) | ✅ |
| Multi-device support | ✅ |
| Voice & Video calls (WebRTC) | ✅ |
| Screen sharing | ✅ |
| Online/offline status | ✅ |
| Analytics dashboard | ✅ |
| Dark UI | ✅ |

---

## 🗂️ Project Structure

```
nexus-chat/
├── backend/          # Node.js + Express + Socket.IO
│   ├── controllers/
│   ├── models/       # Mongoose schemas
│   ├── routes/
│   ├── middleware/
│   ├── sockets/
│   ├── utils/        # email, AI, cloudinary, scheduler
│   └── server.js
└── frontend/         # React + Tailwind CSS
    └── src/
        ├── components/
        ├── context/
        ├── hooks/
        ├── pages/
        ├── services/
        └── utils/
```

---

## 🌐 API Endpoints

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users              Search users
PUT    /api/users/profile      Update profile
POST   /api/users/upload-avatar

POST   /api/chats              Create/get 1:1 chat
GET    /api/chats              Get all user chats
GET    /api/chats/:id
PUT    /api/chats/:id/mute

GET    /api/messages/:chatId   Get messages (paginated)
POST   /api/messages           Send message
PUT    /api/messages/:id       Edit message
DELETE /api/messages/:id
GET    /api/messages/search    Full-text search
PUT    /api/messages/:id/pin

POST   /api/groups             Create group
PUT    /api/groups/:id/add
PUT    /api/groups/:id/remove
PUT    /api/groups/:id/promote
DELETE /api/groups/:id

POST   /api/messages/upload    Upload media
```

---

## 🔌 Socket Events

| Event | Direction | Description |
|---|---|---|
| `sendMessage` | client→server | Send a message |
| `receiveMessage` | server→client | Receive a message |
| `typing` / `stopTyping` | client→server | Typing indicators |
| `userTyping` / `userStopTyping` | server→client | Broadcast typing |
| `messageRead` | client→server | Mark as seen |
| `addReaction` / `removeReaction` | client→server | Emoji reactions |
| `callUser` / `answerCall` / `endCall` | bidirectional | WebRTC signaling |
| `iceCandidate` | bidirectional | ICE candidates |

---

## 📦 Deployment

**Frontend → Vercel**
```bash
cd frontend && npm run build
# Push to GitHub → connect to vercel.com
```

**Backend → Render / Railway**
- Build command: `npm install`
- Start command: `node server.js`
- Set all `.env` variables in the dashboard

**Database → MongoDB Atlas**
- Create free cluster at cloud.mongodb.com
- Whitelist IPs: `0.0.0.0/0`
- Copy connection string to `MONGO_URI`

---

## 🤖 AI Assistant

Type `@AI` (or `@ai`) at the start of any message to invoke the AI assistant.

Example: `@AI What is the capital of France?`

Requires `GROQ_API_KEY` in backend `.env`.
