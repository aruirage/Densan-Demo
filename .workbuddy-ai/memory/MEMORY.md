# 项目约定（电算 demo / LLM OCR）

## 运行 / 测试 / 部署
- 预览：`python3 demo/serve.py 8787`（开发版，运行时注入）；8899 = `dist/` 静态版；8888 是无关的 Vite 项目，别碰。
- 构建：`python3 demo/serve.py --build dist`（Vercel，output=dist）。改 app.js 后必须重建 dist。
- 测试：`node --test demo/tests/result-ui.test.cjs`（生 app.js 逻辑）+ `tests/served-bundle.test.cjs`（serve.py 产物）。`tests/` 目录直接传 node --test 不跑，须传具体文件。

## app.js 改写风险 & 再生成強レイヤ
- 别会话可能同时改写 app.js（实测 1–2 分钟全面覆盖）。批量改动用 `node -e` 读→替换→写回一次完成，写完 grep 复查；发现回滚要重做并提醒用户关掉另一会话。
- 调整逃到别文件层：`brand-densan.css`（配色，index.html 最后加载，覆盖 styles 的 :root token）、`prompt-bar-fix.css`、`review-focus-fix.js`（app.js 后加载）。新调整优先加这层。
- `serve.py` 启动时才读，配信时用 `patched_app_js()` 改写 app.js（尤其 `GROUP_MODEL` 整体替换 `GROUPS`）。改 app.js 结构后必查 serve.py 正则补丁是否仍生效（曾因 `canView` 声明被删致一覧空白）。

## 配色（唯一正：demo/brand-densan.css）
主色 `#2448a0`、亮蓝 `#2a5dd8`、青 `#2a99d8/#2ad8d8`、淡蓝底 `#e4f3ff/#deecff`、文字 `#333`、链接 `#0066cc`、灰 `#f7f7f7/#d7d7d7`、橙强调 `#ff8300/#ff9900`。白地+浓绀+淡蓝+灰，克制。

## 权限模型
- 两层：系统级=`ROLES`+`MENU_TREE`/`MENU_PERMS`（菜单权限 #page=roles）；业务级=`TICKET_PERMS`（帳票タイプ×4操作 #page=permissions）。
- 4 操作固定：閲覧→確認→承認→再承認（再承認=2段承認）。`TICKET_PERMS` 是承认流程唯一真相，须覆盖 LAYOUT 全件。
- 部門概念全廃，组织用ロールグループ `GROUPS={id,name,kind,userIds,roleIds}`。UI 用「ロールグループ」，不出「部門/ユーザーグループ」。
- グループ内ランダム割当（直接指定 1 人则固定）。权限≠出现在マイタスク（确认/承認才出任务）。
- 設計案（未実装）：`权限设计_担当组方式.md`(中)/`権限設計_担当グループ方式.md`(日)。帳票カテゴリ层不存在（業務区分＞帳票タイプ＞ファイル）。

## 状态 / Tab / 絞込み / 一覧
- 状态 5 种：読取中/読取完了/読取失敗/確認済み/出力済。`waiting`/`classifying`→`reading`、`checking`/`returned`→`done`、`approved`→`confirmed`。
- タブ件数バッジ=表出行数（同母集団）。読取开始重置絞込み+树搜索；完成时跳对应タブ。
- 結果一覧絞込み全単一選択（status/biz/layout/createdBy/confirmedBy/approvedBy=空文字）；ホーム/マイタスク複数選択。
- 一覧操作葉：再読取→修正→確認→ダウンロード→削除（5つ）。`showOps=false` 时整列不出。`userHasOp` 控制。
- 帳票タイプデータ権限：组织→用户 2 段（`groupIds`/`userIds` + `LAYOUT` 同持ち）。`canSeeLayout`：组织未設=全员可、管理者常可。

