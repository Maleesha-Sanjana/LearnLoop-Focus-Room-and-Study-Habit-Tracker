// =============================================
// main.js – LearnLoop One-Page Landing Site
// =============================================

// ── Navbar: glass effect stays consistent on scroll ──
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  const dark = document.body.classList.contains('dark');
  if (window.scrollY > 40) {
    navbar.style.boxShadow = dark
      ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06)'
      : '0 4px 24px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05)';
    navbar.style.background = dark ? 'rgba(20,20,20,0.80)' : 'rgba(255,255,255,0.85)';
  } else {
    navbar.style.boxShadow = dark
      ? '0 2px 16px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.04)'
      : '0 2px 16px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)';
    navbar.style.background = dark ? 'rgba(20,20,20,0.65)' : 'rgba(255,255,255,0.75)';
  }
});

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── Active nav link highlight on scroll ──
const sections = document.querySelectorAll('section[id], div[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + entry.target.id) {
          link.classList.add('active');
        }
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => observer.observe(s));

// ── Scroll-reveal animation ──
const revealEls = document.querySelectorAll(
  '.feat-card, .tcard, .flow-card, .extra-card, .preview-wrap, .stats-big, .lb-table, .lb-podium-card'
);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

revealEls.forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(el);
});

// ── Stats counter animation ──
function animateCounter(el, target, suffix = '') {
  let current = 0;
  const step = Math.ceil(target / 60);
  const interval = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString() + suffix;
    if (current >= target) clearInterval(interval);
  }, 24);
}

const statsSection = document.querySelector('.stats-section');
let statsAnimated = false;

const statsObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !statsAnimated) {
    statsAnimated = true;
    const spans = document.querySelectorAll('.stats-big span');
    if (spans[0]) animateCounter(spans[0], 12400, ' students');
    if (spans[1]) animateCounter(spans[1], 890000, ' study sessions');
    if (spans[2]) animateCounter(spans[2], 34000, ' goals completed');
  }
}, { threshold: 0.5 });

if (statsSection) statsObserver.observe(statsSection);

// ── Pause marquee on hover ──
const marqueeTrack = document.querySelector('.marquee-track');
if (marqueeTrack) {
  marqueeTrack.addEventListener('mouseenter', () => {
    marqueeTrack.style.animationPlayState = 'paused';
  });
  marqueeTrack.addEventListener('mouseleave', () => {
    marqueeTrack.style.animationPlayState = 'running';
  });
}


// ── Light / Dark Theme Toggle ──
const themeToggle = document.getElementById('theme-toggle');

const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/>
  <line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/>
  <line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  themeToggle.innerHTML = dark ? SUN_SVG : MOON_SVG;
  themeToggle.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  localStorage.setItem('ll_theme', dark ? 'dark' : 'light');
}

applyTheme(localStorage.getItem('ll_theme') === 'dark');

themeToggle.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});


// ── Footer reveal effect: set spacer height ──
function setFooterSpacer() {
  const footer = document.querySelector('footer');
  const spacer = document.getElementById('footer-spacer');
  if (footer && spacer) {
    spacer.style.height = footer.offsetHeight + 'px';
  }
}

setFooterSpacer();
window.addEventListener('resize', setFooterSpacer);


// ── Leaderboard tabs (Individual / Team) ──
const lbTabs = document.querySelectorAll('.lb-tab');
const lbPanels = document.querySelectorAll('.lb-panel');

lbTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.lbTab;

    lbTabs.forEach(t => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });

    lbPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `lb-${target}`);
    });
  });
});

// Scroll to leaderboard when arriving with #leaderboard hash
if (window.location.hash === '#leaderboard') {
  const lbSection = document.getElementById('leaderboard');
  if (lbSection) {
    requestAnimationFrame(() => {
      const top = lbSection.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }
}
