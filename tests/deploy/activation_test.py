import hashlib
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('activation', ROOT / 'deploy/activate.py')
assert spec is not None and spec.loader is not None
activation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(activation)


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        (ROOT / 'verification').mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT / 'verification', prefix='release-test-')
        self.base = pathlib.Path(self.tmp.name)
        self.old = self.base / 'releases/old'
        (self.old / 'dist/_assets').mkdir(parents=True)
        (self.old / 'dist/index.html').write_text('old')
        (self.old / 'dist/_assets/previous-hash.js').write_text('old script')
        (self.base / 'web').symlink_to(self.old, target_is_directory=True)
        self.archive = self.base / 'new.tar.gz'
        files = {'index.html': b'new', '_assets/new-hash.js': b'new script'}
        manifest = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
        with tarfile.open(self.archive, 'w:gz') as tf:
            for name, data in {**{'dist/' + name: data for name, data in files.items()}, 'manifest.json': json.dumps(manifest).encode()}.items():
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                tf.addfile(entry, io.BytesIO(data))
        self.sha = hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def tearDown(self):
        self.tmp.cleanup()

    def run_release(self, verify):
        return activation.activate(self.base, self.archive, self.sha, str(self.old), 'foldstudio-test', verify)

    def test_success_preserves_prior_chunk_and_source(self):
        record = self.run_release(lambda release, manifest: self.assertEqual(len(manifest), 2))
        current = (self.base / 'web').resolve()
        self.assertEqual(str(current), record['release'])
        self.assertEqual((current / 'dist/index.html').read_text(), 'new')
        self.assertEqual((current / 'dist/_assets/previous-hash.js').read_text(), 'old script')
        self.assertEqual((self.old / 'dist/index.html').read_text(), 'old')
        self.assertFalse(list(self.base.glob('web.next-*')))

    def test_verification_failure_restores_link(self):
        def fail(*_): raise RuntimeError('HTTP mismatch')
        with self.assertRaisesRegex(RuntimeError, 'HTTP mismatch'): self.run_release(fail)
        self.assertEqual((self.base / 'web').resolve(), self.old)
        self.assertTrue((self.base / 'releases/foldstudio-test/dist/index.html').exists())
        self.assertFalse(list(self.base.glob('web.next-*')))

    def test_archive_corruption_never_switches(self):
        self.sha = '0' * 64
        with self.assertRaisesRegex(RuntimeError, 'checksum'): self.run_release(lambda *_: None)
        self.assertEqual((self.base / 'web').resolve(), self.old)

    def test_concurrent_release_is_not_overwritten(self):
        with self.assertRaisesRegex(RuntimeError, 'changed since preflight'):
            activation.activate(self.base, self.archive, self.sha, str(self.old) + '-stale', 'foldstudio-test', lambda *_: None)
        self.assertEqual((self.base / 'web').resolve(), self.old)


if __name__ == '__main__': unittest.main()
