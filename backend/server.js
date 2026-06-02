const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
require('express-async-errors');

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
};

// Socket.IO setup
const io = new Server(server, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Database connection is not ready. Check your MongoDB configuration.',
    });
  }

  next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));

// Socket handler
require('./sockets/socketHandler')(io);

// Scheduled message job
require('./utils/scheduler')(io);

// Global error handler
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await User.updateMany(
      {
        $or: [
          { isOnline: true },
          { socketIds: { $ne: [] } },
        ],
      },
      {
        isOnline: false,
        socketIds: [],
        lastSeen: new Date(),
      }
    );
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

startServer();
