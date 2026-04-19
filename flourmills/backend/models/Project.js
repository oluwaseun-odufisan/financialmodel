import mongoose from 'mongoose';

const Mixed = mongoose.Schema.Types.Mixed;

const ProjectSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectName: { type: String,  required: true, default: 'New Project' },
  template:    { type: String,  enum: ['flour_mills', 'blank'], default: 'flour_mills' },
  location:    { type: Mixed,   default: {} },
  assumption:  { type: Mixed,   required: true },
  result:      { type: Mixed,   default: null },
  lastRunAt:   { type: Date,    default: null },
  createdAt:   { type: Date,    default: Date.now },
  updatedAt:   { type: Date,    default: Date.now },
});

ProjectSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
ProjectSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

export default mongoose.models.Project || mongoose.model('Project', ProjectSchema);
