/* extension.js
 *
 * Lupa OCR - Capture text from screen and search the web
 * Version: 1.3 - Debugged
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
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const LupaOCRIndicator = GObject.registerClass(
class LupaOCRIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Lupa OCR');

        this._extension = extension;
        this._settings = extension.getSettings();
        this._selectionActive = false;
        this._selectionMode = 'ocr';
        this._startX = 0;
        this._startY = 0;
        this._selectionBox = null;
        this._overlay = null;
        this._methodIds = [];

        this._icon = new St.Icon({
            icon_name: 'edit-find-symbolic',
            style_class: 'system-status-icon',
        });
        this._icon.set_style('icon-size: 16px; color: #4a9eff;');
        this.add_child(this._icon);

        this._buildMenu();
        this._setupShortcut();

        log('Lupa OCR: enabled and active in background');
    }

    _buildMenu() {
        const statusItem = new PopupMenu.PopupMenuItem('🟢 Lupa OCR Active');
        statusItem.label.set_style('color: #4caf50; font-weight: bold;');
        this.menu.addMenuItem(statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const captureItem = new PopupMenu.PopupMenuItem('🔍 Capture Text (OCR)');
        captureItem.connect('activate', () => this._startSelection('ocr'));
        this.menu.addMenuItem(captureItem);

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

        const aboutItem = new PopupMenu.PopupMenuItem('ℹ️ Lupa OCR v1.3');
        this.menu.addMenuItem(aboutItem);
    }

    _setupShortcut() {
        try {
            this._shortcutId = Main.wm.addKeybinding(
                'lupa-ocr-shortcut',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._startSelection('ocr')
            );
            log('Lupa OCR: shortcut registered');
        } catch (e) {
            logError(e, 'Lupa OCR: failed to register shortcut');
        }

        try {
            this._imageShortcutId = Main.wm.addKeybinding(
                'lupa-ocr-image-shortcut',
                this._settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._startSelection('image')
            );
            log('Lupa OCR: image shortcut registered');
        } catch (e) {
            logError(e, 'Lupa OCR: failed to register image shortcut');
        }
    }

    _startSelection(mode = 'ocr') {
        if (this._selectionActive)
            return;
        this._selectionActive = true;
        this._selectionMode = mode;
        this._createOverlay();
    }

    _createOverlay() {
        const monitor = Main.layoutManager.primaryMonitor;
        const {x, y, width, height} = monitor;

        this._overlay = new Clutter.Actor({
            x,
            y,
            width,
            height,
            reactive: true,
            opacity: 0,
        });

        const bg = new St.Widget({
            width: width,
            height: height,
            style: 'background-color: rgba(0, 0, 0, 0.4);',
        });
        this._overlay.add_child(bg);

        this._selectionBox = new St.Widget({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            style: 'border: 2px solid #4a9eff; background-color: rgba(74, 158, 255, 0.2);',
            visible: false,
        });
        this._overlay.add_child(this._selectionBox);

        const instructionText = new St.Label({
            text: this._selectionMode === 'image'
                ? '🖼️ Draw a rectangle to search by image\nPress Escape to cancel'
                : '🔍 Draw a rectangle to capture text\nPress Escape to cancel',
            style: 'font-size: 18px; color: #ffffff;',
            x: width / 2 - 250,
            y: 50,
            width: 500,
        });
        instructionText.set_pivot_point(0.5, 0);
        this._overlay.add_child(instructionText);

        Main.uiGroup.add_child(this._overlay);

        this._overlay.save_easing_state();
        this._overlay.set_easing_duration(200);
        this._overlay.opacity = 255;
        this._overlay.restore_easing_state();

        this._buttonPressId = this._overlay.connect('button-press-event', this._onButtonPress.bind(this));
        this._buttonReleaseId = this._overlay.connect('button-release-event', this._onButtonRelease.bind(this));
        this._motionId = this._overlay.connect('motion-event', this._onMotion.bind(this));
        this._keyPressId = this._overlay.connect('key-press-event', this._onKeyPress.bind(this));

        global.stage.set_key_focus(this._overlay);
    }

    _onButtonPress(actor, event) {
        const [x, y] = event.get_coords();
        this._startX = x;
        this._startY = y;
        this._selectionBox.set_position(x, y);
        this._selectionBox.set_size(0, 0);
        this._selectionBox.visible = true;
        return Clutter.EVENT_STOP;
    }

    _onMotion(actor, event) {
        const [x, y] = event.get_coords();
        const rectX = Math.min(this._startX, x);
        const rectY = Math.min(this._startY, y);
        const rectW = Math.abs(x - this._startX);
        const rectH = Math.abs(y - this._startY);
        this._selectionBox.set_position(rectX, rectY);
        this._selectionBox.set_size(rectW, rectH);
        return Clutter.EVENT_STOP;
    }

    _onButtonRelease(actor, event) {
        const [x, y] = event.get_coords();
        const rectW = Math.abs(x - this._startX);
        const rectH = Math.abs(y - this._startY);

        if (rectW < 10 || rectH < 10) {
            this._cancelSelection();
            return Clutter.EVENT_STOP;
        }

        const rectX = Math.min(this._startX, x);
        const rectY = Math.min(this._startY, y);
        this._captureArea(rectX, rectY, rectW, rectH);
        return Clutter.EVENT_STOP;
    }

    _onKeyPress(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this._cancelSelection();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _cancelSelection() {
        this._removeOverlay();
        this._selectionActive = false;
    }

    _removeOverlay() {
        if (this._overlay) {
            for (const id of [this._buttonPressId, this._buttonReleaseId,
                this._motionId, this._keyPressId]) {
                if (id)
                    this._overlay.disconnect(id);
            }
            this._overlay.destroy();
            this._overlay = null;
            this._selectionBox = null;
        }
    }

    async _captureArea(x, y, width, height) {
        this._removeOverlay();

        const screenshotPath = GLib.get_tmp_dir() + '/lupa-ocr-capture.png';

        try {
            log(`Lupa OCR: capture area x=${x} y=${y} w=${width} h=${height}`);
            const ok = await this._takeAreaScreenshot(x, y, width, height, screenshotPath);
            log(`Lupa OCR: screenshot ok=${ok} path=${screenshotPath}`);
            if (ok) {
                if (this._selectionMode === 'image') {
                    this._searchByImage(screenshotPath);
                    this._selectionActive = false;
                    return;
                }

                const text = await this._runOCR(screenshotPath);
                log(`Lupa OCR: OCR result len=${text ? text.length : 0} text="${text ? text.trim().slice(0, 50) : ''}"`);
                GLib.unlink(screenshotPath);

                if (text && text.trim().length > 0) {
                    const clean = text.trim();
                    if (this._settings.get_boolean('copy-to-clipboard'))
                        this._copyToClipboard(clean);
                    if (this._settings.get_boolean('show-notification'))
                        this._showNotification(clean);
                    if (this._settings.get_boolean('auto-search') || this._selectionMode === 'search')
                        this._searchWeb(clean);
                } else {
                    this._showNotification('No text detected in selection', 'warning');
                }
            }
        } catch (e) {
            logError(e, 'Lupa OCR: error during capture');
            this._showNotification('Error: ' + e.message, 'error');
        }

        this._selectionActive = false;
    }

    _searchByImage(imagePath) {
        const method = this._settings.get_string('image-search-method');
        log(`Lupa OCR: image search using method="${method}" path=${imagePath}`);

        if (method === 'lens-cli') {
            GLib.spawn_command_line_async(`lens-cli image "${imagePath}"`);
        } else if (method === 'manual') {
            GLib.spawn_command_line_async(`bash -c 'wl-copy --type image/png < "${imagePath}"'`);
            GLib.spawn_command_line_async(`xdg-open https://lens.google.com/`);
        } else {
            const script = GLib.find_program_in_path('lupa-image-search') ||
                GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'lupa-image-search']);
            GLib.spawn_command_line_async(`${script} "${imagePath}"`);
        }
    }

    async _takeAreaScreenshot(x, y, width, height, outputPath) {
        const screenshot = new Shell.Screenshot();
        const stream = Gio.MemoryOutputStream.new_resizable();
        await screenshot.screenshot_area(x, y, width, height, stream);
        stream.close(null);
        const bytes = stream.steal_as_bytes();
        log(`Lupa OCR: screenshot_area returned ${bytes.get_size()} bytes`);

        if (bytes.get_size() === 0)
            return false;

        const file = Gio.File.new_for_path(outputPath);
        const out = file.replace(null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        out.write_bytes(bytes, null);
        out.close(null);
        return true;
    }

    _runOCR(imagePath) {
        const lang = this._settings.get_string('ocr-language');
        return new Promise((resolve) => {
            try {
                const subprocess = new Gio.Subprocess({
                    argv: ['tesseract', imagePath, 'stdout', '-l', lang],
                    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
                });
                subprocess.init(null);
                subprocess.communicate_utf8_async(null, null, (proc, res) => {
                    try {
                        const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                        if (stdout)
                            return resolve(stdout);
                        logError(new Error(stderr || 'tesseract produced no output'),
                            'Lupa OCR: tesseract failed');
                        resolve('');
                    } catch (e) {
                        logError(e, 'Lupa OCR: OCR error');
                        resolve('');
                    }
                });
            } catch (e) {
                logError(e, 'Lupa OCR: OCR error');
                resolve('');
            }
        });
    }

    _copyToClipboard(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _pasteAndSearch() {
        St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
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
        if (this._shortcutId)
            Main.wm.removeKeybinding('lupa-ocr-shortcut');
        if (this._imageShortcutId)
            Main.wm.removeKeybinding('lupa-ocr-image-shortcut');
        this._removeOverlay();
        super.destroy();
    }
});

export default class LupaExtension extends Extension {
    enable() {
        log('Lupa OCR: enabling');
        this._indicator = new LupaOCRIndicator(this);
        Main.panel.addToStatusArea(this._uuid, this._indicator, 1, 'right');
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
