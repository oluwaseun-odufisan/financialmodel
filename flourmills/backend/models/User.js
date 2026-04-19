import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  name:     { type: String, default: 'Analyst' },
  createdAt:{ type: Date,   default: Date.now },
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
