#!/bin/bash
# Lupa OCR - Uninstallation Script
# This script removes the Lupa OCR GNOME Shell extension

set -e

EXTENSION_NAME="lupa-ocr@user"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_NAME"

echo "🔍 Lupa OCR - Uninstallation Script"
echo "===================================="
echo ""

# Disable extension
echo "Disabling extension..."
gnome-extensions disable "$EXTENSION_NAME" 2>/dev/null || true

# Remove extension directory
echo "Removing extension files..."
if [ -d "$EXTENSION_DIR" ]; then
    rm -rf "$EXTENSION_DIR"
    echo "✓ Extension directory removed"
else
    echo "⚠️  Extension directory not found"
fi

# Remove image search helper
echo "Removing image search helper..."
if [ -f "$HOME/.local/bin/lupa-image-search" ]; then
    rm -f "$HOME/.local/bin/lupa-image-search"
    echo "✓ Helper removed"
fi

# Restart GNOME Shell (X11 only)
if [ "$XDG_SESSION_TYPE" = "x11" ]; then
    echo ""
    echo "Restarting GNOME Shell..."
    dbus-send --type=method_call --dest=org.gnome.Shell /org/gnome/Shell org.gnome.Shell.Eval string:'global.reexec_self();'
fi

echo ""
echo "✅ Uninstallation complete!"
echo ""
echo "The extension has been removed from your system."
echo ""
