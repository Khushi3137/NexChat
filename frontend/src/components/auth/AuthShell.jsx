import React from 'react';
import { Link } from 'react-router-dom';

const featureItems = [
  {
    id: 'f1',
    title: 'Real-time chat',
    description: 'Message friends and groups instantly.',
    accent: 'from-[#7c6aff] to-[#ff6ab0]',
  },
  {
    id: 'f2',
    title: 'Media sharing',
    description: 'Send files, photos, voice notes, and reactions.',
    accent: 'from-[#6a52ff] to-[#6affe8]',
  },
  {
    id: 'f3',
    title: 'Calls and groups',
    description: 'Create rooms, invite people, and stay connected.',
    accent: 'from-[#ff6ab0] to-[#ff91c7]',
  },
];

const AuthShell = ({
  eyebrow,
  title,
  description,
  onSubmit,
  submitLabel,
  loadingLabel,
  loading,
  footerPrompt,
  footerLinkTo,
  footerLinkLabel,
  children,
}) => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07070d] text-[#f0eeff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_26%_20%,rgba(124,106,255,0.16),transparent_60%),radial-gradient(ellipse_50%_45%_at_86%_18%,rgba(255,106,176,0.12),transparent_56%),linear-gradient(145deg,#07070d_0%,#10111d_52%,#08090f_100%)]" />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6aff] to-[#ff6ab0] text-white shadow-[0_10px_26px_rgba(124,106,255,0.28)]">
            <span className="brand-font text-[0.96rem] font-extrabold tracking-[0.08em]">NC</span>
          </span>
          <span className="logo-wordmark bg-gradient-to-r from-[#f0eeff] to-[#b9afff] bg-clip-text text-[1.2rem] tracking-[0.04em] text-transparent">
            NexChat
          </span>
        </Link>

        <Link
          to="/"
          className="mono-font rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.66rem] uppercase tracking-[0.1em] text-white/68 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
        >
          Back To Landing
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-[1180px] items-center px-4 py-6 md:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
          <section className="px-1 py-4 md:px-0">
            <div className="mono-font inline-flex items-center gap-2 rounded-lg border border-[#6affe8]/20 bg-[#6affe8]/8 px-3 py-2 text-[0.64rem] uppercase tracking-[0.14em] text-[#6affe8]">
              <span className="h-2 w-2 rounded-full bg-[#6affe8]" />
              Chat App Platform
            </div>

            <h1 className="brand-font mt-6 max-w-[11ch] text-[clamp(2.5rem,5vw,4.6rem)] leading-none tracking-[0.03em] text-white">
              Join NexChat.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/68">
              A focused chat workspace for direct messages, group conversations, media sharing,
              calls, and quick collaboration.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {featureItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-white/[0.045] p-4"
                >
                  <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${item.accent}`} />
                  <h2 className="mt-4 text-sm font-semibold text-white">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-[0.8rem] leading-5 text-white/55">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
              <div>
                <div className="text-2xl font-semibold text-white">Fast setup</div>
                <p className="mt-1 text-sm leading-6 text-white/55">Create an account and start messaging in moments.</p>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">All in one</div>
                <p className="mt-1 text-sm leading-6 text-white/55">Groups, calls, files, AI support, and notifications together.</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#10111b]/95 p-6 shadow-[0_26px_72px_rgba(0,0,0,0.48)] md:p-7">
            <div className="mb-6">
              <div className="mono-font text-[0.68rem] uppercase tracking-[0.16em] text-[#ffbad6]">
                {eyebrow}
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-white md:text-4xl">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                {description}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {children}

              <button
                type="submit"
                disabled={loading}
                className="mono-font w-full rounded-lg border border-[#7c6aff] bg-[#6f5cff] px-5 py-3 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-white shadow-[0_14px_32px_rgba(124,106,255,0.24)] transition hover:bg-[#7c6aff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? loadingLabel : submitLabel}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center">
              <p className="text-sm text-white/45">
                {footerPrompt}{' '}
                <Link
                  to={footerLinkTo}
                  className="mono-font uppercase tracking-[0.08em] text-[#c9c0ff] hover:text-[#ebe7ff]"
                >
                  {footerLinkLabel}
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AuthShell;
