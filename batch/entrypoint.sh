#!/bin/sh
# cronジョブはコンテナのプロセス環境変数(DB_HOST等)を引き継がないため、
# 起動時点の環境変数を/etc/environmentへ書き出してcronに渡す。
set -e

printenv | grep -v '^HOME=' | grep -v '^PWD=' > /etc/environment

exec cron -f
