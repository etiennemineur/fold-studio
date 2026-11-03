"""Static Fold Studio update: own release link only, never shared nginx config."""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tarfile
import urllib.parse
import fcntl


def activate(base, archive, expected_sha, expected_previous, release_name, verify):
    base = pathlib.Path(base)
    current = base / 'web'
    with (base / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = current.resolve(strict=True)
        if str(previous) != expected_previous:
            raise RuntimeError('Active release changed since preflight; refuse to overwrite another deployment.')
        if hashlib.sha256(pathlib.Path(archive).read_bytes()).hexdigest() != expected_sha:
            raise RuntimeError('Archive checksum mismatch')
        if pathlib.Path(release_name).name != release_name or not release_name.startswith('foldstudio-'):
            raise RuntimeError('Invalid release name')
        release = base / 'releases' / release_name
        release.mkdir()
        # Reject traversal and links before extraction (works on older Python too).
        with tarfile.open(archive) as tf:
            for member in tf.getmembers():
                parts = pathlib.PurePosixPath(member.name)
                if parts.is_absolute() or '..' in parts.parts or not (member.isfile() or member.isdir()):
                    raise RuntimeError('Unsafe archive member')
            tf.extractall(release, filter='data')
        manifest = json.loads((release / 'manifest.json').read_text())
        for name, digest in manifest.items():
            target = (release / 'dist' / name).resolve()
            if not target.is_relative_to(release / 'dist') or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                raise RuntimeError('Extracted file mismatch: ' + name)
        if not (release / 'dist/index.html').is_file():
            raise RuntimeError('Missing built index')
        # Keep prior fingerprinted assets for tabs already open during the switch.
        old_assets = previous / 'dist/_assets'
        if old_assets.is_dir():
            for old in old_assets.rglob('*'):
                if old.is_file() and not old.is_symlink():
                    dest = release / 'dist/_assets' / old.relative_to(old_assets)
                    if not dest.exists():
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(old, dest)
        next_link = base / ('web.next-' + str(os.getpid()))
        switched = False
        def switch(target):
            try:
                next_link.symlink_to(target, target_is_directory=True)
                os.replace(next_link, current)
            finally:
                next_link.unlink(missing_ok=True)
        try:
            switch(release)
            switched = True
            if current.resolve() != release:
                raise RuntimeError('Release link mismatch')
            verify(release, manifest)
        except BaseException:
            if switched:
                switch(previous)
                if current.resolve() != previous:
                    raise RuntimeError('Rollback could not be verified')
            raise
        return {'release': str(release), 'previousLink': str(previous), 'sha256': expected_sha,
                'filesVerified': len(manifest), 'rollback': f'python3 -c "import os; os.symlink({str(previous)!r}, {str(base / "web.rollback")!r}); os.replace({str(base / "web.rollback")!r}, {str(current)!r})"'}


def verify_origin(release, manifest):
    for name, expected in manifest.items():
        # SEO may transform HTML; assets must match exactly.
        if name.endswith('.html'):
            continue
        url = 'https://etienne.design/tools/FoldStudio/' + urllib.parse.quote(name)
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '20',
                                 '--resolve', 'etienne.design:443:127.0.0.1', url], check=True, capture_output=True)
        if hashlib.sha256(result.stdout).hexdigest() != expected:
            raise RuntimeError('Origin differs from tested build: ' + name)
    subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '20', '--output', '/dev/null',
                    '--resolve', 'etienne.design:443:127.0.0.1', 'https://etienne.design/tools/FoldStudio/'], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive')
    parser.add_argument('sha256')
    parser.add_argument('previous')
    parser.add_argument('release')
    args = parser.parse_args()
    print(json.dumps(activate('/srv/foldstudio', args.archive, args.sha256, args.previous, args.release, verify_origin), indent=2))
