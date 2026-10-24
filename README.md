# 🔍 Lupa OCR - GNOME Shell Extension

Capture text from your screen with OCR and search the web instantly. Like Google's Circle to Search but built into GNOME.

## 📸 Features

- **Screen OCR**: Select any area of your screen and extract text using Tesseract
- **Smart OCR Preprocessing**: automatically upscales small text, normalizes contrast and handles dark themes (light text on dark backgrounds) so text in windows and images is readable
- **Text Only Mode**: Capture text without opening a web search — perfect for copying text
- **Image Search**: Select any area and reverse image search it with Google Lens (like Circle to Search)
- **Auto Search**: Automatically search extracted text on DuckDuckGo (or other engines)
- **Clipboard Copy**: Text is automatically copied to your clipboard
- **Panel Icon**: Easy access via magnifying glass icon in the top bar
- **Keyboard Shortcuts**: `Super+Space` (OCR), `Super+T` (text only) and `Super+Shift+I` (image search)
- **Multiple Search Engines**: DuckDuckGo, Google, Bing, Yahoo, Ecosia, Startpage
- **12 OCR Language Options**: Portuguese, English, Spanish, French, German, Italian, Japanese, Chinese, Korean, Russian + combined modes (`por+eng`, `spa+eng`) for accents

## 🛠️ Requirements

- GNOME Shell 45-50
- Tesseract OCR
- ImageMagick
- Python 3 and curl (for automatic image search)

### Install dependencies (Arch/Manjaro)

```bash
sudo pacman -S tesseract tesseract-data-eng tesseract-data-por imagemagick python curl
```

### Install dependencies (Ubuntu/Debian)

```bash
sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-por imagemagick python3 curl
```

### Install dependencies (Fedora)

```bash
sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-por imagemagick python3 curl
```

## 📦 Installation

### Automatic

```bash
git clone https://github.com/dznass-cmd/lupa-ocr-extension
cd lupa-ocr-extension
chmod +x install.sh
./install.sh
```

### Manual Installation

