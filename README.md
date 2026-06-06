# 💬 Nexus Chat

A full-stack real-time chat application built with React, Node.js, Express, Socket.IO, and MongoDB.

## 🚀 Quick Start

### ✅ Prerequisites

- Node.js v18+
- npm
- MongoDB Atlas account or local MongoDB
- Cloudinary account for media uploads
- SendGrid account for email notifications
- Groq API key for AI assistant features
- Giphy API key for GIF search

## 📦 1. Clone or Extract the Project

```bash
cd NexChat
```

## 🛠️ 2. Backend Setup

```bash
cd backend
npm install
```

Create or edit `backend/.env` and fill in your credentials:

```env
PORT=10000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nexus-chat
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=30d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

EMAIL_FROM=your_verified_sender_email@example.com
EMAIL_FROM_NAME=Nexus Chat
EMAIL_REPLY_TO=support@example.com
SENDGRID_API_KEY=your_sendgrid_api_key

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile

CLIENT_URL=http://localhost:3000
CLIENT_URLS=http://localhost:3000
```

Start the backend:

```bash
npm run dev
```

or:

```bash
npm start
```

Backend runs on:

```text
http://localhost:10000
```

## 🎨 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create or edit `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:10000/api
REACT_APP_SOCKET_URL=http://localhost:10000
REACT_APP_GIPHY_API_KEY=your_giphy_api_key
REACT_APP_TURN_URL=turn:your-turn-server.com:3478
REACT_APP_TURN_USERNAME=your_turn_username
REACT_APP_TURN_CREDENTIAL=your_turn_password
```

Start the frontend:

```bash
npm start
```

Frontend runs on:

```text
http://localhost:3000
```

## ✅ Features

| Feature | Status |
| --- | --- |
| Real-time messaging with Socket.IO | ✅ |
| JWT authentication | ✅ |
| 1-on-1 and group chats | ✅ |
| Typing indicators | ✅ |
| Read receipts | ✅ |
| Emoji reactions | ✅ |
| Reply, edit, and delete messages | ✅ |
| Pin messages | ✅ |
| File and image sharing with Cloudinary | ✅ |
| AI assistant with `@AI` mentions | ✅ |
| Email notifications for offline users | ✅ |
| Scheduled messages | ✅ |
| Disappearing messages with MongoDB TTL | ✅ |
| Multi-device support | ✅ |
| Voice and video calls with WebRTC | ✅ |
| Screen sharing | ✅ |
| Online and offline status | ✅ |
| Analytics dashboard | ✅ |
| Dark UI | ✅ |

## 🗂️ Project Structure

```text
NexChat/
|-- backend/          # Node.js + Express + Socket.IO
|   |-- controllers/
|   |-- models/       # Mongoose schemas
|   |-- routes/
|   |-- middleware/
|   |-- sockets/
|   |-- utils/        # email, AI, cloudinary, scheduler
|   `-- server.js
|-- frontend/         # React + Tailwind CSS
|   `-- src/
|       |-- components/
|       |-- context/
|       |-- hooks/
|       |-- pages/
|       |-- services/
|       `-- utils/
`-- README.md
```

## 🌐 API Endpoints

```text
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users              Search users
PUT    /api/users/profile      Update profile
POST   /api/users/upload-avatar

POST   /api/chats              Create or get 1:1 chat
GET    /api/chats              Get all user chats
GET    /api/chats/:id
PUT    /api/chats/:id/mute

GET    /api/messages/:chatId   Get messages
POST   /api/messages           Send message
PUT    /api/messages/:id       Edit message
DELETE /api/messages/:id       Delete message
GET    /api/messages/search    Search messages
PUT    /api/messages/:id/pin   Pin message

POST   /api/groups             Create group
PUT    /api/groups/:id/add     Add group member
PUT    /api/groups/:id/remove  Remove group member
PUT    /api/groups/:id/promote Promote group member
DELETE /api/groups/:id         Delete group

POST   /api/messages/upload    Upload media
```

## 🔌 Socket Events

| Event | Direction | Description |
| --- | --- | --- |
| `sendMessage` | client to server | Send a message |
| `receiveMessage` | server to client | Receive a message |
| `typing` / `stopTyping` | client to server | Typing indicators |
| `userTyping` / `userStopTyping` | server to client | Broadcast typing status |
| `messageRead` | client to server | Mark a message as seen |
| `addReaction` / `removeReaction` | client to server | Emoji reactions |
| `callUser` / `answerCall` / `endCall` | bidirectional | WebRTC signaling |
| `iceCandidate` | bidirectional | ICE candidates |

## 🤖 AI Assistant

Type `@AI` or `@ai` at the start of any message to invoke the AI assistant.

Example:

```text
@AI What is the capital of France?
```

This feature requires `GROQ_API_KEY` in `backend/.env`.

## 📦 Deployment

### 🌍 Frontend on Vercel

```bash
cd frontend
npm run build
```

Push the project to GitHub, then connect the frontend folder to Vercel.

Set these frontend environment variables in Vercel:

```env
REACT_APP_API_URL=https://your-backend-url/api
REACT_APP_SOCKET_URL=https://your-backend-url
REACT_APP_GIPHY_API_KEY=your_giphy_api_key
REACT_APP_TURN_URL=turn:your-turn-server.com:3478
REACT_APP_TURN_USERNAME=your_turn_username
REACT_APP_TURN_CREDENTIAL=your_turn_password
```

### 🖥️ Backend on Render or Railway

Use these settings:

```text
Build command: npm install
Start command: node server.js
```

Set all backend `.env` variables in the hosting dashboard.

### 🗄️ Database on MongoDB Atlas

1. Create a free cluster at MongoDB Atlas.
2. Whitelist your deployment IPs, or use `0.0.0.0/0` for quick testing.
3. Copy the connection string to `MONGO_URI`.

## ⚙️ Environment Notes

- `MONGO_URI` is required in production.
- `JWT_SECRET` should be long, random, and private.
- `EMAIL_FROM` must be a verified SendGrid sender.
- For best inbox delivery, authenticate your sending domain in SendGrid and add the SPF/DKIM DNS records SendGrid gives you. Add a DMARC record for the same domain, and use an `EMAIL_FROM` address on that authenticated domain instead of a free Gmail/Yahoo/Outlook address.
- `EMAIL_FROM_NAME` is the sender display name shown in inboxes. `EMAIL_REPLY_TO` should be an address on the same verified domain.
- `SENDGRID_API_KEY` is required for email notifications.
- `CLOUDINARY_*` values are required for file and image sharing.
- `GROQ_API_KEY` is required for AI assistant features.
- `CLIENT_URL` should point to the frontend URL.
- `CLIENT_URLS` can hold allowed frontend origins if multiple client URLs are supported.
- React environment variables must start with `REACT_APP_`.
- `REACT_APP_TURN_*` values are optional, but strongly recommended for mobile WebRTC calls on carrier networks.

## 🔐 Security

Never commit real `.env` values to Git. If any database credentials, API keys, or JWT secrets have been exposed, rotate them immediately in MongoDB Atlas, Cloudinary, SendGrid, Groq, and any other affected service.
