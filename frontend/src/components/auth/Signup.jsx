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
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClass}
          placeholder="Minimum 6 characters"
          required
        />
      </div>
    </AuthShell>
  );
};

export default Signup;
