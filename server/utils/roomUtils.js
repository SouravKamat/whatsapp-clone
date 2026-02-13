// Generate room ID for two users
export const generateRoomId = (userId1, userId2) => {
  return [userId1, userId2].sort().join('_')
}

// Parse room ID to get user IDs
export const parseRoomId = (roomId) => {
  return roomId.split('_')
}
