import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('  FATAL: MONGODB_URI environment variable is not set.');
    console.error('');
    console.error('  This application requires MongoDB. Set MONGODB_URI in your .env:');
    console.error('    Local:   MONGODB_URI=mongodb://127.0.0.1:27017/flour_mills');
    console.error('    Atlas:   MONGODB_URI=mongodb+srv://user:pw@cluster.mongodb.net/flour_mills');
    console.error('');
    console.error('  See .env.example for a reference configuration.');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('');
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
    console.error('  Troubleshooting:');
    console.error('    • Check MongoDB is running (local)  : mongosh');
    console.error('    • Check network / firewall (Atlas)  : whitelist your IP');
    console.error('    • Check credentials                 : user/pw in URI');
    console.error('═══════════════════════════════════════════════════════════════════');
    console.error('');
    process.exit(1);
  }
}

/** Health helper for /api/health */
export function dbState() {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}
