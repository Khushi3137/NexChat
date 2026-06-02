import React from 'react';
import { Link } from 'react-router-dom';

const ReferencePreview = () => {
  return (
    <div className="flex h-screen flex-col bg-[#050508] text-[#f0eeff]">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-[#0f0f1a]/90 px-6 py-4 backdrop-blur-xl">
        <div>
          <h1 className="brand-font text-xl font-bold">Reference Preview</h1>
          <p className="text-sm text-white/45">
            This preview now loads the React landing page instead of a static HTML file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            Open Landing Page
          </a>
          <Link
            to="/app"
            className="rounded-xl border border-[#7c6aff]/30 bg-gradient-to-br from-[#7c6aff] to-[#5f7dff] px-4 py-2 text-sm font-medium text-white shadow-[0_12px_28px_rgba(124,106,255,0.22)] transition hover:brightness-110"
          >
            Back To App
          </Link>
        </div>
      </header>

      <div className="flex-1 bg-[#08080f] p-4">
        <iframe
          title="NexChat website reference"
          src="/"
          className="h-full w-full rounded-[22px] border border-white/10 bg-white"
        />
      </div>
    </div>
  );
};

export default ReferencePreview;
