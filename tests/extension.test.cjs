// Exercise the real extension methods with Shell UI substitutes; no screen
// captures, uploads, clipboard writes or browser launches occur in these tests.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const project = process.env.LUPA_PROJECT_DIR || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(project, 'extension.js'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export default class', 'class');

function fixture(method = 'manual') {
    const calls = {opened: [], copied: [], notices: [], removed: [], bindings: [], unlinked: []};
    let serial = 0;
    const Gio = {
        Cancellable: class { cancel() { calls.cancelled = true; } },
        SubprocessFlags: {STDOUT_PIPE: 1, STDERR_PIPE: 2},
        AppInfo: {launch_default_for_uri: url => calls.opened.push(url)},
        File: {new_for_path: () => ({load_contents: () => [true, Buffer.from('PNG bytes')]})},
    };
    const GLib = {
        get_monotonic_time: () => 0,
        dir_make_tmp: () => `/tmp/lupa-test-${++serial}`,
        build_filenamev: parts => parts.join('/'),
        unlink: file => calls.unlinked.push(file),
        rmdir: dir => calls.removed.push(dir),
    };
    const Main = {
        wm: {
            addKeybinding: name => { calls.bindings.push(name); return 1; },
            removeKeybinding: name => calls.bindings.splice(calls.bindings.indexOf(name), 1),
        },
        notify: (...args) => calls.notices.push(args),
    };
    const St = {ClipboardType: {CLIPBOARD: 1}, Clipboard: {get_default: () => ({
        set_content: (...args) => calls.copied.push(args),
    })}};
    const Screenshot = {};
    const context = vm.createContext({
        Gio, GLib, Main, St, Screenshot,
        GObject: {registerClass: cls => cls},
        PanelMenu: {Button: class { destroy() { calls.destroyed = true; } }},
        Meta: {KeyBindingFlags: {NONE: 0}, KeyBindingAction: {NONE: 0}},
        Shell: {ActionMode: {NORMAL: 1, OVERVIEW: 2}},
        Extension: class {}, log() {}, logError() {},
    });
    vm.runInContext(source + '\nglobalThis.Indicator = LupaOCRIndicator;', context);
    const indicator = Object.create(context.Indicator.prototype);
    Object.assign(indicator, {
        _extension: {path: '/extension with spaces'},
        _destroyed: false, _selectionActive: false, _selector: null,
        _subprocesses: new Set(), _shortcuts: [], _cancellable: new Gio.Cancellable(),
        menu: {close() {}},
        _settings: {
            get_string: key => key === 'image-search-method' ? method : 'por+eng',
            get_boolean: () => true,
        },
    });
    return {indicator, calls, Gio, GLib, Screenshot};
}

test('manual image search copies PNG bytes without shell commands', async () => {
    const {indicator, calls} = fixture();
    await indicator._searchByImage('/tmp/a.png');
    assert.equal(calls.copied[0][1], 'image/png');
    assert.equal(calls.copied[0][2].toString(), 'PNG bytes');
    assert.deepEqual(calls.opened, ['https://lens.google.com/']);
});

test('upload failure falls back to native image clipboard', async () => {
    const {indicator, calls} = fixture('imgur-lens');
    indicator._runCommand = async () => { throw new Error('offline'); };
    await indicator._searchByImage('/tmp/a.png');
    assert.equal(calls.copied.length, 1);
    assert.equal(calls.opened[0], 'https://lens.google.com/');
});

test('bundled helper path with spaces is passed as a separate argument', async () => {
    const {indicator, calls} = fixture('imgur-lens');
    let args;
    indicator._runCommand = async argv => { args = argv; return 'https://litterbox.catbox.moe/x.png\n'; };
    await indicator._searchByImage('/tmp/a.png');
    assert.deepEqual(Array.from(args), ['python3', '/extension with spaces/lupa-image-search', '--upload-only', '/tmp/a.png']);
    assert.equal(calls.copied.length, 0);
    assert.match(calls.opened[0], /uploadbyurl\?url=https%3A%2F%2Flitterbox/);
});

test('disabling during upload prevents clipboard and browser side effects', async () => {
    const {indicator, calls} = fixture('imgur-lens');
    indicator._runCommand = async () => { indicator._destroyed = true; return 'https://litterbox.catbox.moe/x.png'; };
    await indicator._searchByImage('/tmp/a.png');
    assert.equal(calls.opened.length, 0);
    assert.equal(calls.copied.length, 0);
});

test('OCR failure removes all temporary files and reports the actual error', async () => {
    const {indicator, calls} = fixture();
    indicator._takeAreaScreenshot = async () => true;
    indicator._runOCR = async () => { throw new Error('missing language por'); };
    await indicator._captureArea(0, 0, 100, 100);
    assert.deepEqual(calls.removed, ['/tmp/lupa-test-1']);
    assert.equal(calls.unlinked.length, 3);
    assert.match(calls.notices[0][1], /missing language por/);
});

