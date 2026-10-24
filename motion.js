(() => {
  const root = document.documentElement;
  const systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motion = new EventTarget();
  let preference = null;

  window.portraitMotion = motion;

  function applyMotion() {
    const enabled = preference ?? !systemMotion.matches;
    const changed = motion.enabled !== enabled;
    motion.enabled = enabled;
    root.dataset.motion = enabled ? 'on' : 'off';
    root.dataset.motionPreference = preference === null ? 'auto' : root.dataset.motion;
    const button = document.querySelector('.motion-toggle');
    if (button) {
      const state = enabled ? 'on' : 'off';
      const source = preference === null ? 'system' : 'manual';
      const nextState = enabled ? 'off' : 'on';
      const label = `Animations ${state} (${source}) · Turn animations ${nextState}`;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    if (changed) motion.dispatchEvent(new Event('change'));
  }

  applyMotion();

  systemMotion.addEventListener('change', () => {
    if (preference === null) applyMotion();
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyMotion();
    document.querySelector('.motion-toggle')?.addEventListener('click', () => {
      preference = !motion.enabled;
      applyMotion();
    });
  });
})();
