#!/bin/sh
set -eu

# 作用：容器只负责准备上传文件目录；业务数据连接到 MySQL，不再复制 SQLite 文件。
mkdir -p "${DATA_ROOT:-/app/data}"

exec "$@"
