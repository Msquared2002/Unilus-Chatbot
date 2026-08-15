# UNILUS Dummy Environment

High-fidelity Phase 1 reproductions of the supplied UNILUS public website, student portal, and e-learning screenshots. This folder is self-contained and uses only HTML5, CSS3, and Vanilla JavaScript.

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

## Reference comparison

The supplied reference set was inspected in full: 40 images across the public website, student portal, and e-learning folders (30 PNG and 10 JPG files). The implementation was checked at the supplied desktop-style viewport and through the key scroll sections for each shell. The reference images themselves remain in the separate `Context` folder and were not duplicated here.

Known differences are limited to browser chrome/scroll position from the source captures, original-site typography and icon rendering, and the fact that all interactions are local demo states rather than live services.
