// ─── CoreForm Language Switcher (RO | EN) ─────────────────────────────────
// Handles: click-to-switch language, localStorage persistence, and
// automatic redirect on page load to honor the saved language preference.
(function () {
    'use strict';

    /** Returns the current page path (no query string / hash). */
    function getCurrentPath() {
        return window.location.pathname;
    }

    /**
     * Whether the current URL carries a literal ".html" extension.
     * True when served by a plain static server (e.g. VS Code Live Server),
     * false in production where .htaccess serves pretty (extensionless) URLs.
     * Redirect targets are built to match, so they resolve in both environments.
     */
    function usesHtmlExtension(path) {
        return /\.html$/i.test(path);
    }

    /**
     * Builds the English version URL of a given path.
     * "/"        -> "/" (language-neutral landing page)
     * "/contact" -> "/contact-en"
     * Note: index has no English version; it serves both languages.
     */
    function toEnglishUrl(path) {
        const htmlExt = usesHtmlExtension(path);
        let file = path.substring(path.lastIndexOf('/') + 1);

        // Root path, empty, "index", or "index.html" -> language-neutral landing page
        if (file === '' || file === '/' || file === 'index' || file === 'index.html') {
            return htmlExt ? '/index.html' : '/';
        }

        // Strip .html if a stale link still carries it
        file = file.replace(/\.html$/i, '');

        // Already an English page? Keep it as-is.
        if (file.endsWith('-en')) {
            return '/' + file + (htmlExt ? '.html' : '');
        }

        return '/' + file + '-en' + (htmlExt ? '.html' : '');
    }

    /**
     * Builds the Romanian (default) version URL of a given path.
     * "/contact-en" -> "/contact"
     * "/index"      -> "/" (language-neutral landing page)
     */
    function toRomanianUrl(path) {
        const htmlExt = usesHtmlExtension(path);
        let file = path.substring(path.lastIndexOf('/') + 1);

        if (file === '' || file === '/' || file === 'index' || file === 'index.html') {
            return htmlExt ? '/index.html' : '/';
        }

        // Strip .html if a stale link still carries it, then strip "-en" suffix
        file = file.replace(/\.html$/i, '').replace(/-en$/, '');

        return '/' + file + (htmlExt ? '.html' : '');
    }

    /** Switch the active site language to English and redirect. */
    function switchToEnglish() {
        localStorage.setItem('lang', 'en');
        window.location.href = toEnglishUrl(getCurrentPath());
    }

    /** Switch the active site language to Romanian and redirect. */
    function switchToRomanian() {
        localStorage.setItem('lang', 'ro');
        window.location.href = toRomanianUrl(getCurrentPath());
    }

    /** Moves the toggle thumb and updates pressed state based on the URL. */
    function updateActiveLangUI() {
        const isEnglishPage = getCurrentPath().includes('-en');
        const langSwitch = document.querySelector('.lang-switch');
        const enBtn = document.getElementById('lang-en');
        const roBtn = document.getElementById('lang-ro');

        if (langSwitch) langSwitch.setAttribute('data-active', isEnglishPage ? 'en' : 'ro');
        if (enBtn) enBtn.setAttribute('aria-pressed', String(isEnglishPage));
        if (roBtn) roBtn.setAttribute('aria-pressed', String(!isEnglishPage));
    }

    /** Wires up click handlers for the language switch buttons. */
    function bindLanguageButtons() {
        const enBtn = document.getElementById('lang-en');
        const roBtn = document.getElementById('lang-ro');

        if (enBtn) {
            enBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchToEnglish();
            });
        }

        if (roBtn) {
            roBtn.addEventListener('click', function (e) {
                e.preventDefault();
                switchToRomanian();
            });
        }
    }

    /**
     * On page load, honor the user's previously saved language preference
     * by redirecting automatically if the current page doesn't match it.
     * Note: index is language-neutral; no redirect needed.
     * Returns true if a redirect was triggered.
     */
    function autoRedirectToSavedLanguage() {
        const savedLang = localStorage.getItem('lang');
        const isEnglishPage = getCurrentPath().includes('-en');
        const isIndexPage = getCurrentPath() === '/' || getCurrentPath() === '/index' || getCurrentPath() === '/index.html';

        // index is the language-neutral landing page; don't redirect
        if (isIndexPage) {
            return false;
        }

        if (savedLang === 'en' && !isEnglishPage) {
            window.location.replace(toEnglishUrl(getCurrentPath()));
            return true;
        }

        if (savedLang === 'ro' && isEnglishPage) {
            window.location.replace(toRomanianUrl(getCurrentPath()));
            return true;
        }

        return false;
    }

    document.addEventListener('DOMContentLoaded', function () {
        // Redirect first (if needed) to avoid a flash of the wrong language.
        const redirected = autoRedirectToSavedLanguage();
        if (redirected) return;

        bindLanguageButtons();
        updateActiveLangUI();
    });
})();