1. Clone or download this repository
2. From the repository directory, copy the extension files and bundled helper:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/lupa-ocr@user
cp extension.js prefs.js metadata.json stylesheet.css lupa-image-search ~/.local/share/gnome-shell/extensions/lupa-ocr@user/
cp -r schemas ~/.local/share/gnome-shell/extensions/lupa-ocr@user/
```

3. Compile the GSettings schema:

```bash
cd ~/.local/share/gnome-shell/extensions/lupa-ocr@user/schemas
glib-compile-schemas .
```

4. Restart GNOME Shell:
   - **Wayland**: Log out and log back in
   - **X11**: Press `Alt+F2`, type `r`, press Enter

5. Enable the extension:

```bash
gnome-extensions enable lupa-ocr@user
```

Or use the **GNOME Extensions** app to enable it.

## 🎯 Usage

### Via Panel Icon
1. Click the 🔍 icon in the top bar
2. Select **"Capture Text (OCR)"**, **"Text Only (No Search)"** or **"Search Selection on Web"**
3. Draw a rectangle over the text you want to capture
4. The text will be:
   - Copied to your clipboard
   - Searched on DuckDuckGo (if auto-search is enabled, except in **Text Only** mode)
   - Shown in a notification

### Via Keyboard Shortcut
1. Press `Super+Space` to capture text (with auto-search), or `Super+T` for **text only** (never opens the browser)
2. Draw a rectangle over the text
3. Done!

### Search by Image
1. Press `Super+Shift+I` (or menu → "Search by Image (Lens)")
2. Draw a rectangle over the object/region to search
3. The image is uploaded to litterbox.catbox.moe (72-hour retention) and Google Lens opens with the resulting URL
4. If the upload fails, the image is copied to the clipboard (as image data) and Lens opens for manual paste

> Note: requires internet access. To switch method (lens-cli / manual), open ⚙️ Settings → Image Search.

Manual mode and the upload fallback copy PNG data directly through GNOME's clipboard on Wayland and X11. The standalone `lupa-image-search` command requires `wl-clipboard` on Wayland or `xclip` on X11 for its clipboard fallback. Capture files are removed when processing finishes, including on errors.

### Cancel Selection
- Press `Escape` to cancel

## ⚙️ Configuration

Open preferences via:
- GNOME Extensions app → Lupa OCR → ⚙️
- Or: `gnome-extensions prefs lupa-ocr@user`

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **OCR Language** | Language for text recognition (combos like `por+eng` supported) | Português + English (`por+eng`) |
| **Auto Search** | Automatically open web search after OCR | Enabled |
| **Search Engine** | Choose your preferred search engine | DuckDuckGo |
| **Copy to Clipboard** | Copy extracted text to clipboard | Enabled |
| **Show Notifications** | Show notification with extracted text | Enabled |
| **Image Search Method** | Upload+Lens, lens-cli, or manual | Upload+Lens |
| **Text Only Shortcut** | Keyboard shortcut for text-only capture (no search) | Super+T |

### Image Search Methods

| Method | Description |
|--------|-------------|
| **Upload + Google Lens** (default) | Uses Python 3 and curl to upload the image to litterbox.catbox.moe, then opens Google Lens with the URL. |
| **lens-cli** | Uses `lens-cli` (AUR: `lens-cli-git`). Install with `yay -S lens-cli-git`. |
| **Manual** | Copies the PNG image and opens `lens.google.com` for manual paste. Google Lens requires internet access. |

## 📁 Project Structure

```
lupa-ocr@user/
├── extension.js          # Main extension logic
├── prefs.js              # Preferences UI
├── metadata.json         # Extension metadata
├── stylesheet.css        # CSS styles
├── schemas/
│   ├── org.gnome.shell.extensions.lupa-ocr.gschema.xml
│   └── gschemas.compiled
├── lupa-image-search     # Image search helper (Google Lens via litterbox)
└── README.md             # This file
```

## 🔧 How It Works

1. **Selection Mode**: GNOME's native area selector grabs the pointer and keyboard across all monitors
2. **Draw Rectangle**: User draws a rectangle over the desired area
3. **Screenshot**: The selected area is captured using the GNOME Shell screenshot API
4. **OCR or Image Search**: Text is extracted with `tesseract` (`--psm 3` for automatic page segmentation), OR the image is uploaded to litterbox.catbox.moe for Google Lens
5. **Output**: Text is copied to clipboard, searched on web, and/or shown in notification

## 🐛 Troubleshooting

### Extension not showing
- Make sure you restarted GNOME Shell (log out/in on Wayland)
- Check if the extension is enabled: `gnome-extensions list`

### OCR not working
- Verify tesseract is installed: `tesseract --version`
- Check language packs: `tesseract --list-langs`
- Install missing languages with your package manager

### Screenshot fails
- Check the GNOME Shell log for screenshot errors: `journalctl --user -f -o cat`
- On Wayland, some apps may block screenshots

### No text detected
- Try selecting a larger area
- Ensure the text is clear and readable
- Try a different OCR language

## Tests

Run from the repository root:

```bash
node tests/extension.test.cjs
python3 -m unittest discover -s tests -v
bash -n install.sh uninstall.sh
gjs -m tests/ocr-integration.js
```

The first two suites use substitutes for external services and do not capture your screen, upload files, or access the clipboard. The GJS integration test uses synthetic images with real ImageMagick and Tesseract (`eng` language pack and DejaVu Sans font required) and checks subprocess cancellation.

To verify the shortcut schema with real GSettings without modifying your settings:

```bash
schema_dir=$(mktemp -d)
cp schemas/*.xml "$schema_dir/"
glib-compile-schemas --strict "$schema_dir"
GSETTINGS_SCHEMA_DIR="$schema_dir" GSETTINGS_BACKEND=memory gjs -m tests/settings.js
rm -r "$schema_dir"
```

After installing an update, restart your GNOME session so the new schema is loaded. Manually check Escape cancellation, capture on a secondary monitor, OCR/text-only/search modes, each image-search method, and disabling the extension during a capture.

## 📝 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

## 🙏 Credits

- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) - OCR engine
- [GNOME Shell](https://www.gnome.org/) - Desktop environment
- [gnome-screenshot](https://wiki.gnome.org/Apps/GnomeScreenshot) - Screenshot tool
- [ImageMagick](https://imagemagick.org/) - Image processing

## 📞 Support

- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions

---

Made with ❤️ for GNOME
