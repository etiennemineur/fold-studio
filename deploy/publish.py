"""Publish a tested static build to the existing Fold Studio installation."""
import datetime
import hashlib
import json
import pathlib
import shlex
import subprocess
import tarfile
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
HOST = 'etienne-studio-vps'
SSH = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2', HOST]


def ssh(command):
    return subprocess.check_output(SSH + [command], text=True)


def main():
    dist = ROOT / 'dist'
    if not (dist / 'index.html').is_file():
        raise RuntimeError('Build missing: run npm run build -- --base=/tools/FoldStudio/')
    previous = ssh('readlink -f /srv/foldstudio/web').strip()
    # This publisher updates assets only. Preserve the live SEO/nginx snippet.
    snippet = ssh('cat /etc/nginx/snippets/foldstudio-location.conf')
    if 'alias /srv/foldstudio/web/dist/;' not in snippet:
        raise RuntimeError('Unexpected live alias: inspect topology before publishing')
    release = 'foldstudio-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8]
    out = ROOT / 'verification/public-deploy' / release
    out.mkdir(parents=True)
    manifest = {str(f.relative_to(dist)): hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(dist.rglob('*')) if f.is_file()}
    if any(f.is_symlink() for f in dist.rglob('*')):
        raise RuntimeError('Symlinks forbidden in static build')
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (out / 'nginx-before.conf').write_text(snippet)
    archive = out / (release + '.tar.gz')
    with tarfile.open(archive, 'w:gz') as tf:
        tf.add(dist, arcname='dist')
        tf.add(out / 'manifest.json', arcname='manifest.json')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    remote = '/tmp/' + release
    ssh('mkdir -m 700 ' + shlex.quote(remote))
    subprocess.run(['scp', str(archive), str(ROOT / 'deploy/activate.py'), HOST + ':' + remote + '/'], check=True)
    command = 'sudo python3 ' + ' '.join(shlex.quote(v) for v in [remote + '/activate.py', remote + '/' + archive.name, digest, previous, release])
    record = json.loads(ssh(command))
    record['url'] = 'https://etienne.design/tools/FoldStudio/'
    record['nginxUnchanged'] = ssh('cat /etc/nginx/snippets/foldstudio-location.conf') == snippet
    record['activeLink'] = ssh('readlink -f /srv/foldstudio/web').strip()
    (out / 'deployment.json').write_text(json.dumps(record, indent=2))
    if not record['nginxUnchanged'] or record['activeLink'] != record['release']:
        raise RuntimeError('Unexpected deployment state; inspect ' + str(out))
    # Only remove the exact two files uploaded by this run.
    ssh('rm ' + shlex.quote(remote + '/activate.py') + ' ' + shlex.quote(remote + '/' + archive.name) + ' && rmdir ' + shlex.quote(remote))
    print(json.dumps(record, indent=2))


if __name__ == '__main__':
    main()
