const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
function app() {
  /* syncHashFromState が location を触るので、ブラウザ相当の最小スタブを渡す */
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { hash: '', search: '', pathname: '/', href: 'http://localhost/' },
    history: { replaceState() {}, pushState() {} },
  });
  vm.runInContext(source.slice(0, source.lastIndexOf('\napplyHash();')), ctx);
  return (code) => vm.runInContext(code, ctx);
}
test('collapsed result filters show one row (filename/status/type); expanded adds scene, people and dates', () => {
  const run = app();
  let html = run('state.filterOpen = false; renderFilters()');
  assert.match(html, /class="result-filters-body"/);
  assert.match(html, /class="result-filter-row result-search-row"/);
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 1);
  for (const id of ['searchBtn', 'resetBtn']) assert.ok(html.includes(`id="${id}"`), id);
  /* 既定行は「ファイル名・ステータス・帳票タイプ」の 3 つ */
  assert.match(html, /<select class="fld fsel" data-fs="status"/);
  assert.match(html, /id="filtName"/);
  assert.match(html, /data-fs="layout"/);
  assert.ok(html.indexOf('id="filtName"') < html.indexOf('data-fs="status"'));
  assert.ok(html.indexOf('data-fs="status"') < html.indexOf('data-fs="layout"'));
  assert.doesNotMatch(html, /data-fs="biz"/);
  assert.doesNotMatch(html, /data-fs="category"|data-fs="dept"/);
  assert.doesNotMatch(html, /業務シーン/);
  assert.match(html, /もっと見る/);
  assert.doesNotMatch(html, /data-msbtn|data-ms="|data-opt=/);
  assert.doesNotMatch(html, /id="createdFrom"|id="readFrom"/);
  assert.doesNotMatch(html, /data-fs="confirmedBy"|data-fs="approvedBy"|data-fs="createdBy"/);
  assert.doesNotMatch(html, /class="searchline"/);
  assert.doesNotMatch(html, /id="filtRvq"|読取内容/);

  html = run('state.filterOpen = true; renderFilters()');
  assert.match(html, /result-filters is-open/);
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 3);
  assert.doesNotMatch(html, /data-fs="dept"|部署/);
  assert.match(html, /data-fs="biz"/);
  assert.match(html, /業務シーン/);
  assert.match(html, /data-fs="layout"/);
  assert.match(html, /帳票タイプ/);
  assert.match(html, /data-fs="createdBy"/);
  assert.match(html, /data-fs="processedBy"/);
  /* ステータス・詳細条件とも「未出力／出力未済」は持たない */
  assert.doesNotMatch(html, /data-fs="exportPending"|未出力|出力未済/);
  /* 5 状態に絞ったので確認者／承認者の絞り込みは持たない */
  assert.doesNotMatch(html, /data-fs="confirmedBy"|data-fs="approvedBy"|data-fs="operator"/);
  assert.doesNotMatch(html, /確認者|承認者|処理ユーザ|更新者/);
  assert.match(html, /作成者/);
  assert.match(html, /処理者/);
  assert.doesNotMatch(html, /id="resultQuery"|読取結果検索/);
  assert.match(html, /result-date-row/);
  /* 既定行（ファイル名／ステータス／帳票タイプ）→ 詳細行（業務シーン／作成者／処理者）の順 */
  assert.ok(html.indexOf('data-fs="layout"') < html.indexOf('data-fs="biz"'));
  assert.ok(html.indexOf('data-fs="biz"') < html.indexOf('data-fs="createdBy"'));
  for (const id of ['createdFrom', 'createdTo', 'updatedFrom', 'updatedTo']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /作成日時/);
  assert.match(html, /処理日時/);
  assert.match(html, /閉じる/);
  assert.match(html, /id="filtName"/);
  /* 読取内容（OCR 項目値）検索は詳細行に置く */
  assert.match(html, /id="filtRvq"/);
  assert.match(html, /読取内容/);
});
test('result table has thirteen columns, compact rows, four action slots and page jump', () => {
  const run = app();
  const html = run('renderTable()');
  assert.match(html, /result-tablewrap/);
  assert.match(html, /class="result-table"/);
  assert.match(html, /<colgroup>/);
  assert.equal((html.match(/<col /g) || []).length, 13);
  assert.match(html, /<col class="col-actions">/);
  assert.match(styles, /\.result-tablewrap\{[^}]*overflow:\s*auto/);
  assert.match(styles, /\.result-tablewrap\.is-dragging/);
  assert.match(styles, /\.result-tablewrap \.result-table\{[^}]*min-width:\s*1760px/);
  assert.match(source, /function bindResultTableScroll\(/);
  assert.match(source, /resultScrollLeft/);
  assert.doesNotMatch(html, /class="meta"|type-pill|class="dot"|class="ctx"/);
  assert.match(html, />帳票タイプ</);
  assert.match(html, />操作・処理<\/th>/);
  assert.match(html, /data-resultgoto/);
  assert.match(html, /一括ダウンロード/);
  assert.match(html, /class="batch-dl/);
  for (const fmt of ['csv', 'json', 'pdf']) assert.match(html, new RegExp(`data-batchdl="${fmt}"`));
  assert.match(html, /CSVをダウンロード/);
  assert.doesNotMatch(html, /Excelをダウンロード/);
  assert.match(html, /JSONをダウンロード/);
  assert.match(html, /PDFをダウンロード/);
  const row = html.match(/<tr[^>]*data-row="[^"]+"[\s\S]*?<\/tr>/)[0];
  /* 行アクション：再読取／確認／削除。ダウンロードは hover メニュー（data-dlmenu）なので data-act は3つ */
  assert.equal((row.match(/data-act="/g) || []).length, 3);
  for (const act of ['redo', 'confirm', 'delete']) assert.match(row, new RegExp(`data-act="${act}"`), act);
  assert.doesNotMatch(row, /data-act="fix"/);
  assert.doesNotMatch(row, /data-act="download"/);
  assert.match(row, /data-dlmenu="[^"]+"/);
  assert.match(row, /aria-haspopup="menu"/);
  assert.match(row, /i-download/);
  /* 並び順：再読取 → 確認 → ダウンロード → 削除 */
  assert.ok(row.indexOf('data-act="redo"') < row.indexOf('data-act="confirm"'));
  assert.ok(row.indexOf('data-act="confirm"') < row.indexOf('data-dlmenu='));
  assert.ok(row.indexOf('data-dlmenu=') < row.indexOf('data-act="delete"'));
  assert.doesNotMatch(row, /data-act="approve"|data-act="reapprove"/);
  assert.match(row, /class="fn link"/);
});
test('file tree shows no counts and the table has no scope-count line', () => {
  const run = app();
  const tree = run('renderTree()');
  assert.doesNotMatch(tree, /class="cnt"/);
  assert.doesNotMatch(tree, /<span class="cnt">\d+<\/span>/);
  const table = run('renderTable()');
  assert.doesNotMatch(table, /result-scope-head|直属 \d+ 件|配下含む \d+ 件/);
});
test('filename box filters by the displayed file name', () => {
  const run = app();
  const total = run('visibleFiles().length');
  run('state.filters.name = "住民"; state.resultPage = 1');
  const narrowed = JSON.parse(run('JSON.stringify(visibleFiles().map((f) => dispFileName(f.id)))'));
  assert.ok(narrowed.length > 0 && narrowed.length < total);
  assert.ok(narrowed.every((n) => n.includes('住民')));
  run('state.filters.name = "";');
  assert.equal(run('visibleFiles().length'), total);
});
test('read content box filters by OCR field values (including corrections)', () => {
  const run = app();
  const total = run('visibleFiles().length');
  run('state.filters = defaultFilters(); state.q = ""; state.tab = "all"; state.activeNode = { type: "all", id: "all" };');
  /* 表示中の 1 件だけに固有の修正値を入れ、その値で絞り込めることを見る */
  const fid = JSON.parse(run('JSON.stringify(visibleFiles()[0].id)'));
  run(`state.reviewDirty[${JSON.stringify(fid)}] = Object.assign({}, state.reviewDirty[${JSON.stringify(fid)}], { move_type: "ユニーク読取値" });`);
  run('state.filters.rvq = "ユニーク読取値"; state.resultPage = 1');
  assert.deepEqual(JSON.parse(run('JSON.stringify(visibleFiles().map((f) => f.id))')), [fid]);
  run('state.filters.rvq = "存在しない読取値";');
  assert.equal(run('visibleFiles().length'), 0);
  run('state.filters.rvq = "";');
  assert.equal(run('visibleFiles().length'), total);
});
test('tree builds from masters; files stay in the right pane; view mode and reorder', () => {
  const run = app();
  const html = run('renderTree()');
  assert.match(html, /tree-icon-folder/);
  /* ファイルはツリーに並べない（選択した帳票タイプの一覧が右ペインに出る） */
  assert.doesNotMatch(html, /data-type="file"/);
  /* 名称変更は帳票タイプ（ツリー第2階層）で行う。ファイルは右ペインの一覧側 */
  assert.match(html, /data-rename=/);
  assert.match(html, /data-type="cat" data-id="c1"/);
  assert.equal(run('FILES_DATA.length'), 45);
  assert.equal(run('state.fileFolder.f01'), 'c2');
  run('moveFileToFolder("f01", "c1")');
  assert.equal(run('state.fileFolder.f01'), 'c1');
  assert.equal(run('inNode(byId(FILES_DATA, "f01"), { type: "cat", id: "c1" })'), true);
  assert.equal(run('inNode(byId(FILES_DATA, "f01"), { type: "biz", id: "b1" })'), true);
  /* 業務へドロップすると先頭カテゴリへ */
  run('moveFileToFolder("f01", "b2")');
  assert.equal(run('state.fileFolder.f01'), 'c2');
  assert.equal(run('reorderTreeSibling("biz", "b2", "b1")'), true);
  assert.ok(run('BUSINESS.find((x) => x.id === "b2").order < BUSINESS.find((x) => x.id === "b1").order'));
  const panel = run('renderTreePanel()');
  assert.match(panel, /id="treeView"/);
  assert.match(panel, /role="tablist"/);
  assert.match(panel, /data-treeview="biz-cat"/);
  assert.match(panel, /data-treeview="cat"/);
  assert.match(panel, /tree-view-pill on" data-treeview="biz-cat"/);   // 既定は業務シーン階層
  assert.doesNotMatch(panel, /id="treeAddFolder"/);
  run('state.treeView = "cat"');
  const catTree = run('renderTree()');
  /* 帳票タイプ表示でも業務シーンの見出しは残る（グルーピング用） */
  assert.match(catTree, /data-type="cat" data-id="c1"/);
  const side = run('renderSidebarPane()');
  assert.match(side, /読取結果一覧/);
  assert.match(side, /info-i/);
  assert.match(side, /表示次元/);
  assert.match(side, /業務シーン/);
  assert.doesNotMatch(side, /class="tree-hint"/);
});
test('status strip omits waiting tab because upload jumps to reading on result list', () => {
  const run = app();
  const tabs = run('renderTabs()');
  assert.equal((tabs.match(/data-tab=/g) || []).length, 6);
  assert.doesNotMatch(tabs, /data-tab="waiting"/);
  /* 状態は 5 つ（読取中／完了／失敗／確認済み／出力済み）＋すべて */
  for (const id of ['all', 'reading', 'done', 'failed', 'confirmed', 'exported']) {
    assert.ok(tabs.includes(`data-tab="${id}"`), id);
  }
  const filters = run('renderFilters()');
  assert.doesNotMatch(filters, /value="waiting"/);
  assert.doesNotMatch(filters, /読取待ち/);
  assert.doesNotMatch(filters, /value="approved"|value="returned"/);
  assert.ok(filters.includes('value="exported"'));
});
test('review footer is status-driven: 読取完了は確認、確認済みは出力のみ', () => {
  const run = app();
  const flagsOf = (s) => JSON.parse(run(`byId(FILES_DATA, "f11").status = "${s}"; JSON.stringify(reviewFootFlags(byId(FILES_DATA, "f11")))`));
  const done = flagsOf('done');
  assert.equal(done.phase, 'confirm');
  assert.equal(done.canConfirm, true);
  assert.equal(done.readonly, false);
  const conf = flagsOf('confirmed');
  assert.equal(conf.phase, 'export');
  assert.equal(conf.canExport, true);
  assert.equal(conf.canConfirm, false);
  assert.equal(conf.readonly, true);
  const exp = flagsOf('exported');
  assert.equal(exp.canExport, true);
  assert.equal(exp.canConfirm, false);
  /* 承認・差戻の CTA は廃止（5 状態） */
  const html = run('state.reviewId = "f11"; state.page = "review"; state.reviewViewOnly = false; state.reviewReturn = "myTasks"; renderReview()');
  assert.doesNotMatch(html, /id="rvApprove"|id="rvReturn"/);
  assert.match(html, /id="rvBulkConfirm"/);
});

test('confirm audit keeps its shape and has no return records after the 5-state cut', () => {
  const run = app();
  run('ensureConfirmAudit(byId(FILES_DATA, "f15"))');
  const audit = JSON.parse(run('JSON.stringify(confirmAuditOf(byId(FILES_DATA, "f15")))'));
  assert.deepEqual(Object.keys(audit).sort(), ['changes', 'confirm', 'confirmedCount', 'returns']);
  assert.deepEqual(audit.returns, []);
});

test('approve is one-click; return always goes to confirm with required reason and OA progress', () => {
  const run = app();
  run('render = () => {}; toast = () => {};');
  /* 承認ダイアログは出さない（即時実行） */
  run('state.flowDialog = null; openFlowDialog("f11", "approve")');
  assert.equal(run('state.flowDialog'), null);
  assert.equal(run('byId(FILES_DATA, "f11").status'), 'approved');

  /* 2段承認中の差戻は確認へ（承認1へは戻さない） */
  run(`
    const f = byId(FILES_DATA, "f11");
    f.status = "confirmed";
    f.layout = "l1";
    f.flow = [{ stage: 1, action: "承認1", user: "a", at: "2026-10-15 10:00:00" }];
    f.approvedAt = null; f.approvedBy = null;
  `);
  const before = run('byId(FILES_DATA, "f11").status');
  run('runFlowAction("f11", "return", "  ")');
  assert.equal(run('byId(FILES_DATA, "f11").status'), before);
  run('runFlowAction("f11", "return", "記載不備のため確認へ戻します")');
  const f = JSON.parse(run('JSON.stringify(byId(FILES_DATA, "f11"))'));
  assert.equal(f.status, 'returned');
  assert.equal(f.returnTo, 0);
  assert.ok(f.flow.some((h) => /確認者へ/.test(h.action) && h.comment));
  assert.ok(f.flow.some((h) => h.stage === 1 && h.voided));
  const prog = JSON.parse(run('JSON.stringify(flowProgress(byId(FILES_DATA, "f11")))'));
  assert.equal(prog.steps.find((s) => s.key === 'confirm').state, 'current');
  assert.ok(prog.steps.filter((s) => /^approve/.test(s.key)).every((s) => s.state === 'todo'));
  assert.match(prog.label, /差戻/);
  assert.match(run('flowStepsHtml(byId(FILES_DATA, "f11"))'), /oa-progress/);
  run('openFlowDialog("f14", "return")');
  const dlg = run('renderFlowDialog()');
  assert.match(dlg, /差戻理由/);
  assert.match(dlg, /disabled/);
  assert.doesNotMatch(dlg, /id="flowReturn"/);
});

test('my tasks lists pending and done with filters', () => {
  const run = app();
  /* 確認担当 u4。5 状態に絞ったので承認タスクは持たない */
  run('state.currentUser = "u4"');
  assert.ok(run('myTaskFiles("confirm").length') > 0);
  assert.equal(run('myTaskFiles("approve").length'), 0);
  assert.ok(run('myTaskRows("pending").length') > 0);
  assert.ok(run('myTaskRows("done").length') > 0);
  run('state.page = "myTasks"; state.myTaskTab = "pending"; state.currentUser = "u4"');
  const html = run('renderMyTasks()');
  assert.match(html, /data-mytab="pending"/);
  assert.match(html, /data-mytab="done"/);
  assert.match(html, /未対応/);
  assert.match(html, /対応済/);
  assert.match(html, /id="mtName"/);
  assert.match(html, /id="mtBiz"/);
  assert.match(html, /id="mtCat"/);
  assert.match(html, /確認する/);
  assert.doesNotMatch(html, /承認する|再承認する|要再承認（2 段目）/);
  /* 担当は具体ユーザ名（グループ名ではない） */
  assert.match(html, /田中 実|伊藤 由美|佐藤 一郎/);
  assert.doesNotMatch(html, /確認者グループ|承認者グループ|窓口グループ/);
  assert.doesNotMatch(html, /担当グループに割り当てられた/);
});
test('confirm-only users never get approve tasks because approval was dropped', () => {
  const run = app();
  /* 確認専任 u2：承認タスク 0 */
  assert.equal(run('userHasOp("confirm", "u2")'), true);
  run('state.currentUser = "u2"');
  assert.equal(run('myTaskRows("pending").filter((r) => r.kind === "approve" || r.kind === "reapprove").length'), 0);
  assert.equal(run('myTaskRows("done").filter((r) => r.kind === "approve" || r.kind === "reapprove").length'), 0);
  assert.ok(run('myTaskRows("pending").filter((r) => r.kind === "confirm").length') >= 0);
  /* 承認操作そのものを使わないので、承認・再承認タスクは誰にも出ない */
  assert.equal(run('myTaskRows("pending").filter((r) => r.kind === "approve" || r.kind === "reapprove").length'), 0);
});
test('dataPerm 自身のみ hides others tasks; 全件参照 and admin show pool', () => {
  const run = app();
  assert.equal(run('dataPermOf("u2")'), '自身のみ');
  assert.equal(run('dataPermOf("u1")'), '全件参照');
  /* 同じ確認プールで、自身のみの件数 ≤ 全件参照に一時変更した件数 */
  run('state.currentUser = "u2"');
  const selfN = run('myTaskRows("pending").filter((r) => r.kind === "confirm").length');
  run('entUserByUid("u2").dataPerm = "全件参照"');
  const allN = run('myTaskRows("pending").filter((r) => r.kind === "confirm").length');
  assert.ok(allN >= selfN);
  /* 管理者は全件 */
  run('state.currentUser = "u1"');
  assert.ok(run('myTaskRows("pending").length') >= allN);
});

test('opening a my-task opens a dedicated review tab in the tab bar', () => {
  const run = app();
  run('render = () => {}; toast = () => {}; state.tabs = ["home", "myTasks"]; openReview("f11", { returnPage: "myTasks", viewOnly: false })');
  assert.equal(run('state.page'), 'review');
  assert.equal(run('state.reviewId'), 'f11');
  assert.ok(run('state.tabs.includes("review:f11")'));
  assert.equal(run('tabOfRoute("review")'), 'review:f11');
  const bar = run('renderTabbar()');
  assert.match(bar, /data-opentab="review:f11"/);
  assert.match(bar, /class="tabitem on is-review"/);
  /* 別タスクも別タブ */
  run('openReview("f14", { returnPage: "myTasks", viewOnly: false })');
  assert.ok(run('state.tabs.includes("review:f11") && state.tabs.includes("review:f14")'));
  assert.equal(run('state.reviewId'), 'f14');
});


test('menu opens matching tab for classification and ticket type', () => {
  const run = app();
  /* 帳票設定メニューはシステム管理者で開く（一般ユーザーには出ない） */
  run('state.currentUser = "u1"');
  assert.equal(run('TABS_DEF.bizScenes.label'), '業務シーン設定');
  assert.equal(run('TABS_DEF.ticketDetail.label'), '帳票タイプ設定');
  assert.ok(run('HEADER_MENUS.bill.items.some((it) => it.id === "bizScenes")'));
  run('render = () => {}; state.tabs = ["home"]; openBizScenes(null)');
  assert.ok(run('state.tabs.includes("bizScenes")'));
  assert.equal(run('state.page'), 'bizScenes');
  assert.equal(run('tabOfRoute("bizScenes")'), 'bizScenes');
  /* メニュー入口＝左リスト＋右 Step1（業務シーンと同じ構成） */
  run('openTicketTypes()');
  assert.ok(run('state.tabs.includes("ticketDetail")'));
  assert.equal(run('state.page'), 'ticketDetail');
  assert.equal(run('state.typeStep'), 1);
  assert.equal(run('tabOfRoute("ticketDetail")'), 'ticketDetail');
  const split = run('renderTicketDetail()');
  assert.match(split, /type-list-title">帳票設定-タイプ/);
  assert.match(split, /data-typeid="/);
  assert.match(split, /AI分類設定/);
  assert.doesNotMatch(split, /typedetail-solo/);
  run('openTicketDetail("T1")');
  assert.equal(run('state.page'), 'ticketDetail');
  assert.equal(run('state.typeStep'), 1);
  run('openTab("bizScenes")');
  assert.equal(run('state.page'), 'bizScenes');
  assert.ok(run('state.tabs.includes("bizScenes")'));
  const html = run('renderTabbar()');
  assert.match(html, /data-opentab="bizScenes"/);
  assert.match(html, /業務シーン設定/);
  assert.match(html, /帳票タイプ/);
  assert.match(html, /class="tabitem on"/);
});

test('top nav exposes upload and file list as separate menus', () => {
  const run = app();
  run('state.page = "home"; state.tabs = ["home", "upload", "result"]');
  // render() needs document - check TABS_DEF and tabOfRoute instead
  assert.equal(run('TABS_DEF.upload.label'), '新規アップロード');
  assert.equal(run('TABS_DEF.result.label'), '読取結果一覧');
  assert.equal(run('tabOfRoute("upload")'), 'upload');
  assert.equal(run('tabOfRoute("result")'), 'result');
  const side = run('state.page = "result"; renderSidebarPane()');
  assert.match(side, /表示次元/);
  assert.doesNotMatch(side, /data-page="upload"/);
});

test('review from result list is view-only without workflow CTAs', () => {
  const run = app();
  run('state.reviewId = "f02"; state.reviewViewOnly = true; state.reviewReturn = "result"; state.page = "review"');
  const html = run('renderReview()');
  assert.doesNotMatch(html, /id="rvConfirm"/);
  assert.doesNotMatch(html, /id="rvApprove"/);
  const flags = run('JSON.stringify(reviewFootFlags(byId(FILES_DATA, "f02")))');
  assert.equal(JSON.parse(flags).phase, 'view');
  assert.equal(JSON.parse(flags).canConfirm, false);
});
test('result pagination binds result-page buttons, not sidebar route buttons', () => {
  const run = app();
  run(`globalThis.pageButton = { dataset: { resultpage: '2' } };
    globalThis.document = { querySelector: () => null, querySelectorAll: (s) => s === '[data-resultpage]' ? [pageButton] : [] };
    render = () => {}; bindUploadPanel();`);
  assert.equal(run('typeof pageButton.onclick'), 'function');
  run('pageButton.onclick()');
  assert.equal(run('state.resultPage'), 2);
  assert.equal(run('state.page'), 'home');
});
test('selecting forms for reading promotes rows and jumps to result list while reading', () => {
  const run = app();
  run(`state.page = 'upload'; state.currentUser = 'u4'; state.upBiz = 'b2';
    const u = makeUpload('01_令和8年度分市民税・県民税申告書.pdf', 1024);
    u.status = 'waiting'; u.history = '分類完了';
    state.uploads = [u]; state.upPicked = { [u.id]: true };
    globalThis.document = { querySelector: (s) => s === '#upRead' ? globalThis.upReadBtn : null, querySelectorAll: () => [] };
    globalThis.upReadBtn = {};
    render = () => {}; toast = () => {};
    const origStart = startReading;
    globalThis.started = null;
    startReading = (items) => { globalThis.started = items.map((x) => x.id); };
    bindUploadPanel();
    upReadBtn.onclick();`);
  assert.equal(run('state.page'), 'result');
  assert.equal(run('state.tab'), 'reading');
  assert.equal(run('JSON.stringify(globalThis.started)'), run('JSON.stringify(state.uploads.map(u => u.id))'));
  assert.equal(run('FILES_DATA[0].status'), 'reading');
  assert.equal(run('FILES_DATA[0].tenant'), run('state.tenant'));
});
test('upload screen business division is a dropdown select filtered by UPLOAD_PERMS', () => {
  const run = app();
  /* u2＝読取グループ → アップロードできる業務シーンだけが出る */
  run('state.currentUser = "u2";');
  const html = run('renderUpload()');
  assert.match(html, /業務シーンの選択/);
  assert.doesNotMatch(html, /帳票分類タイプの選択/);
  assert.match(html, /data-tip="アップロード前に業務シーンの選択が必要です/);
  assert.match(html, /アップロード権限のある業務シーンのみ/);
  assert.match(html, /id="upBizSelect"/);
  assert.match(html, /<select class="fld up-biz-select" id="upBizSelect">/);
  assert.equal((html.match(/<option value="b/g) || []).length, run('uploadableBusiness().length'));
  assert.equal(run('state.upBiz'), 'b1');
  assert.match(html, /value="b1" selected/);
  assert.doesNotMatch(html, /value="b2"/); /* 税務は u2 に権限なし */
  assert.doesNotMatch(html, /up-chip|data-upbiz=/);
  /* 税務窓口 u4 なら b2 が見える */
  const taxHtml = run('state.currentUser = "u4"; state.upBiz = "b2"; renderUpload()');
  assert.match(taxHtml, /value="b2" selected/);
  assert.equal(run('canUploadBiz("b2")'), true);
});
test('classification list is the six sample business folders with a per-row menu and empty right pane', () => {
  const run = app();
  run('state.page = "bizScenes"; state.sceneId = null; state.sceneMenu = null');
  const html = run('renderBizScenes()');
  assert.equal(run('BIZ_SCENES.length'), 6);
  for (const n of ['10_住民異動関係', '20_税務関係', '30_保育所等入所の申込手続', '40_児童手当', '50_介護保険関係', '60_高齢者実態調査']) {
    assert.ok(html.includes(n), n);
  }
  assert.match(html, /業務シーン設定/);
  assert.match(html, /placeholder="業務シーンを検索"/);
  assert.match(html, /\+ 業務シーン追加/);
  assert.match(html, /data-scenemenu="cls-jyumin"/);
  /* 未選択時は右ペインを空にする（ガイド／配置モデルは出さない） */
  assert.match(html, /class="type-main scene-empty"/);
  assert.doesNotMatch(html, /guide-card|sceneConfig|配置モデル|guide-lead/);
  // ⋯ メニューは開いた行のみ
  const opened = run('state.sceneMenu = "cls-zeimu"; renderBizScenes()');
  assert.match(opened, /data-scenerename="cls-zeimu"/);
  assert.match(opened, /data-scenedel="cls-zeimu"/);
  assert.doesNotMatch(opened, /data-scenerename="cls-jyumin"/);
});

test('classification forms and business divisions are named after the sample files', () => {
  const run = app();
  assert.equal(run('CLASSIFY_FORMS.length'), 23);
  // 左リストの名称＝samples のフォルダ名、帳票名＝同フォルダ内 PDF のファイル名（拡張子なし）
  assert.equal(run('BIZ_SCENES.map((b) => b.name).join("|")'),
    '10_住民異動関係|20_税務関係|30_保育所等入所の申込手続|40_児童手当|50_介護保険関係|60_高齢者実態調査');
  // 各帳票は必ずどれかの業務シーンに属し、formIds は実在する帳票を指す
  for (const sc of run('BIZ_SCENES')) {
    assert.ok(sc.formIds.length > 0, sc.name);
    assert.ok(sc.formIds.length <= run('MAX_CLASSIFY_FORMS'), sc.name);
    for (const fid of sc.formIds) {
      const f = run(`byId(CLASSIFY_FORMS, ${JSON.stringify(fid)})`);
      assert.ok(f, `${sc.name} -> ${fid}`);
      assert.equal(f.sector, sc.id);
      assert.doesNotMatch(f.name, /\.pdf$/);
    }
  }
  // 帳票の重複所属なし（全 23 件がちょうど 1 回）
  const used = run('BIZ_SCENES.flatMap((b) => b.formIds)');
  assert.equal(used.length, 23);
  assert.equal(new Set(used).size, 23);
  assert.equal(run('BIZ_SCENES.map((b) => b.formIds.length).join(",")'), '3,3,7,4,2,4');
  // 効果テストで使う代表例
  assert.equal(run('byId(CLASSIFY_FORMS, "form-jyumin-a").name'), '10_A団体_住民異動届');
  assert.equal(run('byId(CLASSIFY_FORMS, "form-hoiku-doctor").name'), '03_医師の診断書');
});

test('classification wizard step 1 mirrors prototype fields with a 20-form cap', () => {
  const run = app();
  run('state.page = "bizScenes"; state.sceneId = "cls-jyumin"; state.sceneStep = 1');
  const html = run('renderBizScenes()');
  assert.equal(run('MAX_CLASSIFY_FORMS'), 20);
  assert.match(html, /業務シーン ID/);
  assert.match(html, /2077224056968261701/);
  assert.match(html, /data-scenestep="1"/);
  assert.match(html, /data-scenestep="2"/);
  assert.match(html, /AI分類設定/);
  assert.match(html, /効果テスト/);
  assert.match(html, /選択済み 3\/20/);
  assert.match(html, /id="scAddType"/);
  assert.match(html, /帳票追加/);
  assert.doesNotMatch(html, /分類する帳票/);
  /* 業務シーンのデータ権限選択は廃止（フロー担当は帳票タイプで設定） */
  assert.doesNotMatch(html, /データ権限ユーザー|data-wmsbtn="scUser"|scDept|データ権限部門/);
  assert.match(html, /data-typedel="form-jyumin-a"/);
  assert.match(html, /10_A団体_住民異動届/);
  assert.match(html, /cat-badge/);
  assert.match(html, /保存＆テスト/);
  assert.match(html, /id="scClose"/);
  assert.doesNotMatch(html, /id="scPrev"/);
});

test('classification wizard step 2 runs the effect test and renders ranked results', () => {
  const run = app();
  run('state.page = "bizScenes"; state.sceneId = "cls-zeimu"; state.sceneStep = 2; render = () => {}');
  let html = run('renderBizScenes()');
  assert.match(html, /分類結果/);
  assert.match(html, /ファイルをアップロードすると/);
  assert.match(html, /id="scPickFile"/);
  assert.match(html, /id="scPrev"/);
  assert.match(html, />完成</);
  assert.doesNotMatch(html, /id="scNext"/);
  run('setSceneTestFile("sample.pdf", 20480)');
  html = run('renderBizScenes()');
  assert.match(html, /sample.pdf/);
  assert.match(html, /01_令和8年度分市民税・県民税申告書（兼・国保税申告書）/);
  assert.match(html, /96.0 %/);
  assert.match(html, /scene-result/);
});

test('classification step 1 blocks advancing until name is set', () => {
  const run = app();
  run('globalThis.msgs = []; toast = (m) => globalThis.msgs.push(m);');
  run('globalThis.bad = { id: "x", name: "" }');
  assert.equal(run('validateSceneStep1(globalThis.bad)'), false);
  assert.equal(run('globalThis.msgs[0]'), '業務シーン名を入力してください');
  run('globalThis.bad.name = "テスト"; globalThis.msgs = []');
  assert.equal(run('validateSceneStep1(globalThis.bad)'), true);
  assert.equal(run('validateSceneStep1(byId(BIZ_SCENES, "cls-jyumin"))'), true);
  assert.equal(run('validateSceneStep1(byId(BIZ_SCENES, "cls-korei"))'), true);
});

test('result filter actions show icon search/reset matching mytasks and toggle expand', () => {
  const run = app();
  let html = run('state.filterOpen = false; renderFilters()');
  const actions = html.match(/<div class="result-search-actions[^"]*">[\s\S]*?<\/div>/)[0];
  assert.match(actions, /id="searchBtn"/);
  assert.match(actions, /id="resetBtn"/);
  assert.match(actions, /filter-act/);
  assert.match(actions, /aria-label="検索"/);
  assert.match(actions, /aria-label="リセット"/);
  assert.match(actions, /search-icon/);
  assert.match(actions, /ico i-refresh/);
  assert.match(actions, /<\/svg>検索<\/button>/);
  assert.doesNotMatch(actions, />リセット</);
  assert.match(actions, /data-exp="filter"/);
  assert.match(actions, /もっと見る/);
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 1);
  assert.ok(actions.indexOf('id="searchBtn"') < actions.indexOf('id="resetBtn"'));
  assert.ok(actions.indexOf('id="resetBtn"') < actions.indexOf('data-exp="filter"'));
  /* マイタスク側も同じ正方形アイコンボタン */
  const mt = run('state.page = "myTasks"; renderMyTasks()');
  assert.match(mt, /class="btn primary filter-act" id="mtSearch"/);
  assert.match(mt, /class="btn filter-act" id="mtReset"/);
  assert.match(mt, /id="mtSearch"[\s\S]*?search-icon/);

  html = run('state.filterOpen = true; renderFilters()');
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 3);
  assert.match(html, /閉じる/);
  assert.match(html, /result-filters is-open/);
});
test('result bulk controls and file links are bound to existing demo operations', () => {
  const run = app();
  run(`globalThis.controls = { '#batchRead': {}, '#batchDelete': {} };
    globalThis.fileLink = { dataset: { resultPreview: 'f01' } };
    globalThis.document = { querySelector: (s) => controls[s] || null, querySelectorAll: (s) => s === '[data-result-preview]' ? [fileLink] : [] };
    globalThis.window = { confirm: () => true };
    render = () => {}; toast = () => {};
    globalThis.readIds = [];
    startReRead = (id) => { globalThis.readIds.push(id); };
    visibleFiles = () => FILES_DATA.filter((f) => state.picked[f.id]);
    state.picked = { f01: true }; bindResultPanel(); bindUploadPanel();`);
  assert.equal(run('typeof controls["#batchRead"].onclick'), 'function');
  run('controls["#batchRead"].onclick()');
  assert.equal(run('JSON.stringify(globalThis.readIds)'), '["f01"]');
  assert.equal(run('typeof fileLink.onclick'), 'function');
  run('fileLink.onclick()');
  assert.equal(run('state.reviewId'), 'f01');
  run('state.picked = { f01: true }; controls["#batchDelete"].onclick()');
  assert.equal(run('FILES_DATA.some(f => f.id === "f01")'), false);
});
test('detail action on the result list opens the page preview, not the review screen', () => {
  const run = app();
  run(`state.page = 'result'; state.reviewId = null;
    globalThis.detailBtn = { dataset: { act: 'detail', file: 'f01' } };
    globalThis.document = {
      querySelector: () => null,
      querySelectorAll: (s) => (s === '[data-act][data-file]' ? [globalThis.detailBtn] : []),
    };
    render = () => {};
    bindPaneNav();
    detailBtn.onclick({ stopPropagation() {} });`);
  assert.equal(run('state.pvOpen'), true);
  assert.equal(run('state.pvId'), 'f01');
  assert.equal(run('state.reviewId'), null);
  assert.equal(run('state.page'), 'result');
  /* 一覧の行（FILES_DATA）でもアップロード（state.uploads）でも同じプレビューで引ける */
  assert.equal(run('previewTarget().id'), 'f01');
  assert.ok(JSON.parse(run('Number(byId(FILES_DATA, "f01").pages) > 0')));
  const html = run('renderPreviewModal()');
  assert.match(html, /class="pv-back"/);
  assert.match(html, /class="sheet-title"/);
  assert.match(html, /id="pvClose"/);
  assert.match(html, /id="pvNext"/);
  /* 操作ボタンのバー（ズーム／回転／幅に合わせる／前のページ・次のページのボタン列）は置かない */
  assert.doesNotMatch(html, /modal-foot|modal-head|modal-meta|pvZoomIn|pvZoomOut|pvFit|pvRotL|pvRotR|pvClose2/);
  assert.doesNotMatch(html, /NaN|undefined/);
  /* 1ページだけの帳票では左右の矢印も出さない */
  const onePage = run('state.pvId = "f30"; byId(FILES_DATA, "f30").pages = 1; renderPreviewModal()');
  assert.doesNotMatch(onePage, /pv-nav|id="pvPrev"|id="pvNext"/);
});
test('starting a read clears filters and tree search so the new row is visible in the reading tab', () => {
  const run = app();
  run(`state.page = 'upload';
    state.filters.status = 'failed';
    state.filters.createdTo = '2026-10-14';
    state.q = '住民';
    const u = makeUpload('01_児童手当 認定請求書.pdf', 1024);
    u.status = 'waiting'; u.history = '分類完了';
    state.uploads = [u]; state.upPicked = { [u.id]: true };
    globalThis.document = { querySelector: (s) => s === '#upRead' ? globalThis.upReadBtn : null, querySelectorAll: () => [] };
    globalThis.upReadBtn = {};
    render = () => {}; toast = () => {};
    startReading = () => {};
    bindUploadPanel();
    upReadBtn.onclick();`);
  assert.equal(run('state.page'), 'result');
  assert.equal(run('state.tab'), 'reading');
  assert.equal(run('state.q'), '');
  assert.equal(run('state.filters.status'), '');
  assert.equal(run('state.filters.createdTo'), run('HOME_TO'));
  assert.equal(run('JSON.stringify(state.activeNode)'), '{"type":"all","id":"all"}');
  /* 読取タブで新規行が見えること（既存の読取中ファイルがいてもよい） */
  const visible = JSON.parse(run('JSON.stringify(visibleFiles().map(f => f.id))'));
  const uploads = JSON.parse(run('JSON.stringify(state.uploads.map(u => u.id))'));
  for (const id of uploads) assert.ok(visible.includes(id), id);
});
test('tab counts use the same filters as the table so badges never disagree with rows', () => {
  const run = app();
  const all = JSON.parse(run(`state.page = 'result'; state.q = ''; state.tab = 'all';
    state.filters = { ...defaultFilters(), createdFrom: HOME_FROM, createdTo: HOME_TO };
    JSON.stringify({ rows: visibleFiles().length, badge: Number((renderTabs().match(/data-tab="all"[\\s\\S]*?<span class="n[^"]*">(\\d+)</) || [])[1]) })`));
  assert.ok(all.rows > 0);
  assert.equal(all.badge, all.rows);
  /* 絞り込むと、表の行数とバッジが同じだけ減る（バッジだけ 1 のまま、を防ぐ） */
  const narrowed = JSON.parse(run(`state.filters.status = 'done'; state.tab = 'done';
    JSON.stringify({ rows: visibleFiles().length, badge: Number((renderTabs().match(/data-tab="done"[\\s\\S]*?<span class="n[^"]*">(\\d+)</) || [])[1]) })`));
  assert.equal(narrowed.badge, narrowed.rows);
  assert.ok(narrowed.rows > 0 && narrowed.rows < all.rows);
  /* 検索語も同じ母集団に効く */
  const searched = JSON.parse(run(`state.filters.status = ''; state.q = '児童手当'; state.tab = 'all';
    JSON.stringify({ rows: visibleFiles().length, badge: Number((renderTabs().match(/data-tab="all"[\\s\\S]*?<span class="n[^"]*">(\\d+)</) || [])[1]) })`));
  assert.equal(searched.badge, searched.rows);
  assert.ok(searched.rows < all.rows);
});
test('finishing a read moves to the tab that matches the outcome', () => {
  const run = app();
  run(`state.page = 'result'; state.tab = 'reading'; state.q = '';
    state.filters = { ...defaultFilters(), createdFrom: HOME_FROM, createdTo: HOME_TO };
    globalThis.__timers = [];
    setTimeout = (fn) => { globalThis.__timers.push(fn); return 1; };
    setInterval = () => 1; clearInterval = () => {};
    render = () => {}; toast = () => {};
    Math.random = () => 0.9;              // 0.15 未満で読取失敗になるので、必ず成功させる
    const u = makeUpload('01_児童手当 認定請求書.pdf', 1024);
    u.status = 'reading'; u._proc = true; u.history = '読取処理中（0秒経過）';
    state.uploads = [u];
    promoteUploadToResult(u);
    startReading([u]);
    globalThis.__timers.forEach((fn) => fn());`);
  assert.equal(run('byId(FILES_DATA, state.uploads[0].id).status'), 'done');
  assert.equal(run('state.tab'), 'done');
  assert.equal(
    run('visibleFiles().some(f => f.id === state.uploads[0].id)'),
    true,
  );
});
test('row download icon opens a hover menu with three export formats', () => {
  const run = app();
  run(`
    globalThis.menu = null;
    globalThis.dlCalls = [];
    globalThis.removed = 0;
    downloadResultFile = (id, fmt) => { globalThis.dlCalls.push([id, fmt]); };
    const fakeBtn = (fmt) => ({ dataset: { dlFmt: fmt }, onclick: null });
    globalThis.menuBtns = [fakeBtn('csv'), fakeBtn('json'), fakeBtn('pdf')];
    globalThis.dlAnchor = {
      dataset: { dlmenu: 'f01' },
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 24, height: 24, bottom: 124 }),
    };
    globalThis.box = {
      className: '', innerHTML: '', style: {}, setAttribute() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 190, height: 120 }),
      querySelectorAll: (s) => (s === '[data-dl-fmt]' ? globalThis.menuBtns : []),
      remove() { globalThis.removed += 1; },
    };
    globalThis.document = {
      body: { appendChild: (el) => { globalThis.menu = el; } },
      createElement: () => globalThis.box,
      querySelectorAll: (s) => (s === '[data-dlmenu]' ? [globalThis.dlAnchor] : (s === '.dl-menu' ? [globalThis.box] : [])),
      addEventListener() {},
    };
    globalThis.window = { innerWidth: 1200, innerHeight: 800, addEventListener() {} };
    bindDlMenus();
    dlAnchor.onmouseenter();`);
  const menu = run('globalThis.menu.innerHTML');
  for (const fmt of ['csv', 'json', 'pdf']) assert.match(menu, new RegExp(`data-dl-fmt="${fmt}"`));
  assert.equal((menu.match(/data-dl-fmt=/g) || []).length, 3);
  assert.equal(run('JSON.stringify(DL_FORMATS.map((f) => f[0]))'), '["csv","json","pdf"]');
  assert.equal(run('typeof dlAnchor.onmouseleave'), 'function');
  /* メニュー項目を押すと、その行×その形式でダウンロードが走り、メニューは閉じる */
  run('globalThis.menuBtns[1].onclick({ stopPropagation() {} })');
  assert.equal(run('JSON.stringify(globalThis.dlCalls)'), '[["f01","json"]]');
  assert.equal(run('globalThis.removed > 0'), true);
});

test('the usage-settings pages drop the settings side menu and span the full width', () => {
  const run = app();
  /* 利用設定の各画面は左メニューなしの全幅（辞書登録・辞書監視も同じ扱い） */
  assert.equal(run('JSON.stringify(CFG_NO_SIDEBAR)'), '["users","roles","security","logs","api","dictionary","watch"]');
  /* render() は noSidePane のとき aside を描かず、layout-pane を 1 カラムにする */
  assert.match(source, /const noSidePane = CFG_NO_SIDEBAR\.includes\(route\)/);
  assert.match(source, /isReview \|\| isFullPane \|\| noSidePane \|\| isTypeList\) \? '' : \(isCfg \? renderCfgNav\(\)/);
  assert.match(source, /noSidePane \|\| isTypeList \? 'layout-pane layout-noside' : 'layout-pane'/);
  assert.match(styles, /\.layout-pane\.layout-noside\{grid-template-columns:minmax\(0,1fr\)\}/);
  /* 他の設定画面の左メニューは 3 グループ 8 項目（帳票設定／権限／利用設定＋辞書） */
  const nav = run('renderCfgNav()');
  assert.equal((nav.match(/class="sidenav-item/g) || []).length, 8);
  assert.match(nav, /辞書登録/);
  assert.match(nav, /帳票設定/);
  assert.match(nav, /権限設定/);
  assert.match(nav, /利用設定/);
  /* 帳票権限管理（業務レベル）と 権限設定（システムレベル）は左メニューから別項目で到達できる */
  assert.match(nav, /data-cfgpage="roles"/);
});

test('tree info hint shows one tooltip only: data-tip without a native title', () => {
  const run = app();
  const html = run('renderSidebarPane()');
  const info = html.match(/<span class="info-i"[^>]*>[^<]*<\/span>/);
  assert.ok(info, 'info-i が描画される');
  assert.match(info[0], /data-tip="[^"]*表示名/);
  /* title があるとブラウザ標準のツールチップと二重に出て重なって見える */
  assert.doesNotMatch(info[0], /\btitle=/);
  assert.equal((html.match(/class="info-i"/g) || []).length, 1);
  /* 同じ過ちが他所で起きないよう、ソース全体でも data-tip と title の同居を禁止する */
  assert.deepEqual(source.match(/<[^>]*\bdata-tip=[^>]*\btitle=/g) || [], []);
});

test('hover tooltips are swept from body before rebinding so they never stack up', () => {
  const run = app();
  run(`
    globalThis.stale = { removed: false, remove() { this.removed = true; } };
    globalThis.made = [];
    globalThis.hovered = {
      dataset: { tip: 'ヒント' },
      closest: () => null,
      getBoundingClientRect: () => ({ left: 10, top: 40, width: 12, height: 12, bottom: 52 }),
    };
    globalThis.document = {
      body: { appendChild: (el) => globalThis.made.push(el) },
      createElement: () => ({ className: '', style: { setProperty() {} }, textContent: '', removed: false, remove() { this.removed = true; }, getBoundingClientRect: () => ({ width: 80, height: 20 }) }),
      querySelectorAll: (s) => (s === 'body > .tip' ? [globalThis.stale] : (s === '[data-tip]' ? [globalThis.hovered] : [])),
    };
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    try { bindTips(); } catch (e) { globalThis.err = String(e && e.stack || e); }
  `);
  /* 再描画で mouseleave が飛ばずに残った古いツールチップは、バインド時に必ず消す */
  assert.equal(run('globalThis.err || "no-error"'), 'no-error');
  assert.equal(run('globalThis.stale.removed'), true);
  assert.equal(run('globalThis.made.length'), 0);
  run('globalThis.hovered.onmouseenter()');
  assert.equal(run('globalThis.made.length'), 1);
  assert.equal(run('globalThis.made[0].className'), 'tip');
  assert.equal(run('globalThis.made[0].textContent'), 'ヒント');
  run('globalThis.hovered.onmouseleave()');
  assert.equal(run('globalThis.hovered._tip'), null);
});
test('ticket permission matrix lists every folder (business scene → ticket type) against the three business actions', () => {
  const run = app();
  const html = run('renderPermissions()');
  assert.match(html, /帳票権限管理/);
  assert.match(html, /フォルダ権限（業務シーン → 帳票タイプ）/);
  /* 閲覧 → 修正 → 確認 の順で固定（承認・再承認は 5 状態化で廃止） */
  for (const label of ['閲覧', '修正', '確認']) assert.ok(html.includes(`>${label}<`), label);
  assert.ok(html.indexOf('>閲覧<') < html.indexOf('>修正<'));
  assert.ok(html.indexOf('>修正<') < html.indexOf('>確認<'));
  assert.doesNotMatch(html, />承認<|>再承認</);
  /* 権限の単位はファイルツリーのフォルダ（業務シーン＋帳票タイプ） */
  const nodes = Number(run('BUSINESS.length + CATEGORY.length'));
  assert.equal((html.match(/data-fpermcell="/g) || []).length, nodes * 3);
  assert.equal((html.match(/data-fpermclear="/g) || []).length, nodes);
  assert.match(html, /data-fpermcell="c1:confirm"/);
  assert.match(html, /data-fpermcell="c1:fix"/);
  assert.match(html, /data-fpermclear="c1"/);
  /* 業務シーンの行は配下の帳票タイプにまとめて効く */
  assert.match(html, /data-fpermcell="b1:view"/);
  assert.match(html, /class="fp-row fp-biz"/);
  assert.match(html, /class="fp-row fp-cat"/);
  /* 閲覧／確認はグループチップ（ユーザー直指定もある） */
  assert.match(html, /class="perm-cell"/);
  assert.match(html, /perm-chip grp">住民異動窓口|perm-chip grp">税務窓口/);
  assert.match(html, /perm-empty">—/);
  /* 業務レベルの帳票権限表に、システムレベルのメニュー権限ツリーは同居しない */
  assert.doesNotMatch(html, /data-mpnode/);
});
test('upload permission matrix lists every business scene with upload assignees', () => {
  const run = app();
  const html = run('renderPermissions()');
  assert.match(html, /アップロード権限（業務シーン単位）/);
  const bizCount = Number(run('BUSINESS.length'));
  assert.equal((html.match(/data-uploadcell="/g) || []).length, bizCount);
  assert.equal((html.match(/data-uploadclear="/g) || []).length, bizCount);
  assert.match(html, /data-uploadcell="b1"/);
  assert.match(html, /data-uploadclear="b2"/);
  const up = JSON.parse(run('JSON.stringify(UPLOAD_PERMS)'));
  assert.equal(Object.keys(up).length, bizCount);
  Object.values(up).forEach((list) => {
    assert.ok(list.every((id) => /^([gu]\d+)$/.test(id)), 'upload targets are group or user ids');
  });
  assert.equal(run('canUploadBiz("b1", "u2")'), true);
  assert.equal(run('canUploadBiz("b2", "u2")'), false);
  assert.equal(run('canUploadBiz("b2", "u4")'), true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(uploadableBusiness("u2").map((b) => b.id))')), ['b1', 'b3', 'b4', 'b6']);
});
test('ticket permissions assign groups and users for business actions', () => {
  const run = app();
  assert.equal(run('typeof GROUPS'), 'object');
  assert.ok(run('GROUPS.length') >= 1);
  const perms = JSON.parse(run('JSON.stringify(TICKET_PERMS)'));
  Object.values(perms).forEach((p) => {
    for (const k of ['view', 'confirm', 'approve', 'reapprove']) {
      assert.ok(p[k].every((id) => /^([gu]\d+)$/.test(id)), `${k} must be group or user ids`);
    }
  });
  assert.ok(Object.values(perms).some((p) => p.confirm.some((id) => /^g\d+$/.test(id))), 'some confirms use groups');
  const html = run('renderPermissions()');
  assert.match(html, /帳票権限管理/);
  assert.match(source, /groupMemberIds|GROUPS/);
  assert.match(source, /pickRandomAssignee/);
});
test('system-level menu permissions and business-level ticket permissions stay in separate tables', () => {
  const run = app();
  const leaves = JSON.parse(run('JSON.stringify(MENU_LEAVES)'));
  assert.ok(leaves.length >= 10);
  assert.equal(JSON.parse(run('JSON.stringify(MENU_PERMS.R1)')).length, leaves.length);
  /* メニュー権限はロール（システムレベル）に紐づく */
  const menuKeys = Object.keys(JSON.parse(run('JSON.stringify(MENU_PERMS)')));
  const roleIds = JSON.parse(run('JSON.stringify(ROLES.map((r) => r.id))'));
  menuKeys.forEach((k) => assert.ok(roleIds.includes(k), k));
  /* 帳票権限は帳票タイプ（業務レベル）に紐づく */
  const ticketKeys = Object.keys(JSON.parse(run('JSON.stringify(TICKET_PERMS)')));
  const layoutIds = JSON.parse(run('JSON.stringify(LAYOUT.map((l) => l.id))'));
  assert.ok(ticketKeys.length >= 8);
  ticketKeys.forEach((k) => assert.ok(layoutIds.includes(k), k));
  assert.ok(ticketKeys.every((k) => !menuKeys.includes(k)), 'the two tables share no keys');
  /* アップロード権限は業務シーン単位（メニュー／帳票タイプとキーが重ならない） */
  const uploadKeys = Object.keys(JSON.parse(run('JSON.stringify(UPLOAD_PERMS)')));
  const bizIds = JSON.parse(run('JSON.stringify(BUSINESS.map((b) => b.id))'));
  uploadKeys.forEach((k) => assert.ok(bizIds.includes(k), k));
  assert.ok(uploadKeys.every((k) => !menuKeys.includes(k) && !ticketKeys.includes(k)));
  /* 権限設定（ロール一覧）に帳票権限セルは出ない／帳票権限表にメニュー権限は出ない */
  assert.doesNotMatch(run('renderRoles()'), /data-permcell/);
  assert.match(source, /function bindPermDialogs\(/);
  assert.match(source, /bindDlMenus\(\);\s*\n\s*bindPermDialogs\(\);/);
});
test('role form dialog creates and edits a permission with the four reference fields', () => {
  const run = app();
  let html = run("state.permForm = { mode: 'new', id: null, name: '', code: '', desc: '', status: '有効' }; roleFormDialog()");
  assert.match(html, /新規権限作成/);
  for (const id of ['permFormName', 'permFormCode', 'permFormDesc', 'permFormStatus', 'permFormOk', 'permFormCancel', 'permFormClose', 'permFormBack']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, />権限名</);
  assert.match(html, />権限ID</);
  assert.match(html, />概要</);
  assert.match(html, />ステータス</);
  assert.match(html, /lbl req/);                       // 必須項目のマーク
  assert.match(html, /placeholder="権限名を入力してください"/);
  assert.match(html, /class="tgl /);                   // 有効＝ON
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /class="modal perm-modal"/);

  html = run("state.permForm = { mode: 'edit', id: 'R2', name: '承認者', code: 'APPROVER', desc: '承認する', status: '無効' }; roleFormDialog()");
  assert.match(html, /権限編集/);
  assert.match(html, /value="承認者"/);
  assert.match(html, /value="APPROVER"/);
  assert.match(html, /承認する/);
  assert.match(html, /class="tgl off"/);               // 無効＝OFF
  assert.match(html, /aria-checked="false"/);
  assert.equal(run('state.permForm = null; roleFormDialog()'), '');
});
test('menu permission dialog renders the reachability tree with parent-child cascade', () => {
  const run = app();
  let html = run("state.menuPerm = { roleId: 'R1', checked: MENU_LEAVES.slice(), closed: [] }; menuPermDialog()");
  assert.match(html, /メニュー権限/);
  assert.match(html, /id="menuPermBack"/);
  assert.match(html, /id="mpTree"/);
  assert.match(html, /class="mptree"/);
  assert.match(html, /data-mpnode="llm-ocr"/);
  assert.match(html, /data-mpnode="settings-type"/);
  assert.match(html, /data-mpnode="permissions-menu"/);
  assert.match(html, /data-mptoggle="settings"/);
  /* 帳票タイプ／業務シーンの細粒度＋読取結果のボタン権限＋辞書 */
  assert.match(html, /data-mpnode="settings-type-add"/);
  assert.match(html, /data-mpnode="settings-scenes-add"/);
  assert.match(html, /data-mpnode="usage-users"/);
  assert.match(html, /data-mpnode="op-confirm"/);
  assert.match(html, /data-mpnode="usage-dict"/);
  assert.match(html, /業務シーン追加|タイプ追加|ユーザー管理/);
  assert.doesNotMatch(html, /AI画像処理|外部API|業務区分追加|部門照会|グループ照会|帳票分類/);
  /* 権限名／権限ID は読み取り専用のチップ */
  assert.match(html, /class="mp-idchip"/);
  assert.ok((html.match(/checked/g) || []).length >= 10);
  for (const id of ['menuPermOk', 'menuPermCancel', 'menuPermClose']) assert.ok(html.includes(`id="${id}"`), id);

  html = run("state.menuPerm.closed = ['settings']; menuPermDialog()");
  assert.doesNotMatch(html, /data-mpnode="settings-type"/);      // 折りたたみ中は子を出さない
  assert.match(html, /mpcaret ico i-caret-down closed/);

  /* 親は配下リーフの部分選択で半選択になり、子へ一括反映する */
  assert.match(source, /cb\.indeterminate = on > 0 && on < leaves\.length/);
  assert.match(source, /MENU_PERMS\[m\.roleId\] = \[\.\.\.syncOpFixConfirm\(m\.checked\)\]/);
  assert.equal(run('state.menuPerm = null; menuPermDialog()'), '');
});

test('user management lists users with belonging groups', () => {
  const run = app();
  run('state.page = "users"');
  const html = run('renderUsers()');
  assert.match(html, /ユーザー管理/);
  assert.match(html, /佐藤 美子|田中 実|中村 美咲/);
  assert.match(html, /所属グループ/);
  assert.doesNotMatch(html, /group-panel|groupTreeQ|所属部門/);
  assert.doesNotMatch(html, /確認／承認の担当は帳票タイプ/);
});
test('root group selection covers every user in the organisation', () => {
  const run = app();
  run('state.page = "users"; state.userGroupFocus = ROOT_GROUP_ID');
  const html = run('renderUsers()');
  /* 配下すべてのグループに入っているユーザー数（＝組織全体） */
  const n = run('ENT_USERS.filter((u) => new Set(GROUPS.flatMap((g) => g.userIds || [])).has(u.uid)).length');
  assert.match(html, new RegExp(`所属人数: ${n}人（組織全体）`));
  assert.ok((html.match(/is-in-scope/g) || []).length >= 1, '配下グループが選択に含まれていない');
  /* 一覧の行数も組織全体の人数と一致する（直属だけを出すと足りない） */
  assert.equal((html.match(/data-usertoggle=/g) || []).length, n);
  assert.doesNotMatch(html, /このグループに直属のユーザーはいません/);
});
test('ticket permission cell dialog picks groups for one action', () => {
  const run = app();
  const html = run("state.permCell = { kind: 'ticket', layoutId: 'l1', act: 'confirm' }; permCellDialog()");
  assert.match(html, /帳票権限の設定/);
  assert.match(html, /id="permCellBack"/);
  assert.match(html, /帳票タイプ/);
  assert.match(html, /業務操作/);
  assert.match(html, /class="accent">確認</);
  assert.match(html, /修正したうえで確認済みにする/);
  /* データ権限はグループ単位（所属ユーザー全員が対象） */
  assert.match(html, /グループ/);
  assert.match(html, /data-permpick="g:g1" checked/);
  assert.doesNotMatch(html, /data-permpick="u:u1"/);
  for (const id of ['permCellOk', 'permCellCancel', 'permCellClose']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(source, /document\.querySelectorAll\('\[data-fpermcell\]'\)/);
  assert.match(source, /state\.permCell = \{ kind: 'folder', nodeId, act \}/);
  assert.equal(run('state.permCell = null; permCellDialog()'), '');
});
test('permission dialogs and chips are styled in the shared stylesheet', () => {
  assert.match(styles, /\.perm-modal\{[^}]*width:min\(600px/);
  assert.match(styles, /\.perm-modal\.mp-modal\{[^}]*width:min\(760px/);
  assert.match(styles, /\.perm-row\{[^}]*grid-template-columns:\s*104px/);
  assert.match(styles, /\.perm-row > \.lbl\.req::before\{/);
  assert.match(styles, /\.tgl\.off\{/);
  assert.match(styles, /\.mptree\{/);
  assert.match(styles, /\.mpcaret\.closed\{/);
  assert.match(styles, /\.perm-cell:hover\{/);
  assert.match(styles, /\.perm-chip\.grp\{/);
  assert.match(styles, /\.perm-chip\.role\{/);
  assert.match(styles, /\.perm-chip\.usr\{/);
  assert.match(styles, /\.perm-pick-cols\{[^}]*repeat\(2,/);
  assert.match(styles, /\.perm-target\{/);
});
test('ticket permissions are the single source of truth for the approval flow', () => {
  const run = app();
  const layouts = JSON.parse(run('JSON.stringify(LAYOUT.map((l) => l.id))'));
  const perms = JSON.parse(run('JSON.stringify(TICKET_PERMS)'));
  /* 帳票タイプ全件が権限表に載っている（欠けると「誰も操作できない」帳票になる） */
  layouts.forEach((id) => assert.ok(perms[id], `missing permission row: ${id}`));
  Object.keys(perms).forEach((id) => assert.ok(layouts.includes(id), `unknown layout in permission table: ${id}`));

  const rows = JSON.parse(run(`JSON.stringify(LAYOUT.map((l) => {
    const a = approvalOf(l.id);
    return { id: l.id, need: a.need, stages: a.stages, view: a.viewGroups, confirm: a.confirmGroups, approve: a.approveGroups, reapprove: a.reapproveGroups, exp: a.exportGroups };
  }))`));
  rows.forEach((r) => {
    const p = perms[r.id];
    /* 担当は権限表そのもの。承認フロー側で二重管理しない */
    assert.deepEqual([...r.view], [...p.view], `${r.id}.view`);
    assert.deepEqual([...r.confirm], [...p.confirm], `${r.id}.confirm`);
    assert.deepEqual([...r.approve], [...p.approve], `${r.id}.approve`);
    assert.deepEqual([...r.reapprove], [...p.reapprove], `${r.id}.reapprove`);
    /* 承認段数は「再承認に担当が入っているか」から導出（1 段目＝承認／2 段目＝再承認） */
    assert.equal(r.stages, r.need ? (p.reapprove.length ? 2 : 1) : 0, `${r.id} stages`);
    /* 承認を使う帳票は承認担当が必ずいる */
    if (r.need) assert.ok(p.approve.length > 0, `${r.id} needs an approver`);
    /* 承認不要の帳票は承認／再承認を持たない */
    if (!r.need) assert.equal(p.approve.length + p.reapprove.length, 0, `${r.id} must not have approvers`);
    /* 出力は承認担当（承認不要なら確認担当）に付随する */
    assert.deepEqual([...r.exp], p.approve.length ? [...p.approve] : [...p.confirm], `${r.id}.export`);
  });
  /* 承認フロー設定（カテゴリ単位）は「承認を使うか」だけを持つ */
  const cfgBlock = source.match(/const APPROVAL_CONFIG = \{[\s\S]*?\n\};/)[0];
  assert.doesNotMatch(cfgBlock, /confirmGroups|approveGroups|exportGroups|stages/);
  assert.match(cfgBlock, /c7: \{ need: false \}/);
  /* 承認要否はカテゴリポリシー×段の担当から導出（担当の実体は帳票権限表） */
  assert.match(source, /const need = base\.need !== false && stageLists\.some\(\(x\) => \(x \|\| \[\]\)\.length\)/);
  /* 段数は「担当が入っている段の数」（可変 N 段） */
  assert.match(source, /const stages = need \? stageLists\.filter\(\(x\) => \(x \|\| \[\]\)\.length\)\.length : 0/);
  /* N 段承認では、次の担当が「済んだ段数」で切り替わる */
  assert.match(source, /function approversFor\(f, cfg\)/);
  assert.match(source, /const idx = Math\.min\(done, lists\.length - 1\)/);
  assert.match(source, /return lists\[idx\] \|\| lists\[0\] \|\| \[\]/);
  /* フロー担当はグループ展開後のユーザー照合 */
  assert.match(source, /currentUser: 'u1'/);
  assert.match(source, /assigneeUserIds\(ids\)\.includes\(me\)/);
  assert.match(source, /function pickRandomAssignee/);
  /* シードはグループ（g*）またはユーザー（u*） */
  assert.ok(Object.values(perms).every((p) => p.confirm.every((id) => /^([gu]\d+)$/.test(id))), 'confirm is group or user');
  assert.ok(Object.values(perms).every((p) => p.approve.every((id) => /^([gu]\d+)$/.test(id))), 'approve is group or user');
  assert.ok(Object.values(perms).every((p) => p.reapprove.every((id) => /^([gu]\d+)$/.test(id))), 'reapprove is group or user');
  /* グループ／ユーザーは同一操作で混在しない（2 択） */
  Object.entries(perms).forEach(([id, p]) => {
    for (const k of ['view', 'confirm', 'approve', 'reapprove']) {
      const hasG = p[k].some((x) => /^g\d+$/.test(x));
      const hasU = p[k].some((x) => /^u\d+$/.test(x));
      assert.equal(hasG && hasU, false, `${id}.${k} mixes group and user`);
    }
  });
});

test('ticket type step1 configures the description; approval flow lives in the permission page', () => {
  const run = app();
  run('state.page = "ticketDetail"; state.typeId = "T1"; state.typeStep = 1');
  const html = run('renderTicketDetail()');
  assert.match(html, /説明文/);
  assert.match(html, /id="tpDesc"/);
  assert.match(html, /wiz-ta-actions/);
  assert.match(html, /id="tpDescAi"/);
  assert.match(html, /id="tpDescClear"/);
  assert.match(html, /id="tpCount"/);
  assert.doesNotMatch(html, /wiz-ta-foot/);
  /* 承認フロー／担当の割当は帳票権限管理へ集約（ここでは出さない） */
  assert.doesNotMatch(html, /承認フロー|data-tp-stage|承認担当（1段目）/);
  /* 左リスト＋右 Step1（帳票設定-タイプ） */
  assert.match(html, /帳票設定-タイプ/);
  assert.match(html, /タイプを検索|\+ タイプ追加|type-list-title/);
  assert.match(html, /data-typeid="T1"/);
  assert.doesNotMatch(html, /typedetail-solo/);
  assert.equal(run('layoutIdOfTicketType(byId(TICKET_TYPES, "T1"))'), 'l1');
});

test('security settings keep only the three modules from the design', () => {
  const run = app();
  const html = run('renderSecurity()');

  /* 3 モジュールだけ（データ保存期限／IPアドレスホワイトリスト／アイドルセッション） */
  assert.equal((html.match(/class="sec-card"/g) || []).length, 3);
  for (const t of ['データ保存期限設定', 'IPアドレスホワイトリスト設定', 'アイドルセッション設定']) {
    assert.ok(html.includes(t), t);
  }
  /* 見出しの右に設定コントロール（select）を置く。カードごとに 1 つ */
  assert.equal((html.match(/class="sec-head"/g) || []).length, 3);
  assert.equal((html.match(/class="fld sec-ctl" data-sec=/g) || []).length, 3);
  /* 説明文は全カード共通の注記ボックス（見た目を揃える） */
  assert.equal((html.match(/class="cfg-note"/g) || []).length, 4);
  assert.doesNotMatch(html, /sec-hint/);
  assert.deepEqual(JSON.parse(run(`JSON.stringify(Object.keys(SECURITY).filter((k) => k !== 'logs'))`)), ['retention', 'ipEnabled', 'idle']);

  /* 廃止したモジュールが残っていないこと */
  assert.doesNotMatch(html, /二要素|多要素|MFA|二段階|IPアドレスを追加|id="ipInput"|id="ipAddBtn"|data-ipdel/);
  assert.doesNotMatch(source, /mfaEnabled|mfaMethod|ipList|ipAddBtn|data-ipdel|SECURITY\.logs\.push/);

  /* 選択肢は設計どおり */
  assert.match(html, /data-sec="retention"[\s\S]*?7日[\s\S]*?14日[\s\S]*?1ヶ月[\s\S]*?2ヶ月[\s\S]*?3ヶ月[\s\S]*?6ヶ月[\s\S]*?12ヶ月/);
  assert.match(html, /data-sec="ipEnabled"[\s\S]*?無効[\s\S]*?有効/);
  assert.match(html, /data-sec="idle"[\s\S]*?15分[\s\S]*?30分[\s\S]*?60分[\s\S]*?2時間[\s\S]*?制限なし/);
  /* 既定値 */
  assert.equal(run('SECURITY.retention'), '12ヶ月');
  assert.equal(run('SECURITY.ipEnabled'), '無効');
  assert.equal(run('SECURITY.idle'), '制限なし');
  /* 保存／閉じる */
  assert.match(html, /id="secSave"/);
  assert.match(html, /id="secClose"/);
  assert.match(source, /const secClose = \$\('#secClose'\)/);

  /* スタイル：1 カラムのカード、見出し行は左右に振り分け。IP 追加 UI のスタイルは削除済み */
  assert.match(styles, /\.sec-grid\{display:grid;grid-template-columns:1fr/);
  assert.match(styles, /\.sec-head\{display:flex;align-items:center;justify-content:space-between/);
  assert.match(styles, /\.sec-inline\{/);
  assert.match(styles, /\.sec-ctl\{/);
  assert.doesNotMatch(styles, /\.ip-list|\.ip-add/);
});

test('departments are gone: groups, users and history are organised without them', () => {
  const run = app();

  /* 部門マスタ自体が存在しない */
  assert.equal(run('typeof DEPTS'), 'undefined');
  assert.equal(run('typeof deptName'), 'undefined');
  assert.doesNotMatch(source, /DEPTS|deptName|deptOfUser|HISTORY_DEPTS/);

  /* ユーザーは部門を持たない（所属はロールグループで表現する） */
  const users = JSON.parse(run('JSON.stringify(USERS)'));
  users.forEach((u) => assert.equal('dept' in u, false, u.id));
  const ent = JSON.parse(run('JSON.stringify(ENT_USERS)'));
  ent.forEach((u) => assert.equal('dept' in u, false, u.id));

  /* 部門は廃止。ユーザーグループ（担当ロール）は残す */
  assert.equal(run('typeof GROUPS'), 'object');
  assert.ok(run('GROUPS.length') >= 1);

  /* 業務シーンに部門権限はない（データ権限 UI も削除済み） */
  const scenes = JSON.parse(run('JSON.stringify(BIZ_SCENES)'));
  scenes.forEach((sc) => assert.equal('deptIds' in sc, false, sc.id));
  const sceneHtml = run('state.page = "bizScenes"; state.sceneId = "cls-jyumin"; state.sceneStep = 1; renderBizScenes()');
  assert.doesNotMatch(sceneHtml, /データ権限ユーザー/);

  /* ご利用履歴にも部門の絞り込み・列は無い */
  const hist = JSON.parse(run('JSON.stringify(HISTORY.slice(0, 5))'));
  hist.forEach((h) => assert.equal('dept' in h, false, h.reqId));
  const home = run('renderHome()');
  assert.doesNotMatch(home, /data-hopt="hDept"|>部門</);
  assert.match(home, /data-hopt="hBiz"/);
  assert.doesNotMatch(source, /'ユーザー', '部門'\]/);

  /* ユーザー管理は部門なし。所属グループ（担当ロール）は表示する */
  const usersHtml = run('renderUsers()');
  assert.doesNotMatch(usersHtml, /所属部門|部門情報/);
  assert.match(usersHtml, /所属グループ|ユーザー名/);
});

test('demo actor switcher lets you change currentUser from the header menu', () => {
  const run = app();
  assert.equal(run('DEMO_ACTORS.length'), 9);
  assert.deepEqual(JSON.parse(run('JSON.stringify(DEMO_ACTORS.map((a) => a.id))')), ['u1', 'u3', 'u8', 'u7', 'u6', 'u5', 'u2', 'u10', 'u4']);
  /* 既定はシステム管理者 u1 */
  assert.equal(run('state.currentUser'), 'u1');
  assert.equal(run('currentProfile().name'), '佐藤 一郎');
  assert.match(run('currentProfile().hint'), /全メニュー/);
  /* 切替後はプロフィール名が変わる */
  assert.equal(run('state.currentUser = "u4"; currentProfile().name'), '田中 実');
  assert.equal(run('state.currentUser = "u8"; currentProfile().name'), '中村 亮');
  assert.equal(run('state.currentUser = "u1"; currentProfile().name'), '佐藤 一郎');
  assert.equal(run('currentProfile().roleLabel'), 'システム管理者');
  assert.match(run('currentProfile().hint'), /全メニュー/);
  /* ソースにデモ切替 UI／ハンドラがある */
  assert.match(source, /data-demo-actor/);
  assert.match(source, /デモ：担当者を切替え/);
  assert.match(source, /demo-badge/);
});
test('tenant admin role bypasses ticket and upload permission tables', () => {
  const run = app();
  assert.equal(run('TENANT_ADMIN_ROLE'), 'R1');
  assert.equal(run('byId(ROLES, "R1").name'), 'システム管理者');
  assert.equal(run('isTenantAdmin("u1")'), true);
  assert.equal(run('isTenantAdmin("u2")'), false);
  /* メニュー全到達 */
  assert.equal(run('MENU_PERMS.R1.length'), run('MENU_LEAVES.length'));
  /* アップロード：権限表に無い業務シーンも可 */
  assert.equal(run('canUploadBiz("b2", "u1")'), true);
  assert.equal(run('uploadableBusiness("u1").length'), run('BUSINESS.length'));
  /* 帳票操作：管理者は担当外のタイプでも可 */
  assert.equal(run('canTicketAct("l4", "confirm", "u1")'), true);
  /* マイタスク照合もバイパス */
  assert.equal(run('state.currentUser = "u1"; userInGroups([])'), true);
  assert.equal(run('state.currentUser = "u2"; userInGroups([])'), false);
  const html = run('renderPermissions()');
  assert.match(html, /システム管理者/);
});

test('ticket permission table gates confirm per layout', () => {
  const run = app();
  /* l4 の確認担当は g4（u3/u4）。u2 は担当外なので不可、u3 は可。 */
  assert.equal(run('canTicketAct("l4", "confirm", "u2")'), false);
  assert.equal(run('canTicketAct("l4", "confirm", "u3")'), true);
  /* 担当が未設定の行は全体の操作権限にフォールバック（view は従来どおり） */
  assert.equal(run('TICKET_PERMS.l4.confirm = []; canTicketAct("l4", "confirm", "u3")'), run('userHasOp("confirm", "u3")'));
});

test('自動アップロード: 監視パスと帳票タイプ別ルールの 5 セクションを描画する', () => {
  const run = app();
  const html = run('renderWatch()');
  const heads = [...html.matchAll(/class="watch-sec-head">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(heads, ['監視パス', '帳票タイプ別ルール', '二重取込防止', '失敗時の再実行', 'エラー通知']);
  /* 監視設定は 1 つだけ（一覧・追加・削除は持たない） */
  assert.doesNotMatch(html, /監視設定を追加|data-watchadd|data-watchdel|data-watchedit/);

  /* 監視パス：1 行＝1 パス。行ごとに有効／無効のトグルと処理後のファイルを持つ */
  assert.equal((html.match(/class="wr-root/g) || []).length, run('WATCH.roots.length'));
  assert.equal((html.match(/data-wrooton=/g) || []).length, run('WATCH.roots.length'));
  assert.equal((html.match(/data-wroot-path=/g) || []).length, run('WATCH.roots.length'));
  assert.match(html, /data-wrootadd/);
  assert.match(html, /監視パスを追加/);
  assert.doesNotMatch(html, /data-wroot-tenant=|>テナント</);
  assert.match(html, /data-wroot-path=/);
  assert.match(html, /data-wroot-after=/);
  assert.match(html, /処理後のファイル/);

  /* 帳票タイプ別ルール：帳票タイプ（ツリー第2階層）1 行。フォルダ名・ファイル名・自動取込 */
  assert.equal(run('CATEGORY.length'), 9);
  assert.equal((html.match(/class="wr-rule/g) || []).length, run('CATEGORY.length'));
  assert.equal((html.match(/data-wruleon=/g) || []).length, run('CATEGORY.length'));
  for (const t of ['帳票タイプ', 'フォルダ名', 'ファイル名', '監視対象']) {
    assert.ok(html.includes(t), t);
  }
  assert.match(html, /data-wrule-folder=/);
  assert.match(html, /data-wrule-pattern=/);
  /* 処理開始・大小区別は削除済み */
  assert.doesNotMatch(html, /処理開始|大小区別|data-wrule-start|data-wrule-case/);
  const ruleRow = (html.match(/<tr class="wr-rule[\s\S]*?<\/tr>/) || [])[0] || '';
  assert.equal((ruleRow.match(/<td/g) || []).length, 4);

  /* 業務シーンの階層は作らない（帳票タイプをそのまま並べる） */
  assert.doesNotMatch(html, /data-wf="biz"|data-wf="pattern"|data-wf="startFile"|data-wf="afterDir"/);
  assert.equal((html.match(/class="wr-group"/g) || []).length, 0);
  assert.equal((html.match(/class="wr-rule/g) || []).length, run('CATEGORY.length'));

  /* 実際に監視する本数＝有効ルート × 有効カテゴリ */
  assert.match(html, /監視対象 <b>\d+<\/b> 本/);
  assert.equal(run('WATCH.roots.filter((r) => r.on).length * WATCH.rules.filter((r) => r.on).length'), 18);

  /* 共通設定（メール通知・宛先メール・通知方法の選択は廃止。Webhook URL を直接入力） */
  for (const t of ['同一ファイルを除外', '再実行回数', 'Webhook URL']) {
    assert.ok(html.includes(t), t);
  }
  assert.doesNotMatch(html, /宛先メール|data-wf="notifyMail"|通知方法|data-wf-check/);
  /* ログ設定はログ設定ページへ移した */
  assert.doesNotMatch(html, /data-wf="logLevel"|data-wf="logPath"|ログ<\/h3>/);
});

test('自動アップロード: 監視パスごとに処理後のファイル（削除／そのまま）を選べる', () => {
  const run = app();
  const html = run('renderWatch()');
  assert.equal((html.match(/data-wroot-after=/g) || []).length, run('WATCH.roots.length'));
  assert.match(html, /<option value="del"[^>]*>削除<\/option>/);
  assert.match(html, /<option value="keep"[^>]*>そのまま<\/option>/);
  assert.doesNotMatch(html, /data-wroot-done=|処理済フォルダ|data-wf-radio/);
  assert.equal((html.match(/class="watch-sec"/g) || []).length, 5);
  /* 選択値は行ごとに保持される */
  run('WATCH.roots[0].after = "del"; WATCH.roots[1].after = "keep";');
  const h2 = run('renderWatch()');
  assert.match(h2, /data-wroot-after="r1"[\s\S]*?<option value="del" selected/);
  assert.match(h2, /data-wroot-after="r2"[\s\S]*?<option value="keep" selected/);
  /* 保存時にフォルダ名の重複を弾く */
  run('WATCH.rules[0].folder = WATCH.rules[1].folder;');
  assert.equal(run('WATCH.rules.filter((r) => r.on).map((r) => r.folder.trim().toLowerCase()).filter((n, i, a) => a.indexOf(n) !== i).length'), 1);
});

test('エラー通知: 通知方法の選択は持たず、Webhook URL を直接入力する', () => {
  const run = app();
  const html = run('renderWatch()');
  assert.match(html, /Webhook URL/);
  assert.match(html, /data-wf="notifyUrl"/);
  assert.doesNotMatch(html, /通知方法|data-wf-check/);
  assert.doesNotMatch(html, /data-wf="notifyMail"|宛先メール|>メール</);
});

test('ログ設定: 出力設定（詳細度・保存先）はログ画面に持つ', () => {
  const run = app();
  const html = run('renderLogs()');
  assert.match(html, /log-cfg/);
  assert.match(html, /data-logcfg="level"/);
  assert.match(html, /data-logcfg="path"/);
  assert.match(html, /data-logsave/);
  for (const t of ['詳細度', '保存先', 'ログ出力設定']) assert.ok(html.includes(t), t);
  /* ログの閲覧テーブルは残っている */
  assert.match(html, /操作日時/);
  assert.equal((html.match(/<tr>/g) || []).length, run('SECURITY.logs.length') + 1);
});

test('ユーザー権限: 個人の権限はグループの権限に上乗せされる（和集合）', () => {
  const run = app();
  /* u5 は承認者グループ（R4）のみ → 確認はできない */
  assert.equal(run('userHasOp("confirm","u5")'), false);
  run('entUserByUid("u5").soloPermIds = ["R3"]');
  /* 個人に R3 を足すと、グループの R4 と合わせて確認ができる */
  assert.equal(run('userHasOp("confirm","u5")'), true);
  assert.deepEqual(JSON.parse(run('JSON.stringify(rolesOfUser("u5"))')), ['R4', 'R3']);
  run('entUserByUid("u5").soloPermIds = []');
  assert.equal(run('userHasOp("confirm","u5")'), false);
});

test('読取ロール: 再読取・一括読取・アップロード画面の読取／削除が出る', () => {
  const run = app();
  /* u7 に R5（アップロード）＋R8（読取）を注入して「読取ロール」の挙動を検証（既定は R5 のみ） */
  run('entUserByUid("u7").soloPermIds = ["R5", "R8"]; state.currentUser = "u7";');
  const cell = run('resultActionsCell({ id: "f1", status: "done", layout: "l1" })');
  assert.match(cell, /data-act="redo"/);
  assert.match(cell, /data-act="delete"/);
  assert.doesNotMatch(cell, /data-act="fix"/);
  assert.doesNotMatch(cell, /data-act="confirm"/);
  assert.doesNotMatch(cell, /data-dlmenu=/);
  /* 一覧のツールバーに一括読取（未選択でも押せて、押すと選択を促す） */
  run('state.page = "result"; state.tab = "all"; state.resultPage = 1;');
  const table = run('renderTable()');
  assert.match(table, /class="btn sm primary" id="batchRead"/);
  assert.doesNotMatch(table, /id="batchRead" disabled/);
  assert.match(table, /id="batchDelete"/);
  /* アップロード済ファイルの読取と削除 */
  const up = run('state.page = "upload"; renderUpload()');
  assert.match(up, /id="upRead"/);
  assert.match(up, /id="upDel"/);
  /* 読取はできるが確認はできない */
  assert.equal(run('userHasOp("redo","u7")'), true);
  assert.equal(run('userHasOp("read","u7")'), true);
  assert.equal(run('userHasOp("delete","u7")'), true);
  assert.equal(run('userHasOp("confirm","u7")'), false);
  assert.equal(run('userHasOp("export","u7")'), false);
});

test('アップロードロール: u7 既定はアップロードのみ（閲覧・読取・削除は出ない）', () => {
  const run = app();
  /* 既定の u7 は R5（アップロード）だけ。R8（読取）は付けない */
  run('entUserByUid("u7").soloPermIds = ["R5"]; state.currentUser = "u7";');
  assert.equal(run('userHasOp("upload", "u7")'), true);
  assert.equal(run('userHasOp("view", "u7")'), false);
  assert.equal(run('userHasOp("read", "u7")'), false);
  assert.equal(run('userHasOp("delete", "u7")'), false);
  assert.equal(run('userHasOp("confirm", "u7")'), false);
  assert.equal(run('userHasOp("export", "u7")'), false);
  /* デモ切替バーは「アップロード」だけ表示される */
  const caps = JSON.parse(run('JSON.stringify((function(){'
    + 'const CAPS=[["view","閲覧"],["upload","アップロード"],["read","読取"],["fix","修正"],["confirm","確認"],["export","出力"],["delete","削除"],["settings","設定"]];'
    + 'return CAPS.filter(([k])=>{try{return userHasOp(k,"u7");}catch(e){return false;}}).map(([,t])=>t);})())'));
  assert.deepEqual(caps, ['アップロード']);
});

test('出力ロール: ダウンロードと一括ダウンロードだけが出る', () => {
  const run = app();
  run('state.currentUser = "u10";');
  const cell = run('resultActionsCell({ id: "f1", status: "done", layout: "l1" })');
  assert.match(cell, /data-dlmenu="f1"/);
  assert.doesNotMatch(cell, /data-act="redo"|data-act="fix"|data-act="confirm"|data-act="delete"/);
  run('state.page = "result"; state.tab = "all"; state.resultPage = 1;');
  const table = run('renderTable()');
  assert.match(table, /id="batchExport"/);
  assert.doesNotMatch(table, /id="batchRead"/);
  assert.equal(run('userHasOp("export","u10")'), true);
  assert.equal(run('userHasOp("read","u10")'), false);
  assert.equal(run('userHasOp("confirm","u10")'), false);
});

test('ユーザー編集: 権限はドロップダウンで複数選択でき、グループ継承分は別に表示する', () => {
  const run = app();
  run('USER_ADD_DRAFT = { mode:"edit", id:"U5", uid:"u5", name:"伊藤 由美", email:"yumi.ito@itso.co.jp", soloPermIds:["R3"], status:"有効" };');
  const html = run('renderUserAddDialog()');
  /* 個人の権限は複数選択のドロップダウン（旧：読み取り専用のテキスト／単一セレクト／チップ） */
  assert.doesNotMatch(html, /id="userAddRole"/);
  assert.doesNotMatch(html, /data-userperm/);
  assert.match(html, /data-msbtn="uaPerm"/);
  assert.match(html, /data-gfopt="uaPerm"/);
  assert.match(html, /value="R3"[^>]*checked/);
  assert.match(html, /所属グループから継承/);
  assert.match(html, /和集合/);
});

test('グループ編集: 権限は複数選択できる', () => {
  const run = app();
  run('state.groupForm = { mode:"edit", id:"g6", name:"保育・児童窓口", permIds:["R3","R4"], userIds:["u6"] };');
  const html = run('groupFormDialog()');
  assert.match(html, /data-gfopt="gfPerm"/);
  assert.match(html, /value="R3"[^>]*checked/);
  assert.match(html, /value="R4"[^>]*checked/);
  /* 単一選択のラジオは使わない */
  assert.doesNotMatch(html, /data-gfsopt="gfPerm"/);
});

test('グループの権限が複数のとき、所属ユーザーの実効権限は和集合になる', () => {
  const run = app();
  run('GROUPS.find((g) => g.id === "g6").permIds = ["R4","R3"]');
  assert.deepEqual(JSON.parse(run('JSON.stringify(rolesOfUser("u6"))')), ['R4', 'R3']);
  /* R3 の確認が効く（R4 だけでは確認できない） */
  assert.equal(run('userHasOp("confirm","u6")'), true);
});

test('帳票タイプ設定: 4 ステップ（出力設定は Step5 から外し、列は AI 読取設定・文字コードは実行時ダイアログ）', () => {
  const run = app();
  /* ステップは 4 つ。効果テストが最後。出力設定は別画面に統合 */
  assert.equal(run('TYPE_STEPS.length'), 4);
  const ids = run('TYPE_STEPS.map((s) => s.id).join(",")');
  assert.match(ids, /classify/);
  assert.match(ids, /ocr/);
  assert.match(ids, /rule/);
  assert.match(ids, /test/);
  /* ウィザード本体に Step5（出力設定）タブ・文言・data 属性は無い */
  const html = run('state.typeStep = 4; renderTicketDetail()');
  assert.doesNotMatch(html, /data-typestep="5"/);
  assert.doesNotMatch(html, /data-expform=/);
  assert.doesNotMatch(html, /data-expcol-/);
  assert.doesNotMatch(html, /複数ファイルのまとめ/);
  /* 出力の列名・列順は AI 読取設定のフィールド／テーブルで定義する */
  const fields = run('ensureTypeFields().map((f) => f.name)');
  assert.ok(fields.includes('計画書区分'));
  assert.ok(run('ensureTypeTables().length') >= 1);
  /* 文字コード（BOM あり／なし／Shift_JIS）は実行時の出力ダイアログで切り替える */
  const dlg = run('state.exportOpen = true; renderExportDialog()');
  assert.match(dlg, /UTF-8/);
  assert.match(dlg, /Shift_JIS/);
  /* 出力項目の初期値は従来どおり：AI 読取項目は on、テーブル列は既定 off */
  const cols = JSON.parse(run('JSON.stringify(exportCfgOf(TICKET_TYPES[0]).cols)'));
  assert.equal(cols.filter((c) => c.on).length, 8);
  assert.ok(cols.filter((c) => c.table).every((c) => !c.on));
  /* 既定は「1 帳票＝1 行」、同一帳票タイプのまとめが有効 */
  const cfg = JSON.parse(run('JSON.stringify(exportCfgOf(TICKET_TYPES[0]))'));
  assert.equal(cfg.record, 'perTicket');
  assert.equal(cfg.merge, true);
  assert.deepEqual(cfg.formats, ['csv']);
});

test('出力設定は帳票タイプごとに独立している', () => {
  const run = app();
  /* 1 つ目の列名を変えても、別の帳票タイプの設定は変わらない */
  const other = run('(exportCfgOf(TICKET_TYPES[0]).cols[0].label = "独自列名", exportCfgOf(TICKET_TYPES[1]).cols[0].label)');
  assert.notEqual(other, '独自列名');
  /* レコード単位・まとめもタイプごと */
  run('exportCfgOf(TICKET_TYPES[0]).record = "perRow"');
  assert.equal(run('exportCfgOf(TICKET_TYPES[1]).record'), 'perTicket');
});

test('エクスポートダイアログ: 管理者は出力形式（横向/竖向/結合）と列設定を編集できる', () => {
  const run = app();
  run('var window={DEMO_FULL_ADMIN:true}; state.exportOpen=true; state.picked={}; state.picked[FILES_DATA[0].id]=true; visibleFiles=function(){ return FILES_DATA; };');
  const html = run('renderExportDialog()');
  /* 出力形式：3 つのラジオ（横向／竖向／結合） */
  assert.equal((html.match(/data-exprecord="/g) || []).length, 3);
  assert.ok(html.includes('出力形式'));
  assert.ok(html.includes('横向（1 帳票 = 1 行）'));
  assert.ok(html.includes('竖向（項目名／項目値）'));
  assert.ok(html.includes('結合（一般＋テーブル Left Join）'));
  /* 列設定：出力項目（一般 8 件）のトグル行＋初期化ボタン */
  assert.ok(html.includes('列設定（出力項目・列順）'));
  assert.ok(html.includes('id="expColReset"'));
  assert.ok((html.match(/data-colact="on"/g) || []).length >= 8);
  /* 管理者は disabled にならない */
  assert.doesNotMatch(html, /data-exprecord="perTicket"[^>]*disabled/);
});

test('エクスポートダイアログ: 管理者以外は出力形式・列設定は変更不可', () => {
  const run = app();
  run('state.currentUser="u7"; state.exportOpen=true; state.picked={}; state.picked[FILES_DATA[0].id]=true; visibleFiles=function(){ return FILES_DATA; };');
  const html = run('renderExportDialog()');
  /* 出力形式は選択肢だけ表示・無効、編集不可の注記 */
  assert.ok(html.includes('出力形式の変更は管理者のみ可能です'));
  assert.match(html, /data-exprecord="perTicket"[^>]*disabled/);
  /* 列設定ブロックは管理者以外には出ない（設定変更は管理者のみ：機能確認表 No.15） */
  assert.doesNotMatch(html, /列設定（出力項目・列順）/);
  assert.doesNotMatch(html, /id="expColReset"/);
});

test('CSV 出力: 横向/竖向/結合の 3 レイアウトが要件 R7 に従う', () => {
  const run = app();
  run('state.exportCfg={fileNameFromInput:false,encoding:"UTF-8"};');
  const fid = run('FILES_DATA[0].id');
  const csv = (rec) => JSON.parse(run('(function(){var t=TICKET_TYPES.find(x=>layoutIdOfTicketType(x)===FILES_DATA[0].layout); exportCfgOf(t).record=' + JSON.stringify(rec) + '; var r=buildExportCsv([' + JSON.stringify(fid) + ']); return JSON.stringify({head:r.text.split("\\r\\n")[0], rows:r.text.split("\\r\\n").length-1});})()'));
  /* 横向：1 帳票 1 行、ヘッダ＝一般項目 */
  const per = csv('perTicket');
  assert.ok(per.head.includes('計画書区分'));
  assert.equal(per.rows, 1);
  /* 竖向：項目名／項目値、一般 8 項目分の行 */
  const v = csv('perRow');
  assert.ok(v.head.includes('項目,値'));
  assert.equal(v.rows, 8);
  /* 結合：一般項目 ＋ テーブル列（商品明細/税率内訳/備考）が Left Join、テーブル行ごと展開（モック 2 行） */
  const c = csv('combine');
  assert.ok(c.head.includes('商品明細テーブル / No.'));
  assert.ok(c.head.includes('税率内訳テーブル / 税率'));
  assert.equal(c.rows, 2);
});

test('CSV 出力: 列の表示/非表示・列順がヘッダに反映される', () => {
  const run = app();
  run('state.exportCfg={fileNameFromInput:false,encoding:"UTF-8"};');
  const fid = run('FILES_DATA[0].id');
  /* 一般項目を先頭 1 件だけ ON にする */
  run('(function(){var t=TICKET_TYPES.find(x=>layoutIdOfTicketType(x)===FILES_DATA[0].layout); var c=exportCfgOf(t).cols; c.forEach((x,i)=>{x.on=(i===0);}); exportCfgOf(t).record="perTicket";})()');
  const head = run('(function(){var r=buildExportCsv([' + JSON.stringify(fid) + ']); return r.text.split("\\r\\n")[0];})()');
  assert.equal(head, '計画書区分');
  /* 列順を入れ替え（提出日 を先頭に）して全件 ON */
  run('(function(){var t=TICKET_TYPES.find(x=>layoutIdOfTicketType(x)===FILES_DATA[0].layout); var c=exportCfgOf(t).cols; var x=c.splice(1,1)[0]; c.unshift(x); c.forEach((y)=>{y.on=true;});})()');
  const head2 = run('(function(){var r=buildExportCsv([' + JSON.stringify(fid) + ']); return r.text.split("\\r\\n")[0];})()');
  assert.ok(head2.startsWith('提出日,'));
});

test('ホーム: ご利用履歴と自動アップロードのダッシュボードをタブで切り替える', () => {
  const run = app();
  let html = run('state.homeTab = "history"; renderHome()');
  assert.match(html, /class="home-tabs"/);
  assert.match(html, /data-hometab="history"/);
  assert.match(html, /data-hometab="dashboard"/);
  assert.match(html, /ご利用履歴/);
  assert.match(html, /ダッシュボード/);
  assert.match(html, /data-hopt="hBiz"/);
  assert.doesNotMatch(html, /class="auto-dash"/);

  html = run('state.homeTab = "dashboard"; renderHome()');
  assert.match(html, /class="auto-dash"/);
  assert.match(html, /直近7日の取込/);
  assert.match(html, /取込成功率/);
  assert.match(html, /未対応エラー/);
  assert.match(html, /自動アップロードのエラー/);
  /* エラーは記録表示のみ（操作ボタンは置かない） */
  assert.match(html, /class="auto-status/);
  assert.match(html, /未対応/);
  assert.match(html, /対応済み/);
  assert.doesNotMatch(html, /data-werr-handle=|未対応に戻す|対応済みにする/);
  assert.doesNotMatch(html, /class="auto-chart"|class="auto-legend"/);
  assert.doesNotMatch(html, /data-hopt="hBiz"/);
});
