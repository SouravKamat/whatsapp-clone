import express from 'express'
import User from '../models/User.js'

const router = express.Router()

// Get user by invite code
router.get('/:inviteCode', async (req, res) => {
  try {
    const user = await User.findOne({ inviteCode: req.params.inviteCode })
      .select('_id username avatar inviteCode')
      .lean()

    if (!user) {
      return res.status(404).json({ error: 'Invalid invite code' })
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      inviteCode: user.inviteCode
    })
  } catch (error) {
    console.error('Get invite error:', error)
    res.status(500).json({ error: 'Failed to get invite' })
  }
})

export default router
