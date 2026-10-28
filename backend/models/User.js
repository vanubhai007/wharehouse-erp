const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALL_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ALL_ROLES, required: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Public sign-up only. These stay unset for Admin-created users and the
    // first Admin, who count as verified and approved. A public sign-up can
    // sign in only once emailVerified is true and approvalStatus is
    // 'approved' (see utils/accountStatus.js).
    signupSource: { type: String, enum: ['public'] },
    emailVerified: { type: Boolean },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
    // Current email verification code: only its HMAC is stored, never the code.
    emailVerification: {
      type: new mongoose.Schema(
        {
          codeHash: String,
          expiresAt: Date,
          attempts: { type: Number, default: 0 },
          sentAt: Date,
          windowStart: Date,
          sendCount: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerification;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
