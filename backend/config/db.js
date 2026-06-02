const mongoose = require('mongoose');

const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/nexus-chat';

const isPlaceholderMongoUri = (mongoUri = '') => {
  const trimmedUri = mongoUri.trim();

  return (
    !trimmedUri ||
    trimmedUri.includes('<user>') ||
    trimmedUri.includes('<password>') ||
    /@cluster\.mongodb\.net(\/|$)/i.test(trimmedUri)
  );
};

const resolveMongoUri = () => {
  const mongoUri = process.env.MONGO_URI || '';

  if (!isPlaceholderMongoUri(mongoUri)) {
    return mongoUri;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGO_URI is missing or still using the placeholder Atlas connection string.');
  }

  console.warn(
    `MONGO_URI is missing or still using the placeholder Atlas connection string. Falling back to local MongoDB at ${LOCAL_MONGO_URI}.`
  );

  return LOCAL_MONGO_URI;
};

const connectDB = async () => {
  mongoose.set('bufferCommands', false);

  const mongoUri = resolveMongoUri();

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('MongoDB connected');
};

module.exports = connectDB;
