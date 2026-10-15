# デプロイ（Vercel）

このリポジトリは **`dist/` を出力する静的サイト**として Vercel にデプロイします。

## 仕組み

`demo/` は本来 `demo/serve.py`（ローカル用の簡易サーバ）が **配信時にパッチを注入**して動きます
（permission レイヤー、モックデータ、CSS、admin-mode など）。
Vercel には Python サーバが無いため、**ビルド時にその注入結果を静的ファイルとして書き出します**。

```
npm run build            # = python3 demo/serve.py --build dist
```

`demo/serve.py --build dist` が行うこと:

| 出力 | 内容 |
| --- | --- |
| `dist/app.js` | 配信時パッチを全て適用した app.js |
| `dist/index.html` | タイトル／CSS 注入／`admin-mode.js` 読み込み込み |
| `dist/admin-mode.js` | 管理者固定モード（全権限）＋フォルダ可視範囲 |
| `dist/folder-visibility.js` | フォルダ単位の可視範囲 |
| その他 | `styles.css` などの CSS、`review-fix` overlay、`assets/` |

## Vercel 設定

`vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "cleanUrls": true
}
```

- **Python が使える場合**：このまま `npm run build` が走り、最新の `dist/` が生成されます。
- **Python が使えない環境の場合**：`vercel.json` の `buildCommand` を削除してください。
  リポジトリには**ビルド済みの `dist/` をコミットしてある**ので、そのまま配信されます。

## ローカル

```bash
# 開発（配信時パッチつき・自動反映）
npm run dev            # http://127.0.0.1:8788/

# 静的ビルド（Vercel と同じもの）
npm run build          # -> dist/
python3 -m http.server 8899 --directory dist
```
