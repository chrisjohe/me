(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;

  function applyTheme() {
    const theme = preference ?? (systemTheme.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    root.dataset.themePreference = preference ?? 'auto';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#f7f6f3');
    const button = document.querySelector('.theme-toggle');
    if (button) {
      const mode = theme === 'dark' ? 'Dark' : 'Light';
      const source = preference === null ? 'system' : 'manual';
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      const label = `${mode} mode (${source}) · Switch to ${nextTheme} mode`;
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }

  applyTheme();

  systemTheme.addEventListener('change', () => {
    if (preference === null) applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    document.querySelector('.theme-toggle').addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
    });
  });
})();
