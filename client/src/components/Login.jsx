import { useState } from 'react'

const AVATARS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuByqRJYg5BVEc9IYb7iXwAIJ3O5cQsmlntL4klz928V9mXGsll1yLF6wAN2d24dIwEa1lanicMBcBRH3cUQjanyNT7_rwGJcQrJHAzb_TOp79K5-uJ3qduX9ooAlZUFoavY5rXxj7Lsb80Tq0IJQs1ZwL5pwAXSaW-Ke40samdijZwKxYJ8P_Q4BFW-jgY_VlKhGuuCLvACsqgtVh6IOx_LjAA7lzOWUBYaxCt8TkQhQY2fCRHiCA_cawCVqQroX6HReyOjgCEWMog',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBbpIdormuDCyvdGHvooF4usxzNoZPsRfBLhvrfwgWgnfoEDzt3crNGC_NWPQ1pbAHS4XOxZ9V0tG7C2wJVqpMa6FkYWGXtWm7qlGv8tP-BnyBh7iCeqvAbNkW1deE-AXsGLinF5MLp0Vy__ts5GT1d0pVwvY6wS-IhZw3OTi3Uvc5tc5OQuL9DvLfbeDHCe-5Dxf1qjQzYyCMmsZi6_M-FhLtUS9cozQzhNiaNWBYcxaciyBb3PQ7FvW_e1q0OCQkfMuJfjsrL6GU',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAwbev9-S_fo4-qsp8p-m7GqapCGv2ig_5ghAgrZDGQ4UP0MEPdXfIEquBx3QD0Ar9Y8IHpZu2ywgrX1JWibhAxIyaDoggIEZMM2FVoq2EuZYndKJb-ztop--SSxVOwS8c3UfJREe0F_Fed7otkJ-qY0uPpFZqfBmcxHxxTHmzDYDM6wqcPUoKYi0Shfv9w7_4yAp0zqMBwvIIzSkI5QxLRalRLen0cYBY6UHZHVbG1JmR-utZq7LqpCGWva-cFYei4497TkelUPug',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA7fIJ9_TKa8GCh8Xwt8kYoDMnf1qpcQ_Nji1qNrvCA8Ne3CPRvxianBOKZIuXd_2xysfFac-6OCZKdoqDeEVI8gr-p83dNKfVK78W1AK35iUqN0wrbpdvHOurnmPIeHDnCES-JIBOKHVa-AskSbp5Yxp1W1khsW5QnUEUmUDoOM5Oucnp9dWWxh_sMej_0HZyQ5T1FlHbmkVBzXtx4mN9xA1UPoZdwdcTTGEhAzOxJFlbGq_oib_Sgvy_msO11IazBt3IkldZ_zTc',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBOxSTT8qTj955k24D8o0U8xZ2YGyHerIFm-QkU6PZDJN59DylfXPyPgsqPPXevvA8TL3YRf_MUMVMAYe0UD6-4X0_wslRJ4VBVC5bdDco1pS-iWyxQ_GoRPYzyX-9DSkjL0d-DHRO7ERT30s9dIIuWIuFaa6iKxAQo2vgOw_L-pb9bJsZNgUauxpyVl8fihbGbx9_ypaW-EkNYL3p16_6yCGDw2dahykj8r5rwCBXvk-FlOj8sDubDtrMFX2kJqc8g_Sf8LoxuP24',
]

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(0)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim()) {
      onLogin({
        username: username.trim(),
        avatar: AVATARS[selectedAvatar]
      })
    }
  }

  return (
    <div className="min-h-screen bg-background-dark font-display text-white overflow-hidden h-screen flex items-center justify-center p-6 relative">
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 pattern-bg pointer-events-none"></div>
      
      {/* Phone Container */}
      <div className="relative w-full max-w-[400px] h-[800px] max-h-screen flex flex-col items-center justify-center z-10">
        {/* Header Section */}
        <div className="text-center mb-8 w-full">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
            <span className="material-icons text-primary text-3xl">chat</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome</h1>
          <p className="text-primary/70 text-sm">Join the global conversation today</p>
        </div>

        {/* Main Login Card */}
        <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-8">
          {/* Username Input Group */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-primary/80 ml-1" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons text-primary/50 text-xl">alternate_email</span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alex_smith"
                className="w-full bg-background-dark/50 border-white/10 border text-white rounded-full py-4 pl-12 pr-6 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-white/20"
                required
                autoFocus
              />
            </div>
            <p className="text-[10px] text-white/40 ml-1">How others will see you in chats and calls.</p>
          </div>

          {/* Avatar Selection Grid */}
          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-primary/80">Select Avatar</label>
              <span className="text-[10px] text-white/40">{AVATARS.length} characters available</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedAvatar(index)}
                  className="relative group"
                >
                  <div className={`aspect-square rounded-full overflow-hidden border-2 p-0.5 transition-colors ${
                    selectedAvatar === index ? 'border-primary' : 'border-white/5 hover:border-primary/50'
                  }`}>
                    <img
                      className={`w-full h-full object-cover rounded-full transition-all ${
                        selectedAvatar === index ? '' : 'grayscale hover:grayscale-0'
                      }`}
                      src={avatar}
                      alt={`Avatar ${index + 1}`}
                    />
                  </div>
                  {selectedAvatar === index && (
                    <div className="absolute -top-1 -right-1 bg-primary text-background-dark rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="material-icons text-xs font-bold">check</span>
                    </div>
                  )}
                </button>
              ))}
              <button
                type="button"
                className="relative group flex items-center justify-center"
              >
                <div className="aspect-square w-full rounded-full border-2 border-dashed border-white/20 flex flex-col items-center justify-center hover:border-primary/50 transition-colors bg-white/5">
                  <span className="material-icons text-white/40 text-lg">add_a_photo</span>
                </div>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleSubmit}
            className="w-full bg-primary hover:bg-primary/90 text-background-dark font-bold py-5 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>Enter Chat</span>
            <span className="material-icons text-xl">arrow_forward</span>
          </button>
        </div>

        {/* Footer / Legal */}
        <div className="mt-8 text-center px-4">
          <p className="text-xs text-white/30 leading-relaxed">
            By entering, you agree to our{' '}
            <a className="text-primary/60 hover:text-primary transition-colors underline underline-offset-4" href="#">
              Terms of Service
            </a>{' '}
            and{' '}
            <a className="text-primary/60 hover:text-primary transition-colors underline underline-offset-4" href="#">
              Privacy Policy
            </a>.
          </p>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
      <div className="fixed -bottom-32 -left-32 w-64 h-64 bg-primary/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed -top-32 -right-32 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
    </div>
  )
}

export default Login
