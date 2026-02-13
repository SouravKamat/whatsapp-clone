function MessageBubble({ message, isOwn, isRead }) {
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[85%]`}>
      <div
        className={`p-3.5 rounded-2xl shadow-lg ${
          isOwn
            ? 'message-gradient text-background-dark rounded-tr-none'
            : 'bg-white dark:bg-white/5 text-slate-900 dark:text-white rounded-tl-none border border-primary/5'
        }`}
      >
        <p className="text-[15px] leading-relaxed font-medium">{message.text}</p>
      </div>
      <div className={`flex items-center gap-1 mt-1.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
        <span className="text-[10px] text-slate-400 uppercase font-medium">{formatTime(message.timestamp)}</span>
        {isOwn && (
          <span className="material-icons text-[14px] text-primary">
            {isRead ? 'done_all' : 'done'}
          </span>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
