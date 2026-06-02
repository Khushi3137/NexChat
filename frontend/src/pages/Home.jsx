import React from 'react';
import Sidebar from '../components/sidebar/Sidebar';

const quickStartCards = [
  {
    id: 'search',
    eyebrow: 'Search',
    title: 'Find a person or chat',
    description: 'Jump straight to the sidebar search so you can open a conversation quickly.',
    accentClass: 'from-[#ff6ab0]/18 via-[#7c6aff]/12 to-transparent',
  },
  {
    id: 'group',
    eyebrow: 'Create Group',
    title: 'Start a shared room',
    description: 'Open the group creator and set up a space for your team, friends, or project.',
    accentClass: 'from-[#7c6aff]/18 via-[#d67cff]/12 to-transparent',
  },
  {
    id: 'ai',
    eyebrow: 'AI Chat',
    title: 'Talk to the assistant',
    description: 'Open the built-in AI chat for ideas, summaries, and quick help inside NexChat.',
    accentClass: 'from-[#6affe8]/16 via-[#7c6aff]/10 to-transparent',
  },
];

const Home = () => {
  const handleQuickStart = (type) => {
    if (typeof document === 'undefined') return;

    if (type === 'search') {
      document.getElementById('sidebar-search')?.focus();
      return;
    }

    if (type === 'group') {
      document.getElementById('sidebar-create-group-button')?.click();
      return;
    }

    if (type === 'ai') {
      document.getElementById('sidebar-ai-filter-button')?.click();
    }
  };

  return (
    <div className="flex h-screen min-h-0 bg-[#050508]">
      <Sidebar />
      <main className="app-scrollbar relative hidden min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[linear-gradient(135deg,#120613_0%,#1b0922_42%,#13071a_100%)] md:block">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,106,176,0.26),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(124,106,255,0.3),transparent_30%),radial-gradient(circle_at_50%_78%,rgba(214,124,255,0.16),transparent_34%)]" />
        <div className="pointer-events-none absolute -left-16 top-[12%] h-72 w-72 rounded-full bg-[#ff6ab0]/22 blur-[130px]" />
        <div className="pointer-events-none absolute right-[8%] top-[8%] h-80 w-80 rounded-full bg-[#7c6aff]/24 blur-[150px]" />
        <div className="pointer-events-none absolute bottom-[4%] left-[28%] h-96 w-96 rounded-full bg-[#d67cff]/14 blur-[170px]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:88px_88px]" />

        <div className="relative z-10 flex min-h-full items-center justify-center px-10 py-10 xl:px-16">
          <div className="flex w-full max-w-5xl flex-col items-center gap-6">
            <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[#120d1a]/45 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl xl:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6ab0]/20 bg-[#ff6ab0]/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-[#ff6ab0] shadow-[0_0_12px_rgba(255,106,176,0.85)]" />
                <span className="mono-font text-[0.66rem] uppercase tracking-[0.16em] text-[#ffd5e8]">
                  Welcome To NexChat
                </span>
              </div>

              <h1 className="mt-6 max-w-[12ch] text-[clamp(2.65rem,4.7vw,4.7rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-[#fbf6ff]">
                Chat smarter, faster, and more beautifully.
              </h1>

              <p className="mt-6 max-w-2xl text-[1.02rem] font-medium leading-8 text-white/72">
                NexChat is a modern messaging platform built for personal chats, groups, media
                sharing, and AI-powered conversations. Use the left sidebar to open a thread and
                start exploring the workspace.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="mono-font rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-white/60">
                  Real-Time Messaging
                </div>
                <div className="mono-font rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-white/60">
                  Group Chats
                </div>
                <div className="mono-font rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-white/60">
                  AI Assistant
                </div>
                <div className="mono-font rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-white/60">
                  Media Sharing
                </div>
              </div>
            </div>

            <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-3">
              {quickStartCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleQuickStart(card.id)}
                  className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[#120d1a]/40 p-6 text-left shadow-[0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:border-white/16 hover:bg-[#171120]/55"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.accentClass}`} />
                  <div className="relative z-10">
                    <div className="mono-font text-[0.66rem] uppercase tracking-[0.16em] text-white/58">
                      {card.eyebrow}
                    </div>
                    <div className="mt-3 text-[1.25rem] font-semibold leading-6 text-[#fbf6ff]">
                      {card.title}
                    </div>
                    <p className="mt-3 text-[0.95rem] leading-7 text-white/68">
                      {card.description}
                    </p>
                    <div className="mono-font mt-5 text-[0.68rem] uppercase tracking-[0.14em] text-[#ffd5e8] transition group-hover:text-white">
                      Click to open
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
