import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import AuthShell from './AuthShell';

const fieldLabelClass = 'mono-font mb-2 block text-[0.68rem] uppercase tracking-[0.12em] text-white/55';
const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#12131b] px-4 py-3 text-white outline-none transition placeholder:text-white/32 focus:border-[#7c6aff]/60 focus:bg-[#161827] focus:shadow-[0_0_0_3px_rgba(124,106,255,0.14)]';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signup, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await signup(name, email, password);
      navigate('/app');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Signup failed');
    }
  };

  return (
    <AuthShell
      eyebrow="New Account"
      title="Create Your Account"
      description="Sign up to start chatting, sharing media, and creating groups with your contacts."
      onSubmit={handleSubmit}
      submitLabel="Create Account"
      loadingLabel="Creating Account..."
      loading={loading}
      footerPrompt="Already inside the ecosystem?"
      footerLinkTo="/login"
      footerLinkLabel="Sign In"
    >
      <div>
        <label htmlFor="signup-name" className={fieldLabelClass}>
          Name
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          placeholder="Your name"
          required
        />
      </div>

      <div>
        <label htmlFor="signup-email" className={fieldLabelClass}>
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label htmlFor="signup-password" className={fieldLabelClass}>
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
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
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" strokeLinecap="round" strokeLinejoin="round" />
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
    </AuthShell>
  );
};

export default Signup;
