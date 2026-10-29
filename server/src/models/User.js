import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, default: '', maxlength: 20 },
    program: { type: String, default: '', maxlength: 100 },
    year: { type: String, default: '', maxlength: 30 },
    bio: { type: String, default: '', maxlength: 240 },
    campus: { type: String, default: 'MIT-WPU, Pune', maxlength: 100 },
    role: { type: String, enum: ['student', 'admin'], default: 'student' }
  },
  { timestamps: true }
);

/** Shape returned to the client. Never includes the password hash. */
userSchema.methods.toClient = function toClient() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    program: this.program,
    year: this.year,
    bio: this.bio,
    campus: this.campus,
    role: this.role
  };
};

export default mongoose.model('User', userSchema);
