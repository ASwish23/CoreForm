// Template for config.js — copy this file to config.js and fill in your own
// project's values. config.js is gitignored and must never be committed.
//
// Local dev:  cp config.example.js config.js   (then edit config.js)
// Production: upload your real config.js to the server via FTP; it is not
//             part of the git repo and will not be overwritten by deploys
//             that only push tracked files.
window.SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
window.SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';

// Used by consultanta.js — TEMPORARY, still exposed to anyone viewing the
// page source. Rotate this key in Google AI Studio and move the call behind
// a server-side proxy before relying on it for real traffic.
window.GEMINI_API_KEY = 'YOUR-GEMINI-KEY';
