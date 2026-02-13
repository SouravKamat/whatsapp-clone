import express from 'express'
import Message from '../models/Message.js'
import User from '../models/User.js'

const router = express.Router()

// Get chat history for a room
router.get('/history/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    const { limit = 50, before } = req.query

    const query = { roomId }
    if (before) {
      query.createdAt = { $lt: new Date(before) }
    }

    const messages = await Message.find(query)
      .populate('from', 'username avatar')
      .populate('to', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean()

    res.json(messages.reverse())
  } catch (error) {
    console.error('Get chat history error:', error)
    res.status(500).json({ error: 'Failed to get chat history' })
  }
})

// Mark messages as read
router.put('/read', async (req, res) => {
  try {
    const { roomId, userId } = req.body

    await Message.updateMany(
      {
        roomId,
        to: userId,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    )

    res.json({ message: 'Messages marked as read' })
  } catch (error) {
    console.error('Mark read error:', error)
    res.status(500).json({ error: 'Failed to mark messages as read' })
  }
})

export default router
