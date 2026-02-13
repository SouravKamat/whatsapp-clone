function CallOverlay({ call, user, onAnswer, onReject }) {
  const callerName = call.fromUsername || call.from
  const callerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(callerName)}&background=33e67a&color=112117&size=200`

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="mb-6">
            <img
              src={callerAvatar}
              alt={callerName}
              className="w-32 h-32 rounded-full mx-auto mb-4 ring-4 ring-primary/30"
            />
            <h2 className="text-2xl font-bold text-white mb-2">{callerName}</h2>
            <p className="text-primary/70">
              {call.type === 'video' ? 'Incoming video call' : 'Incoming voice call'}
            </p>
          </div>

          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={onReject}
              className="p-4 bg-danger hover:bg-danger/90 text-white rounded-full transition shadow-lg hover:shadow-xl"
              title="Decline"
            >
              <span className="material-icons text-3xl">call_end</span>
            </button>
            <button
              onClick={onAnswer}
              className="p-4 bg-primary hover:bg-primary/90 text-background-dark rounded-full transition shadow-lg hover:shadow-xl"
              title="Accept"
            >
              {call.type === 'video' ? (
                <span className="material-icons text-3xl">videocam</span>
              ) : (
                <span className="material-icons text-3xl">call</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CallOverlay
