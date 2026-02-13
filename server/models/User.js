import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 30
  },
  avatar: {
    type: String,
    required: true
  },
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Generate invite code before saving
userSchema.pre('save', async function(next) {
  if (!this.inviteCode) {
    const { randomBytes } = await import('crypto')
    this.inviteCode = randomBytes(8).toString('hex')
  }
  next()
})

// Index for search
userSchema.index({ username: 'text' })

const User = mongoose.model('User', userSchema)

export default User
