export const landingMarkup = String.raw`
<div class="cur" id="cur"></div>
<div class="cur-r" id="curR"></div>

<nav id="nav">
  <a href="#" class="logo"><div class="ld"></div>NEXCHAT</a>
  <ul class="nl">
    <li><a href="#feat">Features</a></li>
    <li><a href="#how">How It Works</a></li>
    <li><a href="#about">Project</a></li>
  </ul>
  <a href="/login" class="ncta">Login &rarr;</a>
</nav>

<section class="hero">
  <div class="hbg"></div><div class="hgrd"></div>
  <div class="orb o1"></div><div class="orb o2"></div>

  <div class="mok">
    <div class="mhd">
      <div class="mav">S</div>
      <div><div class="mnm">Sophia Chen</div><div class="mst"><span class="mdk"></span>Online</div></div>
    </div>
    <div class="msgs">
      <div class="mm"><div class="mma" style="background:linear-gradient(135deg,#6a4fff,#ff6ab0)">S</div><div class="mmb rc">Designs look incredible.</div></div>
      <div class="mm r"><div class="mma" style="background:linear-gradient(135deg,#8c74ff,#ff6ab0)">Y</div><div class="mmb st">Sending files now.</div></div>
      <div class="mm"><div class="mma" style="background:linear-gradient(135deg,#6a4fff,#ff6ab0)">S</div><div class="mmb rc">Let's hop on a call.</div></div>
      <div class="mm r"><div class="mma" style="background:linear-gradient(135deg,#8c74ff,#ff6ab0)">Y</div><div class="mmb st">Give me 2 min.</div></div>
    </div>
    <div class="minp"><span>Message Sophia...</span><div class="msend">&#10148;</div></div>
  </div>

  <div class="heye"><div class="live"><div class="ldot"></div>Local chat workspace</div></div>
  <div class="ht">COMMUNICATE<br><span class="outline">WITHOUT</span><br><span class="acc">LIMITS</span></div>
  <div class="hbot">
    <div class="hdesc"><strong>NexChat</strong> is a full-stack chat app with authentication, real-time messages, groups, media sharing, calls, and optional AI replies.</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end">
      <a href="/login" class="btnp">Login To Start &rarr;</a>
      <a href="#feat" class="btns">Explore features <span class="arr">&darr;</span></a>
    </div>
  </div>

  <div class="hstats">
    <div><div class="sn">JWT</div><div class="sl">Secure Login</div></div>
    <div><div class="sn">LIVE</div><div class="sl">Socket.IO Chat</div></div>
    <div><div class="sn">GROUP</div><div class="sl">Invite Flow</div></div>
    <div><div class="sn">MEDIA</div><div class="sl">File Uploads</div></div>
  </div>
</section>

<div class="marq">
  <div class="mt">
    <div class="mi">REAL-TIME MESSAGING <span>&#10022;</span></div><div class="mi">AI ASSISTANT <span>&#10022;</span></div>
    <div class="mi">VOICE &amp; VIDEO CALLS <span>&#10022;</span></div><div class="mi">PRIVACY CONTROLS <span>&#10022;</span></div>
    <div class="mi">MEDIA SHARING <span>&#10022;</span></div><div class="mi">GROUP CHATS <span>&#10022;</span></div>
    <div class="mi">MESSAGE SCHEDULING <span>&#10022;</span></div><div class="mi">SCREEN SHARING <span>&#10022;</span></div>
    <div class="mi">REAL-TIME MESSAGING <span>&#10022;</span></div><div class="mi">AI ASSISTANT <span>&#10022;</span></div>
    <div class="mi">VOICE &amp; VIDEO CALLS <span>&#10022;</span></div><div class="mi">PRIVACY CONTROLS <span>&#10022;</span></div>
  </div>
</div>

<section class="sec" id="feat">
  <div class="slbl rv">01 &mdash; Platform</div>
  <div class="sttl rv d1">EVERY FEATURE<br>YOU NEED</div>
  <div class="fgrid">
    <div class="fc fw rv" style="min-height:290px">
      <div class="fn">01</div><div class="fi">&#9889;</div>
      <div class="ftt">REAL-TIME MESSAGING</div>
      <div class="fd2">Messages update in real time with Socket.IO. Typing indicators, read receipts, and online presence are built into the chat flow.</div>
      <div class="mc2">
        <div class="mc"><div class="mcav" style="background:linear-gradient(135deg,#6a4fff,#ff6ab0)">S</div><div class="mcb rc">Feature is live and synced.</div></div>
        <div class="mc r"><div class="mcav" style="background:linear-gradient(135deg,#8c74ff,#ff6ab0)">Y</div><div class="mcb st">Checking now. Looks fast.</div></div>
        <div class="mc"><div class="mcav" style="background:linear-gradient(135deg,#6a4fff,#ff6ab0)">S</div><div class="mcb rc" style="opacity:.55;font-style:italic">typing...</div></div>
      </div>
      <div class="tags"><span class="tag a">Socket.IO</span><span class="tag a">Read Receipts</span><span class="tag">Offline Sync</span><span class="tag">Multi-Device</span></div>
    </div>
    <div class="fc ft rv d1" style="background:linear-gradient(155deg,#12112a,#0d0d1c)">
      <div class="fn">02</div><div class="fi p">&#129302;</div>
      <div class="ftt">AI ASSISTANT</div>
      <div class="fd2">Powered by Groq. Summarize threads, draft replies, answer questions &mdash; inside chat.</div>
      <div class="mc2" style="margin-top:14px">
        <div class="mc"><div class="mcav" style="background:linear-gradient(135deg,#8c74ff,#ff6ab0)">Y</div><div class="mcb rc">@AI summarize this thread</div></div>
        <div class="mc"><div class="mcav" style="background:linear-gradient(135deg,#7c6aff,#6affe8);font-size:7px">AI</div><div class="mcb ai">Team agreed to ship Tuesday. Blockers cleared.</div></div>
      </div>
      <div class="tags" style="margin-top:18px"><span class="tag a">Summarize</span><span class="tag a">Draft Reply</span><span class="tag">Translate</span><span class="tag">Code</span></div>
    </div>
    <div class="fc fm2 rv d2" style="text-align:center">
      <div class="fn">03</div><div class="fi p" style="margin:0 auto 16px">&#128222;</div>
      <div class="ftt" style="font-size:22px">CALLING</div>
      <div class="fd2">HD voice and video via WebRTC. Screen sharing and group calls.</div>
      <div style="display:flex;gap:9px;justify-content:center;margin-top:16px">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(0,229,160,.09);border:1px solid rgba(0,229,160,.2);display:flex;align-items:center;justify-content:center;font-size:16px">&#128222;</div>
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(124,106,255,.09);border:1px solid rgba(124,106,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">&#127909;</div>
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,106,176,.12);border:1px solid rgba(255,106,176,.2);display:flex;align-items:center;justify-content:center;font-size:16px">&#128421;</div>
      </div>
    </div>
    <div class="fc fm2 rv d3">
      <div class="fn">04</div><div class="fi g">&#127897;</div>
      <div class="ftt" style="font-size:22px">VOICE NOTES</div>
      <div class="fd2">Record and share voice messages with waveform playback and transcription.</div>
      <div class="wv" id="wvEl"></div>
    </div>
    <div class="fc fl rv" style="display:flex;gap:38px;align-items:center">
      <div style="flex:1">
        <div class="fn">05</div><div class="fi">&#128274;</div>
        <div class="ftt">PRIVACY<br>CONTROLS</div>
        <div class="fd2">Manage blocked users, hidden chats, notification preferences, group invite permissions, and profile visibility.</div>
        <div class="tags" style="margin-top:18px"><span class="tag a">Block Users</span><span class="tag a">Invite Rules</span><span class="tag">Hidden Chats</span><span class="tag">Notifications</span></div>
      </div>
      <div style="flex-shrink:0;text-align:center">
        <div class="rw">
          <svg class="rsvg" viewBox="0 0 105 105"><circle class="rtr" cx="52.5" cy="52.5" r="44"></circle><circle class="rfi" cx="52.5" cy="52.5" r="44" stroke="#00e5a0" stroke-dasharray="276" stroke-dashoffset="82"></circle></svg>
          <div class="rlbl">USER<div class="rsub">CONTROL</div></div>
        </div>
        <div style="font-family:var(--fm);font-size:8.5px;color:rgba(245,243,238,.2);margin-top:7px">APP SETTINGS</div>
      </div>
    </div>
    <div class="fc fm2 rv"><div class="fi">&#9200;</div><div class="ftt" style="font-size:21px">SCHEDULE</div><div class="fd2">Write now, send later. Perfect timing every time.</div></div>
    <div class="fc fm2 rv d1"><div class="fi g">&#128168;</div><div class="ftt" style="font-size:21px">DISAPPEARING</div><div class="fd2">Auto-delete after 10s, 1min, 1h, or 24h.</div></div>
    <div class="fc fm2 rv d2"><div class="fi p">&#128202;</div><div class="ftt" style="font-size:21px">ANALYTICS</div><div class="fd2">Track engagement, peak times, and communication patterns.</div></div>
  </div>
</section>

<section class="sec sstep" id="how">
  <div class="slbl rv">02 &mdash; Process</div>
  <div class="sttl rv d1">HOW IT<br>WORKS</div>
  <div class="sgrid rv d2">
    <div class="sc2"><div class="scn">01</div><div class="scic">&#9997;</div><div class="sctt">CREATE ACCOUNT</div><div class="scds">Sign up with a name, email, and password. Your account is stored in MongoDB and protected with JWT auth.</div><div class="scar">&rarr;</div></div>
    <div class="sc2"><div class="scn">02</div><div class="scic">&#128101;</div><div class="sctt">FIND PEOPLE</div><div class="scds">Search registered users, start direct chats, or create groups by selecting existing accounts.</div><div class="scar">&rarr;</div></div>
    <div class="sc2"><div class="scn">03</div><div class="scic">&#128640;</div><div class="sctt">START CHATTING</div><div class="scds">Send messages, files, reactions, replies, scheduled messages, and use calls or AI when configured.</div><div class="scar">&#8599;</div></div>
  </div>
</section>

<section class="sec" style="overflow:hidden;padding-bottom:72px" id="about">
  <div class="slbl rv">03 &mdash; Project</div>
  <div class="sttl rv d1">WHAT IS<br>INCLUDED</div>
  <div class="tscr">
    <div class="tc2"><div class="tst">AUTH</div><div class="tq">Email signup, login, JWT sessions, password reset flow, and profile editing are included.</div><div class="ta2"><div class="tav2" style="background:linear-gradient(135deg,#6a4fff,#ff6ab0)">A</div><div><div class="tnm">Authentication</div><div class="trl">User accounts</div></div></div></div>
    <div class="tc2"><div class="tst">CHAT</div><div class="tq">Direct chats, group chats, typing status, read receipts, pinned messages, edits, deletes, and reactions.</div><div class="ta2"><div class="tav2" style="background:linear-gradient(135deg,#00b4d8,#0077b6)">C</div><div><div class="tnm">Messaging</div><div class="trl">Real-time UI</div></div></div></div>
    <div class="tc2"><div class="tst">MEDIA</div><div class="tq">Media upload support is wired through Cloudinary configuration for images and shared files.</div><div class="ta2"><div class="tav2" style="background:linear-gradient(135deg,#8c74ff,#ff6ab0)">M</div><div><div class="tnm">Uploads</div><div class="trl">Cloudinary based</div></div></div></div>
    <div class="tc2"><div class="tst">CALLS</div><div class="tq">Voice, video, screen sharing, and group call signaling are included through WebRTC and Socket.IO.</div><div class="ta2"><div class="tav2" style="background:linear-gradient(135deg,#4affa0,#00b4d8)">V</div><div><div class="tnm">Calling</div><div class="trl">Browser based</div></div></div></div>
    <div class="tc2"><div class="tst">AI</div><div class="tq">Messages starting with @AI can use the configured Groq API key to generate assistant replies.</div><div class="ta2"><div class="tav2" style="background:linear-gradient(135deg,#ff6ab0,#8c74ff)">AI</div><div><div class="tnm">Assistant</div><div class="trl">Requires API key</div></div></div></div>
  </div>
</section>

<section class="ctas">
  <div class="ctabg">CHAT</div>
  <div class="ctat rv">READY TO<br><span class="l2">START?</span></div>
  <div class="ctad rv d1">Create an account, add another registered user, and try real-time chat, groups, calls, uploads, and AI mentions.</div>
  <div class="ctabtns rv d2">
    <a href="/login" class="btnp" style="font-size:14px;padding:15px 38px">Login To Continue &rarr;</a>
    <a href="#feat" class="btns" style="font-size:14px">All features <span class="arr">&rarr;</span></a>
  </div>
  <div style="margin-top:40px;display:flex;justify-content:center;gap:26px;flex-wrap:wrap;opacity:.28;font-size:10.5px;font-family:var(--fm);letter-spacing:.1em;text-transform:uppercase">
    <span>React frontend</span><span>&middot;</span><span>Node backend</span><span>&middot;</span><span>MongoDB Atlas</span><span>&middot;</span><span>Socket.IO</span>
  </div>
</section>

<footer>
  <div class="fgr">
    <div class="fbrand">
      <a href="#" class="logo"><div class="ld"></div>NEXCHAT</a>
      <p>A full-stack chat project built with React, Node.js, Socket.IO, MongoDB, and optional third-party services.</p>
      <div style="margin-top:14px"><div class="live"><div class="ldot"></div>All systems operational</div></div>
    </div>
    <div><div class="fct">Product</div><div class="flinks"><a href="#feat">Features</a><a href="#how">How It Works</a><a href="#about">Project</a><a href="/login">Login</a></div></div>
    <div><div class="fct">App</div><div class="flinks"><a href="/signup">Create Account</a><a href="/login">Sign In</a><a href="#feat">Platform</a><a href="#how">Workflow</a></div></div>
    <div><div class="fct">Stack</div><div class="flinks"><a href="#about">React</a><a href="#about">Node.js</a><a href="#about">MongoDB</a><a href="#about">Socket.IO</a></div></div>
  </div>
  <div class="fbot">
    <div class="fcpy">&copy; 2026 NexChat Technologies Inc. All rights reserved.</div>
    <div class="fsoc">
      <button class="sb">X</button><button class="sb">in</button><button class="sb">gh</button><button class="sb">&#9654;</button>
    </div>
  </div>
</footer>
`;
