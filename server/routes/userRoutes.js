import express from 'express'
import User from '../models/User.js'

const router = express.Router()

// Search users by username
router.get('/search', async (req, res) => {
  try {
    const { query, excludeUserId } = req.query
    
    if (!query || query.length < 2) {
      return res.json([])
    }

    const searchRegex = new RegExp(query, 'i')
    const searchQuery = {
      username: searchRegex,
      _id: { $ne: excludeUserId }
    }

    const users = await User.find(searchQuery)
      .select('_id username avatar')
      .limit(10)
      .lean()

    res.json(users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar
    })))
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Failed to search users' })
  }
})

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('_id username avatar')
      .lean()

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
})

// Create or get user
router.post('/create', async (req, res) => {
  try {
    const { username, avatar } = req.body

    if (!username || !avatar) {
      return res.status(400).json({ error: 'Username and avatar are required' })
    }

    // Check if user exists
    let user = await User.findOne({ username: username.toLowerCase() })

    if (user) {
      return res.json({
        id: user._id.toString(),
        username: user.username,
        avatar: user.avatar,
        contacts: user.contacts.map(c => c.toString())
      })
    }

    // Create new user
    user = await User.create({
      username: username.toLowerCase(),
      avatar
    })

    res.status(201).json({
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      contacts: []
    })
  } catch (error) {
    console.error('Create user error:', error)
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username already exists' })
    }
    res.status(500).json({ error: 'Failed to create user' })
  }
})

export default router
