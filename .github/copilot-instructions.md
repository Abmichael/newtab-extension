<!--
This file contains workspace-specific Copilot instructions derived from the project's
`shrimp-rules.md` development guidelines. It replaces the previous contents and
serves as the authoritative guidance for Copilot-assisted edits and automated
coding tasks in this repository.

IMPORTANT: keep this file free of HTML comments for readability; this header is
HTML-commented only to remain compatible with other tooling that may parse the
file. The remainder of the file is plain Markdown.
-->

# Copilot Instructions — newtab Chrome Extension (derived from shrimp-rules.md)

Purpose
- Provide explicit, workspace-specific instructions for Copilot to follow when
	assisting with the `newtab` extension. These rules are the canonical source
	for development decisions, security and performance constraints, and file
	structure conventions.

High-level constraints
- Use Vanilla JavaScript, HTML5, CSS3. No external frameworks or third-party
	dependencies.
- Target: Chrome extension Manifest V3.
- Offline-first: all resources must be local or retrieved via chrome.runtime.getURL.
- Follow Content Security Policy (no inline scripts, no eval/Function).

Required manifest and permissions
- `manifest_version: 3` and `chrome_url_overrides.newtab` to point at `index.html`.
- Declare `permissions: ["storage"]` for use of `chrome.storage.local`.

File and naming standards
- Keep the repo layout and file roles consistent with the project:
	- `index.html` — new tab page entry
	- `manifest.json` — extension entry
	- `src/js/*.js` — ES modules (use camelCase for identifiers)
	- `src/css/*.css` — kebab-case filenames
- Filenames: kebab-case. JavaScript variables and functions use camelCase. Class
	names use PascalCase.

Storage and data schema
- Use `chrome.storage.local` for all persistence. Never use localStorage or
	sessionStorage.
- All storage operations must use async/await and include try/catch error
	handling and fallback/defaults.
- Persist a schema version string in storage to support future migrations.

Data validation and sanitization
- Validate URLs using the URL constructor. If invalid, reject and surface a
	helpful error to the UI.
- Sanitize any user-provided text before inserting into the DOM. Avoid
	direct innerHTML assignments; build DOM nodes with createElement/textContent.

UI and UX rules
- Android-style folder grid using CSS Grid for layout and CSS transitions for
	animations (no complex JS animations). Use requestAnimationFrame only for
	gesture-based interactions.
- Folder previews show up to 4 favicons in a 2x2 grid. Provide a local fallback
	favicon (`./assets/default-favicon.png`) for failed loads.
- Click to expand a folder into a full-screen overlay; click outside to close.
- Right-click enters edit mode. Drag-and-drop merges folders/sites.

Favicon handling
- Generate favicons using the site origin: `${origin}/favicon.ico`. Wrap this in
	a try/catch and return a local fallback on errors.
- Attach onerror handlers to favicon `<img>` elements to swap to a local
	fallback and clear the error handler to avoid loops.

Performance and bundle size
- Target total bundle size under 50KB. File budgets:
	- JS files: <= 15KB each
	- CSS files: <= 10KB each
	- Images: optimized and WebP when possible
- Minimize DOM updates, batch mutations, debounce inputs (search/drag), and
	lazy-load non-critical resources.

Security and CSP
- No inline scripts in HTML. Use only local resources and chrome.runtime.getURL
	where necessary.
- No eval(), Function() constructors, or dynamic code execution.

Coding standards and patterns
- Use ES6 modules with named exports. Prefer small, testable modules.
- Async functions: use async/await and try/catch. Avoid Promise.then() chains.
- Prefix private methods with an underscore (e.g., `_getDefaultFolders`).
- Clean up event listeners to avoid leaks; use bound handler maps when needed.

Testing and local development
- Test locally by loading the unpacked extension in Chrome.
- Required test cases include: storage persistence, corrupted data recovery,
	page load performance (<100ms), responsive layout, and keyboard accessibility.

Changelog and documentation
- Follow Keep a Changelog and semantic versioning. Update `CHANGELOG.md` under
	`[Unreleased]` before committing any feature/fix.
- When adding features, update docs under `docs/` and reference them in the
	changelog entry.

When adding features or modifying UI
- Check existing patterns and storage schema before changing or extending.
- Always consider storage quota and implement migration logic with a schema
	version bump when necessary.

What to never do
- Never add external frameworks or CDN resources.
- Never use localStorage/sessionStorage.
- Never use inline event handlers or inject unsanitized HTML.

AI / Copilot-specific rules
- Before creating new files or altering large parts of the codebase, scan the
	repository for the existing patterns (storage.js, app.js, folders.js, ui.js)
	and mirror those patterns.
- If a suggested change would violate the bundle size, CSP rules, or storage
	constraints, do not apply it; instead present a plain-text alternative.
- When in doubt about UX decisions, keep changes minimal and open a short
	issue describing the proposed change and trade-offs.

Developer workflow notes
- Commit changes together with changelog/docs updates.
- Include small, focused tests for new behaviors (happy path + one edge case).

Contact / authority
- These instructions are authoritative for Copilot behavior in this repository.
	Any deviation must be documented and justified in `docs/` and the changelog.

-- End of instructions

