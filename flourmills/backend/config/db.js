import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('  FATAL: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
    });
    console.log('[db] Connected to MongoDB');
    return mongoose.connection;
  } catch (err) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('  FATAL: Could not connect to MongoDB.');
    console.error('  URI:', uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@'));
    console.error('  Error:', err.message);
    console.error('');
    console.error('');
    process.exit(1);
  }
}

/** Health helper for /api/health */
export function dbState() {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}
