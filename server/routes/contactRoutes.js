import express from 'express'
import User from '../models/User.js'
import Message from '../models/Message.js'

const router = express.Router()

// Get all contacts for a user
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate({
        path: 'contacts',
        select: '_id username avatar',
        options: { sort: { username: 1 } }
      })
      .lean()

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get last message for each contact
    const contactsWithMessages = await Promise.all(
      user.contacts.map(async (contact) => {
        const roomId = [req.params.userId, contact._id.toString()].sort().join('_')
        
        const lastMessage = await Message.findOne({ roomId })
          .sort({ createdAt: -1 })
          .populate('from', 'username')
          .populate('to', 'username')
          .lean()

        const unreadCount = await Message.countDocuments({
          roomId,
          to: req.params.userId,
          read: false
        })

        return {
          id: contact._id.toString(),
          username: contact.username,
          avatar: contact.avatar,
          lastMessage: lastMessage ? {
            text: lastMessage.text,
            timestamp: lastMessage.createdAt,
            from: lastMessage.from.username,
            read: lastMessage.read
          } : null,
          unreadCount
        }
      })
    )

    // Sort by last message timestamp (most recent first)
    contactsWithMessages.sort((a, b) => {
      if (!a.lastMessage) return 1
      if (!b.lastMessage) return -1
      return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    })

    res.json(contactsWithMessages)
  } catch (error) {
    console.error('Get contacts error:', error)
    res.status(500).json({ error: 'Failed to get contacts' })
  }
})

// Add a contact
router.post('/add', async (req, res) => {
  try {
    const { userId, friendId } = req.body

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' })
    }

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot add yourself as a contact' })
    }

    const user = await User.findById(userId)
    const friend = await User.findById(friendId)

    if (!user || !friend) {
      return res.status(404).json({ error: 'User or friend not found' })
    }

    // Check if already a contact
    if (user.contacts.includes(friendId)) {
      return res.json({ message: 'Contact already added', contact: {
        id: friend._id.toString(),
        username: friend.username,
        avatar: friend.avatar
      }})
    }

    // Add to both users' contact lists (bidirectional)
    user.contacts.push(friendId)
    await user.save()

    // Also add reverse contact if not already there
    if (!friend.contacts.includes(userId)) {
      friend.contacts.push(userId)
      await friend.save()
    }

    res.json({
      message: 'Contact added successfully',
      contact: {
        id: friend._id.toString(),
        username: friend.username,
        avatar: friend.avatar
      }
    })
  } catch (error) {
    console.error('Add contact error:', error)
    res.status(500).json({ error: 'Failed to add contact' })
  }
})

// Remove a contact
router.delete('/remove', async (req, res) => {
  try {
    const { userId, friendId } = req.body

    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' })
    }

    const user = await User.findById(userId)
    const friend = await User.findById(friendId)

    if (!user || !friend) {
      return res.status(404).json({ error: 'User or friend not found' })
    }

    user.contacts = user.contacts.filter(
      contactId => contactId.toString() !== friendId
    )
    await user.save()

    res.json({ message: 'Contact removed successfully' })
  } catch (error) {
    console.error('Remove contact error:', error)
    res.status(500).json({ error: 'Failed to remove contact' })
  }
})

export default router
