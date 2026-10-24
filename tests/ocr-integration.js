// Real Gio subprocesses and real ImageMagick/Tesseract, without Shell UI access.
// Requires gjs, ImageMagick and tesseract with the eng language pack.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const project = GLib.getenv('LUPA_PROJECT_DIR') || GLib.get_current_dir();
const [, contents] = GLib.file_get_contents(GLib.build_filenamev([project, 'extension.js']));
const source = new TextDecoder().decode(contents)
    .replace(/^import .*;\n/gm, '')
    .replace('export default class', 'class');
const Indicator = new Function('Gio', 'GLib', 'GObject', 'PanelMenu', 'Extension', 'logError',
    source + '\nreturn LupaOCRIndicator;')(
    Gio, GLib, {registerClass: cls => cls}, {Button: class { destroy() {} }},
    class {}, error => printerr(error.message));

function indicator() {
    return Object.assign(Object.create(Indicator.prototype), {
        _destroyed: false, _cancellable: new Gio.Cancellable(),
        _subprocesses: new Set(), _shortcuts: [], _selector: null,
        _settings: {get_string: () => 'eng'},
    });
}

function assert(condition, message) {
    if (!condition)
        throw new Error(message);
}

const instance = indicator();
const directory = GLib.dir_make_tmp('lupa-ocr-test-XXXXXX');
try {
    const magick = GLib.find_program_in_path('magick') || GLib.find_program_in_path('convert');
    assert(magick, 'ImageMagick is required');
    for (const [background, foreground] of [['white', 'black'], ['black', 'white']]) {
        const image = GLib.build_filenamev([directory, `${background}.png`]);
        await instance._runCommand([magick, '-size', '1000x180', `xc:${background}`,
            '-font', 'DejaVu-Sans', '-pointsize', '48', '-fill', foreground,
            '-gravity', 'center', '-annotate', '0', 'Lupa OCR regression 123', image]);
        const text = await instance._runOCR(image, 1000, 180);
        assert(text.includes('Lupa OCR regression 123'), `Unexpected ${background} OCR: ${text}`);
        assert(!GLib.file_test(image.replace('.png', '-prep.png'), GLib.FileTest.EXISTS),
            'Preprocessed image was not removed');
        GLib.unlink(image);
        print(`Real OCR passed: ${background} background`);
    }

    let failed = false;
    try {
        await instance._runTesseract('/nonexistent/lupa-test.png', 'eng');
    } catch (e) {
        failed = /cannot read|No such file|Error/i.test(e.message);
    }
    assert(failed, 'Tesseract nonzero exit must reject');

    const pending = instance._runCommand(['sleep', '30']);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        instance.destroy();
        return GLib.SOURCE_REMOVE;
    });
    let cancelled = false;
    try {
        await pending;
    } catch {
        cancelled = true;
    }
    assert(cancelled && instance._subprocesses.size === 0, 'Disable did not cancel the subprocess');
    print('Real subprocess errors and cancellation passed.');
} finally {
    GLib.rmdir(directory);
}
