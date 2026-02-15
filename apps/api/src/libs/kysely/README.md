## vndb 数据库容器插入命令

进入 pg 容器后执行

```bash
apt update && \
apt install -y wget zstd && \
wget https://dl.vndb.org/dump/vndb-db-latest.tar.zst -O /tmp/vndb-db.tar.zst && \
zstd -d /tmp/vndb-db.tar.zst -o /tmp/vndb-db.tar && \
tar -xf /tmp/vndb-db.tar -C /tmp && \
cd /tmp && \
psql -U vndb -d vndb -f import.sql
```
