#!/bin/bash
# Lupa OCR - Installation Script
# This script installs the Lupa OCR GNOME Shell extension

set -e

EXTENSION_NAME="lupa-ocr@user"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Lupa OCR - Installation Script"
echo "=================================="
echo ""

# Check if running on GNOME
if ! command -v gnome-shell &> /dev/null; then
    echo "❌ Error: gnome-shell not found. This extension requires GNOME."
    exit 1
fi

# Check GNOME version
GNOME_VERSION=$(gnome-shell --version | grep -oP '\d+' | head -1)
echo "✓ GNOME Shell version: $GNOME_VERSION"

# Check dependencies
echo ""
echo "Checking dependencies..."

check_dependency() {
    if command -v "$1" &> /dev/null; then
        echo "✓ $1 is installed"
        return 0
    else
        echo "✗ $1 is NOT installed"
        return 1
    fi
}

MISSING_DEPS=0

check_dependency "tesseract" || MISSING_DEPS=1
check_dependency "gnome-screenshot" || MISSING_DEPS=1
check_dependency "convert" || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo "⚠️  Some dependencies are missing."
    echo "Please install them with your package manager:"
    echo ""
    echo "  Arch/Manjaro: sudo pacman -S tesseract tesseract-data-eng gnome-screenshot imagemagick"
    echo "  Ubuntu/Debian: sudo apt install tesseract-ocr tesseract-ocr-eng gnome-screenshot imagemagick"
    echo "  Fedora: sudo dnf install tesseract tesseract-langpack-eng gnome-screenshot imagemagick"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create extension directory
echo ""
echo "Installing extension..."
mkdir -p "$EXTENSION_DIR"

# Copy files
cp "$SCRIPT_DIR/extension.js" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/prefs.js" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/metadata.json" "$EXTENSION_DIR/"
cp "$SCRIPT_DIR/stylesheet.css" "$EXTENSION_DIR/"

# Copy schemas
mkdir -p "$EXTENSION_DIR/schemas"
cp "$SCRIPT_DIR/schemas/"*.xml "$EXTENSION_DIR/schemas/"

# Copy icons
if [ -d "$SCRIPT_DIR/icons" ]; then
    cp -r "$SCRIPT_DIR/icons" "$EXTENSION_DIR/"
fi

# Install image search helper
echo "Installing image search helper..."
mkdir -p "$HOME/.local/bin"
cp "$SCRIPT_DIR/lupa-image-search" "$HOME/.local/bin/"
chmod +x "$HOME/.local/bin/lupa-image-search"
echo "✓ Helper installed to ~/.local/bin/lupa-image-search"

# Compile schemas
echo "Compiling GSettings schemas..."
cd "$EXTENSION_DIR/schemas"
glib-compile-schemas .

# Restart GNOME Shell (X11 only)
if [ "$XDG_SESSION_TYPE" = "x11" ]; then
    echo ""
    echo "Restarting GNOME Shell..."
    dbus-send --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'global.reexec_self();'
fi

# Enable extension
echo ""
echo "Enabling extension..."
gnome-extensions enable "$EXTENSION_NAME" 2>/dev/null || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    echo "   1. Log out and log back in (required for Wayland)"
    echo "   2. Enable 'Lupa OCR' in GNOME Extensions app"
else
    echo "   1. Enable 'Lupa OCR' in GNOME Extensions app"
fi
echo "   3. Click the 🔍 icon in the top bar to start"
echo "   4. Or press Super+Space to capture text"
echo "   5. Or press Super+Shift+I to search by image"
echo ""
echo "⚙️  Configure via: GNOME Extensions → Lupa OCR → ⚙️"
echo ""
echo "Enjoy! 🔍"
