# finance_tools
日本株売買予測ツール（仮）

## セットアップ

認証情報はテンプレートファイル(`*.example`)をコピーして作成してください(いずれもgit管理対象外です)。

```
cp .env.example .env
cp mysql/client.cnf.example mysql/client.cnf
cp mysql/secrets/root_password.txt.example mysql/secrets/root_password.txt
cp mysql/secrets/password.txt.example mysql/secrets/password.txt
```

各ファイルの値を必要に応じて書き換えたうえで、`mysql/client.cnf` と `mysql/secrets/*.txt` の
パスワードは一致させてください(`mysql/secrets/password.txt` が実際にDBへ設定される
アプリ用ユーザーのパスワードです)。

```
make up
```
