# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
  - **Google Font Integration**: Added Inter font family for improved typography
  - **Hide Tile Labels Setting**: New option in Layout settings to hide text labels below folder and link tiles
  - Move Up/Down (swap with adjacent item)
  - Move to Top/Bottom (jump to first/last position)
  - Smart boundary detection (disabled arrows when at edges)
  - Type-aware ordering (folders separate from links)
  - Auto-sort disabled automatically on manual reorder
  - Inline SVG icons for professional appearance

- **Folder Preview Visuals**: Major improvements to folder preview icons and tile appearance
  - Preview icons now scale with tile size and maintain minimum readable size
  - Adaptive backgrounds applied to preview icons for consistency with main tiles
  - Preview icon containers use proportional border-radius and never elongate vertically
  - Gap between preview icons now scales with tile size (7px to 16px)
  - Wrapping logic ensures 2x2 grid or 2-top/1-bottom layout adapts to item count
  - Folder tile border is now 2px and matches theme (white for light, black for dark)
  - Folder tile background is darker for sunken effect
  - Shadows and borders improved for sunken, modern look

### Changed
  - Professional Feather Icons style (stroke-based)
  - Inline SVG for offline support (no CDN dependencies)
  - Font family now uses Inter as primary font with fallbacks
  - Updated Content Security Policy to allow Google Fonts resources
  - Theme-aware with `currentColor` inheritance
  - 16x16px size with smooth hover transitions
  - See `docs/CONTEXT_MENU_ICONS.md` for icon reference
  - Main grid columns: Auto-fit (responsive)
  - Folder grid columns: 3 (cleaner folder layout)
  - Tile size: 80px (more compact, min 60px)
  - Clock position: Bottom-left
  - Search engine: Google
  - Theme: Auto (follows system preference)

## [1.1.0] - 2025-10-26

### Added
- **Popularity-Based Auto-Sorting**: Automatically reorder links based on click frequency and recency
  - Time-weighted scoring algorithm with 45-day exponential decay
  - New item bonus (7-day boost period) to prevent new links from being buried
  - Deferred sorting (applies on page reload, not mid-session)
  - Configurable via Settings > Layout tab
  - Defaults to OFF to avoid surprising existing users
  - Folders are always exempt and appear first in original order
  - Click tracking across all navigation points (root links, folder sites, context menu)

- **Top Sites Smart Loading Improvements**:
  - Normalized hostname detection (ignores `www.` subdomain to prevent duplicates)
  - Automatic search engine exclusion (Google, Bing, DuckDuckGo, Yahoo, Baidu, etc.)
  - PWA detection and exclusion (filters out `utm_source=homescreen` links)
  - User-controlled blacklist for unwanted top sites suggestions
  - Link tracking metadata (`fromTopSites`, `addedAt` timestamps)
  - Enhanced delete dialog with "Don't suggest this site again" option

- **Modular UI Architecture**: Refactored UI into separate manager classes
  - `ComponentManager` - Reusable UI components (buttons, inputs, etc.)
  - `ContextMenuManager` - Right-click context menu handling
  - `DialogManager` - Modal dialogs and confirmations
  - `DragDropManager` - Drag-and-drop functionality
  - `EventHandler` - Centralized event delegation
  - `NotificationManager` - Toast notifications
  - `PopoverManager` - Folder expansion popovers
  - `RenderManager` - Grid rendering and updates
  - `SettingsUIManager` - Settings modal management

- **Weather Widget**: Optional weather display in header
  - Shows current temperature and conditions
  - Configurable location
  - Automatic updates

- **Enhanced Search**: Multiple search engine support
  - Google, Bing, DuckDuckGo, Brave
  - Custom search engine icons
  - Persistent search engine preference

### Changed
- **Theme System Enhancement**: Custom theme colors now clone from currently active theme instead of arbitrary defaults
- **Performance Improvements**: 
  - Lazy loading for non-visible favicons
  - Debounced user input events
  - Optimized grid re-rendering
- **Storage Schema**: Added `autoSortByPopularity`, `topSitesBlacklist`, and link metadata fields
- **Folder Behavior**: Folders now always appear first before links in the grid layout

### Fixed
- Duplicate site entries when `www.` subdomain variants exist
- Search engines appearing in top sites auto-population
- PWA shortcuts cluttering the new tab grid
- Missing error handling in storage operations

### Documentation
- Updated `README.md` - Reflected new features and architecture
- Updated `shrimp-rules.md` - Added changelog maintenance guidelines

## [1.0.0] - 2024-XX-XX

### Added
- Initial release of newtab Chrome extension
- Android-style folder organization system
- Drag-and-drop interface for organizing bookmarks
- 5 preset theme options
- Custom theme support with color pickers
- Configurable grid layout (3-6 columns)
- Optional clock widget (12/24-hour format)
- Import/Export functionality for settings backup
- Chrome top sites integration for auto-population
- Offline-first design with local storage
- Responsive design for desktop, tablet, and mobile
- Keyboard navigation support
- Right-click context menu (Open, Edit, Delete, Merge)
- Favicon support with fallback handling
- Search functionality with multiple engine options

### Technical
- Manifest V3 compliance
- Vanilla JavaScript (no framework dependencies)
- Bundle size under 50KB
- Sub-100ms load time
- Chrome Storage API integration
- Content Security Policy compliance
- Modular code architecture

---

## Changelog Maintenance Guide

### When to Update
- **Before committing**: Update CHANGELOG.md with your changes
- **During PR review**: Ensure changelog entry is clear and complete
- **Before release**: Move items from `[Unreleased]` to versioned section

### How to Categorize Changes
Use these standard categories:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security vulnerability fixes

### Writing Good Entries
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Be specific and concise
- Include relevant file/component names
- Reference documentation files when applicable
- Link to issues/PRs if relevant

### Version Format
- Use [Semantic Versioning](https://semver.org/)
- Format: `[MAJOR.MINOR.PATCH] - YYYY-MM-DD`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

### Example Entry
```markdown
### Added
- **Feature Name**: Brief description
  - Implementation detail 1
  - Implementation detail 2
  - See `docs/FEATURE.md` for documentation
```

[Unreleased]: https://github.com/Abmichael/newtab-extension/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Abmichael/newtab-extension/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Abmichael/newtab-extension/releases/tag/v1.0.0
