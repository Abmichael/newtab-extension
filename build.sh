#!/bin/bash

# Professional NeoTab Build Script using Node.js minifiers
# Uses terser for JS, clean-css for CSS, and html-minifier for HTML

BUILD_DIR="dist"
SRC_DIR="src"

echo "🚀 Building NeoTab with professional minifiers..."

# Clean and create build directory
rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR/{js,css}

# Copy and optimize icons (keep original PNG files)
echo "📦 Copying icons..."
cp -r icons $BUILD_DIR/

# Minify CSS files using clean-css-cli
echo "📦 Minifying CSS with clean-css..."
# Combine all CSS files first
cat $SRC_DIR/css/main.css $SRC_DIR/css/folders.css $SRC_DIR/css/animations.css $SRC_DIR/css/themes.css > $BUILD_DIR/css/combined.css

# Minify with clean-css (optimization level 2)
cleancss -O 2 $BUILD_DIR/css/combined.css -o $BUILD_DIR/css/styles.min.css
rm $BUILD_DIR/css/combined.css

# Minify JavaScript files using terser
echo "📦 Minifying JavaScript with terser..."
# Combine JavaScript files in dependency order
cat $SRC_DIR/js/performance.js \
    $SRC_DIR/js/error-handler.js \
    $SRC_DIR/js/storage.js \
    $SRC_DIR/js/search.js \
    $SRC_DIR/js/folders.js \
    $SRC_DIR/js/settings.js \
    $SRC_DIR/js/ui/ComponentManager.js \
    $SRC_DIR/js/ui/RenderManager.js \
    $SRC_DIR/js/ui/DialogManager.js \
    $SRC_DIR/js/ui/NotificationManager.js \
    $SRC_DIR/js/ui/DragDropManager.js \
    $SRC_DIR/js/ui/ContextMenuManager.js \
    $SRC_DIR/js/ui/PopoverManager.js \
    $SRC_DIR/js/ui/SettingsUIManager.js \
    $SRC_DIR/js/ui/EventHandler.js \
    $SRC_DIR/js/ui.js \
    $SRC_DIR/js/ui/index.js \
    $SRC_DIR/js/app.js > $BUILD_DIR/js/combined.js

# Minify with terser (aggressive optimization, remove console.log)
terser $BUILD_DIR/js/combined.js \
    --compress drop_console=true,drop_debugger=true,pure_funcs=['console.log','console.info','console.debug'] \
    --mangle \
    --toplevel \
    --output $BUILD_DIR/js/app.min.js

rm $BUILD_DIR/js/combined.js

# Create optimized HTML
echo "📦 Creating optimized HTML..."
cat > $BUILD_DIR/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>new tab</title>
    <!-- Prevent theme flash: hide UI until settings apply -->
    <style>body.preload{display:none;}</style>
    <link rel="stylesheet" href="css/styles.min.css">
</head>
<body class="preload">
    <div id="app">
        <header class="header">
                <div class="clock" id="clock"></div>
            <div class="header-actions">
                <button class="settings-btn" id="settings-button">
                    <span>⚙️</span>
                    Settings
                </button>
            </div>
        </header>
        <main class="main-content">
            <div class="main-content-inner">
                <div class="search-bar" id="search-bar-container">
                    <!-- Search bar will be initialized here -->
                </div>
                <div class="folder-grid" id="folder-grid">
                    <!-- Folders and Links will be dynamically generated here -->
                </div>
            </div>
        </main>
        <div class="folder-overlay" id="folder-overlay">
            <!-- Folder content overlay will be generated here -->
        </div>
    </div>
    <script src="js/app.min.js"></script>
</body>
</html>
EOF

# Minify HTML using html-minifier-terser
html-minifier-terser $BUILD_DIR/index.html \
    --collapse-whitespace \
    --remove-comments \
    --remove-optional-tags \
    --remove-redundant-attributes \
    --remove-script-type-attributes \
    --remove-tag-whitespace \
    --use-short-doctype \
    --minify-css true \
    --minify-js true \
    --output $BUILD_DIR/index.html

# Copy and optimize manifest
echo "📦 Optimizing manifest..."
cp manifest.json $BUILD_DIR/

# Copy background.js and minify it
cp background.js $BUILD_DIR/
terser $BUILD_DIR/background.js \
    --compress drop_console=true \
    --mangle \
    --output $BUILD_DIR/background.js

# Create build info
cat > $BUILD_DIR/BUILD_INFO.md << EOF
# NeoTab Production Build

Built on: $(date)
Build tool: Professional Node.js minifiers

## Minification Tools Used:
- **JavaScript**: terser (with console removal and mangling)
- **CSS**: clean-css-cli (level 2 optimization)
- **HTML**: html-minifier-terser (aggressive compression)

## Bundle Analysis:
EOF

# Calculate and display sizes
echo "📊 Bundle size analysis:"
TOTAL_SIZE=$(du -sh $BUILD_DIR | cut -f1)
CSS_SIZE=$(du -sh $BUILD_DIR/css/styles.min.css 2>/dev/null | cut -f1 || echo "N/A")
JS_SIZE=$(du -sh $BUILD_DIR/js/app.min.js 2>/dev/null | cut -f1 || echo "N/A")
HTML_SIZE=$(du -sh $BUILD_DIR/index.html 2>/dev/null | cut -f1 || echo "N/A")
ICONS_SIZE=$(du -sh $BUILD_DIR/icons 2>/dev/null | cut -f1 || echo "N/A")

echo "Total build size: $TOTAL_SIZE"
echo "Minified CSS: $CSS_SIZE"
echo "Minified JS: $JS_SIZE"
echo "Minified HTML: $HTML_SIZE"
echo "Icons: $ICONS_SIZE"

# Add to build info
echo "- Total build size: $TOTAL_SIZE" >> $BUILD_DIR/BUILD_INFO.md
echo "- Minified CSS: $CSS_SIZE" >> $BUILD_DIR/BUILD_INFO.md
echo "- Minified JS: $JS_SIZE" >> $BUILD_DIR/BUILD_INFO.md
echo "- Minified HTML: $HTML_SIZE" >> $BUILD_DIR/BUILD_INFO.md
echo "- Icons: $ICONS_SIZE" >> $BUILD_DIR/BUILD_INFO.md

# Check if we met our target
TOTAL_KB=$(du -k $BUILD_DIR | tail -1 | cut -f1)
echo ""
if [ $TOTAL_KB -lt 50 ]; then
    echo "🎉 SUCCESS: Bundle size under 50KB target! (${TOTAL_KB}KB)"
    echo "- Bundle target met: ${TOTAL_KB}KB < 50KB ✅" >> $BUILD_DIR/BUILD_INFO.md
else
    echo "📊 Bundle size: ${TOTAL_KB}KB (target: <50KB)"
    echo "- Bundle size: ${TOTAL_KB}KB (target: <50KB)" >> $BUILD_DIR/BUILD_INFO.md
fi

echo ""
echo "✅ Professional production build complete!"
echo "📁 Files are in the '$BUILD_DIR' directory"
echo "📦 Ready for Chrome Web Store submission"

# Show file structure
echo ""
echo "📂 Build structure:"
find $BUILD_DIR -type f -exec ls -lh {} \; | awk '{print $5 "\t" $9}'
