/* extension.js
 *
 * Lupa OCR - Capture text from screen and search the web
 * Version: 1.4 - Light & Fast
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

const _DEBUG = false;

function _dbg(msg) {
    if (_DEBUG)
        log(`Lupa OCR: ${msg}`);
}

function _ms() {
    return Math.round(GLib.get_monotonic_time() / 1000);
}

const LupaOCRIndicator = GObject.registerClass(
class LupaOCRIndicator extends PanelMenu.Button {
    _init(extension) {
        // NOTE: only pass menuAlignment + nameText. Do NOT pass a 3rd "true"
        // argument, otherwise the menu is never created and this.menu is null.
        super._init(0.0, 'Lupa OCR');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._selectionActive = false;
        this._selector = null;
        this._destroyed = false;
        this._cancellable = new Gio.Cancellable();
        this._subprocesses = new Set();
        this._shortcuts = [];

        // Panel icon
        this._icon = new St.Icon({
            icon_name: 'edit-find-symbolic',
            style_class: 'system-status-icon',
        });
        this._icon.set_style('icon-size: 16px; color: #4a9eff;');
        this.add_child(this._icon);

        this._buildMenu();
        this._setupShortcut();

        _dbg('enabled and active in background');
    }

    _buildMenu() {
        const statusItem = new PopupMenu.PopupMenuItem('🟢 Lupa OCR Active');
        statusItem.label.set_style('color: #4caf50; font-weight: bold;');
        this.menu.addMenuItem(statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const captureItem = new PopupMenu.PopupMenuItem('🔍 Capture Text (OCR)');
        captureItem.connect('activate', () => this._startSelection('ocr'));
        this.menu.addMenuItem(captureItem);

        const textItem = new PopupMenu.PopupMenuItem('📝 Text Only (No Search)');
        textItem.connect('activate', () => this._startSelection('text'));
        this.menu.addMenuItem(textItem);

        const searchItem = new PopupMenu.PopupMenuItem('🌐 Search Selection');
        searchItem.connect('activate', () => this._startSelection('search'));
        this.menu.addMenuItem(searchItem);

        const imageItem = new PopupMenu.PopupMenuItem('🖼️ Search by Image (Lens)');
        imageItem.connect('activate', () => this._startSelection('image'));
        this.menu.addMenuItem(imageItem);

        const pasteItem = new PopupMenu.PopupMenuItem('📋 Paste & Search');
        pasteItem.connect('activate', () => this._pasteAndSearch());
        this.menu.addMenuItem(pasteItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const settingsItem = new PopupMenu.PopupMenuItem('⚙️ Settings');
        settingsItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(settingsItem);

        const aboutItem = new PopupMenu.PopupMenuItem('ℹ️ Lupa OCR v1.5');
        this.menu.addMenuItem(aboutItem);
    }

    _setupShortcut() {
        for (const [name, mode] of [
            ['lupa-ocr-shortcut', 'ocr'],
            ['lupa-ocr-image-shortcut', 'image'],
            ['lupa-ocr-text-shortcut', 'text'],
        ]) {
            try {
                const action = Main.wm.addKeybinding(
                    name, this._settings, Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                    () => this._startSelection(mode));
                if (action !== Meta.KeyBindingAction.NONE)
                    this._shortcuts.push(name);
            } catch (e) {
                logError(e, `Lupa OCR: failed to register ${name}`);
            }
        }
    }

    async _startSelection(mode = 'ocr') {
        if (this._selectionActive || this._destroyed)
            return;
        this._selectionActive = true;
        try {
            this.menu.close();
            // The Shell selector manages pointer/keyboard grabs, Escape and
            // all monitors, including the gesture API introduced in GNOME 50.
            this._selector = new Screenshot.SelectArea();
            const rect = await this._selector.selectAsync();
            this._selector = null;
            if (this._destroyed || !rect || rect.width < 10 || rect.height < 10)
                return;
            await this._captureArea(rect.x, rect.y, rect.width, rect.height, mode);
        } catch (e) {
            if (!this._destroyed) {
                logError(e, 'Lupa OCR: selection failed');
                this._showNotification('Could not select an area: ' + e.message, 'error');
            }
        } finally {
            this._selector = null;
            this._selectionActive = false;
        }
    }

    async _captureArea(x, y, width, height, mode = 'ocr') {
        const t0 = _ms();
        let tempDir;
        try {
            // Each operation owns a private directory, so overlapping helper
            // processes can never read another capture or follow a /tmp symlink.
            tempDir = GLib.dir_make_tmp('lupa-ocr-XXXXXX');
            const screenshotPath = GLib.build_filenamev([tempDir, 'capture.png']);
            const ok = await this._takeAreaScreenshot(x, y, width, height, screenshotPath);
            if (this._destroyed)
                return;
            if (!ok)
                throw new Error('Screenshot contains no image data');
            _dbg(`capture w=${width} h=${height} in ${_ms() - t0}ms`);

            if (mode === 'image') {
                await this._searchByImage(screenshotPath);
                return;
            }

            const text = await this._runOCR(screenshotPath, width, height);
            if (this._destroyed)
                return;
            const clean = text.trim();
            if (!clean) {
                this._showNotification('No text detected in selection', 'warning');
                return;
            }
            if (this._settings.get_boolean('copy-to-clipboard'))
                this._copyToClipboard(clean);
            if (this._settings.get_boolean('show-notification'))
                this._showNotification(clean);
            if (mode !== 'text' && (this._settings.get_boolean('auto-search') || mode === 'search'))
                this._searchWeb(clean);
        } catch (e) {
            if (!this._destroyed) {
                logError(e, 'Lupa OCR: error during capture');
                this._showNotification('Error: ' + e.message, 'error');
            }
        } finally {
            if (tempDir) {
                for (const name of ['capture.png', 'capture-prep.png', 'capture-prep.png.inv.png'])
                    GLib.unlink(GLib.build_filenamev([tempDir, name]));
                GLib.rmdir(tempDir);
            }
        }
    }

    _copyImageToClipboard(imagePath) {
        const [, contents] = Gio.File.new_for_path(imagePath).load_contents(null);
        St.Clipboard.get_default().set_content(St.ClipboardType.CLIPBOARD, 'image/png', contents);
    }

    async _searchByImage(imagePath) {
        const method = this._settings.get_string('image-search-method');
        let uploadFailed = false;
        if (method === 'lens-cli') {
            await this._runCommand(['lens-cli', 'image', imagePath]);
            return;
        }
        if (method !== 'manual') {
            const script = GLib.build_filenamev([this._extension.path, 'lupa-image-search']);
            try {
                // The extension owns clipboard/browser actions and file cleanup.
                // Invoke Python explicitly: extension archives need no executable bit.
                const url = (await this._runCommand(['python3', script, '--upload-only', imagePath])).trim();
                if (this._destroyed)
                    return;
                if (!/^https:\/\/litterbox\.catbox\.moe\/[^\s]+$/.test(url))
                    throw new Error('Image host returned an invalid URL');
                Gio.AppInfo.launch_default_for_uri(
                    'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(url), null);
                return;
            } catch (e) {
                if (this._destroyed)
                    throw e;
                logError(e, 'Lupa OCR: upload failed, using clipboard');
                uploadFailed = true;
            }
        }
        this._copyImageToClipboard(imagePath);
        if (uploadFailed)
            this._showNotification('Upload failed. Paste the copied image into Google Lens.', 'warning');
        Gio.AppInfo.launch_default_for_uri('https://lens.google.com/', null);
    }

    async _takeAreaScreenshot(x, y, width, height, outputPath) {
        // Modern Shell.Screenshot API: screenshot_area() returns a Promise and
        // writes the PNG bytes into the provided GOutputStream (GNOME 45+).
        const screenshot = new Shell.Screenshot();
        const stream = Gio.MemoryOutputStream.new_resizable();
        try {
            await screenshot.screenshot_area(x, y, width, height, stream);
        } finally {
            stream.close(null);
        }
        const bytes = stream.steal_as_bytes();
        _dbg(`screenshot_area retornou ${bytes.get_size()} bytes`);

        if (bytes.get_size() === 0)
            return false;

        const file = Gio.File.new_for_path(outputPath);
        const out = file.replace(null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        try {
            out.write_bytes(bytes, null);
        } finally {
            out.close(null);
        }
        return true;
    }

    async _runOCR(imagePath, width = 0, height = 0) {
        const lang = this._settings.get_string('ocr-language') || 'por+eng';
        const prepPath = imagePath.replace(/\.png$/, '') + '-prep.png';

        // Adaptive upscale: tiny selections (small UI text) get 3x, medium
        // selections 2x, large captures (whole windows, photos) stay 1x —
        // upscaling large images is slow and can amplify sensor noise.
        const minSide = Math.min(width || 0, height || 0);
        const scale = minSide > 0 && minSide < 150 ? '300%'
            : minSide < 400 ? '200%' : null;

        try {
            try {
                await this._preprocessImage(imagePath, prepPath, scale);
            } catch (e) {
                if (this._destroyed)
                    throw e;
                logError(e, 'Lupa OCR: preprocess failed, using raw capture');
                return await this._runTesseract(imagePath, lang);
            }
            return await this._runTesseract(prepPath, lang);
        } finally {
            GLib.unlink(prepPath);
            GLib.unlink(prepPath + '.inv.png');
        }
    }

    // Improve OCR quality on real screen content:
    //  - upscale small UI text (scale: '300%', '200%' or null to skip)
    //  - grayscale + auto-level (contrast normalization)
    //  - auto-invert when the background is dark (light text on dark themes)
    _preprocessImage(src, dst, scale = '300%') {
        const magick = GLib.find_program_in_path('magick') ||
            GLib.find_program_in_path('convert');
        if (!magick)
            return Promise.reject(new Error('ImageMagick not found'));

        const run = args => this._runCommand([magick, ...args]);

        return (async () => {
            // 1) optionally upscale, then grayscale + normalize contrast.
            //    -filter point (nearest-neighbor) duplicates pixels instead of
            //    interpolating: it enlarges small UI text without spreading
            //    sensor noise onto glyph edges or smearing thin strokes.
            const args = [src];
            if (scale)
                args.push('-filter', 'point', '-resize', scale);
            args.push('-colorspace', 'Gray', '-auto-level', dst);
            await run(args);
            // 2) detect dark background (mean brightness < 50%) and invert
            const meanStr = await run([dst, '-format', '%[fx:mean]', 'info:']);
            const mean = parseFloat(meanStr.trim());
            if (!isNaN(mean) && mean < 0.5) {
                const inverted = dst + '.inv.png';
                await run([dst, '-negate', inverted]);
                GLib.unlink(dst);
                Gio.File.new_for_path(inverted).move(
                    Gio.File.new_for_path(dst),
                    Gio.FileCopyFlags.OVERWRITE, null, null);
            }
        })();
    }

    _runTesseract(imagePath, lang) {
        // A successful command with empty stdout means no text was detected.
        // Missing language packs and nonzero exits must surface as errors.
        return this._runCommand(['tesseract', imagePath, 'stdout', '-l', lang,
            '--psm', '3', '--dpi', '300']);
    }

    _runCommand(argv) {
        return new Promise((resolve, reject) => {
            if (this._destroyed) {
                reject(new Error('Operation cancelled'));
                return;
            }
            let subprocess;
            try {
                subprocess = new Gio.Subprocess({
                    argv,
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                });
                subprocess.init(null);
                this._subprocesses.add(subprocess);
                subprocess.communicate_utf8_async(null, this._cancellable, (proc, result) => {
                    this._subprocesses.delete(proc);
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                        if (this._destroyed)
                            throw new Error('Operation cancelled');
                        if (!proc.get_successful())
                            throw new Error((stderr || `${argv[0]} failed`).trim());
                        resolve(stdout || '');
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                if (subprocess)
                    this._subprocesses.delete(subprocess);
                reject(e);
            }
        });
    }

    // EGO-A-005: direct clipboard access via St.Clipboard is intentional and
    // cannot be replaced by a higher-level API — St.Clipboard is the standard
    // GNOME Shell clipboard and the only way to write the OCR result.
    // Privacy safeguards:
    //  - reads/writes happen strictly on explicit user action (selection
    //    release, menu click) — never in the background, on timers, or on
    //    enable();
    //  - only the text captured in the current selection is written;
    //  - the read in _pasteAndSearch() runs only when the user clicks
    //    "Paste & Search" and is used solely to open that text in the browser.
    _copyToClipboard(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _pasteAndSearch() {
        // Same rationale: reads the clipboard only when the user explicitly
        // triggers "Paste & Search" from the menu.
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
            if (this._destroyed)
                return;
            if (text && text.trim().length > 0)
                this._searchWeb(text.trim());
            else
                this._showNotification('Clipboard is empty', 'warning');
        });
    }

    _searchWeb(text) {
        const base = this._settings.get_string('search-engine');
        const url = base + encodeURIComponent(text);
        Gio.AppInfo.launch_default_for_uri(url, null);
    }

    _showNotification(text, type = 'info') {
        const summary = type === 'error' ? 'Lupa OCR Error' :
                        type === 'warning' ? 'Lupa OCR Warning' :
                        'Lupa OCR - Text Captured';
        Main.notify(summary, text);
    }

    destroy() {
        this._destroyed = true;
        this._cancellable.cancel();
        for (const proc of this._subprocesses)
            proc.force_exit();
        this._subprocesses.clear();
        for (const name of this._shortcuts)
            Main.wm.removeKeybinding(name);
        this._shortcuts = [];
        // selectAsync() schedules destruction itself once its grab is released.
        this._selector?._grabHelper.ungrab();
        this._selector = null;

        super.destroy();
    }
});

export default class LupaExtension extends Extension {
    enable() {
        _dbg('enabling');
        this._indicator = new LupaOCRIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
