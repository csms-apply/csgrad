import importlib.util
import io
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
import sys

spec = importlib.util.spec_from_file_location('activate', Path(__file__).with_name('activate-build.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PAGES = ('index.html', 'en/index.html', 'school-positioning-result/index.html', 'en/school-positioning-result/index.html', 'zh-Hant/index.html', 'zh-Hant/school-positioning-result/index.html')

class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.site = Path(self.temp.name)
        self.releases = self.site / '.site-releases'
        self.releases.mkdir()

    def release(self, name):
        root = self.releases / name
        for page in PAGES:
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

@unittest.skipUnless(shutil.which('flock'), 'run.sh needs flock (Linux)')
class PrebuiltDeployTests(unittest.TestCase):
    """run.sh --prebuilt with npm and pm2 stubbed out."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.site = Path(temp.name)
        (self.site / 'scripts').mkdir()
        shutil.copy(Path(__file__).with_name('activate-build.py'), self.site / 'scripts')
        (self.site / 'package-lock.json').write_text('v1')
        stubs = self.site / 'stubs'
        stubs.mkdir()
        (stubs / 'npm').write_text('#!/bin/sh\necho "$*" >> npm.log\n[ "$1" != ci ] || mkdir -p node_modules\n')
        (stubs / 'pm2').write_text('#!/bin/sh\n[ "$1" != jlist ] || echo \'[{"name":"docusaurus","pm2_env":{"status":"online"}}]\'\n')
        for stub in stubs.iterdir():
            stub.chmod(0o755)
        self.env = {**os.environ, 'PATH': f'{stubs}{os.pathsep}{os.environ["PATH"]}', 'NVM_DIR': str(self.site / 'no-nvm')}

    def deploy(self, version, pages=PAGES, cut=False):
        source = self.site / 'source' / version
        for page in pages:
            (source / page).parent.mkdir(parents=True, exist_ok=True)
            (source / page).write_text(version)
        # CI hard-links the static files that every locale repeats.
        (source / 'en/img').mkdir(parents=True)
        (source / 'img.png').write_text(version)
        os.link(source / 'img.png', source / 'en/img/img.png')
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w:gz') as tar:
            tar.add(source, arcname='.')
        payload = data.getvalue()[:-100] if cut else data.getvalue()
        return subprocess.run(['bash', str(Path(__file__).resolve().parent.parent / 'run.sh'), '--prebuilt'],
                              cwd=self.site, env=self.env, input=payload, capture_output=True)

    def live(self, page='index.html'):
        return (self.site / 'build' / page).read_text()

    def test_activates_streamed_build_and_reinstalls_only_when_lock_changes(self):
        for version in ('v1', 'v2'):
            result = self.deploy(version)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(self.live('en/img/img.png'), version)
        (self.site / 'package-lock.json').write_text('v2')
        self.assertEqual(self.deploy('v3').returncode, 0)
        self.assertEqual((self.site / 'npm.log').read_text(), 'ci\nci\n')

    def test_cut_upload_or_incomplete_build_keeps_live_and_leaves_nothing(self):
        self.assertEqual(self.deploy('v1').returncode, 0)
        releases = sorted((self.site / '.site-releases').iterdir())
        self.assertNotEqual(self.deploy('cut', cut=True).returncode, 0)
        self.assertNotEqual(self.deploy('partial', pages=PAGES[1:]).returncode, 0)
        self.assertEqual(self.live(), 'v1')
        self.assertEqual(sorted((self.site / '.site-releases').iterdir()), releases)

if __name__ == '__main__':
    unittest.main()
