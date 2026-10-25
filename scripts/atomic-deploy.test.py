import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys

spec = importlib.util.spec_from_file_location('activate', Path(__file__).with_name('activate-build.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.site = Path(self.temp.name)
        self.releases = self.site / '.site-releases'
        self.releases.mkdir()

    def release(self, name):
        root = self.releases / name
        for page in ('index.html', 'en/index.html', 'school-positioning-result/index.html', 'en/school-positioning-result/index.html', 'zh-Hant/index.html', 'zh-Hant/school-positioning-result/index.html'):
            path = root / page
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(name)
        return root

    def test_complete_release_switches_existing_server_path(self):
        old, new = self.release('old'), self.release('new')
        live = self.site / 'build'
        live.symlink_to(old)
        module.activate(self.site, new)
        self.assertEqual((live / 'en/school-positioning-result/index.html').read_text(), 'new')
        self.assertEqual((old / 'index.html').read_text(), 'old')

    def test_previous_assets_survive_but_do_not_accumulate(self):
        versions = [self.release(name) for name in ('old', 'new', 'third')]
        for version in versions:
            (version / 'assets/js').mkdir(parents=True)
            (version / 'assets/js' / (version.name + '.js')).write_text(version.name)
        (self.site / 'build').symlink_to(versions[0])
        module.activate(self.site, versions[1])
        self.assertEqual((self.site / 'build/assets/js/old.js').read_text(), 'old')
        module.activate(self.site, versions[2])
        self.assertEqual((self.site / 'build/assets/js/new.js').read_text(), 'new')
        self.assertFalse((self.site / 'build/assets/js/old.js').exists())

    def test_cleanup_keeps_current_previous_and_unowned_directories(self):
        stale = self.release('release-00000000')
        old = self.release('release-11111111')
        new = self.release('release-22222222')
        unowned = self.release('operator-backup')
        (self.site / 'build').symlink_to(old)
        module.activate(self.site, new)
        self.assertFalse(stale.exists())
        self.assertTrue(old.exists())
        self.assertTrue(new.exists())
        self.assertTrue(unowned.exists())

    def test_incomplete_release_preserves_live(self):
        old, new = self.release('old'), self.release('new')
        (self.site / 'build').symlink_to(old)
        (new / 'en/index.html').unlink()
        with self.assertRaises(ValueError):
            module.activate(self.site, new)
        self.assertEqual((self.site / 'build/index.html').read_text(), 'old')

    def test_missing_traditional_page_preserves_live(self):
        for missing in ('zh-Hant/index.html', 'zh-Hant/school-positioning-result/index.html'):
            with self.subTest(missing=missing):
                old, new = self.release('old'), self.release('new')
                live = self.site / 'build'
                if not live.exists():
                    live.symlink_to(old)
                (new / missing).unlink()
                with self.assertRaises(ValueError):
                    module.activate(self.site, new)
                self.assertEqual((live / 'index.html').read_text(), 'old')

    def test_legacy_directory_exchange_or_safe_platform_failure(self):
        old, new = self.release('old'), self.release('new')
        old.rename(self.site / 'build')
        if sys.platform == 'linux':
            module.activate(self.site, new)
            self.assertTrue((self.site / 'build').is_symlink())
            self.assertEqual((self.site / 'build/index.html').read_text(), 'new')
        else:
            with self.assertRaises(RuntimeError):
                module.activate(self.site, new)
            self.assertEqual((self.site / 'build/index.html').read_text(), 'old')

if __name__ == '__main__':
    unittest.main()
