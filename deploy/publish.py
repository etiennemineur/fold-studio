import pathlib,subprocess,datetime,hashlib,tarfile,json
root=pathlib.Path(__file__).resolve().parents[1]
host='etienne-studio-vps'
def ssh(command): return subprocess.check_output(['ssh','-o','BatchMode=yes',host,command],text=True)
release='foldstudio-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
out=root/'verification/public-deploy'/release;out.mkdir(parents=True)
archive=out/(release+'.tar.gz')
with tarfile.open(archive,'w:gz') as tf: tf.add(root/'dist',arcname='dist')
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
subprocess.run(['scp',str(archive),str(root/'deploy/foldstudio-location.conf'),host+':/tmp/'],check=True)
assert ssh('sha256sum /tmp/'+archive.name).split()[0]==sha
conf='/etc/nginx/sites-enabled/etienne-studio'
old=ssh('sudo readlink -f /srv/foldstudio/web || true').strip()
original=ssh('sudo python3 -c '+__import__('shlex').quote('from pathlib import Path; print(Path("'+conf+'").read_text(),end="")'))
backup='/etc/nginx/sites-available/etienne-studio.before-'+release
ssh(f'sudo cp {conf} {backup}; sudo mkdir -p /srv/foldstudio/releases/{release}; sudo tar -xzf /tmp/{archive.name} -C /srv/foldstudio/releases/{release}; sudo chmod -R a+rX /srv/foldstudio/releases/{release}; sudo ln -sfn /srv/foldstudio/releases/{release} /srv/foldstudio/web; sudo install -m 644 /tmp/foldstudio-location.conf /etc/nginx/snippets/foldstudio-location.conf')
line='    include /etc/nginx/snippets/foldstudio-location.conf;'
if line not in original:
 code='from pathlib import Path; p=Path("'+conf+'"); t=p.read_text(); anchor="    include /etc/nginx/snippets/tools-location.conf;"; assert t.count(anchor)==1; p.write_text(t.replace(anchor,anchor+"\\n'+line+'"))'
 ssh('sudo python3 -c '+__import__('shlex').quote(code))
try: print(ssh('sudo nginx -t && sudo systemctl reload nginx'))
except:
 ssh(f'sudo cp {backup} {conf}; sudo nginx -t && sudo systemctl reload nginx');raise
record={'release':release,'sha256':sha,'previousLink':old,'nginxBackup':backup,'url':'https://etienne.design/tools/FoldStudio/'}
(out/'deployment.json').write_text(json.dumps(record,indent=2));print(json.dumps(record,indent=2));print(ssh('readlink -f /srv/foldstudio/web'))
