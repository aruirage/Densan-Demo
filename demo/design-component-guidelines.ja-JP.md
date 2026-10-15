# デザインコンポーネント規約

> このドキュメントは、現在のプロジェクトコードをもとに整理したものです。システム内で利用されているデザインコンポーネント、スタイル変数、画面開発上の規約を説明します。最終整理日：2026-06-15。

## 1. 技術スタックとコンポーネント基盤

- フロントエンド技術：Vue 3、Vite、TypeScript、Element Plus、UnoCSS、SCSS。
- Element Plus バージョン：`2.9.1`。本プロジェクトの基本 UI ライブラリです。
- 共通コンポーネントは主に `src/components` に配置されています。
- レイアウトコンポーネントは主に `src/layout/components` に配置されています。
- グローバルスタイルは主に `src/styles` に配置されています。
- テーマ、サイズ、ダークモード、レイアウト状態は `src/store/modules/app.ts` で管理されています。

## 2. デザイン規約に関連するソース

| 種類 | パス | 説明 |
| --- | --- | --- |
| グローバルスタイル入口 | `src/styles/index.scss` | 変数、テーマ、FormCreate スタイルを読み込み、ボタン、ラジオ、テーブル hover、確認ダイアログなどを上書き |
| CSS 変数 | `src/styles/var.css` | メニュー、ヘッダー、コンテンツ領域、トランジション時間などのグローバル変数 |
| SCSS 名前空間 | `src/styles/variables.scss` | プロジェクト名前空間 `$namespace: v` と Element Plus 名前空間 `$elNamespace: el` を定義 |
| SCSS モジュール変数 | `src/styles/global.module.scss` | `namespace`、`elNamespace` を `useDesign` に提供 |
| テーマ状態 | `src/store/modules/app.ts` | テーマカラー、レイアウト、ダークモード、コンポーネントサイズ、メニュー折りたたみなどを管理 |
| UnoCSS 設定 | `uno.config.ts` | `custom-hover`、レイアウト境界線、`wh-full` などのユーティリティを定義 |
| Element Plus 登録 | `src/plugins/elementPlus/index.ts` | `ElLoading`、`ElScrollbar`、`ElButton` を登録 |
| グローバルコンポーネント登録 | `src/components/index.ts` | `Icon`、`FormTable` をグローバル登録 |
| 多言語 | `src/locales/zh-CN.ts`、`src/locales/ja.ts`、`src/locales/en.ts` | 多言語文言の定義元 |

## 3. 命名とスタイル規約

プロジェクトでは `useDesign` を使ってコンポーネント単位の class 接頭辞を生成します。

```ts
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('content-wrap')
```

生成される class は次の形式です。

```text
v-content-wrap
```

新しい共通コンポーネントを追加する場合も、この方式を利用することを推奨します。命名衝突を避け、スタイルの由来を追跡しやすくできます。

## 4. テーマとカラー規約

現在のテーマカラーは `src/store/modules/app.ts` で定義されています。

| 用途 | 現在値 |
| --- | --- |
| メインカラー `elColorPrimary` | `#175CD3` |
| 危険色 `--el-color-danger` | `#e31b54` |
| ページ背景 `--app-content-bg-color` | `#fafafa` |
| 左メニュー背景 | `#fff` |
| ヘッダー背景 | `#fff` |
| 主な hover ブルー | `#357af2` |
| 主な active ブルー | `#0f51c5` |
| disabled グレー | `#d5d7da` |

テーマカラーは `setCssVarTheme()` によって CSS 変数へ反映され、`setPrimaryLight()` によって Element Plus のメインカラー派生変数が生成されます。

- `--el-color-primary-light-3`
- `--el-color-primary-light-5`
- `--el-color-primary-light-7`
- `--el-color-primary-light-8`
- `--el-color-primary-light-9`
- `--el-color-primary-dark-2`

新しい画面を開発する場合は、固定値より CSS 変数を優先してください。

```scss
color: var(--el-color-primary);
background: var(--app-content-bg-color);
transition: all var(--transition-time-02);
```

## 5. レイアウト規約

システムは複数の管理画面レイアウトをサポートしています。描画ロジックは `src/layout/components/useRenderLayout.tsx` にあります。

