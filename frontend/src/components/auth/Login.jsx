import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const fieldLabelClass = 'mono-font mb-2 block text-[0.68rem] uppercase tracking-[0.12em] text-white/62';
const inputClass =
  'w-full rounded-[18px] border border-white/10 bg-[#13131c] px-4 py-3.5 text-white outline-none transition placeholder:text-white/34 focus:border-[#7c6aff]/50 focus:bg-[#171722] focus:shadow-[0_0_0_3px_rgba(124,106,255,0.14)]';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    });
  };

  const handlePointerLeave = () => {
    setPointer({ x: 0.5, y: 0.5 });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/app');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div
      className="relative h-screen overflow-x-hidden overflow-y-auto bg-[#050508] text-[#f0eeff]"
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_45%_at_20%_18%,rgba(124,106,255,0.16),transparent_62%),radial-gradient(ellipse_42%_36%_at_82%_18%,rgba(255,106,176,0.16),transparent_58%),radial-gradient(ellipse_48%_40%_at_50%_78%,rgba(106,255,232,0.08),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:70px_70px] opacity-25" />
      <div
        className="pointer-events-none absolute inset-0 opacity-90 transition-transform duration-300"
        style={{
          transform: `translate(${(pointer.x - 0.5) * 24}px, ${(pointer.y - 0.5) * 24}px)`,
        }}
      >
        <div className="absolute left-[8%] top-[14%] h-56 w-56 rounded-full bg-[#7c6aff]/16 blur-[110px]" />
        <div className="absolute right-[10%] top-[18%] h-48 w-48 rounded-full bg-[#ff6ab0]/14 blur-[110px]" />
        <div className="absolute bottom-[10%] left-[28%] h-64 w-64 rounded-full bg-[#6affe8]/10 blur-[120px]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-80 transition-[background] duration-200"
        style={{
          background: `radial-gradient(circle at ${pointer.x * 100}% ${pointer.y * 100}%, rgba(255,255,255,0.07), transparent 14%), radial-gradient(circle at ${pointer.x * 100}% ${pointer.y * 100}%, rgba(124,106,255,0.16), transparent 26%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[7%] top-[17%] hidden w-[200px] rounded-[20px] border border-white/10 bg-[#12121c]/70 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl md:block"
        style={{
          transform: `translate(${(pointer.x - 0.5) * -32}px, ${(pointer.y - 0.5) * -18}px) rotate(-7deg)`,
          transition: 'transform 220ms ease-out',
        }}
      >
        <div className="mono-font text-[0.62rem] uppercase tracking-[0.14em] text-[#c9c0ff]">Live Signal</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#6a52ff] to-[#ff6ab0]" />
        </div>
        <p className="mt-3 text-sm leading-6 text-white/54">Encrypted workspace active. Secure entry channel ready.</p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[13%] bottom-[18%] hidden w-[190px] rounded-[20px] border border-white/10 bg-[#12121c]/66 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl lg:block"
        style={{
          transform: `translate(${(pointer.x - 0.5) * -24}px, ${(pointer.y - 0.5) * 16}px) rotate(6deg)`,
          transition: 'transform 220ms ease-out',
        }}
      >
        <div className="mono-font text-[0.62rem] uppercase tracking-[0.14em] text-[#6affe8]">Quick Access</div>
        <div className="mt-3 space-y-2">
          <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[0.8rem] text-white/64">
            New chats synced
          </div>
          <div className="rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[0.8rem] text-white/64">
            AI assistant ready
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[13%] right-[8%] hidden w-[220px] rounded-[22px] border border-white/10 bg-[#12121c]/68 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl lg:block"
        style={{
          transform: `translate(${(pointer.x - 0.5) * 30}px, ${(pointer.y - 0.5) * 20}px) rotate(8deg)`,
          transition: 'transform 220ms ease-out',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] text-sm font-bold text-white">
            AI
          </span>
          <div>
            <div className="text-sm font-semibold text-white">Background Agent</div>
            <div className="text-[0.72rem] text-[#6affe8]">Online now</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-white/54">Hover across the screen to shift the neon field behind the login card.</p>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[12%] top-[24%] hidden w-[180px] rounded-[18px] border border-white/10 bg-[#12121c]/62 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl xl:block"
        style={{
          transform: `translate(${(pointer.x - 0.5) * 18}px, ${(pointer.y - 0.5) * -16}px) rotate(-5deg)`,
          transition: 'transform 220ms ease-out',
        }}
      >
        <div className="mono-font text-[0.62rem] uppercase tracking-[0.14em] text-[#ffbad6]">Session Note</div>
        <p className="mt-3 text-sm leading-6 text-white/54">
          Sign in to continue chats, calls, media sharing, and workspace updates.
        </p>
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <section className="relative w-full max-w-[460px] overflow-hidden rounded-[30px] border border-white/12 bg-[#0f0f1a]/94 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.58)] transition hover:border-[#c08cff]/26 hover:shadow-[0_34px_90px_rgba(0,0,0,0.58),0_0_28px_rgba(124,106,255,0.18)] before:pointer-events-none before:absolute before:top-[-45%] before:left-[-42%] before:h-[190%] before:w-[34%] before:-skew-x-[22deg] before:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.03)_34%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0.06)_62%,transparent)] before:transition before:duration-700 hover:before:translate-x-[420%] md:p-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] text-white shadow-[0_12px_28px_rgba(124,106,255,0.32)]">
              <span className="brand-font text-[1rem] font-extrabold tracking-[0.08em]">NC</span>
            </span>
            <div>
              <div className="logo-wordmark text-[1.35rem] tracking-[0.04em] text-white">NexChat</div>
              <div className="mono-font text-[0.66rem] uppercase tracking-[0.14em] text-[#c9c0ff]">
                Login
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={fieldLabelClass}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className={fieldLabelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-16`}
                  placeholder="********"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#0f0f18]/92 text-white/72 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition hover:border-[#7c6aff]/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7c6aff]/35"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                      <path
                        d="M10.6 10.7a2 2 0 0 0 2.7 2.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.4 5.5A10.7 10.7 0 0 1 12 5.2c5 0 8.5 4.3 9.5 6.1a.9.9 0 0 1 0 .9 16.5 16.5 0 0 1-3.3 4.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.2 6.2A16.5 16.5 0 0 0 2.5 11.3a.9.9 0 0 0 0 .9C3.5 14 7 18.3 12 18.3c1.3 0 2.6-.2 3.8-.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <path
                        d="M2.5 12.2a.9.9 0 0 1 0-.9C3.5 9.5 7 5.2 12 5.2s8.5 4.3 9.5 6.1a.9.9 0 0 1 0 .9C20.5 14 17 18.3 12 18.3S3.5 14 2.5 12.2Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 text-[0.78rem]">
              <Link to="/forgot-password" className="text-white/44 transition hover:text-[#ffbad6]">
                Forgot password?
              </Link>
              <Link
                to="/signup"
                className="mono-font uppercase tracking-[0.08em] text-[#c9c0ff] transition hover:text-white"
              >
                Create new account
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mono-font relative w-full overflow-hidden rounded-[18px] border border-[#7c6aff] bg-gradient-to-r from-[#6a52ff] via-[#7c6aff] to-[#ff6ab0] px-5 py-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_14px_32px_rgba(124,106,255,0.28)] transition hover:-translate-y-0.5 hover:border-[#9c8cff] hover:shadow-[0_18px_34px_rgba(124,106,255,0.36),0_0_28px_rgba(255,106,176,0.2)] before:pointer-events-none before:absolute before:top-[-45%] before:left-[-38%] before:h-[190%] before:w-[30%] before:-skew-x-[22deg] before:bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.04)_34%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.08)_62%,transparent)] before:transition before:duration-700 hover:before:translate-x-[430%] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="relative z-10">{loading ? 'Signing In...' : 'Enter Workspace'}</span>
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default Login;
