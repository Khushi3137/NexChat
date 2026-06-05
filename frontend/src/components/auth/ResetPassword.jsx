import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';

const fieldLabelClass = 'mono-font mb-2 block text-[0.68rem] uppercase tracking-[0.12em] text-white/62';
const inputClass =
  'w-full rounded-[18px] border border-white/10 bg-[#13131c] px-4 py-3.5 text-white outline-none transition placeholder:text-white/34 focus:border-[#7c6aff]/50 focus:bg-[#171722] focus:shadow-[0_0_0_3px_rgba(124,106,255,0.14)]';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const data = await authService.resetPassword(token, password);
      toast.success(data.message || 'Password updated');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen overflow-x-hidden overflow-y-auto bg-[#050508] text-[#f0eeff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_45%_at_20%_18%,rgba(124,106,255,0.16),transparent_62%),radial-gradient(ellipse_42%_36%_at_82%_18%,rgba(255,106,176,0.16),transparent_58%),radial-gradient(ellipse_48%_40%_at_50%_78%,rgba(106,255,232,0.08),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:70px_70px] opacity-25" />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <section className="relative w-full max-w-[480px] overflow-hidden rounded-[30px] border border-white/12 bg-[#0f0f1a]/94 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.58)] md:p-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] text-white shadow-[0_12px_28px_rgba(124,106,255,0.32)]">
              <span className="brand-font text-[1rem] font-extrabold tracking-[0.08em]">NC</span>
            </span>
            <div>
              <div className="logo-wordmark text-[1.35rem] tracking-[0.04em] text-white">NexChat</div>
              <div className="mono-font text-[0.66rem] uppercase tracking-[0.14em] text-[#c9c0ff]">
                Choose New Password
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-[20px] border border-white/10 bg-[#14141f]/82 p-4">
            <div className="mono-font text-[0.64rem] uppercase tracking-[0.14em] text-[#ffbad6]">
              Secure Reset
            </div>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Set a new password for your account. Once this is complete, you can return to login
              and access your workspace again.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-password" className={fieldLabelClass}>
                New Password
              </label>
              <div className="relative">
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={`${inputClass} pr-16`}
                  placeholder="Minimum 6 characters"
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

            <div>
              <label htmlFor="reset-confirm-password" className={fieldLabelClass}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${inputClass} pr-16`}
                  placeholder="Repeat your new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#0f0f18]/92 text-white/72 shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition hover:border-[#7c6aff]/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#7c6aff]/35"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
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

            <button
              type="submit"
              disabled={loading}
              className="mono-font relative w-full overflow-hidden rounded-[18px] border border-[#7c6aff] bg-gradient-to-r from-[#6a52ff] via-[#7c6aff] to-[#ff6ab0] px-5 py-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_14px_32px_rgba(124,106,255,0.28)] transition hover:-translate-y-0.5 hover:border-[#9c8cff] hover:shadow-[0_18px_34px_rgba(124,106,255,0.36),0_0_28px_rgba(255,106,176,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-white/45">
            Back to{' '}
            <Link to="/login" className="mono-font uppercase tracking-[0.08em] text-[#c9c0ff] hover:text-[#ebe7ff]">
              Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ResetPassword;
