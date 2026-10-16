const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
function app() {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval });
  vm.runInContext(source.slice(0, source.lastIndexOf('\napplyHash();')), ctx);
  return (code) => vm.runInContext(code, ctx);
}
test('collapsed result filters show hierarchy row; expanded adds people and all dates', () => {
  const run = app();
  let html = run('state.filterOpen = false; renderFilters()');
  assert.match(html, /class="result-filters-body"/);
  assert.match(html, /class="result-filter-row result-search-row"/);
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 1);
  for (const id of ['searchBtn', 'resetBtn']) assert.ok(html.includes(`id="${id}"`), id);
  /* ファイル一覧の絞り込みは単一選択（複数選択ドロップダウンは使わない） */
  assert.match(html, /<select class="fld fsel" data-fs="status"/);
  assert.match(html, /<select class="fld fsel" data-fs="biz"/);
  assert.match(html, /<select class="fld fsel" data-fs="layout"/);
  assert.doesNotMatch(html, /data-msbtn|data-ms="|data-opt=/);
  assert.match(html, /業務シーン/);
  assert.match(html, /帳票タイプ/);
  assert.match(html, /もっと見る/);
  /* 折叠行：業務シーン → 帳票タイプ（上位類型・部署は削除） */
  assert.ok(html.indexOf('data-fs="biz"') < html.indexOf('data-fs="layout"'));
  assert.doesNotMatch(html, /data-fs="category"|data-fs="dept"/);
  assert.doesNotMatch(html, /帳票カテゴリ|部署/);
  assert.doesNotMatch(html, /id="fName"|ファイル名/);
  assert.doesNotMatch(html, /id="createdFrom"|id="readFrom"/);
  assert.doesNotMatch(html, /data-fs="confirmedBy"|data-fs="approvedBy"|data-fs="createdBy"/);
  assert.doesNotMatch(html, /class="searchline"/);

  html = run('state.filterOpen = true; renderFilters()');
  assert.match(html, /result-filters is-open/);
  assert.equal((html.match(/class="result-filter-row/g) || []).length, 3);
  assert.doesNotMatch(html, /data-fs="dept"|部署/);
  assert.match(html, /data-fs="createdBy"/);
  assert.match(html, /data-fs="confirmedBy"/);
  assert.match(html, /data-fs="approvedBy"/);
  assert.doesNotMatch(html, /data-fs="operator"|data-fs="updatedBy"/);
  assert.doesNotMatch(html, /処理ユーザ|更新者/);
  assert.match(html, /作成者/);
  assert.match(html, /確認者/);
  assert.match(html, /承認者/);
  assert.doesNotMatch(html, /id="resultQuery"|読取結果検索/);
  assert.match(html, /result-date-row/);
  for (const id of ['createdFrom', 'updatedFrom', 'readFrom', 'checkedFrom', 'approvedFrom']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  assert.match(html, /読取日/);
  assert.match(html, /確認日/);
  assert.match(html, /承認日/);
  assert.match(html, /閉じる/);
  assert.doesNotMatch(html, /id="fName"|ファイル名/);
});
test('result table has nine columns, compact rows, three browse-only action slots and page jump', () => {
  const run = app();
  const html = run('renderTable()');
  assert.match(html, /result-tablewrap/);
  assert.match(html, /class="result-table"/);
  assert.match(html, /<colgroup>/);
  assert.match(html, /width:260px/);
  assert.match(styles, /\.result-tablewrap\{[^}]*overflow:\s*auto/);
  assert.match(styles, /\.result-tablewrap\.is-dragging/);
  assert.match(styles, /\.result-tablewrap \.result-table\{[^}]*min-width:\s*1474px/);
  assert.match(source, /function bindResultTableScroll\(/);
  assert.match(source, /resultScrollLeft/);
  assert.doesNotMatch(html, /class="meta"|type-pill|class="dot"|class="ctx"/);
  assert.match(html, />帳票タイプ</);
  assert.match(html, />操作・処理<\/th>/);
  assert.match(html, /data-resultgoto/);
  assert.match(html, /一括ダウンロード/);
  assert.match(html, /class="batch-dl/);
  for (const fmt of ['csv', 'excel', 'json', 'pdf']) assert.match(html, new RegExp(`data-batchdl="${fmt}"`));
  assert.match(html, /CSVをダウンロード/);
  assert.match(html, /Excelをダウンロード/);
  assert.match(html, /JSONをダウンロード/);
  assert.match(html, /PDFをダウンロード/);
  const row = html.match(/<tr[^>]*data-row="[^"]+"[\s\S]*?<\/tr>/)[0];
  /* 行アクション：详情／再読取／ダウンロード／削除。ダウンロードは hover メニュー（data-dlmenu）なので data-act は3つ */
  assert.equal((row.match(/data-act="/g) || []).length, 3);
  assert.match(row, /data-act="detail"/);
  assert.doesNotMatch(row, /data-act="download"/);
  assert.match(row, /data-dlmenu="[^"]+"/);
  assert.match(row, /aria-haspopup="menu"/);
  assert.match(row, /i-download/);
  assert.doesNotMatch(row, /data-act="confirm"|data-act="approve"/);
  assert.match(row, /class="fn link"/);
});
test('tree builds from masters; rename only files; view mode and reorder', () => {
  const run = app();
  const html = run('renderTree()');
  assert.match(html, /tree-icon-folder/);
  assert.match(html, /tree-icon-document/);
  assert.match(html, /data-type="biz" data-id="b1"/);
  assert.match(html, /data-type="cat" data-id="c1"/);
  assert.match(html, /data-type="file" data-id="f01"/);
  /* 名称変更ボタンはファイル行にのみ付く。長い名前は省略＋hover で全文（data-tip） */
  const fileRow = html.match(/data-type="file" data-id="f01"[\s\S]*?<\/div>/)[0];
  assert.match(fileRow, /data-rename="1"/);
  assert.match(fileRow, /class="label"[^>]*data-tip="/);
  assert.doesNotMatch(fileRow, /class="label"[^>]*\btitle=/);
  const bizRow = html.match(/data-type="biz" data-id="b1"[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(bizRow, /data-rename=/);
  const catRow = html.match(/data-type="cat" data-id="c1"[\s\S]*?<\/div>/)[0];
  assert.doesNotMatch(catRow, /data-rename=/);
  assert.doesNotMatch(html, /data-treedel=/);
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
  assert.match(panel, /tree-view-pill on" data-treeview="biz-cat"/);   // 既定は業務シーンビュー
  assert.doesNotMatch(panel, /id="treeAddFolder"/);
  run('state.treeView = "cat"');
  const catTree = run('renderTree()');
  assert.doesNotMatch(catTree, /data-type="biz"/);
  assert.match(catTree, /data-type="cat" data-id="c1"/);
  const side = run('renderSidebarPane()');
  assert.match(side, /ファイル一覧/);
  assert.match(side, /info-i/);
  assert.match(side, /表示次元/);
  assert.match(side, /ファイル名のみ/);
  assert.doesNotMatch(side, /class="tree-hint"/);
});
test('status strip omits waiting tab because upload jumps to reading on result list', () => {
  const run = app();
  const tabs = run('renderTabs()');
  assert.equal((tabs.match(/data-tab=/g) || []).length, 9);
  assert.doesNotMatch(tabs, /data-tab="waiting"/);
  for (const id of ['reading', 'done', 'failed', 'checking', 'confirmed', 'approved', 'returned', 'exported']) {
    assert.ok(tabs.includes(`data-tab="${id}"`), id);
  }
  const filters = run('renderFilters()');
  assert.doesNotMatch(filters, /value="waiting"/);
  assert.doesNotMatch(filters, /読取待ち/);
  assert.ok(filters.includes('value="approved"'));
  assert.ok(filters.includes('value="returned"'));
  assert.ok(filters.includes('value="exported"'));
});
test('review footer is status-driven: confirmed shows approve/return without confirm', () => {
  const run = app();
  run('state.reviewId = "f11"; state.page = "review"; state.reviewViewOnly = false; state.reviewReturn = "myTasks"');
  const html = run('renderReview()');
  assert.doesNotMatch(html, /id="rvConfirm"/);
  assert.match(html, /id="rvReturn"/);
  assert.match(html, /id="rvApprove"/);
  assert.match(html, /確認済み/);
  const flags = run('JSON.stringify(reviewFootFlags(byId(FILES_DATA, "f11")))');
  assert.equal(JSON.parse(flags).canApprove, true);
  assert.equal(JSON.parse(flags).canReturn, true);
  assert.equal(JSON.parse(flags).canConfirm, false);
  assert.equal(JSON.parse(flags).phase, 'approve');
  assert.equal(JSON.parse(flags).readonly, true);
  /* 承認画面：編集不可・進捗・直前操作サマリ・差分／全項目タブ・一括確認なし */
  assert.match(html, /rv-approve-audit/);
  assert.match(html, /帳票の進捗/);
  assert.match(html, /直前の操作結果/);
  assert.match(html, /読取結果（原文）/);
  assert.match(html, /確認者の修正/);
  assert.match(html, /承認者は項目を編集できません/);
  assert.match(html, /data-rv-apane="diff"/);
  assert.match(html, /data-rv-apane="fields"/);
  assert.doesNotMatch(html, /id="rvBulkConfirm"/);
  assert.doesNotMatch(html, /data-ocr=/);
  assert.match(html, /rv-audit-diff|rv-field-diff|rv-field-ro/);
  assert.match(html, /btn-ds/);
});

test('returned file shows return records on approve-style audit', () => {
  const run = app();
  run('ensureConfirmAudit(byId(FILES_DATA, "f15"))');
  const audit = JSON.parse(run('JSON.stringify(confirmAuditOf(byId(FILES_DATA, "f15")))'));
  assert.ok(audit.returns.length >= 1);
  assert.match(audit.returns[0].action, /差戻/);
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
  /* 承認・確認兼務の u4。自身のみでも割当が当たればタスクが見える */
  run('state.currentUser = "u4"');
  const nConfirm = run('myTaskFiles("confirm").length');
  const nApprove = run('myTaskFiles("approve").length');
  run('state.currentUser = "u1"');
  const nReapprove = run('myTaskFiles("reapprove").length');
  run('state.currentUser = "u4"');
  assert.ok(nConfirm > 0);
  assert.ok(nApprove > 0);
  assert.ok(nReapprove > 0, '2段目待ちの再承認タスクがある');
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
  assert.match(html, /確認する|承認する|再承認する/);
  assert.match(html, /要承認（1段目）|要承認/);
  /* 再承認はシステム管理者 u1（全件参照）で見える */
  const htmlRe = run('state.currentUser = "u1"; renderMyTasks()');
  assert.match(htmlRe, /要再承認（2段目）/);
  /* 担当は具体ユーザ名（グループ名ではない） */
  assert.match(html, /田中 実|伊藤 由美|佐藤 一郎/);
  assert.doesNotMatch(html, /確認者グループ|承認者グループ|窓口グループ/);
  assert.doesNotMatch(html, /担当グループに割り当てられた/);
});
test('confirmers do not see approve tasks; approvers do not see confirm tasks', () => {
  const run = app();
  /* 確認専任 u2：approve 操作なし → 承認タスク 0 */
  assert.equal(run('userHasOp("confirm", "u2")'), true);
  assert.equal(run('userHasOp("approve", "u2")'), false);
  run('state.currentUser = "u2"');
  assert.equal(run('myTaskRows("pending").filter((r) => r.kind === "approve" || r.kind === "reapprove").length'), 0);
  assert.equal(run('myTaskRows("done").filter((r) => r.kind === "approve" || r.kind === "reapprove").length'), 0);
  assert.ok(run('myTaskRows("pending").filter((r) => r.kind === "confirm").length') >= 0);
  /* 承認専任 u5：confirm 操作なし → 確認タスク 0 */
  assert.equal(run('userHasOp("confirm", "u5")'), false);
  assert.equal(run('userHasOp("approve", "u5")'), true);
  run('state.currentUser = "u5"');
  assert.equal(run('myTaskRows("pending").filter((r) => r.kind === "confirm").length'), 0);
  assert.equal(run('myTaskRows("done").filter((r) => r.kind === "confirm").length'), 0);
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
  assert.equal(run('TABS_DEF.result.label'), 'ファイル一覧');
  assert.equal(run('tabOfRoute("upload")'), 'upload');
  assert.equal(run('tabOfRoute("result")'), 'result');
  assert.equal(run('tabOfRoute("myTasks")'), 'myTasks');
  const side = run('state.page = "result"; renderSidebarPane()');
  assert.match(side, /ファイル一覧/);
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
  /* 既定ユーザー u2＝g1/g6/g9 → b1,b3,b4,b6 のみ */
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
    globalThis.menuBtns = [fakeBtn('excel'), fakeBtn('csv'), fakeBtn('json')];
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
  for (const fmt of ['excel', 'csv', 'json']) assert.match(menu, new RegExp(`data-dl-fmt="${fmt}"`));
  assert.equal((menu.match(/data-dl-fmt=/g) || []).length, 3);
  assert.equal(run('JSON.stringify(DL_FORMATS.map((f) => f[0]))'), '["excel","csv","json"]');
  assert.equal(run('typeof dlAnchor.onmouseleave'), 'function');
  /* メニュー項目を押すと、その行×その形式でダウンロードが走り、メニューは閉じる */
  run('globalThis.menuBtns[1].onclick({ stopPropagation() {} })');
  assert.equal(run('JSON.stringify(globalThis.dlCalls)'), '[["f01","csv"]]');
  assert.equal(run('globalThis.removed > 0'), true);
});

test('the usage-settings pages drop the settings side menu and span the full width', () => {
  const run = app();
  /* 利用設定の各画面は左メニューなしの全幅（辞書登録メニューは廃止） */
  assert.equal(run('JSON.stringify(CFG_NO_SIDEBAR)'), '["users","roles","security","logs","api"]');
  /* render() は noSidePane のとき aside を描かず、layout-pane を 1 カラムにする */
  assert.match(source, /const noSidePane = CFG_NO_SIDEBAR\.includes\(route\)/);
  assert.match(source, /isReview \|\| isFullPane \|\| noSidePane \|\| isTypeList\) \? '' : \(isCfg \? renderCfgNav\(\)/);
  assert.match(source, /noSidePane \|\| isTypeList \? 'layout-pane layout-noside' : 'layout-pane'/);
  assert.match(styles, /\.layout-pane\.layout-noside\{grid-template-columns:minmax\(0,1fr\)\}/);
  /* 他の設定画面の左メニューは 3 グループ 7 項目（帳票設定／権限／利用設定。辞書なし） */
  const nav = run('renderCfgNav()');
  assert.equal((nav.match(/class="sidenav-item/g) || []).length, 7);
  assert.doesNotMatch(nav, /辞書登録|dictionaries/);
  assert.match(nav, /帳票設定/);
  assert.match(nav, /権限</);
  assert.match(nav, /利用設定/);
  /* 帳票権限管理（業務レベル）と 権限設定（システムレベル）は左メニューから別項目で到達できる */
  assert.match(nav, /data-cfgpage="permissions"/);
  assert.match(nav, /data-cfgpage="roles"/);
});

test('tree info hint shows one tooltip only: data-tip without a native title', () => {
  const run = app();
  const html = run('renderSidebarPane()');
  const info = html.match(/<span class="info-i"[^>]*>[^<]*<\/span>/);
  assert.ok(info, 'info-i が描画される');
  assert.match(info[0], /data-tip="[^"]*表示次元/);
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
      getBoundingClientRect: () => ({ left: 10, top: 40, width: 12, height: 12, bottom: 52 }),
    };
    globalThis.document = {
      body: { appendChild: (el) => globalThis.made.push(el) },
      createElement: () => ({ className: '', style: {}, textContent: '', removed: false, remove() { this.removed = true; }, getBoundingClientRect: () => ({ width: 80, height: 20 }) }),
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
test('ticket permission matrix lists every layout type against the four business actions', () => {
  const run = app();
  const html = run('renderPermissions()');
  assert.match(html, /帳票権限管理/);
  assert.match(html, /帳票タイプ権限（閲覧／確認／承認／再承認）/);
  /* 閲覧 → 確認 → 承認 → 再承認 の順で固定 */
  for (const label of ['閲覧', '確認', '承認', '再承認']) assert.ok(html.includes(`>${label}<`), label);
  assert.ok(html.indexOf('>閲覧<') < html.indexOf('>確認<'));
  assert.ok(html.indexOf('>確認<') < html.indexOf('>承認<'));
  assert.ok(html.indexOf('>承認<') < html.indexOf('>再承認<'));
  /* 帳票タイプ 1 行につき 4 つの操作セル＋1 つのクリア */
  const layouts = Number(run('LAYOUT.length'));
  assert.equal((html.match(/data-permcell="/g) || []).length, layouts * 4);
  assert.equal((html.match(/data-permclear="/g) || []).length, layouts);
  assert.match(html, /data-permcell="l1:approve"/);
  assert.match(html, /data-permclear="l1"/);
  /* 閲覧／確認／承認はグループチップ（ユーザー直指定もある） */
  assert.match(html, /class="perm-cell"/);
  assert.match(html, /perm-chip grp">住民異動窓口|perm-chip grp">税務窓口/);
  assert.match(html, /perm-empty">—/);
  /* 業務レベルの帳票権限表に、システムレベルのメニュー権限ツリーは同居しない */
  assert.doesNotMatch(html, /data-mpnode/);
  /* 再承認は「2 段目の承認」。1 段承認で運用する帳票タイプは再承認が空欄になる */
  assert.match(source, /再承認', hint: '2 段目の承認/);
  assert.match(html, /1 段目/);
  assert.match(html, /2 段目/);
  const perms = JSON.parse(run('JSON.stringify(TICKET_PERMS)'));
  assert.ok(Object.values(perms).some((p) => p.reapprove.length > 0), 'a two-step type has a re-approver');
  assert.ok(Object.values(perms).some((p) => p.reapprove.length === 0), 'a one-step type leaves re-approval empty');
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
  /* 帳票タイプ／業務シーンの細粒度＋ユーザー管理下の権限 */
  assert.match(html, /data-mpnode="settings-type-add"/);
  assert.match(html, /data-mpnode="settings-scenes-add"/);
  assert.match(html, /data-mpnode="usage-users"/);
  assert.match(html, /業務シーン追加|タイプ追加|ユーザー管理/);
  assert.doesNotMatch(html, /AI画像処理|外部API|業務区分追加|部門照会|グループ照会|グループ追加|辞書登録|usage-dictionary|帳票分類/);
  /* 権限名／権限ID は読み取り専用のチップ */
  assert.match(html, /class="mp-idchip"/);
  assert.ok((html.match(/checked/g) || []).length >= 10);
  for (const id of ['menuPermOk', 'menuPermCancel', 'menuPermClose']) assert.ok(html.includes(`id="${id}"`), id);

  html = run("state.menuPerm.closed = ['settings']; menuPermDialog()");
  assert.doesNotMatch(html, /data-mpnode="settings-type"/);      // 折りたたみ中は子を出さない
  assert.match(html, /mpcaret ico i-caret-down closed/);

  /* 親は配下リーフの部分選択で半選択になり、子へ一括反映する */
  assert.match(source, /cb\.indeterminate = on > 0 && on < leaves\.length/);
  assert.match(source, /MENU_PERMS\[m\.roleId\] = m\.checked\.slice\(\)/);
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
test('ticket permission cell dialog picks groups and users for one action', () => {
  const run = app();
  const html = run("state.permCell = { layoutId: 'l1', act: 'approve' }; permCellDialog()");
  assert.match(html, /帳票権限の設定/);
  assert.match(html, /id="permCellBack"/);
  assert.match(html, /帳票タイプ/);
  assert.match(html, /業務操作/);
  assert.match(html, /class="accent">承認</);
  assert.match(html, /class="pt-hint">1 段目の承認</);
  /* 药丸で 1 列表示。シードがグループなのでグループ列のみ */
  assert.match(html, /data-perm-mode="group"/);
  assert.match(html, /data-perm-mode="user"/);
  assert.equal((html.match(/class="perm-pick-col"/g) || []).length, 1);
  assert.match(html, /グループ/);
  assert.match(html, /data-permpick="g:g2"/);
  assert.doesNotMatch(html, /data-permpick="u:u1"/);
  /* l1 の承認はグループ g2 がシード済み */
  assert.match(html, /data-permpick="g:g2" checked/);
  const userHtml = run("state.permCell = { layoutId: 'l1', act: 'approve', mode: 'user' }; permCellDialog()");
  assert.match(userHtml, /ユーザー（単選）/);
  assert.match(userHtml, /type="radio"[^>]*data-permpick="u:u1"|data-permpick="u:u1"[^>]*type="radio"/);
  assert.doesNotMatch(userHtml, /data-permpick="g:g2"/);
  for (const id of ['permCellOk', 'permCellCancel', 'permCellClose']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(source, /document\.querySelectorAll\('\[data-permcell\]'\)/);
  assert.match(source, /state\.permCell = \{ kind: 'ticket', layoutId, act \}/);
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
  assert.match(source, /currentUser: 'u2'/);
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

test('ticket type step1 configures approval flow with role and user assignees', () => {
  const run = app();
  run('state.page = "ticketDetail"; state.typeId = "T1"; state.typeStep = 1');
  let html = run('renderTicketDetail()');
  assert.match(html, /説明文/);
  assert.match(html, /id="tpDesc"/);
  assert.match(html, /wiz-ta-actions/);
  assert.match(html, /id="tpDescAi"/);
  assert.match(html, /id="tpDescClear"/);
  assert.match(html, /id="tpCount"/);
  assert.doesNotMatch(html, /wiz-ta-foot/);
  assert.match(html, /承認フロー/);
  assert.match(html, /data-tp-stage="0"/);
  assert.match(html, /data-tp-stage="1"/);
  assert.match(html, /data-tp-stage="2"/);
  assert.match(html, /確認担当/);
  assert.match(html, /承認担当（1段目）/);
  assert.match(html, /再承認担当（2段目）/);
  /* 左リスト＋右 Step1（帳票設定-タイプ） */
  assert.match(html, /帳票設定-タイプ/);
  assert.match(html, /タイプを検索|\+ タイプ追加|type-list-title/);
  assert.match(html, /data-typeid="T1"/);
  assert.doesNotMatch(html, /typedetail-solo/);
  /* 药丸スイッチ：グループ／ユーザーは 2 択 */
  assert.match(html, /asg-mode-pills/);
  assert.match(html, /data-asg-mode="confirm:group"/);
  assert.match(html, /data-asg-mode="confirm:user"/);
  assert.match(html, /data-tp-assignee-opt="confirm:g1"/);
  assert.match(html, /data-tp-assignee-opt="approve:g2"/);
  /* グループモード時はユーザー候補を出さない（切替後に出る） */
  assert.doesNotMatch(html, /data-tp-assignee-opt="confirm:u1"/);
  const userModeHtml = run('state.asgMode = { confirm: "user" }; TICKET_PERMS.l1.confirm = []; renderTicketDetail()');
  assert.match(userModeHtml, /data-tp-assignee-opt="confirm:u1"/);
  assert.doesNotMatch(userModeHtml, /data-tp-assignee-opt="confirm:g1"/);
  assert.equal(run('layoutIdOfTicketType(byId(TICKET_TYPES, "T1"))'), 'l1');
  /* グループは所属ユーザーへ展開され、ランダム選定できる */
  assert.deepEqual(JSON.parse(run('JSON.stringify(assigneeUserIds(["g1"]))')), JSON.parse(run('JSON.stringify(groupMemberIds("g1"))')));
  assert.ok(run('pickRandomAssignee(["g1"], "f01:confirm")'));
  /* 2 択：ユーザーを選ぶとグループは全部外れ、ユーザーは単選 */
  assert.deepEqual(JSON.parse(run(`(() => {
    TICKET_PERMS.l1.confirm = ['g1'];
    TICKET_PERMS.l1.confirm = ['u3'];
    return JSON.stringify(TICKET_PERMS.l1.confirm);
  })()`)), ['u3']);
  /* グループを選ぶとユーザー側は全部外れる */
  assert.deepEqual(JSON.parse(run(`(() => {
    TICKET_PERMS.l1.confirm = ['u3'];
    TICKET_PERMS.l1.confirm = ['g1', 'g6'];
    return JSON.stringify(TICKET_PERMS.l1.confirm);
  })()`)), ['g1', 'g6']);
  /* シードも各操作でグループかユーザーのどちらか一方 */
  const seed = JSON.parse(run('JSON.stringify(TICKET_PERMS)'));
  Object.values(seed).forEach((p) => {
    for (const k of ['view', 'confirm', 'approve', 'reapprove']) {
      const groups = p[k].filter((id) => /^g\d+$/.test(id));
      const users = p[k].filter((id) => /^u\d+$/.test(id));
      assert.ok(!(groups.length && users.length), `${k} must not mix group and user`);
      assert.ok(users.length <= 1, `${k} user is single-select`);
    }
  });
  /* 1段に切り替えると再承認が消える */
  run(`(() => {
    const p = TICKET_PERMS.l1;
    p.reapprove = [];
  })()`);
  html = run('state.typeStep = 1; renderTicketDetail()');
  assert.match(html, /承認担当（1段目）/);
  assert.doesNotMatch(html, /再承認担当（2段目）/);
  /* 承認不要にすると承認担当欄も出ない */
  run('TICKET_PERMS.l1.approve = []; TICKET_PERMS.l1.reapprove = []');
  html = run('renderTicketDetail()');
  assert.match(html, /data-tp-stage="0"[^>]*class="wiz-seg-btn on"|class="wiz-seg-btn on"[^>]*data-tp-stage="0"/);
  assert.doesNotMatch(html, /承認担当（1段目）/);
  assert.match(html, /確認担当/);
  /* 介護（承認不要カテゴリ） */
  run('state.typeId = "T7"');
  html = run('renderTicketDetail()');
  assert.equal(run('layoutIdOfTicketType(byId(TICKET_TYPES, "T7"))'), 'l12');
  assert.doesNotMatch(html, /承認担当（1段目）/);
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
  assert.equal(run('DEMO_ACTORS.length'), 4);
  assert.deepEqual(JSON.parse(run('JSON.stringify(DEMO_ACTORS.map((a) => a.id))')), ['u1', 'u2', 'u4', 'u8']);
  /* 既定は確認窓口 u2 */
  assert.equal(run('state.currentUser'), 'u2');
  assert.equal(run('currentProfile().name'), '鈴木 花子');
  assert.match(run('currentProfile().hint'), /確認窓口/);
  /* 切替後はプロフィール名が変わる */
  assert.equal(run('state.currentUser = "u4"; currentProfile().name'), '田中 実');
  assert.equal(run('state.currentUser = "u8"; currentProfile().name'), '中村 亮');
  assert.equal(run('state.currentUser = "u1"; currentProfile().name'), '佐藤 一郎');
  assert.equal(run('currentProfile().roleLabel'), 'システム管理者');
  assert.match(run('currentProfile().hint'), /システム管理者/);
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
  /* 帳票操作：担当外のタイプでも可 */
  assert.equal(run('canTicketAct("l4", "confirm", "u1")'), true);
  assert.equal(run('canTicketAct("l4", "confirm", "u2")'), false);
  /* マイタスク照合もバイパス */
  assert.equal(run('state.currentUser = "u1"; userInGroups([])'), true);
  assert.equal(run('state.currentUser = "u2"; userInGroups([])'), false);
  const html = run('renderPermissions()');
  assert.match(html, /システム管理者/);
});
