import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import { landingMarkup } from './landingPageMarkup';

const waveformHeights = [5, 9, 18, 13, 26, 17, 22, 11, 19, 24, 15, 9, 21, 17, 13, 23, 7, 19, 15, 22, 11, 17];

const LandingPage = () => {
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return undefined;
    }

    const previousTitle = document.title;
    document.title = 'NexChat - Chat App';
    root.scrollTop = 0;
    root.scrollLeft = 0;

    const cur = root.querySelector('#cur');
    const curR = root.querySelector('#curR');
    const nav = root.querySelector('#nav');
    const revealEls = Array.from(root.querySelectorAll('.rv'));
    const hoverEls = Array.from(root.querySelectorAll('a, button, .fc, .tc2, .sc2'));
    const featureCards = Array.from(root.querySelectorAll('.fc'));
    const waveEl = root.querySelector('#wvEl');
    const timeouts = new Set();

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let animationFrame = 0;

    const setCursorState = (isActive) => {
      if (!cur || !curR) {
        return;
      }

      cur.style.width = isActive ? '18px' : '10px';
      cur.style.height = isActive ? '18px' : '10px';
      curR.style.width = isActive ? '54px' : '38px';
      curR.style.height = isActive ? '54px' : '38px';
      curR.style.borderColor = isActive ? 'rgba(255,106,176,.8)' : 'rgba(255,106,176,.45)';
    };

    const handleMouseMove = (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;

      if (cur) {
        cur.style.transform = `translate(${mouseX - 5}px, ${mouseY - 5}px)`;
      }
    };

    const animateRing = () => {
      ringX += (mouseX - ringX - 19) * 0.11;
      ringY += (mouseY - ringY - 19) * 0.11;

      if (curR) {
        curR.style.transform = `translate(${ringX}px, ${ringY}px)`;
      }

      animationFrame = window.requestAnimationFrame(animateRing);
    };

    const handleScroll = () => {
      if (nav) {
        nav.classList.toggle('s', root.scrollTop > 55);
      }
    };

    const handleRootClick = (event) => {
      const anchor = event.target.closest('a[href]');

      if (!anchor || !root.contains(anchor)) {
        return;
      }

      const href = anchor.getAttribute('href');

      if (!href || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (href === '#') {
        if (anchor.classList.contains('logo')) {
          event.preventDefault();
          root.scrollTo({ top: 0, behavior: 'smooth' });
        }

        return;
      }

      if (href.startsWith('#')) {
        const target = root.querySelector(href);

        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        return;
      }

      if (href.startsWith('/')) {
        event.preventDefault();
        navigate(href);
      }
    };

    root.addEventListener('mousemove', handleMouseMove);
    root.addEventListener('click', handleRootClick);
    root.addEventListener('scroll', handleScroll);
    handleScroll();
    animateRing();

    hoverEls.forEach((element) => {
      element.addEventListener('mouseenter', () => setCursorState(true));
      element.addEventListener('mouseleave', () => setCursorState(false));
    });

    featureCards.forEach((card) => {
      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
      });
    });

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('v');
          }
        });
      },
      { root, threshold: 0.1 }
    );

    revealEls.forEach((element) => revealObserver.observe(element));

    if (waveEl && !waveEl.children.length) {
      waveformHeights.forEach((height, index) => {
        const bar = document.createElement('div');
        bar.className = 'wvb';
        bar.style.height = `${height}px`;
        bar.style.animationDelay = `${index * 0.055}s`;
        bar.style.opacity = height < 11 ? '0.32' : '0.74';
        waveEl.appendChild(bar);
      });
    }

    return () => {
      document.title = previousTitle;
      window.cancelAnimationFrame(animationFrame);
      root.removeEventListener('mousemove', handleMouseMove);
      root.removeEventListener('click', handleRootClick);
      root.removeEventListener('scroll', handleScroll);
      revealObserver.disconnect();
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [navigate]);

  return (
    <div ref={rootRef} className="landing-root app-scrollbar">
      <div dangerouslySetInnerHTML={{ __html: landingMarkup }} />
    </div>
  );
};

export default LandingPage;
