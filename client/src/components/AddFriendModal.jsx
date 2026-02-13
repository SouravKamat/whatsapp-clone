import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function AddFriendModal({ isOpen, onClose, currentUserId, onContactAdded }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [isOpen])

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `${API_URL}/users/search?query=${encodeURIComponent(searchQuery)}&excludeUserId=${currentUserId}`
        )
        const data = await response.json()
        setSearchResults(data)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, currentUserId])

  const handleAddContact = async (friendId) => {
    setAdding(friendId)
    try {
      const response = await fetch(`${API_URL}/contacts/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUserId,
          friendId
        })
      })

      const data = await response.json()
      if (response.ok) {
        onContactAdded(data.contact)
        setSearchResults(prev => prev.filter(user => user.id !== friendId))
      } else {
        alert(data.error || 'Failed to add contact')
      }
    } catch (error) {
      console.error('Add contact error:', error)
      alert('Failed to add contact')
    } finally {
      setAdding(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Add Friend</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <span className="material-icons text-3xl">close</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-primary/50 text-xl">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username..."
            className="w-full bg-background-dark/50 border-white/10 border text-white rounded-full py-3 pl-12 pr-6 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-white/20"
            autoFocus
          />
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto hide-scrollbar">
          {loading ? (
            <div className="text-center py-8 text-white/60">
              <span className="material-icons animate-spin text-3xl">refresh</span>
              <p className="mt-2">Searching...</p>
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-8 text-white/60">
              <span className="material-icons text-4xl mb-2">person_search</span>
              <p>Type at least 2 characters to search</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <span className="material-icons text-4xl mb-2">person_off</span>
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar}
                      alt={user.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                    />
                    <div>
                      <h3 className="font-semibold text-white">{user.username}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddContact(user.id)}
                    disabled={adding === user.id}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-background-dark font-semibold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {adding === user.id ? (
                      <>
                        <span className="material-icons animate-spin text-sm">refresh</span>
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-icons text-sm">person_add</span>
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AddFriendModal
