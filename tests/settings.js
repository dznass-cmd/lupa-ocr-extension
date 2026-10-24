// Run with gjs -m tests/settings.js after compiling schemas in a temp directory.
import Gio from 'gi://Gio';

const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.lupa-ocr'});
for (const [key, expected] of [
    ['lupa-ocr-shortcut', '<Super>space'],
    ['lupa-ocr-image-shortcut', '<Super><Shift>i'],
    ['lupa-ocr-text-shortcut', '<Super>t'],
]) {
    const shortcuts = settings.get_strv(key);
    if (shortcuts.length !== 1 || shortcuts[0] !== expected)
        throw new Error(`Invalid accelerator array for ${key}`);
}
print('All three shortcut keys are valid GSettings string arrays.');
