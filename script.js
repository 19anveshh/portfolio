// Configuration: 12 frames sequence
const TOTAL_FRAMES = 12;
const FRAME_PATH_PREFIX = 'video_frames_24fps/frame_';
const LERP_FACTOR = 0.08; // Silky smooth scroll inertia

// DOM Elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const scrollContainer = document.getElementById('scrollContainer');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
const scrollHint = document.getElementById('scrollHint');
const progressBar = document.getElementById('progressBar');

// State
const images = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let targetFrame = 0;
let currentFrame = 0;
let lastRenderedIndex = -1;
let isFirstFrameReady = false;

// Format frame index to 4-digit number: 1 -> "0001"
function getFrameSrc(index) {
  const padded = String(index + 1).padStart(4, '0');
  return `${FRAME_PATH_PREFIX}${padded}.png`;
}

// Fit & Cover image onto canvas cleanly preserving aspect ratio
function renderFrame(index) {
  if (index < 0 || index >= TOTAL_FRAMES) return;
  const img = images[index];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const canvasRatio = canvasW / canvasH;
  const imgRatio = imgW / imgH;
  let drawW, drawH, drawX, drawY;

  if (canvasRatio > imgRatio) {
    drawW = canvasW;
    drawH = canvasW / imgRatio;
    drawX = 0;
    drawY = (canvasH - drawH) / 2;
  } else {
    drawH = canvasH;
    drawW = canvasH * imgRatio;
    drawX = (canvasW - drawW) / 2;
    drawY = 0;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

// Canvas Resize handler accounting for device pixel ratio
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  // Force re-render of current active frame
  const activeIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
  renderFrame(activeIdx);
}

// Compute target frame based on current scroll position
function updateScrollTarget() {
  const maxScroll = scrollContainer.scrollHeight - window.innerHeight;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  
  // 12 frames scrub smoothly across the first 75% of scroll travel
  const scrubDistance = maxScroll * 0.75;
  const progress = Math.max(0, Math.min(1, scrubDistance > 0 ? scrollY / scrubDistance : 0));

  targetFrame = progress * (TOTAL_FRAMES - 1);

  if (progressBar) {
    progressBar.style.width = `${progress * 100}%`;
    if (scrollY > maxScroll + 30) {
      progressBar.style.opacity = '0';
    } else {
      progressBar.style.opacity = '1';
    }
  }

  if (scrollHint) {
    if (scrollY > 50) {
      scrollHint.classList.add('hidden');
    } else {
      scrollHint.classList.remove('hidden');
    }
  }

  const heroWrapper = document.getElementById('heroIntroWrapper') || document.getElementById('portfolioTitle');
  if (heroWrapper) {
    const titleFloat = (progress - 0.5) * 16;
    heroWrapper.style.transform = `translateY(${titleFloat}px)`;
  }
}

// Color stops matching the subtle lighting across the 12 frames
const COLOR_STOPS = [
  { stop: 0.00, r: 232, g: 222, b: 200 }, // Warm Editorial Cream (Frame 1)
  { stop: 0.50, r: 238, g: 220, b: 190 }, // Soft Warm Sunlight (Frame 6)
  { stop: 1.00, r: 236, g: 212, b: 172 }  // Warm Golden Sand (Frame 12)
];

function getInterpolatedColor(progress) {
  const p = Math.max(0, Math.min(1, progress));
  let start = COLOR_STOPS[0];
  let end = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (p >= COLOR_STOPS[i].stop && p <= COLOR_STOPS[i + 1].stop) {
      start = COLOR_STOPS[i];
      end = COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = end.stop - start.stop;
  const factor = range === 0 ? 0 : (p - start.stop) / range;

  const r = Math.round(start.r + (end.r - start.r) * factor);
  const g = Math.round(start.g + (end.g - start.g) * factor);
  const b = Math.round(start.b + (end.b - start.b) * factor);

  return { r, g, b };
}

let lastColorP = -1;
function updateThemeColors(progress) {
  // Update if progress changed meaningfully
  if (Math.abs(progress - lastColorP) < 0.001) return;
  lastColorP = progress;

  const { r, g, b } = getInterpolatedColor(progress);
  const root = document.documentElement;

  root.style.setProperty('--color-accent', `rgb(${r}, ${g}, ${b})`);
  root.style.setProperty('--color-accent-dim', `rgba(${r}, ${g}, ${b}, 0.7)`);
  root.style.setProperty('--color-glow', `rgba(${r}, ${g}, ${b}, 0.4)`);
  
  const ambientAlpha = (0.04 + progress * 0.14).toFixed(3);
  root.style.setProperty('--color-ambient', `rgba(${r}, ${g}, ${b}, ${ambientAlpha})`);
}

// Animation loop with linear interpolation (Lerp)
function tick() {
  const diff = targetFrame - currentFrame;
  
  if (Math.abs(diff) > 0.001) {
    currentFrame += diff * LERP_FACTOR;
  } else {
    currentFrame = targetFrame;
  }

  const frameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(currentFrame)));
  const smoothedProgress = currentFrame / (TOTAL_FRAMES - 1);
  
  // Smoothly shift colors matching the video lighting
  updateThemeColors(smoothedProgress);

  if (frameIndex !== lastRenderedIndex) {
    renderFrame(frameIndex);
    lastRenderedIndex = frameIndex;
  }

  requestAnimationFrame(tick);
}

// Preload all frames
function preloadFrames() {
  let initialLoaded = false;
  const loadStartTime = performance.now();

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const img = new Image();
    img.src = getFrameSrc(i);

    img.onload = () => {
      loadedCount++;
      const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);

      if (loaderBar) {
        loaderBar.style.width = `${percent}%`;
      }

      // Render the very first frame immediately as soon as ready
      if (i === 0 && !initialLoaded) {
        initialLoaded = true;
        isFirstFrameReady = true;
        renderFrame(0);
      }

      // Hide preloader with graceful timing to enjoy the drop-in animation
      if (loadedCount === TOTAL_FRAMES) {
        const elapsed = performance.now() - loadStartTime;
        const minDisplayDuration = 1200; // ensures smooth drop animation is enjoyed
        const delay = Math.max(0, minDisplayDuration - elapsed);

        setTimeout(() => {
          if (loader) {
            loader.classList.add('fade-out');
          }
        }, delay);
      }
    };

    img.onerror = () => {
      console.warn(`Failed to load frame ${i}`);
      loadedCount++;
    };

    images[i] = img;
  }
}

// Smooth keyboard scrolling support
window.addEventListener('keydown', (e) => {
  const scrollStep = window.innerHeight * 0.4;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
    window.scrollBy({ top: scrollStep, behavior: 'smooth' });
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    window.scrollBy({ top: -scrollStep, behavior: 'smooth' });
  }
});

// Smooth Anchor Navigation
function setupNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href').substring(1);
      if (!targetId) return;

      if (targetId === 'scrollContainer' || targetId === 'hero') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// Event Listeners
window.addEventListener('resize', resizeCanvas);
window.addEventListener('scroll', updateScrollTarget, { passive: true });

// Initialize
function init() {
  resizeCanvas();
  updateScrollTarget();
  preloadFrames();
  setupNavigation();
  requestAnimationFrame(tick);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
