/* prefs.js
 *
 * Lupa OCR Preferences
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class LupaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-other-symbolic',
        });
        window.add(generalPage);

        const ocrGroup = new Adw.PreferencesGroup({
            title: 'OCR Settings',
            description: 'Configure text recognition',
        });
        generalPage.add(ocrGroup);

        const languageRow = new Adw.ComboRow({
            title: 'OCR Language',
            subtitle: 'Language for text recognition',
        });
        languageRow.model = Gtk.StringList.new([
            'por+eng - Português + English (recommended)',
            'por - Portuguese',
            'eng - English',
            'spa+eng - Español + English',
            'spa - Spanish',
            'fra - French',
            'deu - German',
            'ita - Italian',
            'jpn - Japanese',
            'chi_sim - Chinese (Simplified)',
            'kor - Korean',
            'rus - Russian',
        ]);

        const currentLang = settings.get_string('ocr-language');
        const langMap = {
            'por+eng': 0, 'por': 1, 'eng': 2, 'spa+eng': 3, 'spa': 4, 'fra': 5, 'deu': 6,
            'ita': 7, 'jpn': 8, 'chi_sim': 9, 'kor': 10, 'rus': 11
        };
        languageRow.selected = langMap[currentLang] || 0;

        languageRow.connect('notify::selected', () => {
            const langs = ['por+eng', 'por', 'eng', 'spa+eng', 'spa', 'fra', 'deu', 'ita', 'jpn', 'chi_sim', 'kor', 'rus'];
            settings.set_string('ocr-language', langs[languageRow.selected]);
        });
        ocrGroup.add(languageRow);

        const searchGroup = new Adw.PreferencesGroup({
            title: 'Search Settings',
            description: 'Configure web search behavior',
        });
        generalPage.add(searchGroup);

        const autoSearchRow = new Adw.SwitchRow({
            title: 'Auto Search',
            subtitle: 'Automatically open web search after OCR',
        });
        settings.bind('auto-search', autoSearchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        searchGroup.add(autoSearchRow);

        const engineRow = new Adw.ComboRow({
            title: 'Search Engine',
            subtitle: 'Choose your preferred search engine',
        });
        engineRow.model = Gtk.StringList.new([
            'DuckDuckGo',
            'Google',
            'Bing',
            'Yahoo',
            'Ecosia',
            'Startpage',
        ]);

        const currentEngine = settings.get_string('search-engine');
        const engineMap = {
            'https://duckduckgo.com/?q=': 0,
            'https://www.google.com/search?q=': 1,
            'https://www.bing.com/search?q=': 2,
            'https://search.yahoo.com/search?p=': 3,
            'https://www.ecosia.org/search?q=': 4,
            'https://www.startpage.com/sp/search?query=': 5,
        };
        engineRow.selected = engineMap[currentEngine] || 0;

        engineRow.connect('notify::selected', () => {
            const engines = [
                'https://duckduckgo.com/?q=',
                'https://www.google.com/search?q=',
                'https://www.bing.com/search?q=',
                'https://search.yahoo.com/search?p=',
                'https://www.ecosia.org/search?q=',
                'https://www.startpage.com/sp/search?query=',
            ];
            settings.set_string('search-engine', engines[engineRow.selected]);
        });
        searchGroup.add(engineRow);

        const clipboardGroup = new Adw.PreferencesGroup({
            title: 'Clipboard & Notifications',
            description: 'Configure output behavior',
        });
        generalPage.add(clipboardGroup);

        const copyRow = new Adw.SwitchRow({
            title: 'Copy to Clipboard',
            subtitle: 'Copy extracted text to clipboard',
        });
        settings.bind('copy-to-clipboard', copyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clipboardGroup.add(copyRow);

        const notifyRow = new Adw.SwitchRow({
            title: 'Show Notifications',
            subtitle: 'Show notification with extracted text',
        });
        settings.bind('show-notification', notifyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        clipboardGroup.add(notifyRow);

        const imageGroup = new Adw.PreferencesGroup({
            title: 'Image Search',
            description: 'Configure reverse image search (Google Lens)',
        });
        generalPage.add(imageGroup);

        const imageMethodRow = new Adw.ComboRow({
            title: 'Search Method',
            subtitle: 'How to search by image',
        });
        imageMethodRow.model = Gtk.StringList.new([
            'Imgur + Google Lens (default)',
            'lens-cli (requires install)',
            'Manual (clipboard + Lens)',
        ]);

        const currentMethod = settings.get_string('image-search-method');
        const methodMap = {
            'imgur-lens': 0,
            'lens-cli': 1,
            'manual': 2,
        };
        imageMethodRow.selected = methodMap[currentMethod] || 0;

        imageMethodRow.connect('notify::selected', () => {
            const methods = ['imgur-lens', 'lens-cli', 'manual'];
            settings.set_string('image-search-method', methods[imageMethodRow.selected]);
        });
        imageGroup.add(imageMethodRow);

        const shortcutsPage = new Adw.PreferencesPage({
            title: 'Shortcuts',
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic',
        });
        window.add(shortcutsPage);

        const shortcutsGroup = new Adw.PreferencesGroup({
            title: 'Keyboard Shortcuts',
            description: 'Configure keyboard shortcuts for Lupa OCR',
        });
        shortcutsPage.add(shortcutsGroup);

        const shortcutEntry = new Adw.ActionRow({
            title: 'Capture Text Shortcut',
            subtitle: 'Default: Super+Space',
        });

        const shortcutLabel = new Gtk.Label({
            label: 'Super+Space',
            valign: Gtk.Align.CENTER,
        });
        shortcutEntry.add_suffix(shortcutLabel);
        shortcutsGroup.add(shortcutEntry);

        const imageShortcutEntry = new Adw.ActionRow({
            title: 'Image Search Shortcut',
            subtitle: 'Default: Super+Shift+I',
        });

        const imageShortcutLabel = new Gtk.Label({
            label: 'Super+Shift+I',
            valign: Gtk.Align.CENTER,
        });
        imageShortcutEntry.add_suffix(imageShortcutLabel);
        shortcutsGroup.add(imageShortcutEntry);

        const textShortcutEntry = new Adw.ActionRow({
            title: 'Text Only Shortcut',
            subtitle: 'Default: Super+T',
        });

        const textShortcutLabel = new Gtk.Label({
            label: 'Super+T',
            valign: Gtk.Align.CENTER,
        });
        textShortcutEntry.add_suffix(textShortcutLabel);
        shortcutsGroup.add(textShortcutEntry);
    }
}
