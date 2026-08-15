# UNILUS Dummy Environment

High-fidelity Phase 1 reproductions of the supplied UNILUS public website, student portal, and e-learning screenshots. This folder is self-contained and uses only HTML5, CSS3, and JavaScript.

## Run locally

From this folder, start any static HTTP server and open `index.html`. For example:

```text
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/` and choose a shell. The direct pages are `website.html`, `portal-login.html`, `portal.html`, `apply.html`, and `elearning.html`.

The Student Portal launcher opens `portal-login.html`. Use `demo` and `unilus demo` for the local demonstration login. A successful login stores only a temporary `sessionStorage` flag and redirects to `portal.html`; logout clears it. The application page is a separate local demo route and does not authenticate students.

## Structure

- `css/` contains shared, public website, portal, and LMS styles.
- `js/` contains small page-specific modules plus shared demo behaviors.
- `data/` contains structured local fixtures for the three shells.
- `assets/` contains the copied UNILUS logo and supplied campus, student, event, and newsletter imagery used by the reproduction.

The portal login, links, calendar controls, search, and other actions are demo-only. No authentication, backend service, live university data, AI/RAG, Google Sheets, Supabase, or framework dependency is included.

## Login Credentials
Username : demo
Password : unilus demo
