"""Publish the already verified fresh site after explicit browser approval."""
from pathlib import Path
import json,subprocess,urllib.request,hashlib,socket,time
base=Path('/opt/1panel/projects/label-checking-system')
conf=Path('/opt/1panel/www/conf.d/label-checking-system.conf')
result=json.loads((base/'deployment-result.json').read_text())
assert result['status']=='INTERNAL_READY'
assert conf.read_text().count('listen 127.0.0.1:8097;')==1
backup=base/'gateway-internal.conf';backup.write_text(conf.read_text())
# Keep the loopback socket: changing it to a wildcard during graceful reload
# conflicts with the old socket and can leave the new public listener absent.
with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as probe:
 probe.connect(('1.1.1.1',53)); primary_ip=probe.getsockname()[0]
assert not primary_ip.startswith('127.')
conf.write_text(conf.read_text().replace('listen 127.0.0.1:8097;',
 'listen 127.0.0.1:8097;\n    listen '+primary_ip+':8097;'));conf.chmod(0o644)
for args in [['docker','exec','1Panel-openresty-BSpo','nginx','-t'],['docker','exec','1Panel-openresty-BSpo','nginx','-s','reload'],['ufw','allow','8097/tcp','comment','标签核对系统']]:
 p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if p.returncode:
  conf.write_text(backup.read_text());conf.chmod(0o644)
  subprocess.run(['docker','exec','1Panel-openresty-BSpo','nginx','-s','reload'],capture_output=True)
  raise SystemExit('Publish failed; internal gateway restored')
for attempt in range(20):
 try:
  with urllib.request.urlopen('http://'+primary_ip+':8097/api/health',timeout=2) as r:assert json.load(r)['code']==200
  break
 except (OSError,AssertionError):
  if attempt==19:raise
  time.sleep(0.5)
with urllib.request.urlopen('http://127.0.0.1:8097/api/health',timeout=10) as r:assert json.load(r)['code']==200
result['status']='HOST_PUBLISHED_CLOUD_FIREWALL_PENDING';result['publicAccess']='await external verification'
(base/'deployment-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('HOST_READY:8097; backend loopback18097; cloud firewall still needs new8097 allow rule')
