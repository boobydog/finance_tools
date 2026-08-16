.DEFAULT_GOAL := help

# 特定サービスのみ操作したい場合に指定する (frontend / api / app / db)
# 例: make up SERVICE=frontend / make stop SERVICE=frontend
SERVICE ?=

.PHONY: help up stop down down-prune ps logs df \
	prune-image prune-image-all prune-container prune-volume prune-network prune-system prune-system-all prune-builder \
	frontend-build frontend-start frontend-prod \
	exec-front

help: ## コマンド一覧と説明を表示する
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "  SERVICE=<name> で対象サービスを指定可能 (frontend / api / app / db)"
	@echo "  例: make up SERVICE=frontend / make stop SERVICE=frontend"
	@echo ""
	@echo "  frontend-build / frontend-start / frontend-prod はDockerを使わずホストで直接pnpmを実行する"
	@echo "  (Docker側でfrontendを本番相当で動かしたい場合は docker-compose.yml のfrontend.commandを切り替える)"

up: ## 起動 (バックグラウンド。SERVICE未指定なら全サービス)
	docker compose up -d --build $(SERVICE)

stop: ## 停止 (コンテナは削除しない。SERVICE未指定なら全サービス)
	docker compose stop $(SERVICE)

down: ## 全サービスを停止しコンテナ/ネットワークを削除する (個別指定不可)
	docker compose down

frontend-build: ## frontendを本番ビルドする (Dockerを使わずホストで直接pnpmを実行)
	cd frontend && pnpm run build

frontend-start: ## frontendの本番ビルドを起動する (事前にmake frontend-buildが必要、ホストで直接pnpmを実行)
	cd frontend && pnpm run start

frontend-prod: frontend-build frontend-start ## frontendをビルド→起動まで一括実行 (ホストで直接pnpmを実行)

down-prune: ## 全サービスを停止しコンテナ/ネットワーク/イメージを削除する
	docker compose down --rmi all --volumes --remove-orphans

ps: ## コンテナ一覧の確認
	docker compose ps

logs: ## ログの表示 (末尾から追従)
	docker compose logs -f

df: ## イメージ/コンテナ/ボリュームのディスク使用量を確認
	docker system df

prune-image: ## 現在使用されていないイメージの削除
	docker image prune -f

prune-image-all: ## すべてのイメージを削除
	docker image prune -a -f

prune-container: ## 現在使用されていないコンテナの削除
	docker container prune -f

prune-volume: ## 使用していないボリュームすべての削除
	docker volume prune -f

prune-network: ## 使用していないネットワークの削除
	docker network prune -f

prune-system: ## 未使用のイメージ・コンテナ・ネットワークをまとめて削除
	docker system prune -f

prune-system-all: ## 未使用のイメージ・コンテナ・ネットワーク・ボリュームをまとめて削除
	docker system prune -f --volumes

prune-builder: ## ビルドキャッシュの削除
	docker builder prune -f

exec-front: ## フロントエンドコンテナに入る
	docker container exec -it finance_tools-frontend-1 bash 