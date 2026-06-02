import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';

const fieldLabelClass = 'mono-font mb-2 block text-[0.68rem] uppercase tracking-[0.12em] text-white/62';
const inputClass =
  'w-full rounded-[18px] border border-white/10 bg-[#13131c] px-4 py-3.5 text-white outline-none transition placeholder:text-white/34 focus:border-[#7c6aff]/50 focus:bg-[#171722] focus:shadow-[0_0_0_3px_rgba(124,106,255,0.14)]';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await authService.forgotPassword(email);
      setResetUrl(data.resetUrl || '');
      toast.success(data.message || 'Reset instructions sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reset instructions');
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
                Reset Password
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-[20px] border border-white/10 bg-[#14141f]/82 p-4">
            <div className="mono-font text-[0.64rem] uppercase tracking-[0.14em] text-[#6affe8]">
              Password Recovery
            </div>
            <p className="mt-2 text-sm leading-6 text-white/56">
              Enter your account email and we will send a password reset link. In local testing,
              you will also see the reset URL directly on this page.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className={fieldLabelClass}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mono-font relative w-full overflow-hidden rounded-[18px] border border-[#7c6aff] bg-gradient-to-r from-[#6a52ff] via-[#7c6aff] to-[#ff6ab0] px-5 py-3.5 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_14px_32px_rgba(124,106,255,0.28)] transition hover:-translate-y-0.5 hover:border-[#9c8cff] hover:shadow-[0_18px_34px_rgba(124,106,255,0.36),0_0_28px_rgba(255,106,176,0.2)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {resetUrl ? (
            <div className="mt-5 rounded-[20px] border border-[#6affe8]/18 bg-[#6affe8]/8 p-4">
              <div className="mono-font text-[0.64rem] uppercase tracking-[0.14em] text-[#6affe8]">
                Local Preview Link
              </div>
              <p className="mt-2 break-all text-sm leading-6 text-white/62">{resetUrl}</p>
              <a
                href={resetUrl}
                className="mono-font mt-3 inline-flex rounded-full border border-[#6affe8]/24 bg-[#6affe8]/10 px-4 py-2 text-[0.68rem] uppercase tracking-[0.1em] text-[#6affe8] transition hover:bg-[#6affe8]/14"
              >
                Open Reset Page
              </a>
            </div>
          ) : null}

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

export default ForgotPassword;