## 设置系页面 & 各 UI
- 設定系ページ在 `maincol` 内侧滚动（`div.sec-page` + `flex:1 1 auto;min-height:0;overflow:auto`），否则底部按钮切れ。
- セキュリティ設定 3 模块：保存期限/IP白名单/アイドルセッション。`SECURITY={retention,ipEnabled,idle,logs}`。
- ユーザー管理 `#page=users` 用 `.users-page`（2col：左 .users-side 280px 树、右 .users-main）。勿流用 `.roles-page`（column）。
- `data-*` 必须 kebab-case（HTML 小文字化，`dataset.roleTab` 会 undefined）。
- `render()` 后调 `bind()`；`bind()` 抛异常→HTML 描画但事件全无。
- `app.js` 的 let/const 不挂 window；外部要用须 `window.__demo` export 或公开ヘルパ。
- ページ遷移：`applyHash()` 起動時 1 回；`render()` 冒頭 `canReachPage()` 差戻。正しくは `state.currentUser='u1'; location.hash='#page=roles'; applyHash(); render();`。`applyHash` 白名单と render route 両方に新ページ追加。
- `?perm=1` 判定 `(?:^|[?&#])perm=1(?:&|#|$)`。

## 文档语言 & 术语
- 设计文档/方案用中文写，日文术语括弧内：业务区分（業務区分）/单据（帳票）/单据类型（帳票タイプ）/担当组（担当グループ）/用户组（ユーザーグループ）/票据权限表（帳票権限表）/确认（確認）/承认（承認）/输出（出力）/退回（差戻し）/阅览（閲覧）。UI 文案仍日文。`demo/README.md` 保持日文。

## 客户回答（電算記入_LLMOCR機能確認表 No.19/20）
- 制御操作 7 つ（閲覧/アップロード/OCR修正/確認/承認/CSV出力/帳票設定変更），全機能権限制限、担当外見せない。
- 単位=グループ（複数ロール可）；1 ユーザー複数グループ可；権限なき帳票タイプは一覧/樹/履歴から除外。
- 承認：ファイル単位/2段可変/承認ロール+承認者グループ/差戻ひとつ前/コメント任意/差分出力重複なし。

## その他実装注意
- `ENT_USERS` 照合用 `uid`（`id='U1'` vs `state.currentUser='u1'`）。
- 検証用 `demo/serve-nocache.py`（serve.py 注入の `var DEMO_ACTORS` が app.js の `const` と衝突で全画面空白）。
- ブランド配色は `demo/admin-mode.js` 握る（`window.DEMO_FULL_ADMIN` 既定 true，`?perm=1` で制限）。`isTenantAdmin` 同フラグ最優先。
- `review-focus-fix.js` の `killActorSwitcher()` が `.userpick` 配下を remove（DOM 足しても消える）。
- `styles.css` メディアクエリ `.tablewrap table{min-width:1180px}` はモーダル内で `.xxx-wrap .table{min-width:0}` 解除。
- 出力：前回 `exportSnapshot` と `exportDelta(id)` 差分、`commitExport` 差分ゼロなら出力しない。CSV 実行端 `buildExportCsv`+`csvDownload`（BOM/なし/Shift_JIS ラベルのみ・真正 CP932 未実装）。列→OCR 值是 mock（b6 インデックス）。
- 辞書 `DICTS`/`DICT_ENTRIES`、`renderDictionary`；自動アップロード `WATCH_ORDER`/`WATCHES`/`RESULT_SEGS`、`renderWatch`。CSS `demo/dict-watch.css`。
- 新規アップロード葉：アップロード(op-upload)+読取実行(op-read)。`#upDel`=`userHasOp('delete')`。
- `.typedetail` 配下の表（全局 `table{table-layout:fixed}` が効いてる）で中間列に明示幅がない＋中の `input/select` に `min-width` があると、隣のセルに**入力が食み出して重なる**（实测 step2 で 26 件、step3 で 7 件）。`th:nth-child(n){width:...}` で全列幅を固定し、`min-width` を列幅以下に下げる。修正例は `demo/wiz-preview-fix.css` の step2/3 节。
