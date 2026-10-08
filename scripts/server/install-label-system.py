"""One-time, fresh isolated label site; no existing application is altered."""
from pathlib import Path
import crypt, hashlib, json, os, secrets, shutil, socket, subprocess, sys, time, urllib.request, urllib.error

BASE = Path('/opt/1panel/projects/label-checking-system')
SITE = Path('/opt/1panel/www/sites/label-checking-system')
CONF = Path('/opt/1panel/www/conf.d/label-checking-system.conf')
NAME = 'label-checking-system'
MYSQL = '1Panel-mysql-kBcw'
GATEWAY = '1Panel-openresty-BSpo'
DB = 'label_checking_system'
DBUSER = 'label_check_app'
PACKAGE = Path(sys.argv[1]).resolve()

def call(args, data=None):
    p = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        # SQL may contain generated passwords: never echo command/input/stderr.
        raise RuntimeError('command failed: '+str(args[0])+' exit '+str(p.returncode))
    return p.stdout.decode()

def inspect(name):
    return json.loads(call(['docker', 'inspect', name]))[0]

def fetch(path, token=None, data=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request('http://127.0.0.1:18097'+path, headers=headers,
                               data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req,timeout=10) as r:
        return json.loads(r.read())

def sql(text):
    env=next(x.split('=',1)[1] for x in inspect(MYSQL)['Config']['Env'] if x.startswith('MYSQL_ROOT_PASSWORD='))
    return call(['docker','exec','-i','-e','MYSQL_PWD='+env,MYSQL,'mysql','-uroot','--default-character-set=utf8mb4','-N','-B'],text.encode())

def quote(v):
    if v is None:return 'NULL'
    if isinstance(v,bool):return str(int(v))
    if isinstance(v,(int,float)):return str(v)
    return "CONVERT(0x"+str(v).encode().hex()+" USING utf8mb4)"

os.umask(0o077)
assert os.geteuid()==0
assert not BASE.exists() and not SITE.exists() and not CONF.exists(), 'Refuse overwrite existing site'
assert not call(['docker','ps','-aq','--filter','name=^/'+NAME+'$']).strip(), 'Container exists'
for port in [8097,18097]:
    with socket.socket() as s:s.bind(('127.0.0.1',port))
assert not sql("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='"+DB+"';").strip(), 'Database exists'
assert not sql("SELECT User FROM mysql.user WHERE User='"+DBUSER+"';").strip(), 'DB user exists'
assert crypt.METHOD_BLOWFISH in crypt.methods
manifest=json.loads((PACKAGE/'manifest.json').read_text())
for file,digest in manifest['files'].items():
    assert hashlib.sha256((PACKAGE/file).read_bytes()).hexdigest()==digest, 'Release checksum mismatch'
BASE.mkdir(parents=True,mode=0o700)
before={inspect(n)['Name']:inspect(n)['State']['StartedAt'] for n in call(['docker','ps','-q']).split()}
(BASE/'containers-before.json').write_text(json.dumps(before))
SITE.mkdir(mode=0o755); SITE.chmod(0o755)
(SITE/'backend').mkdir(mode=0o755)
(SITE/'backend').chmod(0o755)
shutil.copytree(PACKAGE/'frontend',SITE/'index')
for p in (SITE/'index').rglob('*'):p.chmod(0o755 if p.is_dir() else 0o644)
(SITE/'index').chmod(0o755)
shutil.copy2(PACKAGE/'backend/app.jar',SITE/'backend/app.jar');(SITE/'backend/app.jar').chmod(0o644)
(SITE/'log').mkdir(mode=0o755)
users={u:secrets.token_urlsafe(20) for u in ['admin','tech','analyst','auditor']}
credentials={'url':'http://110.40.188.106:8097/','accounts':users,'generated':'2026-10-08','name':'标签核对系统'}
(BASE/'initial-accounts.json').write_text(json.dumps(credentials,ensure_ascii=False,indent=2))
dbpassword=secrets.token_urlsafe(32)
jwt=secrets.token_hex(48)
sql("CREATE DATABASE `"+DB+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;")
seed=json.loads((PACKAGE/'deployment/system-seed.json').read_text())
script='USE `'+DB+'`;\n'+(PACKAGE/'deployment/schema.sql').read_text()+'\n'
for table,rows in seed.items():
    for row in rows:
        script+='INSERT INTO `'+table+'` ('+','.join('`'+k+'`' for k in row)+') VALUES ('+','.join(quote(v) for v in row.values())+');\n'
for i,(username,role) in enumerate([('admin','ADMIN'),('tech','TECHNICIAN'),('analyst','ANALYST'),('auditor','AUDITOR')],1):
    hashed=crypt.crypt(users[username],crypt.mksalt(crypt.METHOD_BLOWFISH))
    assert len(hashed)==60 and hashed.startswith(('$2a$','$2b$','$2y$'))
    script+='INSERT INTO sys_user(id,username,password_hash,real_name,department,status) VALUES ('+str(i)+','+quote(username)+','+quote(hashed)+','+quote({'admin':'系统管理员','tech':'实验技术员','analyst':'分析人员','auditor':'审计人员'}[username])+","+quote('标签核对系统')+",'ENABLED');\n"
    script+="INSERT INTO sys_user_role(user_id,role_id) SELECT "+str(i)+",id FROM sys_role WHERE role_code='"+role+"';\n"
for migration in sorted((PACKAGE/'deployment/migrations').glob('*.sql')):script+=migration.read_text()+'\n'
sql(script)
sql("CREATE USER '"+DBUSER+"'@'%' IDENTIFIED BY '"+dbpassword+"'; GRANT SELECT, INSERT, UPDATE, DELETE ON `"+DB+"`.* TO '"+DBUSER+"'@'%';")
config='\n'.join([
    'server.port=8080','server.address=0.0.0.0',
    'spring.datasource.url=jdbc:mysql://'+MYSQL+':3306/'+DB+'?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true&useSSL=false',
    'spring.datasource.username='+DBUSER,'spring.datasource.password='+dbpassword,
    'spring.datasource.hikari.maximum-pool-size=5','spring.datasource.hikari.minimum-idle=1',
    'spring.sql.init.mode=never','app.bootstrap-enabled=false','app.jwt-secret='+jwt,
    'app.cors-allowed-origin-patterns=http://110.40.188.106:8097',
])+'\n'
private=SITE/'backend/application-production.properties'; private.write_text(config);private.chmod(0o400);os.chown(private,10001,10001)
call(['docker','run','-d','--name',NAME,'--label','com.label-system.name=标签核对系统','--label','com.label-system.git='+manifest['gitCommit'],
      '--restart','unless-stopped','--network','1panel-network','--memory','512m','--memory-swap','768m','--cpus','1.5',
      '--user','10001:10001','--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=64m',
      '--log-opt','max-size=10m','--log-opt','max-file=3','-p','127.0.0.1:18097:8080','-v',str(SITE/'backend')+':/app:ro','-w','/app',
      '1panel/java:17','java','-Duser.timezone=Asia/Shanghai','-XX:ActiveProcessorCount=2','-Xms64m','-Xmx256m','-XX:MaxMetaspaceSize=128m','-XX:MaxDirectMemorySize=64m',
      '-jar','app.jar','--spring.config.additional-location=file:./application-production.properties'])
healthy=False
for _ in range(60):
    try:
        health=fetch('/api/health')
        if health['code']==200:healthy=True;break
    except Exception:pass
    time.sleep(2)
assert healthy,'Backend not healthy: inspect new container logs privately'
conf='''server {
    listen 127.0.0.1:8097;
    server_name _;
    root /www/sites/label-checking-system/index;
    index index.html;
    client_max_body_size 9m;
    access_log /www/sites/label-checking-system/log/access.log;
    error_log /www/sites/label-checking-system/log/error.log;
    location /api/ {
        proxy_pass http://127.0.0.1:18097/api/;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
    location = /index.html { add_header Cache-Control "no-cache"; }
    location / { try_files $uri $uri/ /index.html; }
}
'''
CONF.write_text(conf);CONF.chmod(0o644)
call(['docker','exec',GATEWAY,'nginx','-t']);call(['docker','exec',GATEWAY,'nginx','-s','reload'])
login=fetch('/api/auth/login',data={'username':'admin','password':users['admin']})
assert login['code']==200
payload=login['data'];token=payload.get('token') or payload.get('accessToken');assert token
experiments=fetch('/api/experiments',token);assert experiments['code']==200 and experiments['data']==[]
for endpoint in ['/api/experiments','/api/system/users']:
    if endpoint=='/api/system/users':continue
    try:fetch(endpoint);raise AssertionError('Unauthenticated read accepted')
    except urllib.error.HTTPError as e:assert e.code==401
with urllib.request.urlopen('http://127.0.0.1:8097/experiments',timeout=10) as r:
    assert '标签核对系统' in r.read().decode()
for n,started in before.items():
    c=inspect(n);assert c['State']['Running'] and c['State']['StartedAt']==started,'Existing container changed'
shutil.copy2(PACKAGE/'manifest.json',BASE/'manifest.json')
result={'name':'标签核对系统','status':'INTERNAL_READY','commit':manifest['gitCommit'],'port':8097,'backend':'127.0.0.1:18097',
        'newDatabase':DB,'frontendVerified':True,'healthVerified':True,'loginVerified':True,'experiments':0,'existingContainersUnchanged':len(before),
        'credentialsFile':str(BASE/'initial-accounts.json'),'publicAccess':False}
(BASE/'deployment-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