test('empty screenshots are reported and cleaned', async () => {
    const {indicator, calls} = fixture();
    indicator._takeAreaScreenshot = async () => false;
    await indicator._captureArea(0, 0, 100, 100);
    assert.match(calls.notices[0][1], /no image data/);
    assert.equal(calls.removed.length, 1);
});

test('each capture uses its own temporary directory', async () => {
    const {indicator, calls} = fixture();
    indicator._takeAreaScreenshot = async () => true;
    indicator._runOCR = async () => '';
    await Promise.all([indicator._captureArea(0, 0, 100, 100), indicator._captureArea(0, 0, 100, 100)]);
    assert.equal(new Set(calls.removed).size, 2);
});

test('text-only capture never opens search even when auto-search is on', async () => {
    const {indicator, calls} = fixture();
    indicator._takeAreaScreenshot = async () => true;
    indicator._runOCR = async () => '  olá  ';
    indicator._copyToClipboard = text => calls.copied.push(text);
    indicator._searchWeb = text => calls.opened.push(text);
    await indicator._captureArea(0, 0, 100, 100, 'text');
    assert.deepEqual(calls.copied, ['olá']);
    assert.equal(calls.opened.length, 0);
});

test('disabling during screenshot prevents OCR and still cleans files', async () => {
    const {indicator, calls} = fixture();
    indicator._takeAreaScreenshot = async () => { indicator._destroyed = true; return true; };
    indicator._runOCR = () => assert.fail('OCR must not run');
    await indicator._captureArea(0, 0, 100, 100);
    assert.equal(calls.notices.length, 0);
    assert.equal(calls.removed.length, 1);
});

test('preprocessed files are removed when Tesseract fails', async () => {
    const {indicator, calls} = fixture();
    indicator._preprocessImage = async () => {};
    indicator._runTesseract = async () => { throw new Error('tesseract failed'); };
    await assert.rejects(indicator._runOCR('/tmp/a.png', 100, 100), /tesseract failed/);
    assert.deepEqual(calls.unlinked, ['/tmp/a-prep.png', '/tmp/a-prep.png.inv.png']);
});

test('native selection supports areas on a secondary monitor', async () => {
    const {indicator, Screenshot} = fixture();
    const rect = {x: 2100, y: 30, width: 200, height: 100};
    Screenshot.SelectArea = class { async selectAsync() { return rect; } };
    let captured;
    indicator._captureArea = async (...args) => { captured = args; };
    await indicator._startSelection('text');
    assert.deepEqual(captured, [2100, 30, 200, 100, 'text']);
    assert.equal(indicator._selectionActive, false);
});

test('Escape and small selections release the busy state without capture', async () => {
    for (const rect of [null, {x: 0, y: 0, width: 1, height: 1}]) {
        const {indicator, Screenshot} = fixture();
        Screenshot.SelectArea = class { async selectAsync() { return rect; } };
        indicator._captureArea = () => assert.fail('must not capture');
        await indicator._startSelection();
        assert.equal(indicator._selectionActive, false);
    }
});

test('disabling releases native selection, shortcuts and subprocesses', () => {
    const {indicator, calls} = fixture();
    indicator._setupShortcut();
    indicator._selector = {_grabHelper: {ungrab() { calls.ungrabbed = true; }}};
    indicator._subprocesses.add({force_exit() { calls.killed = true; }});
    indicator.destroy();
    assert.equal(calls.bindings.length, 0);
    assert.equal(calls.cancelled, true);
    assert.equal(calls.killed, true);
    assert.equal(calls.ungrabbed, true);
});

test('nonzero subprocess exit rejects even if stdout contains text', async () => {
    const {indicator, Gio} = fixture();
    Gio.Subprocess = class {
        init() {}
        communicate_utf8_async(input, cancellable, callback) { callback(this, {}); }
        communicate_utf8_finish() { return [true, 'partial output', 'missing language por']; }
        get_successful() { return false; }
    };
    await assert.rejects(indicator._runTesseract('/tmp/a.png', 'por'), /missing language por/);
    assert.equal(indicator._subprocesses.size, 0);
});

test('successful empty OCR output is not an execution error', async () => {
    const {indicator, Gio} = fixture();
    Gio.Subprocess = class {
        init() {}
        communicate_utf8_async(input, cancellable, callback) { callback(this, {}); }
        communicate_utf8_finish() { return [true, '', '']; }
        get_successful() { return true; }
    };
    assert.equal(await indicator._runTesseract('/tmp/a.png', 'por'), '');
});
