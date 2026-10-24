import contextlib
import importlib.machinery
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


PROJECT = Path(os.environ.get("LUPA_PROJECT_DIR", Path(__file__).resolve().parents[1]))
loader = importlib.machinery.SourceFileLoader("image_search", str(PROJECT / "lupa-image-search"))
spec = importlib.util.spec_from_loader(loader.name, loader)
helper = importlib.util.module_from_spec(spec)
loader.exec_module(helper)


class ImageSearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.image = Path(self.temp.name) / "lupa-ocr-capture.png"
        self.image.write_bytes(b"\x89PNG\r\n\x1a\nimage bytes")

    def test_upload_checks_http_errors(self):
        with patch.object(helper.subprocess, "run", return_value=subprocess.CompletedProcess(
                [], 0, "https://litterbox.catbox.moe/example.png\n", "")) as run:
            self.assertEqual(helper.upload_litterbox(str(self.image)),
                             "https://litterbox.catbox.moe/example.png")
            self.assertIn("--fail", run.call_args.args[0])
            self.assertTrue(run.call_args.kwargs["check"])

    def test_upload_rejects_invalid_responses(self):
        for response in ["http error", "http://litterbox.catbox.moe/x.png",
                         "https://example.com/x.png", "https://litterbox.catbox.moe.evil/x.png",
                         "https://litterbox.catbox.moe/", "https://litterbox.catbox.moe/a\nb"]:
            with self.subTest(response=response), patch.object(helper.subprocess, "run",
                    return_value=subprocess.CompletedProcess([], 0, response, "")):
                with self.assertRaises(RuntimeError):
                    helper.upload_litterbox(str(self.image))

    def run_main(self, *extra_args):
        with patch.object(helper.sys, "argv", ["lupa-image-search", *extra_args, str(self.image)]):
            return helper.main()

    def test_failed_upload_copies_png_bytes_to_wayland_clipboard(self):
        received = []

        def copy(command, **kwargs):
            self.assertEqual(command, ["wl-copy", "--type", "image/png"])
            self.assertTrue(kwargs["check"])
            received.append(kwargs["stdin"].read())

        with patch.object(helper, "upload_litterbox", side_effect=RuntimeError("offline")), \
                patch.dict(os.environ, {"WAYLAND_DISPLAY": "wayland-test"}), \
                patch.object(helper.shutil, "which", return_value="/bin/wl-copy"), \
                patch.object(helper.subprocess, "run", side_effect=copy), \
                patch.object(helper.subprocess, "Popen"), patch.object(helper, "notify"):
            self.assertEqual(self.run_main(), 0)
        self.assertEqual(received, [self.image.read_bytes()])

    def test_x11_fallback_uses_image_data(self):
        with patch.dict(os.environ, {"WAYLAND_DISPLAY": ""}), \
                patch.object(helper.shutil, "which", side_effect=lambda c: "/bin/xclip" if c == "xclip" else None), \
                patch.object(helper.subprocess, "run") as run:
            helper.copy_image(str(self.image))
            self.assertEqual(run.call_args.args[0],
                             ["xclip", "-selection", "clipboard", "-t", "image/png", "-i"])

    def test_clipboard_failure_is_reported_without_false_success(self):
        with patch.object(helper, "upload_litterbox", side_effect=RuntimeError("offline")), \
                patch.object(helper, "copy_image", side_effect=RuntimeError("no clipboard")), \
                patch.object(helper, "notify") as notify, \
                patch.object(helper.subprocess, "Popen") as popen:
            self.assertEqual(self.run_main(), 1)
            self.assertIn("Não foi possível copiar", notify.call_args.args[0])
            popen.assert_not_called()

    def test_success_does_not_delete_callers_input(self):
        with patch.object(helper, "upload_litterbox", return_value="https://litterbox.catbox.moe/x.png"), \
                patch.object(helper, "open_lens"), patch.object(helper, "notify"):
            self.assertEqual(self.run_main(), 0)
        self.assertTrue(self.image.exists())

    def test_upload_only_prints_url_without_side_effects(self):
        output = io.StringIO()
        with patch.object(helper, "upload_litterbox", return_value="https://litterbox.catbox.moe/x.png"), \
                patch.object(helper.subprocess, "Popen") as popen, \
                patch.object(helper, "notify") as notify, contextlib.redirect_stdout(output):
            self.assertEqual(self.run_main("--upload-only", "--debug"), 0)
            popen.assert_not_called()
            notify.assert_not_called()
        self.assertEqual(output.getvalue(), "https://litterbox.catbox.moe/x.png\n")

    def test_upload_only_failure_uses_stderr_without_browser(self):
        with patch.object(helper, "upload_litterbox", side_effect=RuntimeError("offline")), \
                patch.object(helper.subprocess, "Popen") as popen, \
                contextlib.redirect_stderr(io.StringIO()) as errors:
            self.assertEqual(self.run_main("--upload-only"), 1)
            self.assertIn("offline", errors.getvalue())
            popen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
