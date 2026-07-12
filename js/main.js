// Home page UI

const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', function () {
  const isDarkMode = document.body.classList.contains('dark');

  if (window.scrollY > 40) {
    if (isDarkMode) {
      navbar.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06)';
      navbar.style.background = 'rgba(20,20,20,0.80)';
    } else {
      navbar.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05)';
      navbar.style.background = 'rgba(255,255,255,0.85)';
    }
  } else {
    if (isDarkMode) {
      navbar.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.04)';
      navbar.style.background = 'rgba(20,20,20,0.65)';
    } else {
      navbar.style.boxShadow = '0 2px 16px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)';
      navbar.style.background = 'rgba(255,255,255,0.75)';
    }
  }
});

// Smooth scroll
const anchorLinks = document.querySelectorAll('a[href^="#"]');

for (let i = 0; i < anchorLinks.length; i++) {
  anchorLinks[i].addEventListener('click', function (e) {
    const href = anchorLinks[i].getAttribute('href');
    const target = document.querySelector(href);

    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  });
}

// Active nav link
const sections = document.querySelectorAll('section[id], div[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const sectionObserver = new IntersectionObserver(function (entries) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isIntersecting) {
      for (let j = 0; j < navLinks.length; j++) {
        navLinks[j].classList.remove('active');
        if (navLinks[j].getAttribute('href') === '#' + entry.target.id) {
          navLinks[j].classList.add('active');
        }
      }
    }
  }
}, { threshold: 0.4 });

for (let i = 0; i < sections.length; i++) {
  sectionObserver.observe(sections[i]);
}

// Scroll animations
const revealElements = document.querySelectorAll(
  '.feat-card, .tcard, .flow-card, .extra-card, .preview-wrap, .stats-big, .lb-table, .lb-podium-card'
);

const revealObserver = new IntersectionObserver(function (entries) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.1 });

for (let i = 0; i < revealElements.length; i++) {
  revealElements[i].style.opacity = '0';
  revealElements[i].style.transform = 'translateY(24px)';
  revealElements[i].style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  revealObserver.observe(revealElements[i]);
}

// Stats counter
function animateCounter(element, target, suffix) {
  let current = 0;
  const step = Math.ceil(target / 60);

  const interval = setInterval(function () {
    current = Math.min(current + step, target);
    element.textContent = current.toLocaleString() + suffix;
    if (current >= target) {
      clearInterval(interval);
    }
  }, 24);
}

const statsSection = document.querySelector('.stats-section');
let statsAnimated = false;
let statsDataReady = false;

function animateStatsFromDom() {
  if (statsAnimated || !statsDataReady) return;

  statsAnimated = true;
  const spans = document.querySelectorAll('.stats-big span');
  const suffixes = [' students', ' study sessions', ' goals completed'];

  for (let i = 0; i < spans.length; i++) {
    const target = parseInt(spans[i].dataset.target || '0', 10);
    animateCounter(spans[i], target, suffixes[i] || '');
  }
}

window.addEventListener('ll-stats-loaded', function () {
  statsDataReady = true;
  if (statsSection) {
    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.6) {
      animateStatsFromDom();
    }
  }
});

const statsObserver = new IntersectionObserver(function (entries) {
  if (entries[0].isIntersecting) {
    animateStatsFromDom();
  }
}, { threshold: 0.5 });

if (statsSection) {
  statsObserver.observe(statsSection);
}

// Marquee pause
const marqueeTrack = document.querySelector('.marquee-track');

if (marqueeTrack) {
  marqueeTrack.addEventListener('mouseenter', function () {
    marqueeTrack.style.animationPlayState = 'paused';
  });
  marqueeTrack.addEventListener('mouseleave', function () {
    marqueeTrack.style.animationPlayState = 'running';
  });
}

// Theme toggle
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

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  themeToggle.innerHTML = isDark ? SUN_SVG : MOON_SVG;
  themeToggle.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  localStorage.setItem('ll_theme', isDark ? 'dark' : 'light');
}

applyTheme(localStorage.getItem('ll_theme') === 'dark');

themeToggle.addEventListener('click', function () {
  const isDark = document.body.classList.contains('dark');
  applyTheme(!isDark);
});

// Footer spacer
function setFooterSpacer() {
  const footer = document.querySelector('footer');
  const spacer = document.getElementById('footer-spacer');
  if (footer && spacer) {
    spacer.style.height = footer.offsetHeight + 'px';
  }
}

setFooterSpacer();
window.addEventListener('resize', setFooterSpacer);

// Leaderboard tabs
const lbTabs = document.querySelectorAll('.lb-tab');
const lbPanels = document.querySelectorAll('.lb-panel');

for (let i = 0; i < lbTabs.length; i++) {
  lbTabs[i].addEventListener('click', function () {
    const tab = lbTabs[i];
    const target = tab.dataset.lbTab;

    for (let j = 0; j < lbTabs.length; j++) {
      const isActive = lbTabs[j] === tab;
      lbTabs[j].classList.toggle('active', isActive);
      lbTabs[j].setAttribute('aria-selected', isActive ? 'true' : 'false');
    }

    for (let k = 0; k < lbPanels.length; k++) {
      lbPanels[k].classList.toggle('active', lbPanels[k].id === 'lb-' + target);
    }
  });
}

// Open leaderboard from URL hash
if (window.location.hash === '#leaderboard') {
  const lbSection = document.getElementById('leaderboard');
  if (lbSection) {
    requestAnimationFrame(function () {
      const top = lbSection.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  }
}
