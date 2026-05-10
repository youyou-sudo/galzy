#!/bin/sh
set -e

apt update
apt install -y wget zstd

wget https://dl.vndb.org/dump/vndb-db-latest.tar.zst -O /tmp/vndb-db.tar.zst

zstd -d /tmp/vndb-db.tar.zst -o /tmp/vndb-db.tar

tar -xf /tmp/vndb-db.tar -C /tmp

cd /tmp

psql -U vndb -d vndb -f import.sql
