// Load required packages
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'User name is required']
  },
  email: {
    type: String,
    required: [true, 'User email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  pendingTasks: {
    type: [String], // store Task _id strings
    default: []
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
}, { versionKey: false });

UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
