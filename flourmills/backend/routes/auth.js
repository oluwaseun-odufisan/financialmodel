import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const normalized = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalized });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalized,
      password: hash,
      name: name?.trim() || 'Analyst',
    });

    const token = signToken(user);
    const userPayload = { id: user._id, email: user.email, name: user.name };
    req.user = userPayload;

    await logAuditEvent(req, {
      action: 'auth.register',
      entityType: 'user',
      entityId: String(user._id),
      entityName: user.email,
      userEmail: user.email,
      userName: user.name,
      metadata: { registeredAt: new Date().toISOString() },
    });

    return res.json({ token, user: userPayload });
  } catch (error) {
    console.error('[auth/register]', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastLoginAt = new Date();
    await user.save();

    const userPayload = { id: user._id, email: user.email, name: user.name, lastLoginAt: user.lastLoginAt };
    req.user = userPayload;

    await logAuditEvent(req, {
      action: 'auth.login',
      entityType: 'user',
      entityId: String(user._id),
      entityName: user.email,
      metadata: { loginAt: user.lastLoginAt.toISOString() },
    });

    const token = signToken(user);
    return res.json({ token, user: userPayload });
  } catch (error) {
    console.error('[auth/login]', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      lastLoginAt: user.lastLoginAt || null,
    },
  });
});

export default router;
