# 🔍 Lupa OCR - GNOME Shell Extension

Capture text from your screen with OCR and search the web instantly. Like Google's Circle to Search but built into GNOME.

## 📸 Features

- **Screen OCR**: Select any area of your screen and extract text using Tesseract
- **Image Search**: Select any area and reverse image search it with Google Lens (like Circle to Search)
- **Auto Search**: Automatically search extracted text on DuckDuckGo (or other engines)
- **Clipboard Copy**: Text is automatically copied to your clipboard
- **Panel Icon**: Easy access via magnifying glass icon in the top bar
- **Keyboard Shortcuts**: `Super+Space` (OCR) and `Super+Shift+I` (image search)
- **Multiple Search Engines**: DuckDuckGo, Google, Bing, Yahoo, Ecosia, Startpage
- **10 OCR Languages**: English, Portuguese, Spanish, French, German, Italian, Japanese, Chinese, Korean, Russian

## 🛠️ Requirements

- GNOME Shell 45-50
- Tesseract OCR
- gnome-screenshot
- ImageMagick

### Install dependencies (Arch/Manjaro)

```bash
sudo pacman -S tesseract tesseract-data-eng tesseract-data-por gnome-screenshot imagemagick
```

### Install dependencies (Ubuntu/Debian)

```bash
sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-por gnome-screenshot imagemagick
```

### Install dependencies (Fedora)

```bash
sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-por gnome-screenshot imagemagick
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
2. Copy the `lupa-ocr@user` folder to your GNOME extensions directory:

```bash
cp -r lupa-ocr@user ~/.local/share/gnome-shell/extensions/
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
2. Select **"Capture Text (OCR)"** or **"Search Selection on Web"**
3. Draw a rectangle over the text you want to capture
4. The text will be:
   - Copied to your clipboard
   - Searched on DuckDuckGo (if auto-search is enabled)
   - Shown in a notification

### Via Keyboard Shortcut
1. Press `Super+Space`
2. Draw a rectangle over the text
3. Done!

### Search by Image
1. Press `Super+Shift+I` (or menu → "Search by Image (Lens)")
2. Draw a rectangle over the object/region to search
3. The image is uploaded to a single trusted host (litterbox.catbox.moe) and Google Lens opens with the resulting URL
4. If the upload fails, the image is copied to the clipboard (as image data) and Lens opens for manual paste

> Note: requires internet access. To switch method (lens-cli / manual), open ⚙️ Settings → Image Search.

### Cancel Selection
- Press `Escape` to cancel

## ⚙️ Configuration

Open preferences via:
- GNOME Extensions app → Lupa OCR → ⚙️
- Or: `gnome-extensions prefs lupa-ocr@user`

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **OCR Language** | Language for text recognition | English (`eng`) |
| **Auto Search** | Automatically open web search after OCR | Enabled |
| **Search Engine** | Choose your preferred search engine | DuckDuckGo |
| **Copy to Clipboard** | Copy extracted text to clipboard | Enabled |
| **Show Notifications** | Show notification with extracted text | Enabled |
| **Image Search Method** | Imgur+Lens, lens-cli, or manual | Imgur+Lens |

### Image Search Methods

| Method | Description |
|--------|-------------|
| **Imgur + Google Lens** (default) | Uploads image anonymously to a single trusted host (litterbox) and opens Google Lens with the URL. No extra installs. Fast and lightweight. |
| **lens-cli** | Uses `lens-cli` (AUR: `lens-cli-git`). Install with `yay -S lens-cli-git`. |
| **Manual** | Copies file path and opens `lens.google.com` for manual paste. Always works offline. |

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

1. **Selection Mode**: When activated, a fullscreen overlay appears
2. **Draw Rectangle**: User draws a rectangle over the desired area
3. **Screenshot**: The selected area is captured using the GNOME Shell screenshot API
4. **OCR or Image Search**: Text is extracted with `tesseract` (`--psm 6` for fast single-block), OR the image is uploaded to a trusted host for Google Lens
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
- Make sure `gnome-screenshot` is installed
- On Wayland, some apps may block screenshots

### No text detected
- Try selecting a larger area
- Ensure the text is clear and readable
- Try a different OCR language

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