- `left`：現在のデフォルトレイアウト。上部ツールバー + 折りたたみ可能な左メニュー。
- `classic`：クラシックな左メニューレイアウト。
- `topLeft`：上部ツールバー + 左メニュー。
- `top`：上部メニューレイアウト。
- `cutMenu`：分割メニューレイアウト。

主なレイアウト変数：

| 変数 | デフォルト値 | 説明 |
| --- | --- | --- |
| `--left-menu-max-width` | `200px` | 左メニュー展開時の幅 |
| `--left-menu-min-width` | `64px` | 左メニュー折りたたみ時の幅 |
| `--logo-height` | `48px` | Logo と上部ツールバーの高さ |
| `--top-tool-height` | `var(--logo-height)` | 上部ツールバーの高さ |
| `--tags-view-height` | `32px` | タグビューの高さ |
| `--app-content-padding` | `0` | コンテンツ領域の余白 |
| `--transition-time-02` | `0.2s` | 共通トランジション時間 |

業務画面では、全体レイアウトを再実装せず、既存のレイアウトコンポーネントを利用してください。

## 6. UnoCSS 利用規約

UnoCSS の設定は `uno.config.ts` にあります。

既存ショートカット：

- `wh-full`：`w-full h-full` と同等。

既存カスタムルール：

- `custom-hover`：ヘッダー、Logo、ツールバーなどの hover 領域。
- `layout-border__left`
- `layout-border__right`
- `layout-border__top`
- `layout-border__bottom`

推奨：

- レイアウト、余白、flex、幅、高さは既存のユーティリティ class を優先します。
- 境界線と hover 状態は既存のカスタムルールを優先します。
- 複雑なスタイルは scoped SCSS またはグローバルスタイルに記述します。

## 7. 多言語規約

現在、以下の言語ファイルがあります。

- `src/locales/zh-CN.ts`
- `src/locales/ja.ts`
- `src/locales/en.ts`

コンポーネント内では `useI18n()` を使って `t` を取得します。

```ts
const { t } = useI18n()
```

推奨：

- 画面タイトル、ボタン、メッセージ、バリデーション文言は言語ファイルに定義します。
- 既存の共通文言は `common` 配下の key を再利用します。例：`common.query`、`common.reset`、`common.back`。
- 中国語・日本語対応の画面を追加する場合は、`zh-CN.ts` と `ja.ts` を同時に更新します。

## 8. 画面開発の推奨構成

新しい管理画面を追加する場合は、以下の構成を推奨します。

1. 主コンテンツ領域には `ContentWrap` を使用します。
2. 検索条件エリアには `Search` を使用します。
3. 一覧には `Table`、または `ElTable` + `Pagination` を使用します。
4. 新規作成、編集、詳細ダイアログには `Dialog` を使用します。
5. フォームには `Form` + `schema` を使用します。
6. アイコンにはグローバル `Icon` を使用します。
7. 色は CSS 変数を使用し、固定値の散在を避けます。
8. 文言は多言語ファイルで管理します。
9. 複雑な業務画面では、`Annotation`、`Recognize`、`FilePreview`、`UploadFile` などのドメインコンポーネントを利用します。

## 9. 業務コンポーネントの配置

共通コンポーネント以外にも、以下の業務コンポーネントがあります。

| 種類 | 例 | 説明 |
| --- | --- | --- |
| アノテーション関連 | `src/components/Annotation` | 帳票・画像アノテーション |
| 認識関連 | `src/components/Recognize` | 認識結果と操作 |
| ファイルプレビュー | `src/components/FilePreview`、`src/components/vueOfficePreview` | PDF、画像、Office プレビュー |
| アップロード | `src/components/UploadFile` | ファイル、画像、アノテーションファイルのアップロード |
| フォームデザイン | `src/components/FormCreate` | 動的フォーム設計 |
| 可視化 | `src/components/Echart` | チャート表示 |
| ページ編集 | `src/components/DiyEditor`、`src/components/MagicCubeEditor` | モバイルページ編集コンポーネント |

業務コンポーネントを利用する前に、該当ディレクトリの `index.vue`、`config.ts`、`data.js`、hooks などを確認し、データ構造とイベント仕様を把握してください。



