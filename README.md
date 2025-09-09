# NeoTab - Android-Style New Tab Extension

Transform your Chrome new tab into an organized workspace with beautiful Android-style folders for your favorite sites and bookmarks.

![NeoTab Preview](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=NeoTab+Preview)

## 🌟 Features

- **Android-Style Folders**: Organize your bookmarks in beautiful, intuitive folders
- **Configurable Layout**: Adjustable grid size and tile dimensions to fit your preference
- **Drag & Drop**: Easily reorganize folders and sites
- **Custom Themes**: 5 beautiful preset themes to match your style
- **Clock Widget**: Optional digital clock with customizable format
- **Import/Export**: Backup and restore your configuration
- **Offline-First**: Works completely offline with local storage
- **Lightweight**: Under 50KB total bundle size for fast loading

## 📦 Installation

### From Chrome Web Store (Recommended)
1. Visit the [NeoTab Chrome Web Store page](https://chrome.google.com/webstore)
2. Click "Add to Chrome"
3. Open a new tab to start using NeoTab!

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Open a new tab to see NeoTab in action!

## 🚀 Quick Start

1. **Create Your First Folder**: Click the "+" button to add a new folder
2. **Add Sites**: Click on a folder to open it, then use the "+" to add sites
3. **Customize**: Click the settings (⚙️) button to personalize themes and layout
4. **Organize**: Drag and drop folders and sites to merge them together

## ⚙️ Settings & Customization

### Themes
- **Default**: Clean dark theme with blue accents
- **Light**: Bright theme perfect for daytime use
- **Ocean**: Calming blue gradient theme
- **Forest**: Natural green theme for productivity
- **Sunset**: Warm orange and pink gradient

### Grid Options
- **Grid Size**: Choose 3, 4, 5, 6, 7, or 8 columns
- **Tile Size**: Adjustable tile size from 80px to 200px (affects both folders and links)
- **Responsive**: Smart responsive layout for all devices

### Clock Widget
- Toggle on/off
- 12-hour or 24-hour format
- Positioned in the header

## 🔧 Development

### Project Structure
```
NeoTab/
├── manifest.json          # Extension manifest
├── index.html             # Main new tab page
├── background.js          # Service worker
├── src/
│   ├── css/
│   │   ├── main.css       # Main styles
│   │   ├── folders.css    # Folder-specific styles
│   │   └── animations.css # Animations and transitions
│   └── js/
│       ├── app.js         # Main application
│       ├── storage.js     # Chrome storage wrapper
│       ├── folders.js     # Folder business logic
│       ├── settings.js    # Settings management
│       ├── ui.js          # UI management
│       ├── performance.js # Performance monitoring
│       └── error-handler.js # Error handling
├── icons/                 # Extension icons
└── build/                 # Production build output
```

### Building for Production

```bash
# Run the build script
./build.sh

# The optimized files will be in the 'build' directory
# Ready for Chrome Web Store submission
```

### Development Setup

```bash
# Clone the repository
git clone https://github.com/neotab/extension.git
cd neotab

# Load the extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" and select this directory
```

## 🏗️ Technical Details

### Architecture
- **Vanilla JavaScript**: No frameworks for maximum performance
- **Modular Design**: Clear separation of concerns
- **Chrome Storage API**: Reliable local data persistence
- **CSS Grid**: Modern, responsive layout system
- **Manifest V3**: Latest Chrome extension standards

### Performance Targets
- ✅ Bundle size under 50KB
- ✅ Load time under 100ms
- ✅ Memory usage under 10MB
- ✅ 60fps animations

### Browser Support
- Chrome 88+
- Edge 88+
- Other Chromium-based browsers

## 📱 Responsive Design

NeoTab works perfectly on all screen sizes:

- **Desktop**: Full-featured experience with hover effects
- **Tablet**: Touch-optimized interactions
- **Mobile**: Compact layout with gesture support

## 🔒 Privacy & Security

- **No External Requests**: Everything runs locally
- **No Data Collection**: Your data stays on your device
- **Open Source**: Transparent code you can audit
- **Minimal Permissions**: Only requires storage permission

## 🐛 Troubleshooting

### Common Issues

**Extension doesn't load:**
- Make sure you're using Chrome 88 or newer
- Check that Developer mode is enabled
- Try reloading the extension

**Data not saving:**
- Check Chrome storage permissions
- Ensure you're not in Incognito mode
- Try clearing extension data and reimporting

**Performance issues:**
- Check if you have too many sites (recommended: <100 total)
- Try switching to a lighter theme
- Clear browser cache

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Coding Standards

- Use ES6+ modern JavaScript
- Follow the existing code style
- Add comments for complex logic
- Ensure all features work offline
- Maintain the <50KB bundle size limit

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Android's folder system
- Icons from [Material Design Icons](https://materialdesignicons.com/)
- Color palettes from [Coolors.co](https://coolors.co/)

## 📞 Support

- 🐛 [Report Issues](https://github.com/neotab/extension/issues)
- 💬 [Discussions](https://github.com/neotab/extension/discussions)
- 📧 [Email Support](mailto:support@neotab.com)

## 🗺️ Roadmap

- [ ] Cloud sync capabilities
- [ ] Custom icon uploads
- [ ] Bookmark import from Chrome
- [ ] Widget system for weather, notes, etc.
- [ ] Keyboard shortcuts
- [ ] Advanced search functionality

---

**Made with ❤️ by the NeoTab Team**
