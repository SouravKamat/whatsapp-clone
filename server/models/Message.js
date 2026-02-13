import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 5000
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
})

// Index for efficient queries
messageSchema.index({ roomId: 1, createdAt: -1 })
messageSchema.index({ from: 1, to: 1 })

const Message = mongoose.model('Message', messageSchema)

export default Message
