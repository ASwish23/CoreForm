// Light / dark theme for the admin pages (login + dashboard).
// Loaded synchronously in <head> so the right theme is set before first paint.
//
// Order of preference: the choice saved from the switcher, otherwise the
// system setting. Without a saved choice the page follows the system live.
(function () {
  var KEY = 'cf-theme';
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (err) {
      return null; // private mode / blocked storage
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0E1512' : '#2C4A3B');
    document.dispatchEvent(new CustomEvent('cf-themechange', { detail: theme }));
  }

  window.cfTheme = {
    get: function () { return root.getAttribute('data-theme') || 'light'; },
    set: function (theme) {
      try { localStorage.setItem(KEY, theme); } catch (err) { /* still applies for this visit */ }
      apply(theme);
    }
  };

  apply(saved() || (media.matches ? 'dark' : 'light'));

  var onSystemChange = function (event) { if (!saved()) apply(event.matches ? 'dark' : 'light'); };
  if (media.addEventListener) media.addEventListener('change', onSystemChange);
  else if (media.addListener) media.addListener(onSystemChange);
})();
