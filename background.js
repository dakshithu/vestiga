(() => {
  'use strict';

  const root = document.getElementById('bg-slideshow');
  if (!root) return;

  const slides = Array.from(root.querySelectorAll('.bg-slide'));
  if (!slides.length) return;

  // Apply background images from data-src so missing assets can be swapped later without code changes.
  for (const s of slides) {
    const src = s.getAttribute('data-src');
    if (src) s.style.backgroundImage = `url('${src}')`;
  }

  let idx = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));
  if (idx === -1) idx = 0;

  const intervalMs = 9000;
  setInterval(() => {
    const next = (idx + 1) % slides.length;
    slides[idx].classList.remove('is-active');
    slides[next].classList.add('is-active');
    idx = next;
  }, intervalMs);
})();
