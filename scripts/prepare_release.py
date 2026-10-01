"""生成部署包和本地数据库备份，不输出连接凭据及业务记录。"""

import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile
import xml.etree.ElementTree as ElementTree

import pymysql
import yaml

ROOT = Path(__file__).resolve().parents[1]


def resolve(value: str) -> str:
    """解析本地配置中的环境变量占位符。"""
    return re.sub(r"\$\{([^}:]+)(?::([^}]*))?\}",
                  lambda match: os.environ.get(match[1], match[2] or ""), str(value))


def load_datasource() -> dict:
    """与从 backend 目录启动后端时使用同一份本地私有配置。"""
    config = yaml.safe_load((ROOT / "backend/src/main/resources/application.yml").read_text(encoding="utf-8"))
    datasource = dict(config["spring"]["datasource"])
    private_path = ROOT / "backend/application-private.yml"
    if private_path.is_file():
        private_config = yaml.safe_load(private_path.read_text(encoding="utf-8")) or {}
        datasource.update(private_config.get("spring", {}).get("datasource", {}))
    return datasource


def fingerprint(connection) -> dict:
    """仅保存行数和摘要，避免在清单中记录业务数据。"""
    result = {}
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            if not re.fullmatch(r"[a-z0-9_]+", table):
                raise RuntimeError("表名不符合导出约定")
            cursor.execute(f"SELECT * FROM `{table}` ORDER BY id")
            rows = cursor.fetchall()
            payload = json.dumps(rows, ensure_ascii=False, default=str, separators=(",", ":"))
            result[table] = {"rows": len(rows), "sha256": hashlib.sha256(payload.encode()).hexdigest()}
    return result


def main() -> None:
    datasource = load_datasource()
    url = resolve(datasource["url"])
    match = re.match(r"jdbc:mysql://([^:]+):(\d+)/([^?]+)", url)
    if not match:
        raise RuntimeError("无法识别本地数据库地址")
    host, port, database = match.groups()
    username = resolve(datasource["username"])
    password = resolve(datasource["password"])
    release = ROOT / ".releases" / datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    release.mkdir(parents=True, exist_ok=False)
    connection = pymysql.connect(host=host, port=int(port), user=username, password=password,
                                 database=database, charset="utf8mb4", autocommit=True)
    before = fingerprint(connection)
    env = dict(os.environ, MYSQL_PWD=password)
    dump_path = release / "database.sql"
    command = [shutil.which("mysqldump"), "--host=" + host, "--port=" + port, "--user=" + username,
               "--single-transaction", "--quick", "--hex-blob", "--default-character-set=utf8mb4",
               "--set-gtid-purged=OFF", "--no-tablespaces", "--skip-add-drop-table", database]
    with dump_path.open("wb") as output:
        outcome = subprocess.run(command, env=env, stdout=output, stderr=subprocess.PIPE, check=False)
    if outcome.returncode:
        raise RuntimeError("数据库备份失败，未生成可发布包")
    after = fingerprint(connection)
    connection.close()
    if before != after:
        raise RuntimeError("备份期间本地数据发生变化，请重新导出")
    backend = release / "backend"
    backend.mkdir()
    pom = ElementTree.parse(ROOT / "backend/pom.xml").getroot()
    namespace = {"m": "http://maven.apache.org/POM/4.0.0"}
    artifact_id = pom.findtext("m:artifactId", namespaces=namespace)
    backend_version = pom.findtext("m:version", namespaces=namespace)
    frontend_version = json.loads((ROOT / "frontend/package.json").read_text(encoding="utf-8"))["version"]
    shutil.copy2(ROOT / f"backend/target/{artifact_id}-{backend_version}.jar", backend / "app.jar")
    shutil.copytree(ROOT / "frontend/dist", release / "frontend")
    manifest = {"release": release.name, "frontendVersion": frontend_version, "backendVersion": backend_version,
                "database": database, "tables": before, "files": {}}
    for item in sorted(release.rglob("*")):
        if item.is_file():
            manifest["files"][item.relative_to(release).as_posix()] = hashlib.sha256(item.read_bytes()).hexdigest()
    (release / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    archive = release / "tag-management-release.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as package:
        for item in sorted(release.rglob("*")):
            if item.is_file() and item != archive:
                package.write(item, item.relative_to(release).as_posix())
    print(json.dumps({"release": str(release), "archive": str(archive), "bytes": archive.stat().st_size,
                      "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                      "tables": {table: info["rows"] for table, info in before.items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
