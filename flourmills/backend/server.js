import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, dbState } from './config/db.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  // MongoDB is required; connectDB() exits process on failure.
  await connectDB();

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, db: dbState(), time: new Date().toISOString() })
  );

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);

  app.use((err, _req, res, _next) => {
    console.error('[unhandled]', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  Flour Mills — Project Finance Modeling System');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  API:    http://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
    console.log(`  DB:     ${dbState()}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
  });
}

bootstrap().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});
