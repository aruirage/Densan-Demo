/* === injected by serve.py: 欠落している定義の自己修復パッチ（app.js 再生成対策） === */
var GROUP_ROOT_ID = 'g-root';
var HISTORY_DEPTS = [];
var ASSIGNEE_GROUP_IDS = ['g3', 'g1', 'g2', 'g4', 'g4a', 'g5', 'g6'];
var CURRENT_PROFILE = {
  id: 'u1', name: '佐藤 一郎', email: 'ichiro.sato@itso.co.jp', roleLabel: 'システム管理者'
};
window.DEMO_ACTORS = [];
if (typeof window.currentProfile !== 'function') {
  window.currentProfile = function currentProfile() {
    var u = (typeof byId === 'function' && typeof USERS !== 'undefined') ? byId(USERS, state.currentUser) : null;
    return u ? { id: u.id, name: u.name, email: u.id + '@demo.local', roleLabel: '一般', hint: '' } : CURRENT_PROFILE;
  };
}
function groupChildren(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  return gs.filter(function (g) { return g.parentId === id; });
}
function groupDescendantIds(id, out) {
  var acc = out || [];
  groupChildren(id).forEach(function (g) {
    if (acc.indexOf(g.id) < 0) { acc.push(g.id); groupDescendantIds(g.id, acc); }
  });
  return acc;
}
function usersInGroupScope(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  var ids = [id].concat(groupDescendantIds(id));
  var seen = {}, out = [];
  gs.forEach(function (g) {
    if (ids.indexOf(g.id) < 0) return;
    (g.userIds || []).forEach(function (uid) { if (!seen[uid]) { seen[uid] = 1; out.push(uid); } });
  });
  return out;
}
function groupNameOf(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  var hit = gs.filter(function (g) { return g.id === id; })[0];
  return hit ? hit.name : '';
}
function renderGroupTree() { return ''; }
/* =========================================================================
 * 帳票読取 ｜ 読取結果一覧  ファイルツリー＋絞り込み デモ
 * -------------------------------------------------------------------------
 * 前提（客户回答より）:
 *   - ツリー表示次元は切替可能：
 *       業務シーン → 帳票タイプ → ファイル ／ 帳票タイプ → ファイル
 *   - 業務シーン名・帳票タイプ名はマスタ固定（ツリーでは改名不可）。ファイル名のみ改名可。
 *   - 同階層はドラッグで並び替え可能。
 *   - 業務／帳票タイプ／版式のマスタは各自治体（組織）が作成・命名する。
 *   - 絞り込み条件は AND（同時滿足）。1条件内の複数選択は OR。
 *   - 「日付」＝ 読取日 / 確認日 / 承認日。
 *   - ファイルの手動リネームは表示名のみ（ID・格納パス・エクスポート名は不変）。
 * ========================================================================= */

/* ============================ 1. モックデータ ============================ */

/** 業務マスタ（＝ツリー第1階層。組織ごとに自由に増減できる想定） */
/* 業務マスタ（組織ごとに自由に増減できる前提。本デモは単一組織の構成のみ） */
let BUSINESS = [
  { id: 'b1', name: '住民異動関係', order: 1 },
  { id: 'b2', name: '税務関係', order: 2 },
  { id: 'b3', name: '保育所等入所', order: 3 },
  { id: 'b4', name: '児童手当', order: 4 },
  { id: 'b5', name: '介護保険関係', order: 5 },
  { id: 'b6', name: '高齢者実態調査', order: 6 },
];

/** 帳票タイプ（＝ツリー第2階層。権限・承認フローの単位） */
let CATEGORY = [
  { id: 'c1', business: 'b1', name: '住民異動届', order: 1 },
  { id: 'c2', business: 'b2', name: '個人住民税申告', order: 1 },
  { id: 'c3', business: 'b2', name: '特別徴収', order: 2 },
  { id: 'c4', business: 'b3', name: '利用申込', order: 1 },
  { id: 'c5', business: 'b3', name: '保育必要事由', order: 2 },
  { id: 'c6', business: 'b4', name: '児童手当認定請求', order: 1 },
  { id: 'c7', business: 'b5', name: '介護保険認定申請', order: 1 },
  { id: 'c8', business: 'b6', name: '実態調査票', order: 1 },
];

/** 版式（＝ツリー第3階層。現行製品の「帳票タイプ」を1段下げたもの。AI読取設定の単位）
 *  名称は `samples/申請書類サンプル/` 配下の PDF ファイル名（拡張子なし）に揃える。 */
let LAYOUT = [
  /* 10_住民異動関係 */
  { id: 'l1', category: 'c1', name: '10_A団体_住民異動届', template: '10_A団体_住民異動届', order: 1, saved: true },
  { id: 'l2', category: 'c1', name: '20_B団体_住民異動届', template: '20_B団体_住民異動届', order: 2, saved: true },
  { id: 'l3', category: 'c1', name: '21_B団体_住民異動届_記入済(全部転入)', template: '21_B団体_住民異動届_記入済(全部転入)', order: 3, saved: true },
  /* 20_税務関係 */
  { id: 'l4', category: 'c2', name: '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）', template: '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）', order: 1, saved: true },
  { id: 'l5', category: 'c3', name: '02_特別徴収関係一式', template: '02_特別徴収関係一式', order: 1, saved: true },
  { id: 'l6', category: 'c3', name: '10_給与支払報告書（総括表・個人別明細書）', template: '10_給与支払報告書（総括表・個人別明細書）', order: 2, saved: true },
  /* 30_保育所等入所の申込手続 */
  { id: 'l7', category: 'c4', name: '02_令和8年度保育所等利用申込書', template: '02_令和8年度保育所等利用申込書', order: 1, saved: true },
  { id: 'l8', category: 'c4', name: '01_施設型給付費・地域型保育給付費等教育・保育給付認定申請書', template: '01_施設型給付費・地域型保育給付費等教育・保育給付認定申請書', order: 2, saved: true },
  { id: 'l15', category: 'c4', name: '参考_令和8年度保育所等入所のご案内', template: '参考_令和8年度保育所等入所のご案内', order: 3, saved: true },
  { id: 'l9', category: 'c5', name: '02_就労証明書', template: '02_就労証明書', order: 1, saved: true },
  { id: 'l17', category: 'c5', name: '01_保育必要事由及び添付書類一覧', template: '01_保育必要事由及び添付書類一覧', order: 2, saved: true },
  { id: 'l18', category: 'c5', name: '03_医師の診断書', template: '03_医師の診断書', order: 3, saved: true },
  { id: 'l19', category: 'c5', name: '04_介護・看護状況申告書', template: '04_介護・看護状況申告書', order: 4, saved: true },
  /* 40_児童手当 */
  { id: 'l10', category: 'c6', name: '01_児童手当 認定請求書', template: '01_児童手当 認定請求書', order: 1, saved: true },
  { id: 'l11', category: 'c6', name: '03_児童手当 別居監護申立書', template: '03_児童手当 別居監護申立書', order: 2, saved: true },
  { id: 'l20', category: 'c6', name: '02_児童手当 監護相当・生計費の負担についての確認書', template: '02_児童手当 監護相当・生計費の負担についての確認書', order: 3, saved: true },
  { id: 'l21', category: 'c6', name: '40-01_児童手当 認定請求書_記入済', template: '40-01_児童手当 認定請求書_記入済', order: 4, saved: true },
  /* 50_介護保険関係 */
  { id: 'l12', category: 'c7', name: '01_介護保険認定申請書（新規・更新）', template: '01_介護保険認定申請書（新規・更新）', order: 1, saved: true },
  { id: 'l22', category: 'c7', name: '02_介護保険認定申請書', template: '02_介護保険認定申請書', order: 2, saved: true },
  /* 60_高齢者実態調査 */
  { id: 'l13', category: 'c8', name: '高齢者等実態調査票', template: '高齢者等実態調査票', order: 1, saved: true },
  { id: 'l14', category: 'c8', name: '61_高齢者等実態調査票_記入済(既存_修正)', template: '61_高齢者等実態調査票_記入済(既存_修正)', order: 2, saved: true },
  { id: 'l23', category: 'c8', name: '62_高齢者等実態調査票_記入済(新規_年齢到達)', template: '62_高齢者等実態調査票_記入済(新規_年齢到達)', order: 3, saved: true },
  { id: 'l24', category: 'c8', name: '62_高齢者等実態調査票_記入済(既存_修正_障害者)', template: '62_高齢者等実態調査票_記入済(既存_修正_障害者)', order: 4, saved: true },
];

/** ユーザー（確認／承認などフロー担当の割当先） */
const USERS = [
  { id: 'u1', name: '佐藤 一郎' },
  { id: 'u2', name: '鈴木 花子' },
  { id: 'u3', name: '高橋 健' },
  { id: 'u4', name: '田中 実' },
  { id: 'u5', name: '伊藤 由美' },
  { id: 'u6', name: '渡辺 修' },
  { id: 'u7', name: '山本 彩' },
  { id: 'u8', name: '中村 亮' },
  { id: 'u9', name: '万能 管理者' },
];

/** デモ用：権限の違いを見せるための切替候補（GROUPS／帳票権限表のシードに合わせる） */
const DEMO_ACTORS = [];

/** 右上に表示するログイン中ユーザ（state.currentUser から導出） */
function currentProfile() {
  const u = byId(USERS, state.currentUser) || USERS[0];
  const actor = DEMO_ACTORS.find((a) => a.id === u.id);
  const groupNames = (typeof GROUPS !== 'undefined' && Array.isArray(GROUPS))
    ? GROUPS.filter((g) => (g.userIds || []).includes(u.id)).map((g) => g.name)
    : [];
  const roles = (typeof ROLES !== 'undefined' && typeof ROLE_MEMBERS !== 'undefined')
    ? ROLES.filter((r) => (ROLE_MEMBERS[r.id] || []).includes(u.id)).map((r) => r.name)
    : [];
  /* システム管理者は万能権限のため、所属グループよりロール名を優先表示 */
  const label = (typeof isTenantAdmin === 'function' && isTenantAdmin(u.id))
    ? (roles[0] || 'システム管理者')
    : (groupNames.length ? groupNames.join('／') : (roles.length ? roles.join('／') : '一般'));
  return {
    id: u.id,
    name: u.name,
    email: (actor && actor.email) || (u.id + '@demo.local'),
    roleLabel: label,
    hint: (actor && actor.hint) || '',
  };
}

/* ── 処理ステータス定義（客户回答の9ステータス）─────────────────────────
 * 上传：読取待ち ／ 識別：読取中・読取完了・読取失敗 ／ 確認：確認中(当面不要)・確認済み(承認待ち)
 * 承認：承認済み・差戻中 ／ 出力：出力済み
 * 「確認中」は客户回答で当面不要のため予備（unused）。タブには残し、件数0・無効で表示する。
 * ------------------------------------------------------------------------ */
const STATUS_PHASES = [
  { id: 'upload', no: '1', label: '票据上传', actor: 'アップロード実行者（窓口・職員）' },
  { id: 'ocr', no: '2', label: '票据识别', actor: 'システム（OCR／AI）' },
  { id: 'confirm', no: '3', label: '票据确认', actor: '確認権限を持つユーザ' },
  { id: 'approve', no: '4', label: '票据承认', actor: '承認権限を持つユーザ' },
  { id: 'export', no: '5', label: '票据导出', actor: '出力権限を持つユーザ' },
];
const ALL_ACTIONS = ['view', 'fix', 'confirm', 'approve', 'return', 'export'];
const ACTIONS = {
  view: { label: '閲覧', icon: 'i-view', title: 'プレビュー（閲覧）' },
  fix: { label: '修正', icon: 'i-edit', title: '読取結果を修正' },
  confirm: { label: '確認', icon: '✓', title: '確認済みにする' },
  approve: { label: '承認', icon: '◎', title: '承認する' },
  return: { label: '差戻', icon: '↩', title: '差戻す' },
  export: { label: '出力', icon: 'i-export', title: 'CSVダウンロード（出力）' },
};
const STATUS = {
  /* アップロード後、AIが帳票タイプを判定している状態（製品ではスピナー付きで「分類中」表示） */
  classifying: { key: 'classifying', label: '分類中', phase: 'upload', actor: 'システム（AI分類）', actions: ['view'], unused: false, done: false },
  reading: { key: 'reading', label: '読取中', phase: 'ocr', actor: 'システム（OCR／AI）', actions: ['view'], unused: false, done: false },
  failed: { key: 'failed', label: '読取失敗', phase: 'ocr', actor: 'システム（OCR／AI）', actions: ['view', 'fix'], unused: false, done: false },
  waiting: { key: 'waiting', label: '読取待ち', phase: 'upload', actor: 'アップロード実行者（窓口・職員）', actions: ['view'], unused: false, done: false },
  done: { key: 'done', label: '読取完了', phase: 'ocr', actor: 'システム（OCR／AI）', actions: ['view', 'fix', 'confirm'], unused: false, done: true },
  checking: { key: 'checking', label: '確認中', phase: 'confirm', actor: '確認権限を持つユーザ', actions: ['view', 'fix', 'confirm'], unused: false, done: false },
  confirmed: { key: 'confirmed', label: '確認済み', phase: 'confirm', actor: '確認権限を持つユーザ', actions: ['view', 'approve', 'return'], unused: false, done: true },
  approved: { key: 'approved', label: '承認済み', phase: 'approve', actor: '承認権限を持つユーザ', actions: ['view', 'export', 'return'], unused: false, done: true },
  returned: { key: 'returned', label: '差戻中', phase: 'approve', actor: '承認権限を持つユーザ', actions: ['view', 'fix', 'confirm'], unused: false, done: false },
  exported: { key: 'exported', label: '出力済', phase: 'export', actor: '出力権限を持つユーザ', actions: ['view', 'export'], unused: false, done: true },
};
/** 処理フロー順のステータス一覧（ステータス絞り込みの選択肢） */
const STATUS_ORDER = ['waiting', 'reading', 'done', 'failed', 'confirmed', 'exported'];
/**
 * タブに出すステータス。
 * 「読取待ち」は新規アップロード画面のみの状態（選択帳票読取で即「読取中」になり一覧へ遷移するため、結果一覧のタブには出さない）。
 */
const TAB_STATUS = ['reading', 'done', 'failed', 'confirmed', 'exported'];
/** ステータスタブ（上記＋すべて） */
const TABS = [{ id: 'all', label: 'すべて' }].concat(TAB_STATUS.map((k) => ({ id: k, label: STATUS[k].label })));
function phaseOf(statusKey) { return STATUS_PHASES.find((p) => p.id === STATUS[statusKey].phase); }

/* ファイル明細（読取結果）。日付は 読取日=readAt / 確認日=confirmedAt / 承認日=approvedAt */
const FILES = [
  ['f01', '②-1-2_不備なし_正規様式_ゴム印なし.pdf', 'l4', 90700, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 17:55:29', '2026-10-14 17:00:25', '2026-10-14 17:55:41', null, null, 'u2', 'u2', null],
  ['f02', '②-1-4_不備なし_正規様式_ゴム印あり.pdf', 'l4', 91310, 'done', '読取完了', '2026-10-14 17:55:29', '2026-10-14 18:02:20', '2026-10-14 17:55:36', null, null, 'u2', 'u2', null],
  ['f03', '①-2（不備なし、正規様式、ゴム印あり）.pdf', 'l4', 245320, 'done', '読取完了', '2026-10-14 17:55:29', '2026-10-14 18:02:37', '2026-10-14 17:55:44', null, null, 'u2', 'u4', null],
  ['f04', '②-1-1_不備なし_正規様式_ゴム印なし.pdf', 'l4', 95670, 'done', '読取完了', '2026-10-14 17:55:28', '2026-10-14 18:01:11', '2026-10-14 17:55:33', '2026-10-14 18:20:04', '2026-10-15 09:12:00', 'u2', 'u2', 'u4'],
  ['f05', '②-2-1_不備なし_正規様式_ゴム印あり.pdf', 'l4', 120370, 'done', '読取完了', '2026-10-14 17:55:28', '2026-10-14 18:01:29', '2026-10-14 17:55:39', null, null, 'u2', 'u2', null],
  ['f06', '①-1（不備なし、正規様式、ゴム印なし）.pdf', 'l4', 1350000, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 17:55:28', '2026-10-14 16:59:48', '2026-10-14 17:55:50', null, null, 'u2', 'u2', null],
  ['f07', '②-1-3_不備なし_正規様式_ゴム印なし.pdf', 'l4', 93360, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 17:55:28', '2026-10-14 16:59:16', '2026-10-14 17:55:47', null, null, 'u2', 'u2', null],
  ['f08', '④-1-1_不備なし_独自様式_ゴム印なし.pdf', 'l4', 123260, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 17:55:28', '2026-10-14 16:59:07', '2026-10-14 17:55:52', null, null, 'u2', 'u2', null],
  ['f09', '10_A団体_住民異動届.pdf', 'l1', 412100, 'exported', '出力済み（CSV）', '2026-10-13 09:14:02', '2026-10-13 09:20:31', '2026-10-13 09:14:40', '2026-10-13 14:02:11', '2026-10-13 15:40:00', 'u1', 'u1', 'u3'],
  ['f10', '20_B団体_住民異動届.pdf', 'l2', 388240, 'approved', '承認済み', '2026-10-13 09:16:20', '2026-10-13 09:22:05', '2026-10-13 09:16:52', '2026-10-13 16:31:40', '2026-10-14 10:05:12', 'u1', 'u1', 'u3'],
  ['f11', '21_B団体_住民異動届_記入済(全部転入).pdf', 'l3', 522900, 'confirmed', '確認済み', '2026-10-13 09:18:44', '2026-10-14 11:40:02', '2026-10-13 09:19:10', '2026-10-14 11:42:33', null, 'u1', 'u2', null],
  ['f12', '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）.pdf', 'l4', 1860400, 'done', '読取完了', '2026-10-14 08:31:10', '2026-10-14 08:39:55', '2026-10-14 08:32:02', null, null, 'u4', 'u4', null],
  ['f13', '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）_2.pdf', 'l4', 1204500, 'reading', '読取処理中（3/8ページ）', '2026-10-15 10:02:41', '2026-10-15 10:03:05', '2026-10-15 10:02:48', null, null, 'u4', 'u4', null],
  ['f14', '02_特別徴収関係一式.pdf', 'l5', 2688400, 'confirmed', '確認済み', '2026-10-14 13:20:11', '2026-10-15 09:44:20', '2026-10-14 13:21:35', '2026-10-15 09:50:02', null, 'u5', 'u5', null],
  ['f15', '10_給与支払報告書（総括表・個人別明細書）.pdf', 'l6', 7412300, 'returned', '差戻中（確認者より差戻）', '2026-10-14 13:25:44', '2026-10-15 08:55:10', '2026-10-14 13:27:02', null, null, 'u5', 'u5', null],
  ['f16', '02_令和8年度保育所等利用申込書.pdf', 'l7', 934500, 'done', '読取完了', '2026-10-14 15:02:33', '2026-10-14 15:11:20', '2026-10-14 15:03:01', null, null, 'u6', 'u6', null],
  ['f17', '01_施設型給付費・地域型保育給付費等教育・保育給付認定申請書.pdf', 'l8', 1102300, 'classifying', '分類中（AIが帳票タイプを判定）', '2026-10-15 10:31:02', '2026-10-15 10:31:05', '2026-10-15 10:31:02', null, null, 'u6', 'u6', null],
  ['f18', '02_就労証明書.pdf', 'l9', 640200, 'done', '読取完了', '2026-10-14 15:20:10', '2026-10-14 15:28:44', '2026-10-14 15:20:36', '2026-10-15 08:31:12', null, 'u7', 'u7', null],
  ['f19', '02_就労証明書_2.pdf', 'l9', 655800, 'failed', '帳票の処理中にエラーが発生', '2026-10-15 09:12:00', '2026-10-15 09:12:40', '2026-10-15 09:12:31', null, null, 'u7', 'u7', null],
  ['f20', '01_児童手当 認定請求書.pdf', 'l10', 812400, 'approved', '承認済み', '2026-10-13 11:02:19', '2026-10-13 11:15:40', '2026-10-13 11:02:55', '2026-10-13 17:20:08', '2026-10-14 09:00:00', 'u8', 'u8', 'u7'],
  ['f21', '40-01_児童手当 認定請求書_記入済.pdf', 'l10', 889100, 'done', '読取完了', '2026-10-14 16:40:00', '2026-10-14 16:52:11', '2026-10-14 16:40:28', null, null, 'u8', 'u8', null],
  ['f22', '03_児童手当 別居監護申立書.pdf', 'l11', 401300, 'reading', '読取処理中（2秒経過）', '2026-10-15 10:44:12', '2026-10-15 10:44:15', '2026-10-15 10:44:12', null, null, 'u8', 'u8', null],
  ['f23', '01_介護保険認定申請書（新規・更新）.pdf', 'l12', 702800, 'done', '読取完了', '2026-10-14 10:11:20', '2026-10-14 10:20:02', '2026-10-14 10:11:58', null, null, 'u3', 'u3', null],
  ['f24', '02_介護保険認定申請書.pdf', 'l12', 698400, 'confirmed', '確認済み', '2026-10-14 10:14:44', '2026-10-14 10:52:33', '2026-10-14 10:15:09', '2026-10-14 11:30:20', null, 'u3', 'u3', null],
  ['f25', '高齢者等実態調査票.pdf', 'l13', 512700, 'done', '読取完了', '2026-10-13 13:41:02', '2026-10-13 13:50:44', '2026-10-13 13:41:39', null, null, 'u6', 'u6', null],
  ['f26', '61_高齢者等実態調査票_記入済(既存_修正).pdf', 'l14', 733100, 'failed', '帳票の処理中にエラーが発生', '2026-10-13 13:44:20', '2026-10-13 13:44:58', '2026-10-13 13:45:02', null, null, 'u6', 'u6', null],
  ['f27', '62_高齢者等実態調査票_記入済(新規_年齢到達).pdf', 'l14', 749600, 'reading', '読取処理中（5/12ページ）', '2026-10-15 10:05:12', '2026-10-15 10:06:01', '2026-10-15 10:05:20', null, null, 'u6', 'u6', null],
  ['f28', '62_高齢者等実態調査票_記入済(既存_修正_障害者).pdf', 'l14', 761200, 'done', '読取完了', '2026-10-14 09:02:44', '2026-10-14 09:12:20', '2026-10-14 09:03:18', '2026-10-14 15:40:00', '2026-10-15 08:10:00', 'u6', 'u6', 'u3'],
  ['f29', '01_令和7年度分市民税・県民税申告書（兼・国保税申告書）_検証.pdf', 'l4', 998700, 'done', '読取完了', '2026-10-13 15:22:00', '2026-10-13 15:31:10', '2026-10-13 15:22:41', null, null, 'u5', 'u5', null],
  ['f30', '01_令和7年度分市民税・県民税申告書（兼・国保税申告書）_検証2.pdf', 'l4', 1002400, 'done', '読取完了', '2026-10-15 10:50:33', '2026-10-15 10:51:10', '2026-10-15 10:50:40', null, null, 'u5', 'u5', null],
  ['f31', '01_児童手当 認定請求書_読取待ち.pdf', 'l11', 512000, 'waiting', '読取待ち', '2026-10-15 11:02:10', '2026-10-15 11:02:10', null, null, null, 'u5', 'u5', null],
  ['f32', '02_令和8年度保育所等利用申込書_読取待ち.pdf', 'l7', 486400, 'waiting', '読取待ち', '2026-10-15 11:05:44', '2026-10-15 11:05:44', null, null, null, 'u6', 'u6', null],
  ['f33', '10_A団体_住民異動届_読取待ち.pdf', 'l1', 301200, 'waiting', '読取待ち', '2026-10-15 11:09:02', '2026-10-15 11:09:02', null, null, null, 'u7', 'u7', null],
  ['f34', '20_B団体_住民異動届_確認中.pdf', 'l2', 318700, 'checking', '確認中（確認者作業中）', '2026-10-14 19:10:03', '2026-10-15 09:31:12', '2026-10-14 19:11:40', null, null, 'u2', 'u4', null],
  ['f35', '02_特別徴収関係一式_確認中.pdf', 'l5', 402100, 'checking', '確認中（確認者作業中）', '2026-10-14 19:22:18', '2026-10-15 09:35:44', '2026-10-14 19:24:02', null, null, 'u3', 'u4', null],
  ['f36', '01_介護保険認定申請書（新規・更新）_確認中.pdf', 'l12', 377900, 'checking', '確認中（確認者作業中）', '2026-10-14 19:40:51', '2026-10-15 09:41:20', '2026-10-14 19:42:10', null, null, 'u5', 'u4', null],
  ['f37', '21_B団体_住民異動届_記入済(全部転入)_読取失敗.pdf', 'l3', 289400, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 20:02:31', '2026-10-14 20:03:05', '2026-10-14 20:02:44', null, null, 'u6', 'u6', null],
  ['f38', '10_給与支払報告書（総括表・個人別明細書）_読取失敗.pdf', 'l6', 733100, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 20:10:12', '2026-10-14 20:11:02', '2026-10-14 20:10:30', null, null, 'u3', 'u3', null],
  ['f39', '高齢者等実態調査票_読取失敗.pdf', 'l13', 512700, 'failed', '帳票の処理中にエラーが発生', '2026-10-14 20:18:47', '2026-10-14 20:19:20', '2026-10-14 20:19:01', null, null, 'u8', 'u8', null],
  ['f40', '10_A団体_住民異動届_確認済み.pdf', 'l1', 333300, 'confirmed', '確認済み', '2026-10-13 09:12:44', '2026-10-14 10:02:33', '2026-10-13 09:14:09', '2026-10-14 10:02:20', null, 'u2', 'u4', null],
  ['f41', '02_特別徴収関係一式_確認済み.pdf', 'l5', 418200, 'confirmed', '確認済み', '2026-10-13 09:30:02', '2026-10-14 10:20:15', '2026-10-13 09:31:39', '2026-10-14 10:19:58', null, 'u3', 'u4', null],
  ['f42', '01_児童手当 認定請求書_確認済み.pdf', 'l11', 355600, 'confirmed', '確認済み', '2026-10-13 10:05:20', '2026-10-14 10:41:02', '2026-10-13 10:06:58', '2026-10-14 10:40:47', null, 'u5', 'u4', null],
  ['f43', '20_B団体_住民異動届_承認済み.pdf', 'l2', 329800, 'approved', '承認済み・出力待ち', '2026-10-12 13:31:10', '2026-10-14 11:20:31', '2026-10-12 13:32:44', '2026-10-13 09:10:12', '2026-10-14 11:20:05', 'u2', 'u4', 'u3'],
  ['f44', '01_令和8年度分市民税・県民税申告書_差戻中.pdf', 'l4', 648900, 'returned', '差戻中（確認者より差戻）', '2026-10-13 15:02:44', '2026-10-14 14:10:02', '2026-10-13 15:04:20', '2026-10-14 09:30:11', null, 'u2', 'u3', 'u3'],
  ['f45', '10_給与支払報告書（総括表・個人別明細書）_出力済み.pdf', 'l6', 702500, 'exported', '出力済み', '2026-10-11 11:12:02', '2026-10-14 16:02:11', '2026-10-11 11:13:40', '2026-10-12 09:20:30', '2026-10-13 10:05:00', 'u3', 'u3', 'u4'],
];

/* ── 読取結果確認ページのモック（assets/review-sample.pdf＝住民異動届） ── */
/** 項目番号の記号（製品の確認エリアと同じ ①②③…） */
const CIRCLED_NUMBERS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const fieldNum = (i) => CIRCLED_NUMBERS[i] || `${i + 1}.`;
/** 確認プレビュー用実帳票（スキャナ PDF を PNG 化したもの） */
const REVIEW_DOC = {
  pdf: './assets/review-sample.pdf',
  image: './assets/review-sample.png',
  fileName: '10_A団体_住民異動届.pdf',
  layoutId: 'l1',
  pages: 1,
  title: '住民異動届（住居地届）',
};
/**
 * bbox はプレビュー画像上の位置（%、左上原点）。
 * reviewPos=true（「項目位置を非表示」ON）のときは描画しない。
 */
const OCR_FIELDS = {
  b6: [
    { key: 'notify_to', label: 'あて先', value: '千代田区長', required: true, bbox: { t: 4, l: 3, w: 18, h: 4 } },
    { key: 'notify_date', label: '届出年月日', value: '令和8年4月13日', required: true, bbox: { t: 8, l: 22, w: 22, h: 4.5 } },
    { key: 'move_date', label: '異動年月日', value: '令和8年4月10日', required: true, bbox: { t: 8, l: 46, w: 22, h: 4.5 } },
    { key: 'move_type', label: '異動区分', value: '転入', required: true, bbox: { t: 13, l: 3, w: 38, h: 8 }, hasError: true },
    { key: 'new_addr_kana', label: '新しい住所（フリガナ）', value: 'チヨダク ヒビヤ 1-1', required: true, bbox: { t: 22, l: 3, w: 42, h: 3.5 } },
    { key: 'new_addr', label: '新しい住所', value: '東京都千代田区日比谷1-1', required: true, bbox: { t: 25.5, l: 3, w: 42, h: 5 } },
    { key: 'new_head_kana', label: '新しい世帯主（フリガナ）', value: 'ヤマダ タロウ', required: true, bbox: { t: 22, l: 46, w: 20, h: 3.5 } },
    { key: 'new_head', label: '新しい世帯主', value: '山田 太郎', required: true, bbox: { t: 25.5, l: 46, w: 20, h: 5 } },
    { key: 'old_addr_kana', label: '今までの住所（フリガナ）', value: 'シナガワク オオサキ 2-2-3', bbox: { t: 31.5, l: 3, w: 42, h: 3.5 } },
    { key: 'old_addr', label: '今までの住所', value: '東京都品川区大崎2-2-3', required: true, bbox: { t: 35, l: 3, w: 42, h: 5 } },
    { key: 'old_head', label: '今までの世帯主', value: '山田 太郎', bbox: { t: 35, l: 46, w: 20, h: 5 } },
    { key: 'notifier_rel', label: '届出人（続柄）', value: '世帯主', required: true, bbox: { t: 4, l: 70, w: 27, h: 6 } },
    { key: 'notifier_name', label: '届出人氏名', value: '山田 太郎', required: true, bbox: { t: 11, l: 70, w: 16, h: 4.5 } },
    { key: 'notifier_tel', label: '届出人電話番号', value: '03-1234-5678', required: true, bbox: { t: 11, l: 87, w: 11, h: 4.5 } },
    { key: 'proxy_addr', label: '代理人住所', value: '', bbox: { t: 16, l: 70, w: 28, h: 5 } },
    { key: 'id_verify', label: '本人確認書類', value: '', required: true, hasError: true, bbox: { t: 72, l: 72, w: 25, h: 10 } },
  ],
  default: [
    { key: 'name', label: '氏名', value: '' },
    { key: 'kana', label: 'フリガナ', value: '' },
    { key: 'birth', label: '生年月日', value: '' },
    { key: 'addr', label: '住所', value: '' },
    { key: 'tel', label: '電話番号', value: '' },
  ],
};
const OCR_TABLES = {
  default: [
    { key: 'r1_kana', label: '行1_氏名フリガナ', value: 'ヤマダ タロウ', bbox: { t: 44, l: 6, w: 22, h: 3 } },
    { key: 'r1_name', label: '行1_氏名', value: '山田 太郎', required: true, bbox: { t: 47, l: 6, w: 22, h: 4 } },
    { key: 'r1_birth', label: '行1_生年月日', value: '昭和55年3月12日', required: true, bbox: { t: 44, l: 29, w: 16, h: 7 } },
    { key: 'r1_gender', label: '行1_性別', value: '男', bbox: { t: 44, l: 46, w: 6, h: 7 } },
    { key: 'r1_rel_new', label: '行1_新続柄', value: '世帯主', bbox: { t: 44, l: 53, w: 7, h: 7 } },
    { key: 'r1_rel_old', label: '行1_旧続柄', value: '世帯主', bbox: { t: 44, l: 60, w: 7, h: 7 } },
    { key: 'r2_kana', label: '行2_氏名フリガナ', value: 'ヤマダ ハナコ', bbox: { t: 52, l: 6, w: 22, h: 3 } },
    { key: 'r2_name', label: '行2_氏名', value: '山田 花子', required: true, bbox: { t: 55, l: 6, w: 22, h: 4 } },
    { key: 'r2_birth', label: '行2_生年月日', value: '昭和58年7月20日', required: true, bbox: { t: 52, l: 29, w: 16, h: 7 } },
    { key: 'r2_gender', label: '行2_性別', value: '女', bbox: { t: 52, l: 46, w: 6, h: 7 } },
    { key: 'r2_rel_new', label: '行2_新続柄', value: '妻', bbox: { t: 52, l: 53, w: 7, h: 7 } },
    { key: 'r2_rel_old', label: '行2_旧続柄', value: '妻', bbox: { t: 52, l: 60, w: 7, h: 7 } },
    { key: 'r3_name', label: '行3_氏名', value: '', hasError: true, bbox: { t: 60, l: 6, w: 22, h: 7 } },
  ],
};
/** 読取直後の値（修正判定の基準）。save で更新される */
const OCR_ORIGINAL = {
  text: Object.fromEntries(OCR_FIELDS.b6.map((x) => [x.key, x.value || ''])),
  table: Object.fromEntries(OCR_TABLES.default.map((x) => [x.key, x.value || ''])),
};


/* ── ユーザー管理・セキュリティ・ログのモック（実機の列に合わせる） ── */
/* uid＝帳票権限・マイタスク側のユーザー（USERS）との対応。所属グループはこの uid で引く。 */
/* dataPerm：自身のみ＝自分に割当／自分が処理したタスクだけ。全件参照＝同権限プール内の他人の待办／已办も見える。
 * 操作権限・所属はユーザーグループ側で付与（ユーザー個別では持たない）。システム管理者は全操作。 */
const ENT_USERS = [
  { id: 'U1', uid: 'u1', name: '佐藤 美子', email: 'miko.sato@itso.co.jp', role: 'システム管理者', dataPerm: '全件参照', created: '2026-09-30 10:12:00', status: '有効' },
  { id: 'U2', uid: 'u2', name: '鈴木 太郎', email: 'taro.suzuki@itso.co.jp', role: '確認者', dataPerm: '自身のみ', created: '2026-10-01 09:02:11', status: '有効' },
  { id: 'U3', uid: 'u3', name: '山田 健太', email: 'kenta.yamada@itso.co.jp', role: '運用管理者', dataPerm: '全件参照', created: '2026-10-02 14:20:31', status: '有効' },
  /* uid は USERS と対応。u4＝田中（確認＋承認兼務）、u5＝承認専任 → 操作は所属グループの役割で決まる */
  { id: 'U4', uid: 'u4', name: '田中 実', email: 'minoru.tanaka@itso.co.jp', role: '承認者', dataPerm: '自身のみ', created: '2026-10-03 11:45:02', status: '有効' },
  { id: 'U5', uid: 'u5', name: '伊藤 由美', email: 'yumi.ito@itso.co.jp', role: '承認者', dataPerm: '自身のみ', created: '2026-10-05 08:31:10', status: '有効' },
  { id: 'U6', uid: 'u6', name: '渡辺 修', email: 'osamu.watanabe@itso.co.jp', role: '確認者', dataPerm: '自身のみ', created: '2026-10-06 10:05:44', status: '有効' },
  { id: 'U7', uid: 'u7', name: '山本 彩', email: 'aya.yamamoto@itso.co.jp', role: 'アップロード者', dataPerm: '自身のみ', created: '2026-10-07 13:22:09', status: '有効' },
  { id: 'U8', uid: 'u8', name: '中村 亮', email: 'ryo.nakamura@itso.co.jp', role: '確認者', dataPerm: '自身のみ', created: '2026-10-08 09:41:30', status: '有効' },
];
/** システム権限（メニュー到達）。業務の操作権限はユーザーグループの役割で付与する */
let ROLES = [
  { id: 'R1', name: 'システム管理者', code: 'tenant_admin', desc: '万能権限。メニュー全到達に加え、帳票／アップロード権限表をバイパスして全業務を実行できる', created: '2025-10-01 00:00:00', status: '有効' },
  { id: 'R2', name: '運用管理者', code: 'operation_admin', desc: '帳票設定＋利用設定＋ユーザー管理。日常運用の管理者', created: '2025-10-01 00:00:00', status: '有効' },
  { id: 'R3', name: '確認者', code: 'confirmer', desc: '読取結果の確認・修正。マイタスクの確認作業', created: '2025-10-01 00:00:00', status: '有効' },
    { id: 'R5', name: 'アップロード者', code: 'uploader', desc: 'ファイルのアップロードと読取結果の閲覧', created: '2025-10-01 00:00:00', status: '有効' },
];
/** システム管理者ロール ID（メニュー全許可＋業務権限バイパス） */
const TENANT_ADMIN_ROLE = 'R1';
/** ユーザー追加ダイアログのデータ権限（製品の選択肢） */
/**
 * 操作権限のラベル定義（付与はユーザーグループの「役割」で行う）。
 * システム権限（メニュー到達）とは別物。OCR結果修正は確認に付随。
 */
const USER_OPS = [ { key: 'view', label: '閲覧' }, { key: 'upload', label: 'アップロード' }, { key: 'read', label: '読取' }, { key: 'confirm', label: '確認' }, { key: 'export', label: '出力' }, ];

const DATA_PERMISSIONS = ['自身のみ', '全件参照'];

/** uid（USERS）→ ユーザー管理レコード */
function entUserByUid(uid) {
  const id = uid || (typeof state !== 'undefined' ? state.currentUser : null);
  return ENT_USERS.find((u) => u.uid === id) || null;
}

/** データ権限：自身のみ／全件参照。システム管理者は常に全件参照 */
function dataPermOf(uid) {
  const me = uid || state.currentUser;
  if (isTenantAdmin(me)) return '全件参照';
  const eu = entUserByUid(me);
  return (eu && DATA_PERMISSIONS.includes(eu.dataPerm)) ? eu.dataPerm : '自身のみ';
}

/** 所属グループの役割から操作権限を集約（1 グループ 1 役割。兼務は和集合） */
function userOpsOf(uOrUid) {
  const uid = (uOrUid && typeof uOrUid === 'object')
    ? (uOrUid.uid || uOrUid.id)
    : uOrUid;
  const me = uid || (typeof state !== 'undefined' ? state.currentUser : null);
  if (isTenantAdmin(me)) return USER_OPS.map((o) => o.key);
  const seen = new Set();
  const out = [];
  const add = (key) => {
    const k = key === 'fix' ? 'confirm' : key;
    if (!USER_OPS.some((o) => o.key === k) || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  groupsOfUser(me).forEach((g) => { String(g.kind || '').split(/[、,]/).map((x) => x.trim()).filter(Boolean).forEach((label) => { const kind = GROUP_KINDS.find((k) => k.label === label); (kind && kind.ops ? kind.ops : []).forEach(add); const key = (typeof GROUP_ROLE_OP_KEY !== 'undefined') && GROUP_ROLE_OP_KEY[label]; if (key && key !== 'settings') add(key); }); /* 帳票権限表の承認段に入っていれば 承認／再承認 を付与する */ LAYOUT.forEach((l) => { const n = Math.max(1, approvalStageCountOf(l.id)); for (let si = 0; si < n; si++) { if (stageTargetsOf(l.id, si).indexOf(g.id) >= 0) add(si === 0 ? 'approve' : 'reapprove'); } }); });
  /* CSV出力は業務操作があれば付随。帳票設定変更はシステム権限ロール側 */
  if (out.some((k) => k === 'view' || k === 'confirm' || k === 'approve' || k === 'upload')) add('export');
  const eu = entUserByUid(me);
  if (eu && (eu.role === 'システム管理者' || eu.role === '運用管理者')) add('settings');
  return out;
}

/** 操作権限。グループ役割から判定。未所属時は帳票権限プールから推定。管理者は全操作可 */
function userHasOp(op, uid) {
  const me = uid || state.currentUser;
  if (isTenantAdmin(me)) return true;
  /* OCR結果修正＝確認権限に含まれる */
  if (op === 'fix') return userHasOp('confirm', me);
  const fromGroups = userOpsOf(me);
  if (fromGroups.length) {
    if (fromGroups.includes(op)) return true;
    /* グループ役割で明示されている操作は、それ以外を落とす（確認者に承認を見せない等） */
    if (op === 'confirm' || op === 'approve' || op === 'upload' || op === 'view' || op === 'export' || op === 'settings') {
      return false;
    }
  }
  if (op === 'confirm') return LAYOUT.some((l) => userMatchesTargets(me, permsOf(l.id).confirm || []));
  if (op === 'approve') {
    return LAYOUT.some((l) => {
      const p = permsOf(l.id);
      return userMatchesTargets(me, p.approve || []) || userMatchesTargets(me, p.reapprove || []);
    });
  }
  if (op === 'view') return LAYOUT.some((l) => userMatchesTargets(me, permsOf(l.id).view || []));
  if (op === 'upload') return uploadableBusiness(me).length > 0;
  if (op === 'export') return userHasOp('view', me);
  if (op === 'settings') {
    const eu = entUserByUid(me);
    return !!(eu && (eu.role === 'システム管理者' || eu.role === '運用管理者'));
  }
  return false;
}
/** ユーザー追加ダイアログの入力値（null＝閉じている） */
let USER_ADD_DRAFT = null;

const SECURITY = {
  /* セキュリティ設定は 3 モジュールだけ（データ保存期限／IPアドレスホワイトリスト／アイドルセッション） */
  retention: '12ヶ月',      // 7日 / 14日 / 1ヶ月 / 2ヶ月 / 3ヶ月 / 6ヶ月 / 12ヶ月
  ipEnabled: '無効',        // 無効 / 有効
  idle: '制限なし',         // 15分 / 30分 / 60分 / 2時間 / 制限なし
  logs: [
    { at: '2026-10-14 20:51:32', user: 'miko.sato@itso.co.jp', type: '帳票読取', ip: '172.16.51.8', result: '成功', note: '—' },
    { at: '2026-10-14 20:19:45', user: 'miko.sato@itso.co.jp', type: 'ダウンロード', ip: '172.16.51.8', result: '成功', note: 'CSV 12件' },
    { at: '2026-10-14 19:02:48', user: 'taro.suzuki@itso.co.jp', type: '確認', ip: '172.16.51.20', result: '成功', note: '確認担当者: 山田 健太' },
    { at: '2026-10-14 17:44:02', user: 'misaki.nakamura@itso.co.jp', type: 'ログイン', ip: '172.16.51.33', result: '失敗', note: 'パスワード誤り' },
    { at: '2026-10-14 15:10:40', user: 'minoru.tanaka@itso.co.jp', type: '設定変更', ip: '172.16.51.44', result: '成功', note: 'エクスポート設定' },
    { at: '2026-10-14 09:12:00', user: 'miko.sato@itso.co.jp', type: 'アップロード', ip: '172.16.51.8', result: '成功', note: '3ファイル' },
  ],
};

/* ── 権限管理のモック ────────────────────────────────────────────────────
 * システムレベル：ロール（ROLES）＋ メニュー権限（MENU_TREE / MENU_PERMS）
 *                  ＝「利用設定 ＞ 権限設定」。画面到達可否だけを持つ。
 * 業務レベル　　：① 帳票タイプ × 4 業務操作 → グループ／ユーザー（TICKET_PERMS）
 *                ② 業務シーン × アップロード → グループ／ユーザー（UPLOAD_PERMS）
 *                  ＝帳票権限管理画面に上下で並べる。メニュー権限とは混ぜない。
 * -------------------------------------------------------------------- */

/** 帳票の 4 業務操作（閲覧 → 確認 → 承認 → 再承認 の順で固定）
 *  承認＝1 段目の承認、再承認＝2 段目の承認（2 段承認のときだけ担当を設定する）。
 *  アップロードは業務シーン単位のため、この表には入れず UPLOAD_PERMS で管理する。 */
const PERM_ACTS = [
  { key: 'view', label: '閲覧', hint: '帳票を開いて内容を見る' },
  { key: 'upload', label: 'アップロード', hint: '帳票を取り込む' },
  { key: 'fix', label: 'OCR結果修正', hint: '読取結果を修正する' },
  { key: 'confirm', label: '確認', hint: '読取結果を確認済みにする' },
  { key: 'export', label: 'CSV出力', hint: 'CSV を出力する' },
  { key: 'settings', label: '帳票設定変更', hint: '帳票タイプの設定を変更する' }
];
/** 操作キー → 表示ラベル */
const permActLabel = (key) => ((PERM_ACTS.find((a) => a.key === key) || USER_OPS.find((o) => o.key === key) || {}).label) || key;
/** 操作キー → 補足説明 */
const permActHint = (key) => (PERM_ACTS.find((a) => a.key === key) || {}).hint || '';

/* 担当の選択は「ユーザーグループ」か「ユーザー」の 2 択。
 * グループを選んだ場合、割当はグループに属するユーザーの誰かにランダムで行う。
 * ユーザーを選んだ場合は単選でその 1 名に固定割当。
 * グループは業務ロールの単位（閲覧／確認／承認／再承認／アップロード）。ロール（権限）はメニュー到達権限の
 * ためだけに使い、帳票権限表には出さない。 */

/** 【帳票権限表】帳票タイプ × 操作 → ユーザーグループ ID（g*）またはユーザー ID（u*）。
 *  確認／承認／再承認＝フロー担当。閲覧＝見える人。
 *  再承認に担当がいれば 2 段、空なら 1 段（または承認空＝承認不要）。 */
let TICKET_PERMS = {
  /* 各操作はグループかユーザーのどちらか一方のみ（2 択） */
  /* 10_住民異動関係 */
  l1: { view: ['g1'], confirm: ['g1'], approve: ['g2'], reapprove: ['g3'] },   // 2 段承認
  l2: { view: ['g1'], confirm: ['g1'], approve: ['g2'], reapprove: [] },       // 1 段承認
  l3: { view: ['g1'], confirm: ['g1'], approve: ['g2'], reapprove: [] },
  /* 20_税務関係 */
  l4: { view: ['g4'], confirm: ['g4'], approve: ['g5'], reapprove: [] },
  l5: { view: ['g4'], confirm: ['g4'], approve: ['g5'], reapprove: [] },
  l6: { view: ['g4'], confirm: ['g4'], approve: ['g5'], reapprove: [] },
  /* 30_保育所等入所の申込手続 */
  l7: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l8: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l15: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l9: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l17: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l18: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l19: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  /* 40_児童手当 */
  l10: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l11: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l20: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  l21: { view: ['g6'], confirm: ['g6'], approve: ['g7'], reapprove: [] },
  /* 50_介護保険関係（承認不要） */
  l12: { view: ['g8'], confirm: ['g8'], approve: [], reapprove: [] },
  l22: { view: ['g8'], confirm: ['g8'], approve: [], reapprove: [] },
  /* 60_高齢者実態調査（確認と承認が同じグループ） */
  l13: { view: ['g9'], confirm: ['g9'], approve: ['g9'], reapprove: [] },
  l14: { view: ['g9'], confirm: ['g9'], approve: ['g9'], reapprove: [] },
  l23: { view: ['g9'], confirm: ['g9'], approve: ['g9'], reapprove: [] },
  l24: { view: ['g9'], confirm: ['g9'], approve: ['g9'], reapprove: [] },
};
const permTargetKind = (id) => (byId(ROLES, id) ? 'role' : byId(GROUPS, id) ? 'grp' : 'usr');
const permTargetName = (id) => (byId(ROLES, id) || byId(GROUPS, id) || {}).name || userName(id) || id;

/* 追加操作のキーを既存データへ補完（serve.py 注入） */
Object.keys(TICKET_PERMS || {}).forEach(function (lid) {
  var p = TICKET_PERMS[lid];
  ['upload', 'fix', 'export', 'settings'].forEach(function (k) {
    if (!Array.isArray(p[k])) p[k] = [];
  });
});
const permsOf = (layoutId) => TICKET_PERMS[layoutId] || { view: [], confirm: [], approve: [], reapprove: [] };

/** 【アップロード権限表】業務シーン（BUSINESS）× アップロード可 → グループ／ユーザー。
 *  窓口の確認グループがアップロードも担う想定。帳票タイプ権限とは別表。 */
let UPLOAD_PERMS = {
  b1: ['g1'],   // 住民異動窓口
  b2: ['g4'],   // 税務窓口
  b3: ['g6'],   // 保育・児童窓口
  b4: ['g6'],
  b5: ['g8'],   // 介護保険窓口
  b6: ['g9'],   // 高齢者調査担当
};
const uploadPermsOf = (bizId) => UPLOAD_PERMS[bizId] || [];

/** ユーザーが対象 ID（グループ／ユーザー）のいずれかに該当するか */
function userMatchesTargets(uid, targets) {
  if (!uid || !targets || !targets.length) return false;
  if (targets.includes(uid)) return true;
  return targets.some((tid) => {
    const g = byId(GROUPS, tid);
    return g && (g.userIds || []).includes(uid);
  });
}

/** システム管理者か（メニュー全到達＋帳票／アップロード権限表をバイパス）
 *  デモ既定の「全システム・全メニュー権限」は window.DEMO_FULL_ADMIN で立てる
 *  （admin-mode.js。URL に ?perm=1 を付けると権限どおりの制限に戻る）。 */
function isTenantAdmin(uid) {
  if (typeof window !== 'undefined' && window.DEMO_FULL_ADMIN === true) return true;
  const me = uid || (typeof state !== 'undefined' ? state.currentUser : null);
  if (!me) return false;
  const members = (typeof ROLE_MEMBERS !== 'undefined' && ROLE_MEMBERS[TENANT_ADMIN_ROLE]) || [];
  return members.includes(me);
}

/** 帳票タイプの業務操作ができるか（システム管理者は常に可） */
function canTicketAct(layoutId, act, uid) {
  const me = uid || state.currentUser;
  if (isTenantAdmin(me)) return true;
  return userMatchesTargets(me, (permsOf(layoutId)[act] || []));
}

/** 現在ユーザーがその業務シーンへアップロードできるか */
function canUploadBiz(bizId, uid) {
  const me = uid || state.currentUser;
  if (!bizId) return false;
  if (isTenantAdmin(me)) return !!byId(BUSINESS, bizId);
  return userMatchesTargets(me, uploadPermsOf(bizId));
}

/** 現在ユーザーがアップロード可能な業務シーン一覧（order 順） */
function uploadableBusiness(uid) {
  const me = uid || state.currentUser;
  if (isTenantAdmin(me)) return BUSINESS.slice().sort((a, b) => a.order - b.order);
  return BUSINESS.filter((b) => canUploadBiz(b.id, me)).slice().sort((a, b) => a.order - b.order);
}

/** アップロード画面の選択中業務シーンを権限内に揃える */
function ensureUpBizAllowed() {
  const allowed = uploadableBusiness();
  if (!allowed.length) { state.upBiz = ''; return allowed; }
  if (!allowed.some((b) => b.id === state.upBiz)) state.upBiz = allowed[0].id;
  return allowed;
}

/** メニュー権限ツリー（システムレベル。AI画像処理／外部API は置かない） */
const MENU_TREE = [
  { id: 'llm-ocr', label: 'LLM-OCR', children: [
    { id: 'home', label: 'ホーム' },
    { id: 'upload', label: '新規アップロード' },
    { id: 'result', label: 'ファイル一覧' },
    { id: 'myTasks', label: 'マイタスク' },
    /* 帳票設定：画面到达权限＝親、ボタン操作权限＝子 */
    { id: 'settings', label: '帳票設定', children: [
      { id: 'settings-type', label: '帳票タイプ設定', children: [
        { id: 'settings-type-add', label: 'タイプ追加' },
        { id: 'settings-type-edit', label: 'タイプ編集' },
        { id: 'settings-type-workflow', label: 'ワークフロー編集' },
        { id: 'settings-type-form-del', label: 'タイプ削除' },
      ] },
      { id: 'settings-scenes', label: '業務シーン設定', children: [
        { id: 'settings-scenes-add', label: '業務シーン追加' },
        { id: 'settings-scenes-edit', label: '業務シーン編集' },
        { id: 'settings-scenes-del', label: '業務シーン削除' },
      ] },
    ] },
    { id: 'usage', label: '利用設定', children: [
      { id: 'usage-users', label: 'ユーザー管理', children: [
        { id: 'usage-users-add', label: 'ユーザー追加' },
        { id: 'usage-users-edit', label: 'ユーザー編集' },
        { id: 'usage-users-toggle', label: 'ユーザー無効化' },
        { id: 'usage-groups-add', label: 'グループ追加' },
        { id: 'usage-groups-edit', label: 'グループ編集' },
        { id: 'usage-groups-del', label: 'グループ削除' },
      ] },
      { id: 'usage-permissions', label: '権限設定', children: [
        { id: 'permissions-menu', label: 'メニュー権限設定' },
        { id: 'permissions-add', label: '権限作成' },
        { id: 'permissions-edit', label: '権限編集' },
        { id: 'permissions-del', label: '権限削除' },
      ] },
      { id: 'usage-security', label: 'セキュリティ設定' },
      { id: 'usage-logs', label: 'ログ設定' },
      { id: 'usage-api', label: 'API設定' },
    ] },
  ] },
];

const MENU_LEAVES = (() => {
  const out = [];
  const walk = (nodes) => nodes.forEach((n) => { if (n.children) walk(n.children); else out.push(n.id); });
  walk(MENU_TREE);
  return out;
})();
let MENU_PERMS = {
  /* システム管理者＝メニュー全項目（業務権限も isTenantAdmin でバイパス） */
  R1: MENU_LEAVES.slice(),
  /* 運用管理者（通用管理者）＝帳票設定まわり＋ユーザー管理 */
  R2: [
    'home', 'upload', 'result', 'myTasks',
    'settings-type', 'settings-type-add', 'settings-type-edit', 'settings-type-workflow',
    'settings-type-form-del',
    'settings-scenes', 'settings-scenes-add', 'settings-scenes-edit',
    'usage-users', 'usage-users-add', 'usage-users-edit', 'usage-users-toggle',
    'permissions-menu', 'usage-security', 'usage-logs', 'usage-api',
  ],
  /* 確認者＝アップロード・結果一覧・マイタスク（確認） */
  R3: ['home', 'upload', 'result', 'myTasks'],
  /* 承認者＝結果一覧・マイタスク（承認） */
  R4: ['home', 'result', 'myTasks'],
  /* アップロード者＝ファイル選択と結果閲覧 */
  R5: ['home', 'upload', 'result'],
};

/* 万能角色：メニューもユーザー権限もすべて許可（serve.py 注入） */
var SUPER_ROLE_ID = 'R9';
var ROLE_OPS = {
  R1: ['view', 'upload', 'fix', 'confirm', 'approve', 'export', 'settings'],
  R2: ['view', 'upload', 'confirm', 'approve', 'export', 'settings'],
  R3: ['view', 'upload', 'fix', 'confirm', 'export'],
  R4: ['view', 'approve', 'export'],
  R5: ['view', 'upload'],
  R9: ['view', 'upload', 'fix', 'confirm', 'approve', 'export', 'settings']
};
(function ensureSuperRole() {
  var list = (typeof ROLES !== 'undefined' && ROLES) || null;
  if (!list) return;
  if (!list.some(function (r) { return r.id === SUPER_ROLE_ID; })) {
    list.push({
      id: SUPER_ROLE_ID, name: '万能（全権限）', code: 'super_admin',
      desc: 'すべての画面・操作・帳票タイプにアクセスできます',
      created: '2025-10-01 00:00:00', status: '有効'
    });
  }
  var perms = (typeof MENU_PERMS !== 'undefined' && MENU_PERMS) || null;
  var leaves = (typeof MENU_LEAVES !== 'undefined' && MENU_LEAVES) || null;
  if (perms && leaves) perms[SUPER_ROLE_ID] = leaves.slice();
})();


/* ── 帳票設定系のモック（実機の一覧列に合わせる） ── */
let TICKET_TYPES = [
  { id: 'T1', name: '10_A団体_住民異動届', type: '非定型帳票', project: 12, updatedAt: '2026-10-14 20:19:45', user: '佐藤 美子' },
  { id: 'T2', name: '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）', type: '非定型帳票', project: 18, updatedAt: '2026-10-14 17:00:25', user: '鈴木 太郎' },
  { id: 'T3', name: '02_特別徴収関係一式', type: '非定型帳票', project: 9, updatedAt: '2026-10-13 11:02:19', user: '佐藤 美子' },
  { id: 'T4', name: '10_給与支払報告書（総括表・個人別明細書）', type: '非定型帳票', project: 3, updatedAt: '2026-10-12 09:31:02', user: '中村 美咲' },
  { id: 'T5', name: '02_令和8年度保育所等利用申込書', type: '非定型帳票', project: 5, updatedAt: '2026-10-11 15:22:41', user: '中村 美咲' },
  { id: 'T6', name: '01_児童手当 認定請求書', type: '定型帳票', project: 7, updatedAt: '2026-10-10 13:04:12', user: '佐藤 美子' },
  { id: 'T7', name: '01_介護保険認定申請書（新規・更新）', type: '定型帳票', project: 4, updatedAt: '2026-10-09 18:44:05', user: '佐藤 美子' },
  { id: 'T8', name: '高齢者等実態調査票', type: '非定型帳票', project: 6, updatedAt: '2026-10-08 10:12:33', user: '中村 美咲' },
];

/* ── 業務シーン設定（原型 llm ocr NL / mock/classifications.ts 準拠）────────────
 * 左リスト＝業務シーン（`samples/申請書類サンプル/` のフォルダ名をそのまま使用）、
 * 右＝その業務シーンに属する帳票（同フォルダ内 PDF のファイル名から拡張子を外したもの）。
 * 1 業務シーンあたり最大 20 種類まで選択可能。
 * -------------------------------------------------------------------- */
const MAX_CLASSIFY_FORMS = 20;

/** 分類対象の帳票マスタ（samples/申請書類サンプル の PDF 23 件） */
const CLASSIFY_FORMS = [
  /* 10_住民異動関係 */
  { id: 'form-jyumin-a', name: '10_A団体_住民異動届', category: '非定型帳票', sector: 'cls-jyumin' },
  { id: 'form-jyumin-b', name: '20_B団体_住民異動届', category: '非定型帳票', sector: 'cls-jyumin' },
  { id: 'form-jyumin-b-filled', name: '21_B団体_住民異動届_記入済(全部転入)', category: '非定型帳票', sector: 'cls-jyumin' },
  /* 20_税務関係 */
  { id: 'form-tax-shimin', name: '01_令和8年度分市民税・県民税申告書（兼・国保税申告書）', category: '非定型帳票', sector: 'cls-zeimu' },
  { id: 'form-tax-tokucho', name: '02_特別徴収関係一式', category: '非定型帳票', sector: 'cls-zeimu' },
  { id: 'form-tax-kyuyo', name: '10_給与支払報告書（総括表・個人別明細書）', category: '非定型帳票', sector: 'cls-zeimu' },
  /* 30_保育所等入所の申込手続 */
  { id: 'form-hoiku-nintei', name: '01_施設型給付費・地域型保育給付費等教育・保育給付認定申請書', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-moushikomi', name: '02_令和8年度保育所等利用申込書', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-riyu-list', name: '01_保育必要事由及び添付書類一覧', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-shuro', name: '02_就労証明書', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-doctor', name: '03_医師の診断書', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-kaigo', name: '04_介護・看護状況申告書', category: '非定型帳票', sector: 'cls-hoiku' },
  { id: 'form-hoiku-guide', name: '参考_令和8年度保育所等入所のご案内', category: '非定型帳票', sector: 'cls-hoiku' },
  /* 40_児童手当 */
  { id: 'form-jido-nintei', name: '01_児童手当 認定請求書', category: '非定型帳票', sector: 'cls-jido' },
  { id: 'form-jido-kango', name: '02_児童手当 監護相当・生計費の負担についての確認書', category: '非定型帳票', sector: 'cls-jido' },
  { id: 'form-jido-kyochi', name: '03_児童手当 別居監護申立書', category: '非定型帳票', sector: 'cls-jido' },
  { id: 'form-jido-nintei-filled', name: '40-01_児童手当 認定請求書_記入済', category: '非定型帳票', sector: 'cls-jido' },
  /* 50_介護保険関係 */
  { id: 'form-kaigo-shinkiki', name: '01_介護保険認定申請書（新規・更新）', category: '非定型帳票', sector: 'cls-kaigo' },
  { id: 'form-kaigo-koshin', name: '02_介護保険認定申請書', category: '非定型帳票', sector: 'cls-kaigo' },
  /* 60_高齢者実態調査 */
  { id: 'form-korei-kiroku-kizon', name: '61_高齢者等実態調査票_記入済(既存_修正)', category: '非定型帳票', sector: 'cls-korei' },
  { id: 'form-korei-kiroku-shinki', name: '62_高齢者等実態調査票_記入済(新規_年齢到達)', category: '非定型帳票', sector: 'cls-korei' },
  { id: 'form-korei-kiroku-sho', name: '62_高齢者等実態調査票_記入済(既存_修正_障害者)', category: '非定型帳票', sector: 'cls-korei' },
  { id: 'form-korei-base', name: '高齢者等実態調査票', category: '非定型帳票', sector: 'cls-korei' },
];

/** 左リスト＝業務シーン（samples/申請書類サンプル のフォルダ名）。名称はフォルダ名と一致させる。 */
let BIZ_SCENES = [
  {
    id: 'cls-jyumin', name: '10_住民異動関係', sceneId: '2077224056968261701',
    desc: '10_住民異動関係に属する帳票の自動分類設定',
    formIds: ['form-jyumin-a', 'form-jyumin-b', 'form-jyumin-b-filled'],
    userIds: ['u1', 'u2', 'u3'],
    updatedAt: '2026-10-14 19:20:11',
  },
  {
    id: 'cls-zeimu', name: '20_税務関係', sceneId: '2077224056968261702',
    desc: '20_税務関係に属する帳票の自動分類設定',
    formIds: ['form-tax-shimin', 'form-tax-tokucho', 'form-tax-kyuyo'],
    userIds: ['u4', 'u5'],
    updatedAt: '2026-10-13 16:02:40',
  },
  {
    id: 'cls-hoiku', name: '30_保育所等入所の申込手続', sceneId: '2077224056968261703',
    desc: '30_保育所等入所の申込手続に属する帳票の自動分類設定',
    formIds: ['form-hoiku-nintei', 'form-hoiku-moushikomi', 'form-hoiku-riyu-list', 'form-hoiku-shuro', 'form-hoiku-doctor', 'form-hoiku-kaigo', 'form-hoiku-guide'],
    userIds: ['u6', 'u7'],
    updatedAt: '2026-10-12 11:45:00',
  },
  {
    id: 'cls-jido', name: '40_児童手当', sceneId: '2077224056968261704',
    desc: '40_児童手当に属する帳票の自動分類設定',
    formIds: ['form-jido-nintei', 'form-jido-kango', 'form-jido-kyochi', 'form-jido-nintei-filled'],
    userIds: ['u6', 'u7'],
    updatedAt: '2026-10-10 09:15:30',
  },
  {
    id: 'cls-kaigo', name: '50_介護保険関係', sceneId: '2077224056968261705',
    desc: '50_介護保険関係に属する帳票の自動分類設定',
    formIds: ['form-kaigo-shinkiki', 'form-kaigo-koshin'],
    userIds: ['u8'],
    updatedAt: '2026-10-08 14:30:05',
  },
  {
    id: 'cls-korei', name: '60_高齢者実態調査', sceneId: '2077224056968261706',
    desc: '60_高齢者実態調査に属する帳票の自動分類設定',
    formIds: ['form-korei-kiroku-kizon', 'form-korei-kiroku-shinki', 'form-korei-kiroku-sho', 'form-korei-base'],
    userIds: ['u8'],
    updatedAt: '2026-10-07 09:00:00',
  },
];
/** 業務シーンごとの効果テスト（②）状態。ファイル未投入なら空。 */
let SCENE_TESTS = {};

/* ── 帳票業務シーン（原画面では「分類1-5」のような区分番号で管理） ── */
const BIZ_CLASSES = ['分類1-1', '分類1-2', '分類1-3', '分類1-4', '分類1-5', '分類2-1', '分類2-2', '分類2-3'];
const bizClassLabel = (businessId) => BIZ_CLASSES[Math.max(0, BUSINESS.findIndex((b) => b.id === businessId)) % BIZ_CLASSES.length];

/* ── ご利用履歴（ホーム）：デモ用に決定的に生成する ────────────────── */
const CALL_METHODS = ['画面呼び出し', 'API呼び出し', '自動監視'];
const HISTORY_LAYOUTS = ['l4', 'l5', 'l7', 'l9', 'l10', 'l12', 'l13', 'l1', 'l6'];
const HISTORY_USERS = [
  { id: 'hu1', name: '鈴木 太郎' },
  { id: 'hu2', name: '佐藤 一郎' },
  { id: 'hu3', name: '鈴木 花子' },
  { id: 'hu4', name: '高橋 健' },
  { id: 'hu5', name: '伊藤 由美' },
  { id: 'hu6', name: 'バッチ処理' },
];

function buildHistory() {
  const rows = [];
  let seed = 20261014;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const total = 868;                       // 画面の「検索結果 868 件中」に合わせる
  for (let i = 0; i < total; i++) {
    const user = HISTORY_USERS[Math.floor(rnd() * HISTORY_USERS.length)];
    const layout = HISTORY_LAYOUTS[Math.floor(rnd() * HISTORY_LAYOUTS.length)];
    const day = 1 + Math.floor(rnd() * 14);
    const p2 = (v) => String(v).padStart(2, '0');
    const p3 = (v) => String(v).padStart(3, '0');
    const st = `2026-10-${p2(day)} ${p2(8 + Math.floor(rnd() * 10))}:${p2(Math.floor(rnd() * 60))}:${p2(Math.floor(rnd() * 60))}`;
    const up = `2026-10-${p2(day)} ${p2(10 + Math.floor(rnd() * 9))}:${p2(Math.floor(rnd() * 60))}:${p2(Math.floor(rnd() * 60))}`;
    const lay = LAYOUT.find((l) => l.id === layout);
    const cat = lay ? CATEGORY.find((c) => c.id === lay.category) : null;
    const biz = cat ? cat.business : null;
    rows.push({
      no: i + 1,
      reqId: '2110' + (3084000000000000 + Math.floor(rnd() * 999999999999)).toString().slice(0, 13),
      layout,
      biz,
      call: CALL_METHODS[Math.floor(rnd() * CALL_METHODS.length)],
      pages: 1 + Math.floor(rnd() * 20),
      startedAt: st,
      updatedAt: up,
      user: user.name,
    });
  }
  return rows;
}
const HISTORY = buildHistory();
HISTORY_DEPTS = [...new Set(HISTORY.map(function (h) { return h.dept; }).filter(Boolean))];

/** 保存済みテンプレートを先頭にした帳票タイプ候補 */
const savedTemplates = () => LAYOUT.slice().sort((a, b) => (b.saved ? 1 : 0) - (a.saved ? 1 : 0) || a.order - b.order);

/** アップロード画面で追加されるファイル（ファイル名から帳票タイプを推定） */
const SIZE_UNITS = ['KB', 'MB'];
let uploadSeq = 0;
function makeUpload(name, sizeBytes) {
  const n = name.toLowerCase();
  const rules = [
    [/住民異動/, 'l1'], [/給与支払/, 'l5'], [/保育|利用申込/, 'l7'], [/給付認定/, 'l8'], [/就労/, 'l9'],
    [/児童手当/, 'l10'], [/別居監護/, 'l11'], [/介護/, 'l12'], [/実態調査|高齢者/, 'l13'],
    [/市民税|県民税|申告書/, 'l4'],
  ];
  const hit = rules.find(([re]) => re.test(n));
  const bizLayouts = layoutsForBiz(state.upBiz);
  const guessed = hit && LAYOUT.find((l) => l.id === hit[1]);
  const guess = (guessed && bizLayouts.some((l) => l.id === guessed.id) ? guessed : null)
    || bizLayouts[0]
    || LAYOUT[0];
  const now = new Date();
  const p2 = (v) => String(v).padStart(2, '0');
  const ts = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`;
  return {
    id: 'up' + (++uploadSeq) + '_' + Math.random().toString(36).slice(2, 6),
    name,
    size: sizeBytes || Math.round((60 + Math.random() * 2400) * 1024),
    pages: 1 + Math.floor(Math.random() * 12),
    uploadedAt: ts,
    user: '閲覧',
    status: 'classifying',                  // ①アップロード → 要確認（自動分類中・タイプ確認が必要）
    history: '帳票タイプを自動分類しています（要確認）',
    layout: guess.id,
    auto: true,
    error: '',
  };
}

/* === 追加モック（serve.py 生成：実データ風のファイル一覧） === */
var MOCK_EXTRA_APPLIED = true;
(function addMoreMockFiles() {
  var L = (typeof LAYOUT !== 'undefined' && LAYOUT) || [];
  var names = L.map(function (l) { return l.name; });
  if (!names.length) return;
  var prefix = ['01', '02', '03', '10', '11', '20', '21', '40', '61', '62', '09', '08'];
  var suffix = ['', '_記入済', '_記入済(全部転入)', '_検証', '_2', '_確認済み', '_B1', '_B2', '_A1', '_A2'];
  var users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'];
  var statuses = ['done', 'confirmed', 'approved', 'done', 'exported', 'failed', 'returned', 'checking', 'done', 'reading'];
  var startId = 50;
  var count = 55;
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  for (var k = 0; k < count; k++) {
    var n = startId + k * 5;                     /* n % 5 === 0 → tenant02（既定テナント） */
    var id = 'f' + n;
    var lay = L[k % L.length];
    var nm = prefix[k % prefix.length] + '_' + lay.name + suffix[(k + 1) % suffix.length] + '.pdf';
    var size = 90000 + ((k * 37337) % 1400000);
    var st = statuses[k % statuses.length];
    var day = 1 + (k % 15);
    var hh = 8 + (k % 10);
    var mm = (k * 7) % 60;
    var stamp = '2026-10-' + pad(day) + ' ' + pad(hh) + ':' + pad(mm) + ':' + pad((k * 13) % 60);
    var stamp2 = '2026-10-' + pad(Math.min(15, day + 1)) + ' ' + pad(hh) + ':' + pad((mm + 9) % 60) + ':' + pad((k * 17) % 60);
    var readAt = (['done', 'confirmed', 'approved', 'returned', 'exported', 'failed'].indexOf(st) >= 0) ? stamp2 : null;
    var confAt = (['confirmed', 'approved', 'returned', 'exported'].indexOf(st) >= 0) ? stamp2 : null;
    var apprAt = (['approved', 'exported'].indexOf(st) >= 0) ? stamp2 : null;
    /* 操作・処理履歴＝「誰が何をしたか」の記録。状態そのものは入れない（処理中は空） */
    var names = ['佐藤 一郎', '鈴木 花子', '高橋 健', '田中 実', '伊藤 由美', '渡辺 修', '山本 彩', '中村 亮'];
    var hist = {
      done: '',
      confirmed: '確認担当者: ' + names[k % names.length],
      approved: '承認担当者: ' + names[(k + 3) % names.length] + '（2段目まで完了）',
      exported: '出力担当者: ' + names[(k + 5) % names.length] + '（CSV）',
      failed: '読取に失敗しました（再読取が必要）',
      returned: '差戻: 確認者へ（記載不備）',
      checking: '',
      reading: ''
    }[st] || '';
    var u = users[k % users.length];
    var au = users[(k + 3) % users.length]; FILES.push([id, nm, lay.id, size, st, hist, stamp, stamp2, readAt, confAt, apprAt, u, u, au]);
  }
})();
function buildFiles() {
  return FILES.map((r) => ({
    id: r[0], name: r[1], layout: r[2], size: r[3], status: r[4], history: r[5],
    createdAt: r[6], updatedAt: r[7], readAt: r[8], confirmedAt: r[9], approvedAt: r[10],
    createdBy: r[11], updatedBy: r[12], approvedBy: r[10] ? r[13] : null,
    /* 確認者：確認日がある場合。デモでは更新者を確認担当として扱う（実データは確認実行ユーザ） */
    confirmedBy: r[9] ? r[12] : null,
    /* 読取完了以降は読取日が入る。確認・承認以降は確認日も入る */
    readDoneAt: ['done', 'confirmed', 'approved', 'returned', 'exported', 'failed'].includes(r[4]) ? (r[8] || r[6]) : null,
    checkedAt: ['confirmed', 'approved', 'returned', 'exported'].includes(r[4]) ? (r[9] || r[7]) : null,
    /* ページ数：モックではファイルサイズから決定的に導く（プレビューのページ送りで使う） */
    pages: Math.max(1, Math.min(20, Math.round((r[3] || 0) / 60000))),
    picked: false,
    /* 承認フロー：確定処理で追加される履歴（例：確認: 山田 健太 / 承認1: 田中 実）・差戻先段・コメント */
    flow: [],
    returnTo: null,
  }));
}

/* ============================== 2. 状態管理 ============================== */

/* ホーム（ご利用履歴）と読取結果一覧の既定期間。既定値のままなら「条件未指定」として扱う。
   終了日は「今日」に追従させる（固定日だと、今日アップロードした帳票が既定の作成日時レンジから
   外れて一覧に出ない）。モックの最新日 2026-10-14 より前には戻さない。 */
const HOME_FROM = '2026-09-14';
const HOME_TO = (() => {
  const d = new Date();
  const p2 = (v) => String(v).padStart(2, '0');
  const today = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  return today > '2026-10-14' ? today : '2026-10-14';
})();

/* ── マルチテナント（客户回答：データ分離・GPU共有。デモではテナントで表示データを切替） ── */
const TENANTS = [
  { id: 'tenant01', name: '農林水産省', note: '本番' },
  { id: 'tenant02', name: '〇〇市', note: '本番' },
  { id: 'tenant03', name: '△△町', note: '検証' },
];

/* ── 承認フロー設定（帳票タイプ単位。ここは「承認を使うか」だけを持つ） ──
 * 承認段数とフロー担当は 帳票タイプ側の権限表（TICKET_PERMS）から導出する。
 * フロー担当は権限者（ロール）またはユーザー。権限者は所属ユーザーへランダム割当。 */
const APPROVAL_CONFIG = {
  c1: { need: true }, c2: { need: true }, c3: { need: true }, c4: { need: true },
  c5: { need: true }, c6: { need: true }, c7: { need: false }, c8: { need: true },
};

/**
 * 承認段数（可変 N 段）：帳票タイプごとに「何段目を誰が承認するか」を持つ。
 * APPROVAL_STAGES[layoutId] = [ [主体...], [主体...], ... ]   （空配列＝その段は未設定）
 * 未設定の帳票タイプは、従来の approve / reapprove から 1〜2 段として解釈する。
 */
let APPROVAL_STAGES = {};

/** 帳票タイプの承認段（主体 ID の配列の配列）。1 段目＝approve、2 段目＝reapprove を後方互換で使う */
function stagesOf(layoutId) {
  const custom = APPROVAL_STAGES[layoutId];
  if (Array.isArray(custom) && custom.length) return custom.map((x) => (x || []).slice());
  const p = permsOf(layoutId);
  if (Array.isArray(p.stages) && p.stages.length) return p.stages.map((x) => (x || []).slice());
  const out = [(p.approve || []).slice()];
  if ((p.reapprove || []).length) out.push(p.reapprove.slice());
  return out;
}

/** 承認段数（担当が入っている段の数。0＝承認不要） */
function stageCountOf(layoutId) {
  return stagesOf(layoutId).filter((x) => (x || []).length).length;
}

/** 段数を設定する（UI から呼ぶ）。n 段に増減し、空の段は未設定のまま */
function setStageCount(layoutId, n) {
  const cur = stagesOf(layoutId);
  const want = Math.max(0, Math.min(6, Number(n) || 0));
  const next = [];
  for (let i = 0; i < want; i++) next.push(cur[i] || []);
  APPROVAL_STAGES[layoutId] = next;
  /* 従来の 2 列も同期（帳票権限管理の表と整合させる） */
  const p = TICKET_PERMS[layoutId];
  if (p) {
    p.approve = (next[0] || []).slice();
    p.reapprove = (next[1] || []).slice();
  }
  return next;
}

/** 段の担当を差し替える */
function setStageAssignees(layoutId, index, ids) {
  const cur = stagesOf(layoutId).slice();
  while (cur.length <= index) cur.push([]);
  cur[index] = (ids || []).slice();
  APPROVAL_STAGES[layoutId] = cur;
  const p = TICKET_PERMS[layoutId];
  if (p) {
    if (index === 0) p.approve = (ids || []).slice();
    if (index === 1) p.reapprove = (ids || []).slice();
  }
  return cur;
}

/** 帳票タイプの権限＋フロー担当＋カテゴリの承認ポリシーを合成した実効設定 */
function approvalOf(layoutId) {
  const c = catOf(layoutId) || {};
  const base = APPROVAL_CONFIG[c.id] || { need: true };
  const p = permsOf(layoutId);
  /* カテゴリで承認不要、または承認担当が空 → 承認フローなし */
  const stageLists = stagesOf(layoutId);
  const assigned = stageLists.filter((x) => (x || []).length).length;
  /* 帳票タイプの工作流で決めた承認段数（未設定なら担当から推定） */
  const declared = (typeof catStagesOf === 'function') ? catStagesOf(layoutId) : null;
  /* 配った段数を正とする（担当が空の段は「承認者未設定」として後で警告する） */
  const stages = (declared === null) ? assigned : declared;
  const need = base.need !== false && stages > 0;
  return {
    need,
    stages,
    stageAssignees: stageLists,      // 各段の担当（可変 N 段）
    viewGroups: p.view,              // 閲覧：権限者／ユーザー
    confirmGroups: p.confirm,        // 確認担当：権限者／ユーザー
    approveGroups: p.approve,        // 1 段目承認：権限者／ユーザー
    reapproveGroups: p.reapprove,    // 2 段目承認：権限者／ユーザー
    /* 出力は承認済みが前提。承認担当（承認不要なら確認担当）に付随させる */
    exportGroups: p.approve.length ? p.approve : p.confirm,
  };
}

/** 帳票タイプ詳細 → 対応する LAYOUT id（名称一致。フロー担当の保存先） */
function layoutIdOfTicketType(t) {
  if (!t) return null;
  if (t.layoutId) return t.layoutId;
  const hit = LAYOUT.find((l) => l.name === t.name);
  return hit ? hit.id : null;
}

/** 権限者（ロール）に属するユーザー。組織グループは持たない。 */
const ROLE_MEMBERS = {
  R1: ['u1'],                 /* システム管理者 */
  R2: ['u3'],                 /* 運用管理者 */
  R3: ['u2', 'u6', 'u8'],     /* 確認者 */
  R4: ['u4', 'u5'],           /* 承認者 */
  R5: ['u7'],                 /* アップロード者 */
};
const roleMemberIds = (roleId) => ROLE_MEMBERS[roleId] || [];

/* ── ユーザーグループ（帳票権限の付与単位） ────────────────────────────────
 *   【ユーザー】←多対多→【ユーザーグループ】← 権限 →【帳票権限表】←多対1→【帳票タイプ】
 *
 * グループは「業務ロール」の単位。役割は帳票権限の操作に対応（1 グループ 1 役割）。
 * 個人にだけ割り当てたいときは「その人だけのグループ」を作る（セルに個人は入れない）。
 * 製品の「部門」は組織階層（上位下位をもつ）なので別物として扱い、こちらは担当ロール。
 * グループに担当が割り当てられると、その中の誰かにランダムで割り当てる。 */
/** グループの役割（＝所属ユーザー全員に付く操作権限。1 グループ 1 役割） */
/* 権限ラベル → 帳票権限表のキー（serve.py 注入） */
const GROUP_ROLE_OP_KEY = {
  '閲覧': 'view', 'アップロード': 'upload', '読取': 'read', 'OCR結果修正': 'fix', '確認': 'confirm',
  '承認': 'approve', '再承認': 'reapprove', '出力': 'export', '帳票設定変更': 'settings',
};
/** グループが持つ帳票権限のキー一覧 */
const groupOpKeysOf = (g) => groupRolesOf(g).map((l) => GROUP_ROLE_OP_KEY[l]).filter(Boolean);
/** グループがこのカテゴリを担当しているか（いずれかの帳票タイプで権限が付いていれば true） */
const groupHasApprovalStageOf = (g, layoutId) => { const n = Math.max(1, approvalStageCountOf(layoutId)); for (let si = 0; si < n; si++) if (stageTargetsOf(layoutId, si).indexOf(g.id) >= 0) return true; return false; };
const groupHasCategory = (g, catId) => LAYOUT.some((l) => { const c = catOf(l.id) || {}; if (c.id !== catId) return false; const p = permsOf(l.id); if (groupOpKeysOf(g).some((k) => (p[k] || []).indexOf(g.id) >= 0)) return true; return groupHasApprovalStageOf(g, l.id); });
/** カテゴリ担当の on/off を帳票権限表へ反映する */
function applyGroupCategoryOps(g, catId, on) {
  const ops = groupOpKeysOf(g).filter((k) => k !== 'approve' && k !== 'reapprove');
  LAYOUT.forEach((l) => {
    const c = catOf(l.id) || {};
    if (c.id !== catId) return;
    const p = permsOf(l.id);
    ops.forEach((k) => {
      if (!Array.isArray(p[k])) p[k] = [];
      if (on) { if (p[k].indexOf(g.id) < 0) p[k].push(g.id); }
      else { p[k] = p[k].filter((x) => x !== g.id); }
      /* 承認は 1〜N 段すべてに付与／解除する */
      if (k === 'approve') {
        for (let si = 0; si < Math.max(1, stagesN); si++) setStageTargets(l.id, si, on
          ? stageTargetsOf(l.id, si).concat(stageTargetsOf(l.id, si).indexOf(g.id) < 0 ? [g.id] : [])
          : stageTargetsOf(l.id, si).filter((x) => x !== g.id));
      }
    });
  });
  return ops;
}
/** カテゴリ内の全帳票タイプの、指定した段だけにグループを入れ／外しする */
function setGroupCategoryStage(g, catId, stageIdx, on) {
  LAYOUT.forEach((l) => {
    const c = catOf(l.id) || {};
    if (c.id !== catId) return;
    const cur = stageTargetsOf(l.id, stageIdx);
    if (on) { if (cur.indexOf(g.id) < 0) setStageTargets(l.id, stageIdx, cur.concat([g.id])); }
    else if (cur.indexOf(g.id) >= 0) setStageTargets(l.id, stageIdx, cur.filter((x) => x !== g.id));
  });
}
/** カテゴリ担当の on/off（操作権限のみ。承認の段は段チップで明示的に決める） */
function applyGroupCategory(g, catId, on) {
  return applyGroupCategoryOps(g, catId, on);
}

/* 処理履歴の行：アップロード → 読取 → （確認／承認…） */
const historyRowsOf = (f) => {
  const rows = [];
  const nameOf = (uid) => (byId(USERS, uid) || {}).name || uid || '';
  rows.push({ action: 'アップロード', user: nameOf(f.createdBy) || '—', at: f.createdAt || '', comment: '—' });
  rows.push({ action: '読取', user: 'システム（OCR／AI）', at: f.readAt || f.readDoneAt || '', comment: '—' });
  (f.flow || []).forEach((h) => rows.push(h));
  return rows;
};

/* ══ 帳票タイプの承認段数 N に合わせて、帳票権限表の「承認」列を 承認1..N に展開する ══ */
const APPROVAL_COL_RE = /^approve(\d+)$/;
const stageIdxOfKey = (key) => { const m = APPROVAL_COL_RE.exec(String(key || '')); return m ? Number(m[1]) - 1 : -1; };
/** その帳票タイプの承認段数（帳票タイプの工作流で決まる） */
const approvalStageCountOf = (layoutId) => {
  const declared = (typeof catStagesOf === 'function') ? catStagesOf(layoutId) : null;
  const assigned = (typeof stageCountOf === 'function') ? stageCountOf(layoutId) : 0;
  return Math.max(0, (declared === null) ? assigned : declared);
};
/** 表全体の最大段数（列は最大に合わせ、段数が足りない行は「—」） */
const maxApprovalStageCount = () => LAYOUT.reduce((mx, l) => Math.max(mx, approvalStageCountOf(l.id)), 1);
/** 段（0 起点）の担当を取得／設定。p.stages が正、approve/reapprove は互換用に同期する */
const stageTargetsOf = (layoutId, idx) => {
  const p = TICKET_PERMS[layoutId] || {};
  if (Array.isArray(p.stages) && Array.isArray(p.stages[idx])) return p.stages[idx];
  if (idx === 0) return p.approve || [];
  if (idx === 1) return p.reapprove || [];
  return [];
};
const setStageTargets = (layoutId, idx, ids) => {
  if (!TICKET_PERMS[layoutId]) TICKET_PERMS[layoutId] = { view: [], confirm: [], approve: [], reapprove: [] };
  const p = TICKET_PERMS[layoutId];
  /* 既存の approve / reapprove を段 1・2 として引き継いでから編集する */
  if (!Array.isArray(p.stages)) p.stages = [(p.approve || []).slice(), (p.reapprove || []).slice()];
  while (p.stages.length <= idx) p.stages.push([]);
  p.stages[idx] = (ids || []).slice();
  if (idx === 0) p.approve = (ids || []).slice();
  if (idx === 1) p.reapprove = (ids || []).slice();
};
const PERM_COL_BASE = [
  { key: 'view', label: '閲覧', hint: '帳票を開いて内容を見る' },
  { key: 'upload', label: 'アップロード', hint: '帳票を取り込む' },
  { key: 'fix', label: 'OCR結果修正', hint: '読取結果を修正する' },
  { key: 'confirm', label: '確認', hint: '読取結果を確認済みにする' },
];
const PERM_COL_TAIL = [
  { key: 'export', label: '出力', hint: 'CSV を出力する' },
];
const permHeadOf = () =>
  PERM_COL_BASE.map((a) => '<th style="width:132px">' + a.label + '</th>').join('')
  + PERM_COL_TAIL.map((a) => '<th style="width:132px">' + a.label + '</th>').join('');
const permCellHtml = (layoutId, key, label, hint, cur) =>
  '<td class="permcell"><button type="button" class="perm-cell" data-permcell="' + layoutId + ':' + key + '"'
  + ' title="' + esc(hint) + '：' + esc((cur || []).map(permTargetName).join('、') || '未設定') + '">'
  + permChips(cur) + '</button></td>';
const permCellsOf = (l) => {
  const p = permsOf(l.id);
  const n = approvalStageCountOf(l.id);
  const maxN = maxApprovalStageCount();
  let html = PERM_COL_BASE.map((a) => permCellHtml(l.id, a.key, a.label, a.hint, (a.key === 'fix' ? (p.fix || []) : (p[a.key] || [])))).join('');
  for (let k = 1; k <= maxN; k++) {
    if (k > n) { html += '<td class="permcell is-na"><span class="muted">—</span></td>'; continue; }
    const cur = stageTargetsOf(l.id, k - 1);
    /* 段数は配ってあるのに担当が空 → 未設定の警告マーカー */
    if (!cur.length) html += '<td class="permcell is-unset"><span class="unset-mark" title="承認' + k + ' の担当が未設定です">未設定</span></td>';
    else html += permCellHtml(l.id, 'approve' + k, (maxN === 1 ? '承認' : '承認' + k), (k + ' 段目の承認'), cur);
  }
  html += PERM_COL_TAIL.map((a) => permCellHtml(l.id, a.key, a.label, a.hint, p[a.key] || [])).join('');
  return html;
};
const permTargetsForCell = (c) => {
  if (c.kind === 'upload') return uploadPermsOf(c.bizId);
  const idx = stageIdxOfKey(c.act);
  if (idx >= 0) return stageTargetsOf(c.layoutId, idx);
  return permsOf(c.layoutId)[c.act] || [];
};
const setPermTargetsForCell = (c, ids) => {
  if (c.kind === 'upload') { UPLOAD_PERMS[c.bizId] = ids; return; }
  const idx = stageIdxOfKey(c.act);
  if (idx >= 0) { setStageTargets(c.layoutId, idx, ids); return; }
  if (!TICKET_PERMS[c.layoutId]) TICKET_PERMS[c.layoutId] = { view: [], confirm: [], approve: [], reapprove: [] };
  TICKET_PERMS[c.layoutId][c.act] = ids;
};
const permActLabelOf = (key) => {
  const idx = stageIdxOfKey(key);
  if (idx >= 0) return (maxApprovalStageCount() === 1 ? '承認' : '承認' + (idx + 1));
  return permActLabel(key);
};

/* グループの役割＝ワークフローノード（複数選択・固定順）。serve.py 注入 */
/* 既定の工程：アップロード → 読取 → 確認 → 承認（0〜N 段・任意） → 出力 */
const WF_STEPS = ['アップロード', '読取', '確認', '承認', '出力'];
const WF_FIXED = ['アップロード', '読取', '確認', '出力'];       /* 常に存在する工程 */
/* グループが担当する権限（7 項目）。工作流の定義（工程の並び・承認段数）は帳票タイプ側。 */
const GROUP_NODES = ['閲覧', 'アップロード', '読取', '確認', '出力'].map((l) => ({ key: l, label: l }));
const GROUP_NODE_LABELS = GROUP_NODES.map((n) => n.label);
/* 旧ラベル（閲覧／再承認／アップロード／CSV出力 等）を新しい工程名へ寄せる */
const GROUP_NODE_ALIAS = {
  'アップロード': 'アップロード', 'OCR結果修正': '確認', 'CSV出力': '出力',
};
/* グループの工程を「固定工程 ＋ 承認（任意・N 段）」として解決する */
const groupFlowOf = (g) => {
  const roles = groupRolesOf(g);
  const stages = Math.max(0, Number(g && g.approvalStages) || 0);
  const approve = roles.indexOf('承認') >= 0 || stages > 0;
  return { roles: roles, approve: approve, stages: stages };
};
/* 保存する kind（固定工程 ＋ 承認） */
const groupFlowKindOf = (g) => {
  const f = groupFlowOf(g);
  const out = WF_FIXED.filter((l) => l !== '出力');
  if (f.approve) out.push('承認');
  out.push('出力');
  return WF_STEPS.filter((l) => out.indexOf(l) >= 0).join('、');
};
/* 唯一の正は g.kind（カンマ／読点区切りのラベル列）。roles は保存時に同期する従属情報。 */
const groupRolesOf = (g) => {
  if (!g) return [];
  const raw = String(g.kind || '');
  const parts = raw.split(/[\/,、・|]/).map((x) => x.trim()).filter(Boolean)
    .map((x) => GROUP_NODE_ALIAS[x] || x);
  return GROUP_NODE_LABELS.filter((l) => parts.indexOf(l) >= 0);
};
const toggleGroupRole = (g, label) => {
  const cur = groupRolesOf(g);
  const next = cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : cur.concat([label]);
  const ordered = GROUP_NODE_LABELS.filter((l) => next.indexOf(l) >= 0);
  if (g) { g.roles = ordered; g.kind = ordered.join('、'); }
  return ordered;
};

const GROUP_KINDS = [
  { key: 'view', label: '閲覧', cls: 'is-view', ops: ['view'] },
  { key: 'confirm', label: '確認', cls: 'is-conf', ops: ['view', 'confirm'] },
  { key: 'approve', label: '承認', cls: 'is-appr', ops: ['view', 'approve'] },
  { key: 'reapprove', label: '再承認', cls: 'is-reappr', ops: ['view', 'approve'] },
  { key: 'upload', label: 'アップロード', cls: 'is-upload', ops: ['view', 'upload'] },
];
const groupKindClass = (kind) => (GROUP_KINDS.find((k) => k.label === kind) || {}).cls || 'is-conf';
let GROUPS = [
  { id: 'g1', name: '住民異動窓口',     kind: '確認',     desc: '住民異動届の受付と読取結果の確認',   userIds: ['u1', 'u2', 'u3'] },
  { id: 'g2', name: '住民課承認者',     kind: '承認',     desc: '住民異動届の承認（1 段目）',        userIds: ['u1', 'u4', 'u5'] },
  { id: 'g3', name: '住民課長',         kind: '再承認',   desc: '住民異動届の再承認（2 段目）',      userIds: ['u1'] },
  { id: 'g4', name: '税務窓口',         kind: '確認',     desc: '税務関係の受付と読取結果の確認',     userIds: ['u3', 'u4'] },
  { id: 'g5', name: '税務承認者',       kind: '承認',     desc: '税務関係の承認（1 段目）',          userIds: ['u4', 'u5'] },
  { id: 'g6', name: '保育・児童窓口',   kind: '確認',     desc: '保育所入所・児童手当の受付と確認',   userIds: ['u1', 'u2', 'u3', 'u6'] },
  { id: 'g7', name: '保育・児童承認者', kind: '承認',     desc: '保育・児童手当の承認（1 段目）',    userIds: ['u1', 'u5'] },
  { id: 'g8', name: '介護保険窓口',     kind: '確認',     desc: '介護保険の受付と読取結果の確認',     userIds: ['u3', 'u8'] },
  { id: 'g9', name: '高齢者調査担当',   kind: '確認',     desc: '高齢者等実態調査票の確認と承認',     userIds: ['u2', 'u8'] },
];
/** グループ ID → 所属ユーザー ID の配列 */
const groupMemberIds = (gid) => (byId(GROUPS, gid) || {}).userIds || [];
/** ユーザー ID → 所属グループの配列（多対多） */
const groupsOfUser = (uid) => GROUPS.filter((g) => (g.userIds || []).includes(uid));
/** グループ ID → グループ名（見つからなければそのまま） */
const groupName = (gid) => (byId(GROUPS, gid) || {}).name || gid;
/** このグループが関与している帳票タイプと操作の一覧（帳票権限表の転置） */
function groupTickets(gid) {
  const out = [];
  LAYOUT.forEach((l) => {
    const p = permsOf(l.id);
    const acts = PERM_ACTS.filter((a) => (p[a.key] || []).includes(gid)).map((a) => a.label);
    if (acts.length) out.push({ layoutId: l.id, name: dispLayout(l.id), acts });
  });
  BUSINESS.forEach((b) => {
    if (uploadPermsOf(b.id).includes(gid)) {
      out.push({ layoutId: null, bizId: b.id, name: dispBiz(b.id), acts: ['アップロード'] });
    }
  });
  return out;
}

/** フロー担当モード：選択内容から推定。未選択なら state.asgMode / 既定は権限者 */
function assigneeModeOf(act, selected) {
  const ids = selected || [];
  if (ids.some((id) => byId(USERS, id))) return 'user';
  if (ids.some((id) => byId(GROUPS, id))) return 'group';
  if (ids.some((id) => byId(ROLES, id))) return 'role';
  return (state.asgMode && state.asgMode[act]) || 'group';
}

/** フロー担当：ユーザーグループ／ユーザーは 2 択（同時選択不可）。
 * 上部の药丸スイッチで切替え。グループ＝複数可（所属ユーザーへランダム割当）、ユーザー＝単選。
 * mode==='role' は旧データ（権限者を直接指定していた時代）の互換表示。 */
function typeAssigneeChips(act, selected) {
  const set = new Set(selected || []);
  const mode = assigneeModeOf(act, selected);
  const roleTags = ROLES.filter((r) => set.has(r.id)).map((r) => `
        <span class="asg-tag is-role" title="権限者内の誰かにランダム割当">
          <span class="asg-tag-kind">権限者</span>${esc(r.name)}
          <button type="button" class="asg-tag-x" data-tp-assignee-rm="${act}:${r.id}" aria-label="解除">×</button>
        </span>`).join('');
  const groupTags = GROUPS.filter((g) => set.has(g.id)).map((g) => `
        <span class="asg-tag is-role" title="グループ内の誰かにランダム割当">
          <span class="asg-tag-kind">${esc(g.kind)}</span>${esc(g.name)}
          <button type="button" class="asg-tag-x" data-tp-assignee-rm="${act}:${g.id}" aria-label="解除">×</button>
        </span>`).join('');
  const userTags = USERS.filter((u) => set.has(u.id)).map((u) => `
        <span class="asg-tag">
          ${esc(u.name)}
          <button type="button" class="asg-tag-x" data-tp-assignee-rm="${act}:${u.id}" aria-label="解除">×</button>
        </span>`).join('');
  const tags = mode === 'user' ? userTags : (mode === 'role' ? roleTags : groupTags);
  const roleOpts = ROLES.map((r) => `
          <button type="button" class="asg-opt${set.has(r.id) ? ' on' : ''}" data-tp-assignee-opt="${act}:${r.id}">
            <span class="asg-opt-body"><span class="asg-opt-name">${esc(r.name)}</span><span class="asg-opt-sub">${esc(assigneeUserNames(roleMemberIds(r.id)))}</span></span>
            <span class="asg-opt-check">✓</span>
          </button>`).join('');
  const groupOpts = GROUPS.map((g) => `
          <button type="button" class="asg-opt${set.has(g.id) ? ' on' : ''}" data-tp-assignee-opt="${act}:${g.id}">
            <span class="asg-opt-body"><span class="asg-opt-name">${esc(g.name)}<span class="asg-opt-kind">${esc(g.kind)}</span></span><span class="asg-opt-sub">${esc(assigneeUserNames(g.userIds))}</span></span>
            <span class="asg-opt-check">✓</span>
          </button>`).join('');
  const userOpts = USERS.map((u) => `
          <button type="button" class="asg-opt${set.has(u.id) ? ' on' : ''}" data-tp-assignee-opt="${act}:${u.id}">
            <span class="asg-opt-body"><span class="asg-opt-name">${esc(u.name)}</span></span>
            <span class="asg-opt-check">✓</span>
          </button>`).join('');
  const placeholder = mode === 'user'
    ? 'ユーザーを選択（単選）'
    : (mode === 'role' ? '権限者を選択（複数可・ランダム割当）' : 'グループを選択（複数可・ランダム割当）');
  return `
      <div class="asg-wrap" data-asg-wrap="${act}">
        <div class="asg-mode-pills" role="tablist" aria-label="担当の種類">
          <button type="button" class="asg-mode-pill${mode === 'group' || mode === 'role' ? ' on' : ''}" data-asg-mode="${act}:group" role="tab" aria-selected="${mode === 'group' || mode === 'role'}">グループ</button>
          <button type="button" class="asg-mode-pill${mode === 'user' ? ' on' : ''}" data-asg-mode="${act}:user" role="tab" aria-selected="${mode === 'user'}">ユーザー</button>
        </div>
        <div class="asg-select${tags ? ' has-value' : ''}" data-asg="${act}" data-asg-mode-cur="${mode}">
          <div class="asg-control" data-tp-assignee-toggle="${act}" role="button" tabindex="0" aria-haspopup="listbox">
            <span class="asg-values">${tags || `<span class="asg-placeholder">${placeholder}</span>`}</span>
            <span class="asg-caret"></span>
          </div>
          <div class="asg-panel" data-asg-panel="${act}">
            ${mode === 'user' ? userOpts : (mode === 'role' ? roleOpts : groupOpts)}
          </div>
        </div>
      </div>`;
}
/** 権限ターゲットの表示名一覧 */
const groupNames = (ids) => (ids || []).map((id) => permTargetName(id)).filter(Boolean).join('／') || '—';

/** フロー担当として有効なユーザー ID（グループ／権限者は所属ユーザーへ展開） */
function assigneeUserIds(ids) {
  const out = [];
  const seen = new Set();
  const push = (uid) => { if (uid && !seen.has(uid)) { seen.add(uid); out.push(uid); } };
  (ids || []).forEach((id) => {
    if (byId(USERS, id)) { push(id); return; }
    if (byId(GROUPS, id)) { groupMemberIds(id).forEach(push); return; }
    if (byId(ROLES, id)) { roleMemberIds(id).forEach(push); }
  });
  return out;
}

/** 権限者プールから 1 人をランダム選定（同一 seed なら安定） */
function pickRandomAssignee(ids, seedKey) {
  const pool = assigneeUserIds(ids);
  if (!pool.length) return null;
  let h = 0;
  const s = String(seedKey || '');
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

/** マイタスク「担当」列：展開後のユーザー名（設定画面の一覧表示用） */
function assigneeUserNames(ids) {
  const names = assigneeUserIds(ids).map((uid) => userName(uid)).filter(Boolean);
  return names.length ? names.join('／') : '—';
}

/* ヘッダーメニューのサブメニュー（名称は製品の言語パックに合わせる） */
const HEADER_MENUS = {
  /* 帳票設定の子は2項目（帳票タイプ設定／業務シーン設定） */
  bill: { label: '帳票設定', items: [
    { id: 'ticketDetail', label: '帳票タイプ設定', menuNode: 'settings-type' },
    { id: 'bizScenes', label: '業務シーン設定', menuNode: 'settings-scenes' },
  ] },
  /* 利用設定の子（製品 5 項目 ＋ 外部API） */
  usage: { label: '利用設定', items: [
    { id: 'users', label: 'ユーザー管理', menuNode: 'usage-users' },
    { id: 'roles', label: '権限設定', menuNode: 'usage-permissions' },
    { id: 'security', label: 'セキュリティ設定', menuNode: 'usage-security' },
    { id: 'logs', label: 'ログ設定', menuNode: 'usage-logs' },
    { id: 'api', label: 'API設定', menuNode: 'usage-api' },
  ] },
};

/** 画面ルート → メニュー権限ツリーのノード id */
const PAGE_MENU_NODE = {
  home: 'home',
  upload: 'upload',
  result: 'result',
  myTasks: 'myTasks',
  ticketTypes: 'settings-type',
  ticketDetail: 'settings-type',
  bizScenes: 'settings-scenes',
  users: 'usage-users',
  roles: 'usage-permissions',
  security: 'usage-security',
  logs: 'usage-logs',
  api: 'usage-api',
  permissions: 'usage-permissions',
};

/** ユーザーが属するロールのメニュー許可集合。null＝全許可（システム管理者） */
function menuLeavesForUser(uid) {
  const me = uid || state.currentUser;
  if (isTenantAdmin(me)) return null;
  const roleIds = Object.keys(ROLE_MEMBERS || {}).filter((rid) => (ROLE_MEMBERS[rid] || []).includes(me));
  if (roleIds.includes(TENANT_ADMIN_ROLE)) return null;
  const set = new Set();
  if (!roleIds.length) {
    (MENU_PERMS.R5 || []).forEach((id) => set.add(id));
    return set;
  }
  roleIds.forEach((rid) => { (MENU_PERMS[rid] || []).forEach((id) => set.add(id)); });
  return set;
}

/** メニューノード（画面）に到達できるか。権限が無ければメニュー自体を出さない */
function canReachMenu(nodeId, uid) {
  if (!nodeId) return false;
  const set = menuLeavesForUser(uid);
  if (set === null) return true;
  if (set.has(nodeId)) return true;
  /* 親ノード許可＝配下リーフのいずれかが許可されている扱い */
  const find = (nodes) => {
    for (const n of nodes) {
      if (n.id === nodeId) {
        if (!n.children) return set.has(n.id);
        const leaves = [];
        const walk = (xs) => xs.forEach((x) => { if (x.children) walk(x.children); else leaves.push(x.id); });
        walk(n.children);
        return leaves.some((id) => set.has(id));
      }
      if (n.children) {
        const hit = find(n.children);
        if (hit !== null) return hit;
      }
    }
    return null;
  };
  const hit = find(MENU_TREE);
  return hit === true;
}

/** 画面ルートを開けるか */
function canReachPage(page, uid) {
  const node = PAGE_MENU_NODE[page];
  if (!node) return isTenantAdmin(uid || state.currentUser);
  return canReachMenu(node, uid);
}

/** 頂栏ナビ HTML（権限の無い項目は出さない＝削除線にしない） */
function renderTopNav() {
  const tops = [
    { page: 'home', label: 'ホーム' },
    { page: 'upload', label: '新規アップロード' },
    { page: 'result', label: 'ファイル一覧' },
    { page: 'myTasks', label: 'マイタスク' },
  ].filter(() => true);
  const topHtml = tops.map((t) =>
    `<div class="navitem" data-opentab="${t.page}">${esc(t.label)}</div>`
  ).join('');
  const menuHtml = Object.entries(HEADER_MENUS).map(([key, m]) => {
    const items = m.items.filter(() => true);
    if (!items.length) return '';
    return `<div class="navitem hasmenu ${state.navMenu === key ? 'open' : ''}" data-navmenu="${key}">${esc(m.label)} <span class="ico i-caret-down caret"></span>
          <div class="navmenu">
            ${items.map((it) => `<button class="navmenu-item" data-navitem="${it.id}">${esc(it.label)}</button>`).join('')}
          </div>
        </div>`;
  }).join('');
  return topHtml + menuHtml;
}

const state = {
  page: 'home',                   // ルート：'home' | 'upload' | 'result'（左メニューで切替）
  tenant: 'tenant02',             // マルチテナント：選択中テナント（データは分離して表示）
  tenantOpen: false,
  tabs: ['home', 'upload', 'result'], // 開いているタブ。×で閉じられる
  resultPage: 1,                  // 読取結果一覧のページ番号
  hFilters: { from: HOME_FROM, to: HOME_TO, layout: [], user: '', biz: [] },
  hPage: 1,
  hPerPage: 10,
  roleTab: 'role',                // 権限設定：'role'（権限＝メニュー到達） / 'group'（ユーザーグループ＝帳票権限）
  userTab: 'user',                // ユーザー管理：'user'（ユーザー一覧） / 'group'（ユーザーグループ＝帳票権限）
  roleDraft: { name: '', status: '' },
  roleFilters: { name: '', status: '' },
  rolePage: 1,
  rolePerPage: 10,
  groupDraft: { q: '', kind: '' },
  groupFilters: { q: '', kind: '' },
  groupPage: 1,
  groupPerPage: 10,
  groupForm: null,                // グループ作成／編集ダイアログ { mode, id, name, kind, desc, userIds[], tab }
  upBiz: 'b1',                    // アップロード画面：帳票業務シーン（既定ユーザー u2 がアップロード可）
  uploads: [],                    // アップロード済ファイル（モック。7日で自動クリア想定）
  upPicked: {},
  upPage: 1,
  upPerPage: 10,
  dragOver: false,
  pvId: null,                     // ページプレビュー対象アップロード id
  dlMenu: null,                   // ダウンロード形式メニューを開いているファイルID
  sceneId: null,                  // 業務シーン設定で選択中の業務シーン
  sceneStep: 1,                   // 業務シーン編集のステップ（1=AI分類設定 / 2=効果テスト）
  sceneMenu: null,                // 業務シーン行の ⋯ メニューを開いているID
  scenePick: false,               // 「帳票追加」ピッカーを開いているか
  sceneRename: null,              // { id, value } 名称変更ダイアログ
  typeId: 'T1',                   // 帳票タイプ画面で選択中のタイプ
  typeStep: 1,                    // 帳票タイプのステップ
  typePage: 1,
  typeZoom: 1,
  typeReadTab: 'text',            // AI読取設定：text | table
  typePrompt: '空白文字列抽出ルール：該当項目が見つからない、または判読不能な場合は空文字（""）を出力してください。',
  typeMenu: null,                 // step2 ツールバー：tpl | gear | null
  typeItemMenu: null,             // 左リスト行の … メニュー（タイプ id）
  typeFields: null,               // step2 抽出項目（遅延初期化）
  reviewId: null,                 // 読取結果確認ページで開いているファイル
  reviewReturn: 'myTasks',        // 详情から戻る先（myTasks | result）
  reviewViewOnly: false,          // 一覧からの閲覧のみ（確認・承認 CTA なし）
  reviewSessions: {},             // 确认タブごとの状態 { [fileId]: { returnPage, viewOnly } }
  reviewTab: 'preview',           // preview | json（右ペイン表示モード）
  reviewReadTab: 'text',          // text | table（テキスト読取／テーブル情報読取）
  reviewOnlyErr: false,           // エラー箇所のみ表示
  reviewPos: true,                // true＝項目位置を非表示（既定ON）。falseで bbox 表示
  reviewFocusKey: null,           // 確認画面で左右連動ハイライト中の項目 key
  resultScrollLeft: 0,            // ファイル一覧テーブルの横スクロール位置
  reviewZoom: 1,
  reviewPage: 1,                  // 详情プレビューページ
  reviewPages: 1,                 // 確認プレビュー総ページ（REVIEW_DOC.pages で上書き）
  reviewRotate: 0,
  reviewDirty: {},                // 修正した項目（ファイルID → 項目キー）
  /* 確認画面：確認済み項目（ファイルID → { 項目キー: true }） */
  reviewConfirmed: {},
  reviewBulkConfirm: false,       // 一括確認スイッチ（表示中項目をまとめて確認済み）
  reviewApprovePane: 'diff',      // 承認画面右：diff（修正差分）| fields（全項目）
  reviewRequiredOpen: false,      // 必須項目が空のときの注意ダイアログ
  saveHistoryOpen: false,         // 保存履历ダイアログ
  flowDialog: null,               // { fileId, action } 承認・確認・差戻のダイアログ
  myTaskTab: 'pending',           // マイタスク：pending(未対応) | done(対応済)
  myTaskFilters: { name: '', biz: '', cat: '', kind: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' },
  /* デモ用：現在ユーザ（帳票タイプの確認／承認ユーザーと照合） */
  currentUser: 'u1',              // デモ既定：確認窓口（閲覧範囲が広い）
  userMenuOpen: false,            // 右上ユーザーメニューの開閉
  exportOpen: false,              // 実行時の出力確認（形式は帳票タイプ設定で保持）
  exportCfg: { mode: 'combine', header: true, encoding: 'UTF-8', newline: 'CRLF', delimiter: 'カンマ', emptyValue: '空欄', dateFormat: 'YYYY-MM-DD', merge: true, maxRows: 10000, fileName: '' },
  exportCfgSnapshot: null,        // ダイアログを開いた時点の控え（キャンセルで戻す）
  pvOpen: false,                  // ページプレビューのモーダル
  pvPage: 1,
  pvZoom: 1,
  pvRotate: 0,
  tab: 'all',
  activeNode: { type: 'all', id: 'all' },
  q: '',
  open: {},                       // ツリー（ノード）の開閉
  treeOpen: true,                 // ファイルツリーパネル自体の開閉
  treeView: 'biz-cat',            // 表示次元：biz-cat | cat
  treeFolders: [],                // 互換用（構造は BUSINESS/CATEGORY を正とする）
  fileFolder: {},                 // ファイルID → 所属帳票タイプID（未分類は null）
  fileOrder: {},                  // ファイルID → 同カテゴリ内の並び順
  treeSeeded: false,              // ファイル所属の初期シード済みか
  rename: {},                     // 表示名のみの手動リネーム（ファイル名のみ変更可）
  picked: {},
  sort: { key: 'updatedAt', dir: 'desc' },
  perPage: 10,
  filterOpen: false,               // 原製品と同じく既定は閉じた状態（「条件を表示」で展開）
  filterMore: false,               // 「もっと見る」で追加条件を表示
  dd: null,                       // 開いている複数選択ドロップダウン
  navMenu: null,                  // 開いているヘッダーのサブメニュー
  permForm: null,                 // 権限作成／編集ダイアログ { mode, id, name, code, desc, status }
  menuPerm: null,                 // メニュー権限ダイアログ { roleId, checked[], closed[] }
  permCell: null,                 // 権限セル編集 { kind:'ticket'|'upload', layoutId?, act?, bizId?, mode? }
  asgMode: {},                    // フロー担当の药丸モード { confirm|approve|reapprove: 'role'|'user' }
  filters: { ...defaultFilters(), createdFrom: HOME_FROM, createdTo: HOME_TO },
};

let FILES_DATA = buildFiles();
/* デモ用：2段承認（l1）で承認1済み → マイタスクに「要再承認」を出す */
(() => {
  const f = FILES_DATA.find((x) => x.id === 'f40');
  if (!f) return;
  f.history = '確認済み';
  f.flow = [
    { stage: null, action: '確認', user: '田中 実', at: f.confirmedAt || '2026-10-14 10:02:20', comment: '' },
    { stage: 1, action: '承認1', user: '田中 実', at: '2026-10-14 15:20:00', comment: '' },
  ];
})();

/* ============================== 3. ユーティリティ ============================== */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = (arr, id) => arr.find((x) => x.id === id);
const catOf = (layoutId) => byId(CATEGORY, (byId(LAYOUT, layoutId) || {}).category);
const bizOfLayout = (layoutId) => { const c = catOf(layoutId); return c ? byId(BUSINESS, c.business) : null; };
const dispCat = (id) => state.rename['cat:' + id] || (byId(CATEGORY, id) || {}).name || '';
const dispBiz = (id) => state.rename['biz:' + id] || (byId(BUSINESS, id) || {}).name || '';
const dispLayout = (id) => state.rename['lay:' + id] || (byId(LAYOUT, id) || {}).name || '';
/** ファイルの表示名（ツリーで変更できるのはここだけ） */

/** 确认预览工具栏 SVG（对齐 llm ocr NL IconResetView / Rotate / Zoom） */
function rvSvg(paths, size = 16) {
  return '<svg class="rv-tool-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + paths + '</svg>';
}
const RV_ICON = {
  reset: rvSvg('<path d="M10 5H6.2C5.5 5 5 5.5 5 6.2V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5" cy="5" r="1.2" stroke="currentColor" stroke-width="1.2"/><path d="M14 19h3.8c.7 0 1.2-.5 1.2-1.2V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19" cy="19" r="1.2" stroke="currentColor" stroke-width="1.2"/>'),
  rotL: rvSvg('<path d="M7.5 8.5H4.5v-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 8.2a7 7 0 1 0 2.2-4.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  rotR: rvSvg('<path d="M16.5 8.5h3v-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 8.2a7 7 0 1 1-2.2-4.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  zoomIn: rvSvg('<circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 8v5M8 10.5h5M15.2 15.2L19 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  zoomOut: rvSvg('<circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" stroke-width="1.5"/><path d="M8 10.5h5M15.2 15.2L19 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
};

const dispFileName = (fileId) => state.rename['file:' + fileId] || (byId(FILES_DATA, fileId) || {}).name || '';
const userName = (id) => (byId(USERS, id) || {}).name || '';
/** 現在時刻の "YYYY-MM-DD hh:mm:ss" */
function nowStamp() {
  const d = new Date(); const p2 = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b / 1024).toFixed(2) + ' KB');
const day = (s) => (s ? s.slice(0, 10) : '');
const unesc = (s) => { const d = document.createElement('div'); d.innerHTML = s; return d.textContent; };
const arrEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** 選択中の業務シーンに紐づく帳票タイプ（自動判別・手動変更の候補） */
function layoutsForBiz(bizId) {
  const biz = bizId || state.upBiz;
  return savedTemplates().filter((l) => {
    const c = byId(CATEGORY, l.category);
    return c && c.business === biz;
  });
}

/** アップロード後の自動分類（モック）：要確認 → 読取待ち。判別後もタイプは確認・変更できる */
function startClassifying(created) {
  const ids = created.map((u) => u.id);
  setTimeout(() => {
    let n = 0;
    state.uploads.forEach((u) => {
      if (ids.includes(u.id) && u.status === 'classifying') {
        const candidates = layoutsForBiz(state.upBiz);
        if (candidates.length && !candidates.some((l) => l.id === u.layout)) {
          u.layout = candidates[0].id;                 // 業務シーン外の推定は候補先頭へ寄せる
        }
        u.status = 'waiting';
        u.history = `帳票タイプ「${dispLayout(u.layout)}」として判別（自動）。要確認のため必要なら変更してください`;
        n++;
      }
    });
    if (n) {
      render();
      toast(`${n} 件の自動分類が完了しました。帳票タイプを確認し、「選択帳票読取」で読取を開始できます`);
    }
  }, 2600);
}

/** アップロード行を読取結果一覧へ載せる（読取中のまま一覧へ遷移するため） */
function promoteUploadToResult(u) {
  const stamp = nowStamp();
  const row = {
    id: u.id,
    name: u.name,
    layout: u.layout,
    size: u.size,
    status: 'reading',
    history: u.history || '読取処理中（0秒経過）',
    createdAt: u.uploadedAt,
    updatedAt: stamp,
    readAt: stamp,
    confirmedAt: null,
    approvedAt: null,
    createdBy: 'u2',
    updatedBy: 'u2',
    confirmedBy: null,
    approvedBy: null,
    readDoneAt: null,
    checkedAt: null,
    picked: false,
    flow: [],
    returnTo: null,
    tenant: state.tenant,
    pages: u.pages,
    error: u.error || '',
    _proc: true,
  };
  const i = FILES_DATA.findIndex((f) => f.id === row.id);
  if (i >= 0) FILES_DATA[i] = Object.assign(FILES_DATA[i], row);
  else FILES_DATA.unshift(row);
  return row;
}

/** 選択中の帳票の読取を開始し、モックで 読取中 → 読取完了/読取失敗 へ進める（一覧側も同期） */
function startReading(items) {
  if (!items.length) return;
  const ids = items.map((u) => u.id);
  const startedAt = Date.now();
  const tick = setInterval(() => {
    const sec = Math.floor((Date.now() - startedAt) / 1000);
    let changed = false;
    const hist = `読取処理中（${sec}秒経過）`;
    state.uploads.forEach((u) => {
      if (u._proc && ids.includes(u.id)) { u.history = hist; changed = true; }
    });
    FILES_DATA.forEach((f) => {
      if (f._proc && ids.includes(f.id)) { f.history = hist; f.status = 'reading'; changed = true; }
    });
    if (!changed) { clearInterval(tick); return; }
    render();
  }, 1000);

  setTimeout(() => {
    let ok = 0; let ng = 0;
    ids.forEach((id) => {
      const u = state.uploads.find((x) => x.id === id);
      const f = byId(FILES_DATA, id);
      if (!(u && u._proc)) return;
      delete u._proc;
      const fail = Math.random() < 0.15;
      u.status = fail ? 'failed' : 'done';
      u.history = fail ? '帳票の処理中にエラーが発生' : '読取完了';
      u.error = fail ? '帳票の処理中にエラーが発生（ページ番号の解釈に失敗）' : '';
      u.updatedAt = nowStamp();
      if (fail) ng += 1; else ok += 1;
      if (f) {
        delete f._proc;
        f.status = u.status;
        f.history = u.history;
        f.error = u.error || '';
        f.readDoneAt = nowStamp();
        f.updatedAt = nowStamp();
        f.readAt = f.readAt || nowStamp();
      }
    });
    clearInterval(tick);
    /* 読取中のタブに留まると、完了した帳票がその場から消えて「反映されていない」ように見える。
       結果に対応するタブ（読取完了／読取失敗）へ移し、その帳票が必ず見えるようにする。混在時は「すべて」。 */
    if (state.page === 'result' && state.tab !== 'all') {
      state.tab = ok && !ng ? 'done' : (ng && !ok ? 'failed' : 'all');
    }
    render();
    toast(`読取が完了しました：成功 ${ok} 件${ng ? ` ／ 失敗 ${ng} 件` : ''}`);
  }, 4200);
}

/** アップロード画面：ファイルを追加（モック）。数秒後に読取完了へ遷移させる */
function addUploadedFiles(items) {
  if (!items.length) return;
  ensureUpBizAllowed();
  if (!canUploadBiz(state.upBiz)) {
    toast('この業務シーンへのアップロード権限がありません');
    return;
  }
  const created = items.map(([name, size]) => makeUpload(name, size));
  created.forEach((u) => state.uploads.unshift(u));          // 表示は新しい順
  render();
  toast(`${items.length} 件をアップロードしました（要確認）。帳票タイプを自動分類しています…`);
  startClassifying(created);
}

function toast(msg) {
  if (typeof document === 'undefined') return;
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('on'), 1900);
}

/* ====================== 3-b. マルチテナント分離 ====================== */

/**
 * テナント分離：どのテナントに属するファイルか（デモは id の番号から決定的に割り当てる）
 * 実運用ではテナントIDでデータが分離される想定。
 */
/* QA 用：ステータス別の代表ファイルを既定テナント（農林水産省）に固定する。
   これで既定表示のままでも 10 ステータスすべてが一覧に現れる。 */
const TENANT_PIN = {
  /* 既定テナント（〇〇市）に足りないステータスを補う
     ※ 分類中／読取待ちは結果一覧に出ないためピン不要（アップロード画面のみの状態） */
  f13: 'tenant02',   // 読取中
  f36: 'tenant02',   // 確認中
  f41: 'tenant02',   // 確認済み
  f45: 'tenant02',   // 出力済み
  /* 検証テナント（△△町）にも 10 ステータスを揃える */
  f37: 'tenant03',   // 読取失敗
  f40: 'tenant03',   // 確認済み
  f43: 'tenant03',   // 承認済み
  f44: 'tenant03',   // 差戻中
  /* 農林水産省（tenant01）に足りないステータスを補う */
  f39: 'tenant01',   // 読取失敗
  f12: 'tenant01',   // 読取完了
};

function tenantOfFile(f) {
  /* アップロードから読取結果へ載せた行は明示テナントを持つ */
  if (f.tenant) return f.tenant === state.tenant;
  if (TENANT_PIN[f.id]) return TENANT_PIN[f.id] === state.tenant;
  const id = String(f.id);
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0;
  /* 割り当ては「△△町 → 〇〇市 → 農林水産省」の順に判定（重複しない） */
  const ends36 = /[36]$/.test(String(n));                                  // △△町（検証テナント）
  const explicit2 = ['f15', 'f18', 'f19'].includes(id);                   // 〇〇市に置く代表ファイル（承認済み・差戻中を揃える）
  if (state.tenant === 'tenant03') return ends36;
  if (state.tenant === 'tenant02') return !ends36 && (n % 5 === 0 || explicit2);
  return !ends36 && !(n % 5 === 0) && !explicit2;                        // 農林水産省（既定）
}
const inTenant = (f) => tenantOfFile(f);

/* ====================== 4. ツリー（自動生成）とノード判定 ====================== */

/** 表示次元に応じてツリーを組み立てる
 *  - biz-cat: 業務シーン → 帳票タイプ → ファイル
 *  - cat:     帳票タイプ → ファイル
 * 業務シーン名・帳票タイプ名はマスタ固定（ツリーでは改名不可）。ファイル名のみ改名可。
 * 同階層はドラッグで並び替え可能。
 */
const TREE_MAX_DEPTH = 3;

/** ファイル所属カテゴリの初期シード（1回のみ） */
function ensureTreeSeeded() {
  if (state.treeSeeded) return;
  state.treeSeeded = true;
  if (!state.fileFolder) state.fileFolder = {};
  if (!state.fileOrder) state.fileOrder = {};
  FILES_DATA.forEach((f, i) => {
    if (state.fileFolder[f.id] === undefined) {
      const c = catOf(f.layout);
      state.fileFolder[f.id] = c ? c.id : null;
    }
    if (state.fileOrder[f.id] === undefined) state.fileOrder[f.id] = i + 1;
  });
}

const folderById = (id) => byId(BUSINESS, id) || byId(CATEGORY, id) || (state.treeFolders || []).find((x) => x.id === id);
const folderName = (id) => {
  if (byId(BUSINESS, id)) return dispBiz(id);
  if (byId(CATEGORY, id)) return dispCat(id);
  return state.rename['folder:' + id] || (folderById(id) || {}).name || id;
};

/** ファイルが属する帳票タイプ ID */
function fileCatId(file) {
  ensureTreeSeeded();
  const fid = state.fileFolder[file.id];
  if (fid && byId(CATEGORY, fid)) return fid;
  return (catOf(file.layout) || {}).id || null;
}

function sortFilesInCat(list) {
  return list.slice().sort((a, b) => {
    const oa = state.fileOrder[a.id] || 0;
    const ob = state.fileOrder[b.id] || 0;
    if (oa !== ob) return oa - ob;
    return dispFileName(a.id).localeCompare(dispFileName(b.id), 'ja');
  });
}

function filesUnderCat(catId) {
  return sortFilesInCat(FILES_DATA.filter((f) => fileCatId(f) === catId && canViewFile(f)))
    .map((f) => ({ id: f.id, type: 'file', name: f.name, layout: f.layout, children: [] }));
}

/** 表示次元に応じたツリー */
function buildTree() {
  ensureTreeSeeded();
  const mode = state.treeView === 'cat' ? 'cat' : 'biz-cat';
  if (mode === 'cat') {
    return CATEGORY.slice().sort((a, b) => a.order - b.order).map((c) => ({
      id: c.id, type: 'cat', name: c.name, children: filesUnderCat(c.id),
    }));
  }
  return BUSINESS.slice().sort((a, b) => a.order - b.order).map((b) => ({
    id: b.id, type: 'biz', name: b.name,
    children: CATEGORY.filter((c) => c.business === b.id).sort((a, c) => a.order - c.order).map((c) => ({
      id: c.id, type: 'cat', name: c.name, children: filesUnderCat(c.id),
    })),
  }));
}

/** 全ファイル */
const scoped = () => FILES_DATA;

/** ノード配下のファイルか判定 */
function inNode(file, node) {
  if (!node || node.type === 'all') return true;
  if (node.type === 'file') return file.id === node.id;
  if (node.type === 'biz') {
    const cid = fileCatId(file);
    const c = byId(CATEGORY, cid);
    return !!(c && c.business === node.id);
  }
  if (node.type === 'cat') return fileCatId(file) === node.id;
  if (node.type === 'folder') {
    const cid = fileCatId(file);
    if (!cid) return false;
    if (cid === node.id) return true;
    const c = byId(CATEGORY, cid);
    return !!(c && c.business === node.id);
  }
  return file.layout === node.id;
}

/** 互換：自由フォルダ追加はデモでは無効（マスタ階層のみ） */
function addTreeFolder() {
  toast('業務シーン・帳票タイプはマスタで管理します');
  return null;
}

function deleteTreeFolder() {
  toast('業務シーン・帳票タイプはツリーから削除できません');
}

function moveTreeFolder() {
  toast('階層の移動はできません。同階層のドラッグで並び替えできます');
  return false;
}

/** ファイルを帳票タイプへ移動（null=未分類） */
function moveFileToFolder(fileId, folderId) {
  ensureTreeSeeded();
  if (folderId && !byId(CATEGORY, folderId)) {
    /* 業務シーンへドロップされた場合は先頭カテゴリへ */
    const cats = CATEGORY.filter((c) => c.business === folderId).sort((a, b) => a.order - b.order);
    if (!cats.length) return false;
    folderId = cats[0].id;
  }
  state.fileFolder[fileId] = folderId || null;
  return true;
}

/** 同階層の並び替え（業務／カテゴリ／ファイル） */
function reorderTreeSibling(type, draggedId, targetId) {
  ensureTreeSeeded();
  if (type === 'biz') {
    const list = BUSINESS.slice().sort((a, b) => a.order - b.order);
    const a = list.find((x) => x.id === draggedId);
    const b = list.find((x) => x.id === targetId);
    if (!a || !b) return false;
    list.splice(list.indexOf(a), 1);
    list.splice(list.indexOf(b), 0, a);
    list.forEach((x, i) => { x.order = i + 1; });
    return true;
  }
  if (type === 'cat') {
    const ca = byId(CATEGORY, draggedId);
    const cb = byId(CATEGORY, targetId);
    if (!ca || !cb) return false;
    /* biz-cat 表示時は同一業務内のみ。cat 表示時は全カテゴリ同士 */
    if (state.treeView !== 'cat' && ca.business !== cb.business) return false;
    const list = (state.treeView === 'cat'
      ? CATEGORY.slice()
      : CATEGORY.filter((c) => c.business === ca.business)
    ).sort((a, b) => a.order - b.order);
    const a = list.find((x) => x.id === draggedId);
    const b = list.find((x) => x.id === targetId);
    if (!a || !b) return false;
    list.splice(list.indexOf(a), 1);
    list.splice(list.indexOf(b), 0, a);
    list.forEach((x, i) => { x.order = i + 1; });
    return true;
  }
  if (type === 'file') {
    const fa = byId(FILES_DATA, draggedId);
    const fb = byId(FILES_DATA, targetId);
    if (!fa || !fb) return false;
    if (fileCatId(fa) !== fileCatId(fb)) return false;
    const list = sortFilesInCat(FILES_DATA.filter((f) => fileCatId(f) === fileCatId(fa)));
    const a = list.find((x) => x.id === draggedId);
    const b = list.find((x) => x.id === targetId);
    if (!a || !b) return false;
    list.splice(list.indexOf(a), 1);
    list.splice(list.indexOf(b), 0, a);
    list.forEach((x, i) => { state.fileOrder[x.id] = i + 1; });
    return true;
  }
  return false;
}

/** ステータスタブの判定（'all' は全件、それ以外はステータスキー一致） */
/* 「すべて」タブは結果一覧に出るステータスだけ（分類中・読取待ちは一覧に出さない）。
   分類中＝アップロード画面のみの一時状態、読取待ち＝新規アップロード画面のみ。 */
const TAB_MATCH = { all: (f) => TAB_STATUS.includes(f.status) };
STATUS_ORDER.forEach((k) => { TAB_MATCH[k] = (f) => f.status === k; });

/** 絞り込み条件（AND）。同一条件内の複数選択は OR。 */
/* 固定ワークフロー（アップロード→読取→確認→出力）で「いま誰が担当か」 */
function currentAssigneeOf(f) {
  if (!f) return '—';
  const p = (typeof permsOf === 'function') ? permsOf(f.layout) : {};
  const resolve = (id) => { const n = (typeof permTargetName === 'function') ? permTargetName(id) : id; return (n && n !== id) ? n : ''; };
  const names = (ids) => (ids || []).map(resolve).filter(Boolean).join('、');
  if (['waiting', 'reading', 'classifying'].includes(f.status)) return 'システム（OCR）';
  if (f.status === 'exported') return '—';
  if (f.status === 'confirmed') { const n = names(p.export); return n ? ('出力待ち：' + n) : '出力待ち'; }
  const n = names(p.confirm);
  return n || '確認待ち';
}
function passesFilters(f) {
  const F = state.filters;
  /* 絞り込みは単一選択：未指定（空文字）なら条件なし */
  const one = (sel, val) => !sel || sel === val;
  if (F.status === 'notExported') { if (f.status === 'exported') return false; }
  else if (!one(F.status, f.status)) return false;
  if (!one(F.biz, (bizOfLayout(f.layout) || {}).id)) return false;
  if (!one(F.layout, f.layout)) return false;
  if (!one(F.createdBy, f.createdBy)) return false;
  if (!one(F.confirmedBy, f.confirmedBy)) return false;
  if (!one(F.approvedBy, f.approvedBy)) return false;
  const inRange = (v, from, to) => {
    if (!from && !to) return true;
    if (!v) return false;
    const d = day(v);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  if (!inRange(f.createdAt, F.createdFrom, F.createdTo)) return false;
  if (!inRange(f.updatedAt, F.updatedFrom, F.updatedTo)) return false;
  if (!inRange(f.readDoneAt, F.readFrom, F.readTo)) return false;
  if (!inRange(f.checkedAt, F.checkedFrom, F.checkedTo)) return false;
  if (!inRange(f.approvedAt, F.approvedFrom, F.approvedTo)) return false;
  if (F.name && !dispFileName(f.id).toLowerCase().includes(F.name.toLowerCase())) return false;
  return true;
}

/** ツリー検索語（state.q）に一致するか。タブ件数と表で同じ判定を使うため関数化 */
function matchesQuery(f) {
  const q = state.q.toLowerCase();
  if (!q) return true;
      const hay = [f.name, dispLayout(f.layout), dispCat((catOf(f.layout) || {}).id), dispBiz((bizOfLayout(f.layout) || {}).id)].join(' ').toLowerCase();
      return hay.includes(q);
}

/**
 * タブ以外の表示条件（テナント／ツリー選択／絞り込み／ツリー検索語）で絞った一覧。
 * タブ件数の母集団をこれに合わせ、「バッジは 1 なのに表は空」という食い違いを防ぐ。
 */
const baseList = () => scoped().filter((f) => inTenant(f) && inNode(f, state.activeNode) && passesFilters(f) && matchesQuery(f) && canViewFile(f));

/* 閲覧権限：権限のない帳票タイプは一覧・ツリー・件数に出さない（serve.py 注入） */
function canViewFile(f) {
  return (typeof window !== 'undefined' && window.__demoPerm && window.__demoPerm.canViewFile)
    ? window.__demoPerm.canViewFile(f) : true;
}
function _permList(list) {
  return list.filter(canViewFile);
}
function visibleFiles() {
  const node = state.activeNode;
  /* 閲覧権限（客户④：権限のない帳票タイプは一覧に出さない）。
     __demoPerm は review-focus-fix.js 側で用意。未定義なら全件（フォールバック）。 */
  let list = scoped().filter((f) => inTenant(f) && TAB_MATCH[state.tab](f) && inNode(f, node) && passesFilters(f) && matchesQuery(f) && canViewFile(f));
  const k = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
  list = list.slice().sort((a, b) => {
    let va = a[k], vb = b[k];
    if (k === 'name') { va = a.name; vb = b.name; return va.localeCompare(vb, 'ja') * dir; }
    if (k === 'layout') { va = dispLayout(a.layout); vb = dispLayout(b.layout); return va.localeCompare(vb, 'ja') * dir; }
    if (va == null) va = ''; if (vb == null) vb = '';
    return va < vb ? -dir : va > vb ? dir : 0;
  });
  return list;
}

/** 条件だけで絞った件数（ノード・タブ・検索語は除く） */
const filteredByConditionsOnly = () => scoped().filter((f) => inTenant(f) && passesFilters(f));

/* ============================== 5. 描画 ============================== */

function activeFilterChips() {
  const F = state.filters, chips = [];
  const push = (k, label, val) => chips.push({ k, label, val });
  if (F.status) push('status', 'ステータス', STATUS[F.status] ? STATUS[F.status].label : F.status);
  if (F.biz) push('biz', '業務シーン', dispBiz(F.biz));
  if (F.layout) push('layout', '帳票タイプ', dispLayout(F.layout));
  if (F.createdBy) push('createdBy', '作成者', userName(F.createdBy));
  if (F.confirmedBy) push('confirmedBy', '確認者', userName(F.confirmedBy));
  if (F.approvedBy) push('approvedBy', '承認者', userName(F.approvedBy));
  if (F.createdFrom || F.createdTo) push('createdAt', '作成日時', `${F.createdFrom || '—'} 〜 ${F.createdTo || '—'}`);
  if (F.updatedFrom || F.updatedTo) push('updatedAt', '更新日時', `${F.updatedFrom || '—'} 〜 ${F.updatedTo || '—'}`);
  if (F.readFrom || F.readTo) push('readAt', '読取日', `${F.readFrom || '—'} 〜 ${F.readTo || '—'}`);
  if (F.checkedFrom || F.checkedTo) push('checkedAt', '確認日', `${F.checkedFrom || '—'} 〜 ${F.checkedTo || '—'}`);
  if (F.approvedFrom || F.approvedTo) push('approvedAt', '承認日', `${F.approvedFrom || '—'} 〜 ${F.approvedTo || '—'}`);
  if (F.name) push('name', 'ファイル名', F.name);
  return chips;
}

function nodeLabel(node) {
  if (node.type === 'folder') return folderName(node.id);
  if (node.type === 'biz') return dispBiz(node.id);
  if (node.type === 'cat') return dispCat(node.id);
  if (node.type === 'file') return dispFileName(node.id);
  return dispLayout(node.id);
}
function nodeFileCount(node) {
  return node.type === 'file' ? 1 : scoped().filter((f) => inTenant(f) && inNode(f, node)).length;
}

function treeIcon(type, opened = true) {
  const paths = {
    all: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
    folder: opened ? '<path d="M3 8V5a1 1 0 0 1 1-1h5l3 3h8a1 1 0 0 1 1 1v2M3 8h6l2 2h10l-3 10H4L2 9Z"/>' : '<path d="M3 5h6l3 3h9v12H3Z"/>',
    document: '<path d="M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6"/>',
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
    expand: '<path d="m8 8 4-4 4 4M8 16l4 4 4-4M5 12h14"/>',
    collapse: '<path d="m8 4 4 4 4-4M8 20l4-4 4 4M5 12h14"/>',
  };
  return `<svg class="tree-icon tree-icon-${type}" viewBox="0 0 24 24" aria-hidden="true">${paths[type]}</svg>`;
}

function renderTree() {
  ensureTreeSeeded();
  const tree = buildTree();
  const q = state.q.toLowerCase();
  const matchNode = (node) => {
    if (!q) return true;
    const self = nodeLabel(node).toLowerCase();
    if (self.includes(q)) return true;
    if (node.children && node.children.some(matchNode)) return true;
    if (node.type === 'file') return false;
    return scoped().some((f) => inNode(f, node) && (dispFileName(f.id) + ' ' + f.name).toLowerCase().includes(q));
  };
  const rows = [];
  rows.push(`<div class="node lv0 ${state.activeNode.type === 'all' ? 'sel' : ''}" data-depth="0" data-type="all" data-id="all">
      <span class="tw"></span><span class="ni ico">${treeIcon('all')}</span><span class=\"label\">すべて</span><span class=\"cnt\">${scoped().filter((f) => inTenant(f) && canViewFile(f)).length}</span></div>`);
  const walk = (nodes, depth) => {
    nodes.forEach((n) => {
      if (!matchNode(n)) return;
      const key = n.type + ':' + n.id;
      const opened = state.open[key] !== false;
      const hasKids = n.children && n.children.length > 0;
      const sel = state.activeNode.type === n.type && state.activeNode.id === n.id
        || ((state.activeNode.type === 'biz' || state.activeNode.type === 'cat') && n.type === 'folder' && state.activeNode.id === n.id);
      const ni = treeIcon(n.type === 'file' ? 'document' : 'folder', opened);
      const fullName = nodeLabel(n);
      /* 名称変更はファイルのみ（業務シーン・帳票タイプはマスタ固定） */
      const ops = n.type === 'file'
        ? [`<button class="redo" title="ファイル名を変更" data-rename="1"><span class="ico i-edit"></span></button>`]
        : [];
      /* 長い名前は省略表示。hover で全文（ファイルは data-tip、フォルダは title） */
      const labelTip = n.type === 'file'
        ? `data-tip="${esc(fullName)}"`
        : `title="${esc(fullName)}"`;
      rows.push(`<div class="node lv${depth + 1} ${sel ? 'sel' : ''} ${n.type === 'file' ? 'leaf' : ''}" data-depth="${depth}" data-type="${n.type}" data-id="${n.id}" draggable="true">
        <span class="tw" data-tw="1">${hasKids ? `<span class="ico ${opened ? 'i-caret-down' : 'i-caret-down tw-closed'}"></span>` : ''}</span>
        <span class="ni ico">${ni}</span>
        <span class="label" ${labelTip}>${esc(fullName)}</span>
        <span class="cnt">${n.type === 'file' ? '' : nodeFileCount(n)}</span>
        ${ops.join('')}
      </div>`);
      if (hasKids && opened) walk(n.children, depth + 1);
    });
  };
  walk(tree, 0);
  return rows.join('');
}

function renderTreePanel() {
  const open = state.treeOpen !== false;
  const view = state.treeView === 'cat' ? 'cat' : 'biz-cat';
  return `
  <section class="treepanel ${open ? 'open' : ''}" id="treePanel">
    <div class="treepanel-head">
      <div class="tree-view-pills" id="treeView" role="tablist" aria-label="表示次元">
        <button type="button" role="tab" class="tree-view-pill ${view === 'biz-cat' ? 'on' : ''}" data-treeview="biz-cat" aria-selected="${view === 'biz-cat'}" title="業務シーン → 帳票タイプ → ファイル">業務シーン</button>
        <button type="button" role="tab" class="tree-view-pill ${view === 'cat' ? 'on' : ''}" data-treeview="cat" aria-selected="${view === 'cat'}" title="帳票タイプ → ファイル">帳票タイプ</button>
      </div>
      <div class="tree-tools-row">
        <div class="tree-search search-wrap"><input id="treeQ" placeholder="ファイル名で検索" value="${esc(state.q)}" /><span class="mag ico">${treeIcon('search')}</span></div>
        <div class="tree-expand-btns">
      <button class="icon-btn" title="すべて展開" data-exp="all">${treeIcon('expand')}</button>
      <button class="icon-btn" title="すべて折りたたむ" data-exp="none">${treeIcon('collapse')}</button>
        </div>
      </div>
    </div>
    <div class="tree-body ${open ? '' : 'hidden'}">
      <div class="tree" id="tree">${renderTree()}</div>
    </div>
  </section>`;
}

function renderTabs() {
  const counts = {};
  /* 件数は表と同じ母集団（絞り込み・検索語込み）で数える。タブごとに「表示される行数」と一致させる */
  const list = baseList();
  TABS.forEach((t) => { counts[t.id] = list.filter(TAB_MATCH[t.id]).length; });
  const tabCls = (id) => {
    if (id === 'failed' && counts[id]) return 'alert';
    if (id === 'reading' && counts[id]) return 'int';
    if (id !== 'all' && STATUS[id] && STATUS[id].done && counts[id]) return 'done';
    return '';
  };
  const tabs = TABS.map((t) => {
    const on = state.tab === t.id;
    const short = t.id === 'confirmed' ? '確認済み' : t.label;
    return `<div class="tab ${on ? 'on' : ''}" data-tab="${t.id}" title="${esc(t.label)}">
      ${esc(short)}<span class="n ${tabCls(t.id)}">${counts[t.id]}</span></div>`;
  }).join('');
  return `<div class="tabs">${tabs}</div>`;
}

/** ホーム画面用の複数選択（data-hopt で識別） */
function hmselect(id, placeholder, opts, current) {
  const list = current || [];
  const open = state.dd === id;
  const summary = list.length === 0 ? `<span class="ph">${esc(placeholder)}</span>`
    : list.length === 1 ? esc((opts.find((o) => o[0] === list[0]) || [])[1] || list[0])
      : `${esc((opts.find((o) => o[0] === list[0]) || [])[1] || list[0])} <span class="more">+${list.length - 1}</span>`;
  return `<div class="ms ${open ? 'open' : ''} ${list.length ? 'has' : ''}" data-ms="${id}">
    <div class="msbtn" data-msbtn="${id}"><span class="txt">${summary}</span><span class="caret2 ico i-caret-down"></span></div>
    <div class="msmenu">
      ${opts.length ? opts.map((o) => `<label class="msrow"><input type="checkbox" class="cb" data-hopt="${id}" value="${o[0]}" ${list.includes(o[0]) ? 'checked' : ''} /><span>${esc(o[1])}</span></label>`).join('') : '<div class="msrow empty">選択肢なし</div>'}
      <div class="msfoot"><button class="link" data-msclear="${id}">クリア</button></div>
    </div>
  </div>`;
}

/** 単一選択の絞り込み（ファイル一覧の絞り込みは 1 条件 1 値。未使用の選択肢は選べない） */
function fselect(id, placeholder, opts, current) {
  return `<select class="fld fsel" data-fs="${id}" aria-label="${esc(placeholder)}">
    <option value="" ${current ? '' : 'selected'}>${esc(placeholder)}</option>
    ${opts.map((o) => `<option value="${esc(o[0])}" ${current === o[0] ? 'selected' : ''} ${o[2] ? 'disabled' : ''}>${esc(o[1])}${o[2] ? '（未使用）' : ''}</option>`).join('')}
  </select>`;
}

/**
 * 承認フローの状態遷移
 * 確認: 読取完了 → 確認済み
 * 承認: 確認済み → 承認1 → 承認2 → 承認済み（stages=1 なら承認1で承認済み）
 *      承認機能を使わない帳票タイプは 確認済み → そのまま出力可
 * 差戻: 常に「確認」へ戻す（2段承認中でも承認1へは戻さない）。理由コメント必須。
 *       差戻後は再確認→再承認（OA の「再順次承認」）。
 * 出力: 承認済み（または承認不要なら確認済み）→ 出力済み
 */
function flowOf(f) {
  const cfg = approvalOf(f.layout);
  const done = (f.flow || []).filter((h) => h.stage && !h.voided).length;
  return { need: cfg.need !== false, stages: cfg.stages || 1, done };
}

/** 1件の帳票に対して実行できる操作 */
function availableActions(f) {
  const { need, stages, done } = flowOf(f);
  switch (f.status) {
    case 'classifying':
    case 'waiting':
    case 'reading': return ['view'];
    case 'failed': return ['view', 'fix', 'confirm'];
    case 'done':
    case 'checking': return ['view', 'fix', 'confirm'];
    case 'confirmed': return need && done < stages ? ['view', 'approve', 'return'] : ['view', 'export', 'return'];
    case 'approved': return ['view', 'export', 'return'];
    case 'returned': return ['view', 'fix', 'confirm'];
    case 'exported': return ['view', 'export'];
    default: return ['view'];
  }
}

/** CSV 出力可能な状態か（承認済み、または承認不要で確認済み） */
function canExportFile(f) {
  if (!f) return false;
  const { need } = flowOf(f);
  return f.status === 'approved' || f.status === 'exported' || (!need && f.status === 'confirmed');
}

/** 現在ユーザが担当プール（権限者展開＋個別ユーザー）に含まれるか。
 *  システム管理者は万能のため、担当指定の有無に依らず true。 */
function userInGroups(ids) {
  if (isTenantAdmin(state.currentUser)) return true;
  const me = state.currentUser;
  if ((ids || []).includes(me)) return true;
  return assigneeUserIds(ids).includes(me);
}

/** 次に承認すべき段の担当。1 段目＝承認、2 段目＝再承認（段数は帳票権限表から導出） */
function approversFor(f, cfg) {
  const { done } = flowOf(f);
  const lists = cfg.stageAssignees || [cfg.approveGroups, cfg.reapproveGroups];
  const idx = Math.min(done, Math.max(0, lists.length - 1));   /* done 段まで承認済み → 次は done 番目（0 起点） */
  const cur = lists[idx] || [];
  if (cur.length) return cur;
  /* 未設定の段は、担当が入っている最初の段にフォールバック（承認者未設定で止まらないように） */
  const first = lists.filter((x) => (x || []).length)[0];
  return first || [];
}

/** いま待ちの承認タスク種別：approve（1段目）| reapprove（2段目）| null */
function pendingApproveKind(f, cfg) {
  if (f.status !== 'confirmed' || cfg.need === false) return null;
  const { done, stages } = flowOf(f);
  if (stages >= 2 && done >= 1) return 'reapprove';
  return 'approve';
}

/** タスク種別 → 担当プール */
function taskTargetsOf(cfg, kind) {
  if (kind === 'confirm') return cfg.confirmGroups;
  if (kind === 'reapprove') return cfg.reapproveGroups;
  return cfg.approveGroups;
}

/** 安定した割当ユーザ（グループ内ランダムのデモ実装） */
function taskAssigneeUid(f, kind) {
  return pickRandomAssignee(taskTargetsOf(approvalOf(f.layout), kind), f.id + ':' + kind);
}

/** 未対応＝割当先／対応済＝処理者。記録が無ければ割当先にフォールバック */
function taskOwnerUid(f, kind, bucket) {
  if (bucket === 'done') {
    if (kind === 'confirm' && f.confirmedBy) return f.confirmedBy;
    if ((kind === 'approve' || kind === 'reapprove') && f.approvedBy) return f.approvedBy;
  }
  return taskAssigneeUid(f, kind);
}

/**
 * マイタスクに出してよいか。
 * 1) 操作権限：確認者は承認タスクを見ない／承認者は確認タスクを見ない
 * 2) 帳票権限：その帳票タイプの担当プールに入っている（管理者はバイパス）
 * 3) データ権限：自身のみ＝自分の割当／処理分だけ。全件参照＝同プールの他人分も見える
 */
function canSeeMyTask(f, kind, bucket, uid) {
  const me = uid || state.currentUser;
  const op = kind === 'confirm' ? 'confirm' : 'approve';
  if (!userHasOp(op, me)) return false;
  const act = kind === 'reapprove' ? 'reapprove' : kind;
  if (!canTicketAct(f.layout, act, me)) return false;
  if (isTenantAdmin(me) || dataPermOf(me) === '全件参照') return true;
  return taskOwnerUid(f, kind, bucket) === me;
}

/** マイタスク候補。kind: confirm | approve | reapprove（未対応＋対応済の合算） */
function myTaskFiles(kind) {
  return FILES_DATA.filter((f) => {
    const cfg = approvalOf(f.layout);
    if (kind === 'confirm') {
      if (['done', 'returned', 'checking'].includes(f.status)) return canSeeMyTask(f, 'confirm', 'pending');
      if (['confirmed', 'approved', 'exported'].includes(f.status)) return canSeeMyTask(f, 'confirm', 'done');
      return false;
    }
    if (kind === 'approve' || kind === 'reapprove') {
      const pk = pendingApproveKind(f, cfg);
      if (pk === kind) return canSeeMyTask(f, kind, 'pending');
      if (['approved', 'exported'].includes(f.status) && cfg.need !== false) {
        if (kind === 'reapprove') return cfg.stages >= 2 && canSeeMyTask(f, 'reapprove', 'done');
        /* 1 段目の対応済。2 段帳票でも 1 段目承認者の已办として出す */
        return canSeeMyTask(f, 'approve', 'done');
      }
      return false;
    }
    return false;
  });
}

/** マイタスク行（タスク種別付き）。bucket: pending | done
 *  kind: confirm | approve（1段）| reapprove（2段） */
function myTaskRows(bucket) {
  const rows = [];
  const want = bucket === 'done' ? 'done' : 'pending';
  FILES_DATA.forEach((f) => {
    const cfg = approvalOf(f.layout);
    if (want === 'pending') {
      if (['done', 'returned', 'checking'].includes(f.status) && canSeeMyTask(f, 'confirm', 'pending')) {
        rows.push({ file: f, kind: 'confirm' });
      }
    } else {
      if (['confirmed', 'approved', 'exported'].includes(f.status) && canSeeMyTask(f, 'confirm', 'done')) {
        rows.push({ file: f, kind: 'confirm' });
      }
    }
  });
  return rows;
}


/* マイタスク：タスク種別での絞り込み（serve.py 注入） */
function passesMyTaskKind(r) {
  const F = state.myTaskFilters || {};
  if (F.kind && r.kind !== F.kind) return false;
  return true;
}

function passesMyTaskFilters(f) {
  const F = state.myTaskFilters || {};
  const name = (F.name || '').trim().toLowerCase();
  if (name && !dispFileName(f.id).toLowerCase().includes(name) && !(f.name || '').toLowerCase().includes(name)) return false;
  if (F.biz) {
    const biz = bizOfLayout(f.layout);
    if (!biz || biz.id !== F.biz) return false;
  }
  if (F.cat) {
    const cat = catOf(f.layout);
    if (!cat || cat.id !== F.cat) return false;
  }
  if (F.createdFrom && (f.createdAt || '') < F.createdFrom) return false;
  if (F.createdTo && (f.createdAt || '').slice(0, 10) > F.createdTo) return false;
  if (F.updatedFrom && (f.updatedAt || '') < F.updatedFrom) return false;
  if (F.updatedTo && (f.updatedAt || '').slice(0, 10) > F.updatedTo) return false;
  if (F.assignee) {
    const a = F.assignee.trim().toLowerCase();
    const cfg = approvalOf(f.layout);
    const people = [
      ...assigneeUserIds(cfg.confirmGroups),
      ...assigneeUserIds(cfg.approveGroups),
      ...assigneeUserIds(cfg.reapproveGroups),
      f.confirmedBy, f.approvedBy, f.createdBy,
    ].map((id) => userName(id) || id || '').join(' ').toLowerCase();
    if (!people.includes(a)) return false;
  }
  return true;
}

/**
 * 详情壳の CTA／編集可否は status のみで決める（モード切替なし）。
 * 一覧からの閲覧は reviewViewOnly で CTA を出さない。
 */
function reviewFootFlags(f) {
  const { need, stages, done } = flowOf(f);
  if (state.reviewViewOnly) {
    return {
      phase: 'view',
      readonly: true,
      canSave: false,
      canConfirm: false,
      canApprove: false,
      canReturn: false,
      canExport: canExportFile(f) && f.status !== 'exported',
      need, stages, done,
    };
  }
  if (['done', 'failed', 'returned', 'checking'].includes(f.status)) {
    return {
      phase: 'confirm',
      readonly: false,
      canSave: true,
      canConfirm: true,
      canApprove: false,
      canReturn: false,
      canExport: false,
      need, stages, done,
    };
  }
  if (f.status === 'confirmed') {
    return {
      phase: 'export',
      readonly: true,
      canSave: false,
      canConfirm: false,
      canApprove: false,
      canReturn: false,
      canExport: true,
      need, stages, done,
    };
  }
  if (f.status === 'approved') {
    return {
      phase: 'export',
      readonly: true,
      canSave: false,
      canConfirm: false,
      canApprove: false,
      canReturn: true,
      canExport: true,
      need, stages, done,
    };
  }
  return {
    phase: 'view',
    readonly: true,
    canSave: false,
    canConfirm: false,
    canApprove: false,
    canReturn: false,
    canExport: f.status === 'exported',
    need, stages, done,
  };
}

/** 保存履历の初期モック（製品の「履歴」一覧用） */
function ensureSaveHistory(f) {
  if (!f || f.saveHistory) return;
  const stamp = (f.updatedAt || f.createdAt || nowStamp()).replace(/-/g, '.').replace(' ', ' ');
  f.saveHistory = [{
    id: 'sh_init',
    at: stamp,
    user: '佐藤 美子',
    fields: Object.fromEntries(OCR_FIELDS.b6.map((x) => [x.key, x.value || ''])),
  }];
}

/**
 * 承認画面用：確認者の操作結果モックを補完する。
 * 確認フローが無い帳票には、読取値→修正値の差分と差戻記録を載せる。
 */
function ensureConfirmAudit(f) {
  if (!f || f._auditSeeded) return;
  f._auditSeeded = true;
  if (!f.flow) f.flow = [];
  const hasConfirm = f.flow.some((h) => h.action === '確認');
  const needsAudit = ['confirmed', 'approved', 'exported', 'returned'].includes(f.status);
  if (!needsAudit) return;
  if (!hasConfirm && f.confirmedAt) {
    const who = userName(f.confirmedBy) || userName(f.updatedBy) || '確認者';
    const sampleChanges = [
      { key: 'move_type', label: '異動区分', from: '転居', to: '転入' },
      { key: 'new_addr', label: '新しい住所', from: '東京都千代田区日比谷', to: '東京都千代田区日比谷1-1' },
      { key: 'notifier_tel', label: '届出人電話番号', from: '03-1234-567', to: '03-1234-5678' },
    ].filter((c) => OCR_FIELDS.b6.some((x) => x.key === c.key));
    f.flow.unshift({
      stage: null,
      action: '確認',
      user: who,
      at: f.confirmedAt,
      comment: '確認担当者が必須項目を目視確認し、誤読箇所を修正しました',
      changes: sampleChanges,
      confirmedCount: OCR_FIELDS.b6.length,
    });
    /* 承認画面の右側でも差分が見えるよう dirty を同期 */
    if (!state.reviewDirty[f.id]) {
      state.reviewDirty[f.id] = Object.fromEntries(sampleChanges.map((c) => [c.key, c.to]));
    }
    state.reviewConfirmed[f.id] = state.reviewConfirmed[f.id] || Object.fromEntries(
      OCR_FIELDS.b6.map((x) => [x.key, true])
    );
  }
  if (f.status === 'returned' && !f.flow.some((h) => h.action && String(h.action).indexOf('差戻') === 0)) {
    f.flow.push({
      action: '差戻（確認者へ）',
      user: userName(f.updatedBy) || '承認者',
      at: f.updatedAt || nowStamp(),
      comment: '異動区分の根拠が不足しています。確認者へ差し戻します',
    });
  }
}

/** 直前の確認操作（差分・コメント付き）と差戻記録を取り出す */
function confirmAuditOf(f) {
  ensureConfirmAudit(f);
  const conf = [...(f.flow || [])].reverse().find((h) => h.action === '確認') || null;
  const returns = (f.flow || []).filter((h) => h.action && String(h.action).indexOf('差戻') === 0);
  const dirty = state.reviewDirty[f.id] || {};
  let changes = (conf && conf.changes) || [];
  if (!changes.length && Object.keys(dirty).length) {
    changes = Object.keys(dirty).map((key) => {
      const field = OCR_FIELDS.b6.find((x) => x.key === key) || OCR_TABLES.default.find((x) => x.key === key);
      return {
        key,
        label: (field && field.label) || key,
        from: (OCR_ORIGINAL.text[key] !== undefined ? OCR_ORIGINAL.text[key] : '') || '',
        to: dirty[key],
      };
    });
  }
  return {
    confirm: conf,
    changes,
    returns,
    confirmedCount: (conf && conf.confirmedCount) || Object.keys(state.reviewConfirmed[f.id] || {}).length || 0,
  };
}

/** 電算サイト型 CTA（紺ラベル＋オレンジ矢印帯） */
function dsCta(id, label, extraClass, disabled) {
  return `<button type="button" class="btn btn-ds ${extraClass || ''}" id="${esc(id)}" ${disabled ? 'disabled' : ''}>`
    + `<span class="btn-ds-lab">${label}</span><span class="btn-ds-go" aria-hidden="true"></span></button>`;
}

/**
 * 承認画面シェル：進捗・確認サマリ・差戻を上部に固定し、
 * 「修正差分 / 全項目」のどちらか一方だけを下ペインに出す（情報の重複を避ける）。
 */
function renderApproveAudit(f, fieldsHtml) {
  const progress = flowProgress(f);
  const audit = confirmAuditOf(f);
  const conf = audit.confirm;
  const pane = state.reviewApprovePane === 'fields' ? 'fields' : 'diff';
  const changeRows = audit.changes.length
    ? `<table class="rv-audit-diff"><thead><tr><th>項目</th><th>読取結果（原文）</th><th>確認者の修正</th></tr></thead><tbody>${
      audit.changes.map((c) => `<tr>
        <td>${esc(c.label)}</td>
        <td class="from">${c.from === '' || c.from == null ? '<span class="muted">（空）</span>' : esc(String(c.from))}</td>
        <td class="to">${esc(String(c.to))}</td>
      </tr>`).join('')
    }</tbody></table>`
    : '<p class="rv-audit-empty">修正された項目はありません（確認者は読取結果をそのまま確認済みにしました）。</p>';
  const returnRows = audit.returns.length
    ? `<ul class="rv-audit-returns">${audit.returns.map((r) => `
        <li>
          <div class="rv-audit-return-head"><b>${esc(r.action)}</b><span>${esc(r.user || '—')} ・ ${esc(r.at || '—')}</span></div>
          ${r.comment ? `<p class="rv-audit-return-body">${esc(r.comment)}</p>` : '<p class="rv-audit-return-body muted">コメントなし</p>'}
        </li>`).join('')}</ul>`
    : '';
  const paneBody = pane === 'fields'
    ? (fieldsHtml || '<p class="rv-audit-empty">表示する項目がありません</p>')
    : changeRows;
  return `
  <div class="rv-approve-shell">
    <div class="rv-approve-audit">
      <div class="rv-approve-progress">
        <div class="rv-approve-progress-head">
          <b>帳票の進捗</b>
          <span class="rv-approve-progress-label">${esc(progress.label)}</span>
        </div>
        ${flowStepsHtml(f, { compact: true, detail: false })}
      </div>
      <div class="rv-approve-prev">
        <div class="rv-approve-prev-head">
          <b>直前の操作結果（確認）</b>
          ${conf
            ? `<span class="rv-approve-meta">${esc(conf.user || '—')} ・ ${esc(conf.at || '—')}</span>`
            : '<span class="rv-approve-meta muted">確認記録なし</span>'}
        </div>
        ${conf && conf.comment ? `<p class="rv-approve-comment">「${esc(conf.comment)}」</p>` : ''}
        <div class="rv-approve-summary">
          <span class="rv-approve-chip">確認済み <b>${audit.confirmedCount || OCR_FIELDS.b6.length}</b></span>
          ${audit.changes.length > 0 ? `<span class="rv-approve-chip is-mod">確認者の修正 <b>${audit.changes.length}</b></span>` : ''}
        </div>
      </div>
      ${returnRows ? `<div class="rv-approve-returns"><div class="rv-approve-prev-head"><b>差戻記録</b></div>${returnRows}</div>` : ''}
      <div class="rv-approve-tabs" role="tablist">
        <button type="button" class="rv-approve-tab ${pane === 'diff' ? 'on' : ''}" data-rv-apane="diff" role="tab" aria-selected="${pane === 'diff'}">修正差分<span class="n">${audit.changes.length}</span></button>
        <button type="button" class="rv-approve-tab ${pane === 'fields' ? 'on' : ''}" data-rv-apane="fields" role="tab" aria-selected="${pane === 'fields'}">全項目</button>
      </div>
    </div>
    <div class="rv-approve-pane" role="tabpanel">${paneBody}</div>
  </div>`;
}

function formatHistoryAt(ts) {
  return String(ts || nowStamp()).replace(/-/g, '.').replace('T', ' ').slice(0, 19);
}

/**
 * 承認フローの進捗（OA 風タイムライン）。
 * ノード：読取 → 確認 → 承認（1/2段）→ 出力
 * 差戻後は確認が current、承認段は未着手に戻す。
 */
function flowProgress(f) {
  const { need, stages, done } = flowOf(f);
  const byStage = (n) => [...(f.flow || [])].reverse().find((h) => h.stage === n && !h.voided);
  const lastReturn = [...(f.flow || [])].reverse().find((h) => h.action && String(h.action).indexOf('差戻') === 0);
  const confRec = [...(f.flow || [])].reverse().find((h) => h.action === '確認' && !h.voided);
  const returned = f.status === 'returned';
  const readDone = ['done', 'failed', 'checking', 'confirmed', 'approved', 'returned', 'exported'].includes(f.status)
    || !!f.readAt || !!f.readDoneAt;
  const steps = [];
  steps.push({ key: 'upload', label: 'アップロード', state: 'done', at: f.createdAt || '', user: '', comment: '' });
  steps.push({
    key: 'read', label: '読取',
    state: readDone ? 'done' : 'current',
    at: f.readAt || f.readDoneAt || '', user: '', comment: '',
  });

  let confirmState = 'todo';
  if (returned) confirmState = 'current';
  else if (['confirmed', 'approved', 'exported'].includes(f.status)) confirmState = 'done';
  else if (['done', 'failed', 'checking'].includes(f.status)) confirmState = 'current';
  steps.push({
    key: 'confirm', label: '確認', state: confirmState,
    at: (confRec && confRec.at) || (!returned ? (f.confirmedAt || '') : ''),
    user: (confRec && confRec.user) || '', comment: (confRec && confRec.comment) || '',
  });

  if (false) {
    for (let n = 1; n <= stages; n += 1) {
      const rec = byStage(n);
      let state = 'todo';
      if (returned) state = 'todo';
      else if (rec) state = 'done';
      else if (f.status === 'confirmed' || f.status === 'approved') {
        state = done + 1 === n ? 'current' : (n <= done ? 'done' : 'todo');
      }
      steps.push({
        key: `approve${n}`,
        label: stages === 1 ? '承認' : ('承認' + n),
        state,
        at: (rec && rec.at) || '',
        user: (rec && rec.user) || '',
        comment: (rec && rec.comment) || '',
      });
    }
  }

  let exportState = 'todo';
  if (f.status === 'exported') exportState = 'done';
  else if (f.status === 'approved' || (!need && f.status === 'confirmed')) exportState = 'current';
  steps.push({
    key: 'export', label: '出力', state: exportState,
    at: f.exportedAt || '', user: '', comment: '',
  });

  const cur = steps.findIndex((x) => x.state === 'current');
  const state = returned ? 'returned' : (f.status === 'exported' ? 'done' : (cur >= 0 ? 'current' : 'todo'));
  const label = returned ? '差戻中（確認へ）'
    : f.status === 'exported' ? '完了'
      : f.status === 'approved' ? '承認済み・出力待ち'
        : f.status === 'confirmed'
          ? (!need ? '確認済み（承認不要）' : '確認済み')
          : confirmState === 'current' ? '確認待ち'
            : '読取中';
  return { need, stages, done, steps, current: cur, state, label, lastReturn };
}

/** OA 風の進捗バー（全ノードを横一列で見せる） */
function flowStepsHtml(f, opts) {
  const p = flowProgress(f);
  const o = opts || {};
  const detail = !!o.detail;
  return `
  <div class="oa-progress ${p.state === 'returned' ? 'is-returned' : ''} ${o.compact ? 'is-compact' : ''}" role="list" aria-label="承認進捗">
    <div class="oa-progress-track">
      ${p.steps.map((st, i) => `
        ${i ? `<span class="oa-edge ${st.state === 'done' || st.state === 'current' || (p.steps[i - 1].state === 'done') ? 'on' : ''} ${p.steps[i - 1].state === 'done' && st.state === 'current' ? 'to-current' : ''}" aria-hidden="true"></span>` : ''}
        <div class="oa-node ${st.state}" role="listitem">
          <span class="oa-dot">${st.state === 'done' ? '<span class="ico i-check"></span>' : (st.state === 'current' ? '●' : i + 1)}</span>
          <span class="oa-label">${esc(st.label)}</span>
          ${detail && (st.user || st.at)
            ? `<span class="oa-meta">${esc(st.user || '—')}${st.at ? `<br>${esc(st.at)}` : ''}</span>`
            : ''}
        </div>`).join('')}
    </div>
    
  </div>`;
}

/** 帳票1件のフロー操作を実行する */
function runFlowAction(fileId, action, comment) {
  /* 確認は取り消せないため、メッセージに同意するまで確定しない */
  if (action === 'confirm' && !state.reviewConfirmAgreed) {
    if (!state.reviewConfirmAsk) { state.reviewConfirmAsk = true; render(); }
    return;
  }
  const f = byId(FILES_DATA, fileId);
  if (!f) return;
  const { need, stages, done } = flowOf(f);
  const cfg = approvalOf(f.layout);
  const who = '佐藤 美子';
  const stamp = nowStamp();
  if (action === 'confirm') {
    f.status = 'confirmed'; f.confirmedAt = stamp; f.checkedAt = stamp; f.confirmedBy = 'u2';
    const dirty = state.reviewDirty[fileId] || {};
    const changes = Object.keys(dirty).map((key) => {
      const field = OCR_FIELDS.b6.find((x) => x.key === key) || OCR_TABLES.default.find((x) => x.key === key);
      return {
        key,
        label: (field && field.label) || key,
        from: (OCR_ORIGINAL.text[key] !== undefined ? OCR_ORIGINAL.text[key] : OCR_ORIGINAL.table[key]) || '',
        to: dirty[key],
      };
    });
    f.flow.push({
      stage: null, action: '確認', user: who, at: stamp, comment: comment || '',
      changes,
      confirmedCount: Object.keys(state.reviewConfirmed[fileId] || {}).length || OCR_FIELDS.b6.length,
    });
    f.history = `確認担当者: ${who}`;
    toast('確認しました');
  } else if (action === 'approve') {
    if (!need) { toast('この帳票タイプは承認機能を使用しません'); return; }
    const next = done + 1;
    f.flow.push({ stage: next, action: stages === 1 ? '承認' : `承認${next}`, user: who, at: stamp, comment: comment || '' });
    if (next >= stages) {
      f.status = 'approved'; f.approvedAt = stamp; f.approvedBy = 'u3';
      f.history = stages === 2 ? '承認済み（2段）' : '承認済み';
      toast(stages === 2 ? '最終承認が完了しました' : '承認が完了しました');
    } else {
      f.history = `承認1済み（承認2待ち）`;
      toast('1段目を承認しました（次は再承認）');
    }
  } else if (action === 'return') {
    const reason = String(comment || '').trim();
    if (!reason) { toast('差戻理由を入力してください'); return; }
    /* 常に確認へ差戻。過去の確認・承認は voided（履歴は残し、再順次承認） */
    (f.flow || []).forEach((h) => {
      if (h.stage || h.action === '確認') h.voided = true;
    });
    f.status = 'returned';
    f.returnTo = 0;
    f.confirmedAt = null;
    f.confirmedBy = null;
    f.approvedAt = null;
    f.approvedBy = null;
    f.flow.push({ action: '差戻（確認者へ）', user: who, at: stamp, comment: reason, returnTo: 'confirm' });
    f.history = '差戻中（確認者へ・再確認が必要）';
    toast('確認者へ差し戻しました');
  } else if (action === 'export') {
    f.status = 'exported'; f.exportedAt = stamp; f.history = '出力済み（CSV）';
    toast('CSVを出力しました');
  } else if (action === 'fix') {
    toast('読取結果の修正画面は製品側の画面です（本デモでは未実装）');
    return;
  } else if (action === 'view') { toast('プレビュー（モック）'); return; }
  render();
}

/** 絞り込み条件の既定値（リセットもこれを使う）。state 初期化より前に置くこと（関数宣言なので巻き上げられる） */
function defaultFilters() { return {
  status: '', biz: '', layout: '', createdBy: '', confirmedBy: '', approvedBy: '',
  createdFrom: '', createdTo: '', updatedFrom: '', updatedTo: '',
  readFrom: '', readTo: '', checkedFrom: '', checkedTo: '', approvedFrom: '', approvedTo: '',
  name: '',
  };
}

function renderFilters() {
  const F = state.filters;
  const chips = activeFilterChips().filter((c) => c.k !== 'createdAt' || F.createdFrom !== HOME_FROM || F.createdTo !== HOME_TO);
  const users = USERS.map((u) => [u.id, u.name]);
  const confirmers = users.filter((u) => FILES_DATA.some((f) => f.confirmedBy === u[0]));
  const approvers = users.filter((u) => FILES_DATA.some((f) => f.approvedBy === u[0]));
  const bizOpts = BUSINESS.slice().sort((a, b) => a.order - b.order).map((b) => [b.id, dispBiz(b.id)]);
  /* 業務シーンが選ばれているときは、その配下のタイプだけを候補に出す */
  const selectedBiz = F.biz || [];
  const layouts = LAYOUT
    .filter((l) => {
      if (!selectedBiz.length) return true;
      const biz = bizOfLayout(l.id);
      return biz && selectedBiz.includes(biz.id);
    })
    .map((l) => [l.id, dispLayout(l.id)]);
  /* 読取待ちは新規アップロード画面のみ。ファイル一覧のステータス絞り込みには出さない */
  const statusOpts = STATUS_ORDER.filter((k) => k !== 'waiting').map((k) => [k, STATUS[k].label, STATUS[k].unused]).concat([['notExported', '出力未済', false]]);
  const range = (label, from, to) => `<div class="field"><span class="lbl">${label}</span><div class="result-date-range"><span class="ico i-calendar" aria-hidden="true"></span><input type="date" id="${from}" aria-label="${label} 開始" value="${esc(F[from])}" /><span class="range-sep">-</span><input type="date" id="${to}" aria-label="${label} 終了" value="${esc(F[to])}" /></div></div>`;
  const open = state.filterOpen;
  return `
  <section class="filters result-filters${open ? ' is-open' : ''}">
    <div class="result-filters-body">
      <div class="result-filters-fields">
        <div class="result-filter-row result-search-row">
          <div class="field"><span class="lbl">ステータス</span>${fselect('status', '選択してください', statusOpts, F.status)}</div>
          
          
        </div>
        ${open ? `<div class="result-filter-row" id="resultAdvanced">
          <div class="field"><span class="lbl">作成者</span>${fselect('createdBy', '選択してください', users, F.createdBy)}</div>
          <div class="field"><span class="lbl">確認者</span>${fselect('confirmedBy', '選択してください', confirmers, F.confirmedBy)}</div>
                  </div>
        <div class="result-filter-row result-date-row">
      ${range('作成日時', 'createdFrom', 'createdTo')}
          ${range('更新日時', 'updatedFrom', 'updatedTo')}
          ${range('読取日', 'readFrom', 'readTo')}
          ${range('確認日', 'checkedFrom', 'checkedTo')}
          
        </div>` : ''}
      </div>
      <div class="result-search-actions filter-acts">
        <button type="button" class="btn primary filter-act" id="searchBtn" title="検索" aria-label="検索"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
        <button type="button" class="btn filter-act" id="resetBtn" title="リセット" aria-label="リセット"><span class="ico i-refresh" aria-hidden="true"></span></button>
        <button class="link result-more" data-exp="filter" aria-expanded="${open}" aria-controls="resultAdvanced"><span class="ico ${open ? 'i-caret-up' : 'i-caret-down'}" aria-hidden="true"></span>${open ? '閉じる' : 'もっと見る'}</button>
    </div>
      </div>
    ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip"><b>${esc(c.label)}</b>${esc(c.val)}<button data-chip="${c.k}" title="この条件を解除"><span class="ico i-close" aria-hidden="true"></span></button></span>`).join('')}</div>` : ''}
  </section>`;
}

function renderTable() {
  const node = state.activeNode;
  const ctxName = node.type === 'all' ? 'すべての帳票'
    : node.type === 'file' ? nodeLabel(node)
      : nodeLabel(node) + (node.type === 'cat' ? '（帳票タイプ）' : '（業務）');
  const all = visibleFiles();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  if (state.resultPage > pages) state.resultPage = pages;
  const rows = all.slice((state.resultPage - 1) * state.perPage, state.resultPage * state.perPage);
  const arrow = (k) => (state.sort.key === k ? ` <span class="ico ${state.sort.dir === 'asc' ? 'i-caret-up' : 'i-caret-down'}"></span>` : '');
  const th = (k, label, extra = '') => `<th data-sort="${k}" style="cursor:pointer" ${extra}>${label}${arrow(k)}</th>`;

  const stCls = (s) => (s === 'done' || s === 'confirmed' || s === 'approved' || s === 'exported' ? 'ok' : s === 'failed' || s === 'returned' ? 'ng' : s === 'reading' ? 'mid' : 'wait');
  const histCls = (s) => (s === 'failed' || s === 'returned' || s === 'reading' || s === 'waiting' ? 'cur' : 'done');

  const body = rows.length === 0
    ? `<tr><td colspan="9" class="empty-cell">条件に一致する帳票がありません。条件を変更してください。</td></tr>`
    : rows.map((f) => {
      const c = catOf(f.layout);
      return `<tr class="${state.picked[f.id] ? 'pick' : ''}" data-row="${f.id}">
        <td><input type="checkbox" class="cb" data-pick="${f.id}" ${state.picked[f.id] ? 'checked' : ''} /></td>
        <td class="name col-name"><button class="fn link" data-result-preview="${f.id}" title="${esc(dispFileName(f.id))}">${esc(dispFileName(f.id))}</button></td>
        <td class="result-type" title="${esc(dispLayout(f.layout))}">${esc(dispLayout(f.layout))}</td>
        
        <td><span class="st ${stCls(f.status)}" title="${esc(STATUS[f.status].label)}">${esc(STATUS[f.status].label)}${f.status === 'classifying' || f.status === 'reading' ? '<span class="spin"></span>' : ''}</span></td><td class="sub" title="${esc(currentAssigneeOf(f))}">${esc(currentAssigneeOf(f))}</td>
        
        
        <td style="white-space:nowrap;color:var(--text-2)">${esc(f.updatedAt)}</td>
        <td class="result-actions-cell"><div class="acts act-icons">${(() => {
          /* 行アクション：詳細／確認／ダウンロード／削除 */
          const canRedo = ['done', 'failed', 'returned'].includes(f.status);
          return [
            `<button class="act" data-act="detail" data-file="${f.id}" data-tip="详情" aria-label="详情"><span class="ico i-view" aria-hidden="true"></span></button>`,
            `<button class="act" data-act="confirm" data-file="${f.id}" data-tip="確認" aria-label="確認"><span class="ico i-edit" aria-hidden="true"></span></button>`,
            /* ダウンロードは hover で形式メニューを出す（data-dlmenu）。表のスクロール領域で切れないよう fixed 配置 */
            `<button class="act" data-dlmenu="${f.id}" aria-haspopup="menu" aria-label="ダウンロード"><span class="ico i-download" aria-hidden="true"></span></button>`,
            `<button class="act danger" data-act="delete" data-file="${f.id}" data-tip="削除" aria-label="削除"><span class="ico i-delete" aria-hidden="true"></span></button>`,
          ].join('');
        })()}</div></td></tr>`;
    }).join('');

  const pagesHtml = [];
  if (pages > 1) {
    pagesHtml.push(`<button class="pg" data-resultpage="${Math.max(1, state.resultPage - 1)}" ${state.resultPage === 1 ? 'disabled' : ''}>‹</button>`);
    const set = new Set([1, 2, 3, 4, 5, 6, pages, state.resultPage - 1, state.resultPage, state.resultPage + 1]);
    const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
    let prev = 0;
    list.forEach((p) => { if (p - prev > 1) pagesHtml.push(`<span style="color:var(--text-3)">…</span>`); pagesHtml.push(`<button class="pg ${p === state.resultPage ? 'on' : ''}" data-resultpage="${p}">${p}</button>`); prev = p; });
    pagesHtml.push(`<button class="pg" data-resultpage="${Math.min(pages, state.resultPage + 1)}" ${state.resultPage === pages ? 'disabled' : ''}>›</button>`);
  }
  const pickedCount = Object.values(state.picked).filter(Boolean).length;

  return `
  <div class="tablebar result-tablebar">
    
    <div class="batch-dl${pickedCount ? '' : ' is-disabled'}">
      <button type="button" class="btn sm result-download" id="batchExport" ${pickedCount ? '' : 'disabled'} aria-haspopup="true" title="選択行を一括ダウンロード"><span class="ico i-download" aria-hidden="true"></span>一括ダウンロード</button>
      <div class="batch-dl-menu" role="menu">
        <button type="button" role="menuitem" data-batchdl="csv">CSVをダウンロード</button>
        <button type="button" role="menuitem" data-batchdl="json">JSONをダウンロード</button>
        <button type="button" role="menuitem" data-batchdl="pdf">PDFをダウンロード</button>
  </div>
    </div>
    <button class="btn sm danger-ghost" id="batchDelete" ${pickedCount ? '' : 'disabled'}><span class="ico i-delete" aria-hidden="true"></span>一括削除</button>
  </div>
  <div class="tablewrap result-tablewrap" title="横にドラッグして列を表示できます">
    <table class="result-table">
      <colgroup>
        <col style="width:44px">
        <col class="col-name" style="width:210px">
        <col style="width:190px">
        <col style="width:120px">
        <col style="width:160px">
        <col style="width:170px">
      </colgroup>
      <thead><tr>
        <th><input type="checkbox" class="cb" data-pickall="1" aria-label="このページを全選択" ${rows.length && rows.every((f) => state.picked[f.id]) ? 'checked' : ''} /></th>
        <th data-sort="name" class="col-name" style="cursor:pointer">ファイル名${arrow('name')}</th>${th('layout', '帳票タイプ')}${th('status', 'ステータス')}<th style="width:186px">現在の担当</th>${th('updatedAt', '更新日時')}<th class="result-actions-cell centered">操作・処理</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <div class="pager result-pager">
    <span>検索結果 ${total} 件中</span>
    <select data-perpage="1" aria-label="1ページの表示件数">${[10, 20, 50, 100].map((n) => `<option ${n === state.perPage ? 'selected' : ''}>${n}件ずつ</option>`).join('')}</select>
    <span class="pages">${pagesHtml.join('')}</span>
    <input class="pginput" data-resultgoto inputmode="numeric" aria-label="移動先ページ" value="${state.resultPage}" /><span>ページへ</span>
  </div>`;
}

/* ===================== 5-b2. タブ（ホーム／新規アップロード／ファイル一覧／マイタスク） ===================== */

const TABS_DEF = {
  home: { id: 'home', label: 'ホーム', route: 'home' },
  upload: { id: 'upload', label: '新規アップロード', route: 'upload' },
  result: { id: 'result', label: 'ファイル一覧', route: 'result' },
  myTasks: { id: 'myTasks', label: 'マイタスク', route: 'myTasks' },
  /* 入口＝左リスト＋右 Step1（業務シーン設定と同じ構成） */
  ticketDetail: { id: 'ticketDetail', label: '帳票タイプ設定', route: 'ticketDetail' },
  bizScenes: { id: 'bizScenes', label: '業務シーン設定', route: 'bizScenes' },
  permissions: { id: 'permissions', label: '帳票権限管理', route: 'permissions' },
  api: { id: 'api', label: '外部API連携', route: 'api' },
  users: { id: 'users', label: 'ユーザー管理', route: 'users' },
  roles: { id: 'roles', label: '権限設定', route: 'roles' },
  security: { id: 'security', label: 'セキュリティ設定', route: 'security' },
  logs: { id: 'logs', label: 'ログ設定', route: 'logs' },
};

/** 确认／详情タブ ID（ファイルごとに1タブ） */
const reviewTabId = (fileId) => 'review:' + fileId;
const isReviewTab = (id) => typeof id === 'string' && id.indexOf('review:') === 0;
const reviewTabFileId = (id) => (isReviewTab(id) ? id.slice('review:'.length) : null);

/** 静的メニュータブ or ファイル确认タブ */
function tabDef(id) {
  if (TABS_DEF[id]) return TABS_DEF[id];
  if (isReviewTab(id)) {
    const fileId = reviewTabFileId(id);
    const name = dispFileName(fileId) || fileId || '详情';
    const short = name.length > 18 ? name.slice(0, 16) + '…' : name;
    return { id, label: short, title: name, route: 'review', fileId };
  }
  return null;
}

const isTabOpen = (id) => state.tabs.includes(id);

/** ページ → 対応するタブ ID（メニューとタグを同期） */
function tabOfRoute(route) {
  if (route === 'ticketTypes') return 'ticketDetail';
  if (route === 'review') return state.reviewId ? reviewTabId(state.reviewId) : (state.reviewReturn === 'myTasks' ? 'myTasks' : 'result');
  if (TABS_DEF[route]) return route;
  return 'home';
}

function openTab(id) {
  const def = tabDef(id);
  if (!def) return;
  if (!isReviewTab(id)) {
    const page = def.route || id;
    if (!canReachPage(page)) {
      toast('この画面を開く権限がありません');
      return;
    }
  }
  if (!isTabOpen(id)) state.tabs.push(id);
  if (isReviewTab(id)) {
    const fileId = def.fileId;
    const sess = (state.reviewSessions || {})[fileId] || {};
    state.reviewId = fileId;
    state.reviewViewOnly = !!sess.viewOnly;
    state.reviewReturn = sess.returnPage || state.reviewReturn || 'myTasks';
    state.page = 'review';
  } else {
    state.page = def.route;
  }
  if (id === 'myTasks') state.myTaskTab = state.myTaskTab || 'pending';
  if (id === 'ticketDetail') {
    /* メニュー／タブ＝左リスト＋右 Step1 */
    openTicketTypes();
    return;
  }
  if (id === 'bizScenes') {
    state.sceneStep = state.sceneStep || 1;
  }
  state.dd = null;
  state.navMenu = null;
  render();
}

function closeTab(id) {
  const i = state.tabs.indexOf(id);
  if (i < 0) return;
  if (state.tabs.length === 1) { toast('最後のタブは閉じられません'); return; }
  state.tabs.splice(i, 1);
  if (isReviewTab(id)) {
    const fid = reviewTabFileId(id);
    if (state.reviewSessions) delete state.reviewSessions[fid];
  }
  if (tabOfRoute(state.page) === id || (state.page === 'review' && isReviewTab(id) && reviewTabFileId(id) === state.reviewId)) {
    const next = state.tabs[Math.min(i, state.tabs.length - 1)];
    const nd = next ? tabDef(next) : null;
    if (nd && isReviewTab(next)) {
      state.reviewId = nd.fileId;
      const sess = (state.reviewSessions || {})[nd.fileId] || {};
      state.reviewViewOnly = !!sess.viewOnly;
      state.reviewReturn = sess.returnPage || 'myTasks';
      state.page = 'review';
    } else {
      state.page = nd ? nd.route : 'home';
      if (state.page !== 'review') state.reviewViewOnly = false;
    }
  }
  render();
}

function renderTabbar() {
  if (!state.tabs.length) return '';
  const active = tabOfRoute(state.page);
  const items = state.tabs.map((id) => {
    const t = tabDef(id);
    if (!t) return '';
    /* レビュータブは親画面の権限に従う。通常タブはメニュー到達が必要 */
    if (!isReviewTab(id)) {
      const page = t.route || id;
      if (!canReachPage(page)) return '';
    }
    const label = t.label;
    const title = t.title || t.label;
    return `<div class="tabitem ${id === active ? 'on' : ''}${isReviewTab(id) ? ' is-review' : ''}" data-opentab="${esc(id)}" title="${esc(title)}">
      <span class="tablabel">${esc(label)}</span>
      <button class="tabclose" data-closetab="${esc(id)}" title="タブを閉じる"><span class="ico i-close"></span></button>
    </div>`;
  }).filter(Boolean);
  if (!items.length) return '';
  return `<div class="subnav tabbar">${items.join('')}</div>`;
}

/* ===================== 5-b3. ページプレビュー用モック ===================== */

/** 帳票ページのモック（実際のPDFの代わりにCSSで様式を描く）。layoutId を渡すと様式名が帳票タイプに追従する */
function mockSheet(pageNo, total, layoutId) {
  const idx = LAYOUT.findIndex((l) => l.id === layoutId);
  const code = idx >= 0 ? `第${idx + 1}号様式` : '第11号様式';
  const title = (layoutId && dispLayout(layoutId)) || '住民異動届（住居地届）';
  return `<div class="sheet" aria-label="帳票ページ ${pageNo} / ${total}">
    <div class="sheet-head">
      <span class="sheet-code">${esc(code)}</span>
      <span class="sheet-title">${esc(title)}</span>
      <span class="sheet-page">${pageNo} / ${total}</span>
    </div>
    <div class="sheet-row"><span>届出日</span><i></i><span>受付番号</span><i></i><span>住民票コード</span><i></i></div>
    <table class="sheet-table">
      <tr><th rowspan="2">氏名</th><td colspan="3"></td><th>生年月日</th><td></td></tr>
      <tr><td colspan="3"></td><th>性別</th><td></td></tr>
      <tr><th>住所</th><td colspan="5"></td></tr>
    </table>
    <div class="sheet-note">※ 黒枠内は記載しないでください。</div>
    <table class="sheet-table grid">
      <tr>${Array.from({ length: 8 }, () => '<td></td>').join('')}</tr>
      <tr>${Array.from({ length: 8 }, () => '<td></td>').join('')}</tr>
      <tr>${Array.from({ length: 8 }, () => '<td></td>').join('')}</tr>
      <tr>${Array.from({ length: 8 }, () => '<td></td>').join('')}</tr>
    </table>
  </div>`;
}

/**
 * ページプレビューの対象を解決する。
 * アップロード画面（state.uploads）とファイル一覧（FILES_DATA）の両方から開けるようにする。
 */
function previewTarget() {
  return state.uploads.find((u) => u.id === state.pvId)
    || byId(FILES_DATA, state.pvId)
    || state.uploads[0]
    || null;
}

/**
 * ページプレビュー（帳票のページ画像モーダル）を開く。
 * アップロード画面の「プレビュー」とファイル一覧の「详情」から共通で使う。
 * 確認・承認はマイタスク／確認ページの役割なので、ここでは画像を見せるだけ。
 */
function openPreview(id, page = 1) {
  state.pvId = id;
  state.pvOpen = true;
  state.pvPage = Number(page) || 1;
  state.pvZoom = 1;
  state.pvRotate = 0;
  render();
}

/** 読取結果一覧の行を再読取する（帳票タイプはそのまま、読取だけやり直す） */
function startReRead(fileId) {
  const f = byId(FILES_DATA, fileId);
  if (!f || f._proc) return;
  const startedAt = Date.now();
  f._proc = true;
  f.status = 'reading';
  f.error = '';
  /* 読取中の行は「すべて」以外のタブからは消える。再読取した行がその場で見えるよう読取中タブへ寄せる */
  if (state.page === 'result' && state.tab !== 'all') state.tab = 'reading';
  const tick = setInterval(() => {
    if (!f._proc) { clearInterval(tick); return; }
    f.history = `読取処理中（${Math.floor((Date.now() - startedAt) / 1000)}秒経過）`;
    render();
  }, 1000);
  setTimeout(() => {
    if (!f._proc) return;
    delete f._proc;
    clearInterval(tick);
    const fail = Math.random() < 0.15;              // モック：15% は読取失敗
    f.status = fail ? 'failed' : 'done';
    f.history = fail ? '帳票の処理中にエラーが発生' : '読取完了';
    f.error = fail ? '帳票の処理中にエラーが発生（ページ番号の解釈に失敗）' : '';
    f.readDoneAt = nowStamp();
    /* 再読取の結果も対応するタブへ移して見えるようにする */
    if (state.page === 'result' && state.tab !== 'all') state.tab = f.status === 'failed' ? 'failed' : 'done';
    render();
    toast(fail ? '再読取に失敗しました' : '再読取が完了しました');
  }, 4200);
  render();
  toast('再読取を開始しました（読取処理中）');
}

/**
 * 読取结果详情を開く。
 * opts.viewOnly … 一覧からの閲覧（CTA なし）
 * opts.returnPage … 戻る先（myTasks | result）
 */
function openReview(fileId, opts) {
  const o = typeof opts === 'string' ? { mode: opts } : (opts || {});
  const f = byId(FILES_DATA, fileId);
  const returnPage = o.returnPage || (o.viewOnly ? 'result' : 'myTasks');
  const viewOnly = !!o.viewOnly;
  state.reviewId = fileId;
  state.reviewViewOnly = viewOnly;
  state.reviewReturn = returnPage;
  state.reviewSessions = state.reviewSessions || {};
  state.reviewSessions[fileId] = { returnPage, viewOnly };
  state.reviewTab = 'preview';
  state.reviewReadTab = 'text';
  state.reviewOnlyErr = false;
  state.reviewApprovePane = 'diff';
  state.reviewConfirmed = state.reviewConfirmed || {};
  state.reviewBulkConfirm = false;
  state.reviewRequiredOpen = false;
  state.reviewPage = 1;
  state.reviewPages = REVIEW_DOC.pages;
  state.reviewZoom = 1;
  state.reviewRotate = 0;
  state.reviewFocusKey = null;
  state.reviewPos = true;
  state.saveHistoryOpen = false;
  /* マイタスク／一覧から開いた确认は独立タブとして前面化 */
  const tid = reviewTabId(fileId);
  if (!isTabOpen(tid)) state.tabs.push(tid);
  state.page = 'review';
  ensureSaveHistory(f);
  render();
  const fl = reviewFootFlags(f);
  toast(state.reviewViewOnly ? '详情を開きました' : fl.phase === 'approve' ? '承認タスクを開きました' : fl.phase === 'confirm' ? '確認タスクを開きました' : '详情を開きました');
}

/** 読取結果確認ページのイベント */
function bindReview() {
  const goBack = () => {
    const tid = state.reviewId ? reviewTabId(state.reviewId) : null;
    const ret = state.reviewReturn || 'myTasks';
    if (tid && isTabOpen(tid)) {
      /* タブを閉じて戻り先へ（マイタスク／一覧は残す） */
      const i = state.tabs.indexOf(tid);
      state.tabs.splice(i, 1);
      if (state.reviewSessions) delete state.reviewSessions[state.reviewId];
    }
    state.reviewViewOnly = false;
    state.page = ret;
    if (ret === 'myTasks' && !isTabOpen('myTasks')) state.tabs.push('myTasks');
    if (ret === 'result' && !isTabOpen('result')) state.tabs.push('result');
    render();
  };
  const back = $('#rvBack'); if (back) back.onclick = goBack;
  const cl = $('#rvClose'); if (cl) cl.onclick = goBack;
  const goPage = (p) => {
    state.reviewPage = Math.min(Math.max(1, p), state.reviewPages || REVIEW_DOC.pages);
    render();
  };
  const focusField = (key, fromBBox) => {
    state.reviewFocusKey = key;
    if (state.reviewPos) state.reviewPos = false; // 連動時は位置を見せる
    render();
    requestAnimationFrame(() => {
      const q = (sel) => document.querySelector(sel);
      const inp = q(`[data-ocr="${key}"]`);
      const box = q(`[data-bbox="${key}"]`);
      const row = q(`[data-field-key="${key}"]`);
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (box) box.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      if (inp && !fromBBox) { try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); } }
    });
  };
  const pv = $('#rvPrev'); if (pv) pv.onclick = () => goPage(state.reviewPage - 1);
  const nx = $('#rvNext'); if (nx) nx.onclick = () => goPage(state.reviewPage + 1);
  const pp = $('#rvPagePrev'); if (pp) pp.onclick = () => goPage(state.reviewPage - 1);
  const pn = $('#rvPageNext'); if (pn) pn.onclick = () => goPage(state.reviewPage + 1);
  const pi = $('#rvPageInput');
  if (pi) {
    pi.onchange = () => goPage(Number(pi.value.replace(/\D/g, '')) || 1);
    pi.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); goPage(Number(pi.value.replace(/\D/g, '')) || 1); } };
  }
  const zi = $('#rvZoomIn'); if (zi) zi.onclick = () => { state.reviewZoom = Math.min(1.8, Number((state.reviewZoom + 0.1).toFixed(2))); render(); };
  const zo = $('#rvZoomOut'); if (zo) zo.onclick = () => { state.reviewZoom = Math.max(0.6, Number((state.reviewZoom - 0.1).toFixed(2))); render(); };
  const ft = $('#rvFit'); if (ft) ft.onclick = () => { state.reviewZoom = 1; state.reviewRotate = 0; render(); };
  const rl = $('#rvRotL'); if (rl) rl.onclick = () => { state.reviewRotate = ((state.reviewRotate || 0) - 90 + 360) % 360; render(); };
  const rr = $('#rvRotR'); if (rr) rr.onclick = () => { state.reviewRotate = ((state.reviewRotate || 0) + 90) % 360; render(); };
  document.querySelectorAll('[data-rvtab]').forEach((b) => {
    b.onclick = () => { state.reviewTab = b.dataset.rvtab; render(); };
  });
  document.querySelectorAll('[data-rvread]').forEach((b) => {
    b.onclick = () => { state.reviewReadTab = b.dataset.rvread; render(); };
  });
  document.querySelectorAll('[data-rv-apane]').forEach((b) => {
    b.onclick = () => { state.reviewApprovePane = b.dataset.rvApane; render(); };
  });
  const oe = $('#rvOnlyErr'); if (oe) oe.onchange = () => { state.reviewOnlyErr = oe.checked; render(); };
  /* 一括確認：表示中（現在のタブ）の項目をまとめて確認済みにする */
  const bc = $('#rvBulkConfirm');
  if (bc) bc.onchange = () => {
    const id = state.reviewId;
    const f = byId(FILES_DATA, id);
    if (!f) return;
    const list = state.reviewReadTab === 'table' ? OCR_TABLES.default : OCR_FIELDS.b6;
    const map = state.reviewConfirmed[id] || (state.reviewConfirmed[id] = {});
    list.forEach((x) => { if (bc.checked) map[x.key] = true; else delete map[x.key]; });
    state.reviewBulkConfirm = bc.checked;
    render();
    if (bc.checked) toast('表示中の項目を確認済みにしました');
  };
  const pos = $('#rvPos'); if (pos) pos.onchange = () => { state.reviewPos = pos.checked; if (pos.checked) state.reviewFocusKey = null; render(); };
  document.querySelectorAll('[data-bbox]').forEach((b) => {
    b.onclick = (e) => { e.preventDefault(); focusField(b.dataset.bbox, true); };
  });
  document.querySelectorAll('[data-field-key]').forEach((row) => {
    row.onclick = () => {
      const key = row.dataset.fieldKey;
      if (state.reviewFocusKey === key && !state.reviewPos) return;
      focusField(key, false);
    };
  });
  const guide = $('#rvGuide'); if (guide) guide.onclick = () => toast('操作ガイド（Demo）');
  const dl = $('#rvDownload'); if (dl) dl.onclick = () => { state.dlMenu = state.reviewId; render(); };
  const leaveReviewToMyTasks = (fileId, myTab) => {
    /* 確認メッセージ（同意待ち）の間は遷移しない */
    if (state.reviewConfirmAsk) return;
    const tid = reviewTabId(fileId);
    if (isTabOpen(tid)) {
      state.tabs = state.tabs.filter((x) => x !== tid);
      if (state.reviewSessions) delete state.reviewSessions[fileId];
    }
    if (!isTabOpen('myTasks')) state.tabs.push('myTasks');
    state.page = 'myTasks';
    state.myTaskTab = myTab;
    state.reviewViewOnly = false;
    render();
  };
  /* 承認はワンクリック（ダイアログなし）。差戻のみ理由入力ダイアログ */
  const ap = $('#rvApprove');
  if (ap) ap.onclick = () => {
    const id = state.reviewId;
    runFlowAction(id, 'approve', '');
    const f = byId(FILES_DATA, id);
    /* 2段承認の1段目完了後はまだ承認待ち → pending。最終承認のみ done */
    leaveReviewToMyTasks(id, f && f.status === 'approved' ? 'done' : 'pending');
  };
  const rt2 = $('#rvReturn'); if (rt2) rt2.onclick = () => openFlowDialog(state.reviewId, 'return');
  const fh = $('#rvFlow'); if (fh) fh.onclick = () => toast('進捗は画面上部のバーで確認できます');
  const sv = $('#rvSave'); if (sv) sv.onclick = () => {
    const id = state.reviewId;
    const f = byId(FILES_DATA, id);
    const fl = reviewFootFlags(f);
    if (!f || !fl.canSave) return;
    ensureSaveHistory(f);
    const dirty = state.reviewDirty[id] || {};
    const fields = Object.fromEntries(OCR_FIELDS.b6.map((x) => [x.key, dirty[x.key] !== undefined ? dirty[x.key] : (x.value || '')]));
    f.saveHistory.unshift({ id: 'sh_' + Date.now(), at: formatHistoryAt(nowStamp()), user: '佐藤 美子', fields });
    const n = Object.keys(dirty).length;
    /* 保存したので、いまの値を新しい基準にする（修正済みは 0 に戻る） */
    OCR_FIELDS.b6.forEach((x) => { OCR_ORIGINAL.text[x.key] = dirty[x.key] !== undefined ? dirty[x.key] : (x.value || ''); });
    state.reviewDirty[id] = {};
    render();
    toast(n ? `修正内容を保存しました（${n} 項目）` : '保存しました');
  };
  const ex = $('#rvExport'); if (ex) ex.onclick = () => {
    const f = byId(FILES_DATA, state.reviewId);
    if (!canExportFile(f)) { toast('確認・承認が完了してから CSV を出力できます'); return; }
    runFlowAction(state.reviewId, 'export', '');
  };
  const cf = $('#rvConfirm'); if (cf) cf.onclick = () => {
    const id = state.reviewId;
    const list = state.reviewReadTab === 'table' ? OCR_TABLES.default : OCR_FIELDS.b6;
    const dirtyMap = state.reviewDirty[id] || {};
    const missing = list.filter((x) => x.required && !String(dirtyMap[x.key] !== undefined ? dirtyMap[x.key] : (x.value || '')).trim());
    if (missing.length) {
      state.reviewRequiredOpen = true;
      render();
      return;
    }
    /* 確認は取り消せないため、メッセージを出して同意を得てから確定する */
    state.reviewConfirmAsk = true;
    render();
  };
  /* 必須項目が空のときの注意ダイアログ */
  /* 確認メッセージ（同意してから確認を確定する） */
  const rvAsk = $('#rvAskBack');
  if (rvAsk) {
    const closeAsk = () => { state.reviewConfirmAsk = false; render(); };
    rvAsk.onclick = (e) => { if (e.target === rvAsk) closeAsk(); };
    const askX = $('#rvAskClose'); if (askX) askX.onclick = closeAsk;
    const askC = $('#rvAskCancel'); if (askC) askC.onclick = closeAsk;
    const askOk = $('#rvAskOk');
    if (askOk) askOk.onclick = () => {
      const id = state.reviewId;
      const list = state.reviewReadTab === 'table' ? OCR_TABLES.default : OCR_FIELDS.b6;
      const map = state.reviewConfirmed[id] || (state.reviewConfirmed[id] = {});
      list.forEach((x) => { map[x.key] = true; });
      state.reviewConfirmAsk = false;
      state.reviewConfirmAgreed = true;
      state.reviewBulkConfirm = true;
      runFlowAction(id, 'confirm', '');
      state.reviewConfirmAgreed = false;
      state.page = 'myTasks';
      state.myTaskTab = 'pending';
      render();
    };
  }
const rqBack = $('#rvReqBack');
  if (rqBack) {
    const closeReq = () => { state.reviewRequiredOpen = false; render(); };
    rqBack.onclick = (e) => { if (e.target === rqBack) closeReq(); };
    const x = $('#rvReqClose'); if (x) x.onclick = closeReq;
    const cancel = $('#rvReqCancel'); if (cancel) cancel.onclick = closeReq;
    const showErr = $('#rvReqShowErr');
    if (showErr) showErr.onclick = () => {
      state.reviewRequiredOpen = false;
      state.reviewOnlyErr = true;
      render();
      toast('必須項目を確認してください');
    };
  }
  /* ダウンロードメニュー（確認画面でも一覧と同じ 4 形式。クリック処理は既存の [data-dl] 側で行う） */
  const dlb = $('#dlPopBack');
  if (dlb) dlb.onclick = (e) => { if (e.target === dlb) { state.dlMenu = null; render(); } };
  const dlc = $('#dlPopCancel'); if (dlc) dlc.onclick = () => { state.dlMenu = null; render(); };
  document.querySelectorAll('[data-ocr]').forEach((inp) => {
    if (inp.disabled || inp.readOnly) return;
    inp.oninput = () => {
      const id = state.reviewId;
      const key = inp.dataset.ocr;
      const original = (state.reviewReadTab === 'table' ? OCR_ORIGINAL.table : OCR_ORIGINAL.text)[key];
      state.reviewDirty[id] = state.reviewDirty[id] || {};
      /* 元の値に戻したら「修正済み」から外す */
      if (inp.value === original) delete state.reviewDirty[id][key];
      else state.reviewDirty[id][key] = inp.value;
      /* 編集した項目は確認待ちに戻す（製品 same） */
      const map = state.reviewConfirmed[id];
      if (map && map[key]) delete map[key];
      inp.classList.toggle('edited', inp.value !== original);
      const row = inp.closest('.rv-field-row');
      if (row) {
        row.classList.remove('is-confirmed', 'is-corrected');
        if (inp.value !== original) row.classList.add('is-corrected');
        const holder = row.querySelector('.rv-field-state-row');
        if (holder) {
          holder.innerHTML = inp.value !== original
            ? '<span class="rv-field-state mod">修正済み</span>'
            : '';
        }
      }
      /* 状態が変わったのでカウンタの数字だけ差し替える（入力フォーカスは保つ） */
      const bolds = document.querySelectorAll('.rv-stat-groups b');
      const list = state.reviewReadTab === 'table' ? OCR_TABLES.default : OCR_FIELDS.b6;
      const confirmedCount = list.filter((x) => (state.reviewConfirmed[id] || {})[x.key]).length;
      const dirtyCount = Object.keys(state.reviewDirty[id]).length;
      const values = [list.length - confirmedCount, confirmedCount, list.length, dirtyCount];
      bolds.forEach((el, i) => {
        if (i < 4) el.textContent = ': ' + values[i];
      });
    };
  });
  bindSaveHistoryDialog();
}

function bindSaveHistoryDialog() {
  if (!state.saveHistoryOpen) return;
  const back = $('#saveHistBack');
  const close = () => { state.saveHistoryOpen = false; render(); };
  if (back) back.onclick = (e) => { if (e.target === back) close(); };
  const x = $('#saveHistClose'); if (x) x.onclick = close;
  document.querySelectorAll('[data-sh-show]').forEach((b) => {
    b.onclick = () => {
      const f = byId(FILES_DATA, state.reviewId);
      if (!f || !f.saveHistory) return;
      const rec = f.saveHistory.find((h) => h.id === b.dataset.shShow);
      if (!rec) return;
      state.reviewDirty[f.id] = Object.assign({}, rec.fields);
      toast('履歴を編集内容に反映しました。保存するまで、これらの変更は適用されません。');
      state.saveHistoryOpen = false;
      render();
    };
  });
  document.querySelectorAll('[data-sh-dl]').forEach((b) => {
    b.onclick = () => {
      const f = byId(FILES_DATA, state.reviewId);
      if (!f || !f.saveHistory) return;
      const rec = f.saveHistory.find((h) => h.id === b.dataset.shDl);
      if (!rec) return;
      const rows = [['項目', '値']].concat(OCR_FIELDS.b6.map((x) => [x.label, rec.fields[x.key] || '']));
      const text = rows.map((r) => r.join(',')).join('\r\n');
      const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${dispFileName(f.id).replace(/\.[^.]+$/, '')}_履歴_${rec.at.replace(/[.\s:]/g, '')}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      toast('履歴をダウンロードしました');
    };
  });
}

function renderSaveHistoryDialog() {
  if (!state.saveHistoryOpen) return '';
  const f = byId(FILES_DATA, state.reviewId);
  if (!f) return '';
  ensureSaveHistory(f);
  const rows = (f.saveHistory || []).map((h) => `
    <div class="savehist-row">
      <div class="savehist-meta">
        <div class="savehist-at">${esc(h.at)}</div>
        <div class="savehist-user">操作：${esc(h.user)}</div>
      </div>
      <div class="savehist-acts">
        <button class="btn" data-sh-show="${esc(h.id)}"><span class="ico i-refresh"></span>表示</button>
        <button class="btn savehist-dl" data-sh-dl="${esc(h.id)}"><span class="ico i-download"></span>ダウンロード</button>
      </div>
    </div>`).join('');
  return `
  <div class="modal-back" id="saveHistBack">
    <div class="modal savehist-modal">
      <div class="modal-head"><b>履歴</b><span class="spacer"></span><button class="icon-btn" id="saveHistClose"><span class="ico i-close"></span></button></div>
      <div class="savehist-body">${rows || '<p class="muted">まだ保存履歴はありません。</p>'}</div>
      <div class="savehist-foot">すべての履歴を読み込みました</div>
    </div>
  </div>`;
}

/** 行ダウンロードの形式（製品のポップアップに合わせる）。表示順もこの配列の順 */
const DL_FORMATS = [
  ['csv', 'CSVをダウンロード'],
  ['json', 'JSONをダウンロード'],
];

/** 読取結果を指定形式でダウンロードする（モック。実ファイルは生成せずテキストを保存） */
function downloadResultFile(id, fmt) {
  if (!['csv', 'excel', 'json', 'pdf'].includes(fmt)) return;
  const rows = [['項目', '値']].concat(OCR_FIELDS.b6.map((x) => [x.label, (state.reviewDirty[id] || {})[x.key] || x.value || '']));
  const text = fmt === 'json'
    ? JSON.stringify({ document_id: id, file_name: dispFileName(id), fields: rows.slice(1).map(([k, v]) => ({ label: k, value: v })) }, null, 2)
    : rows.map((r) => r.join(',')).join('\r\n');
  const _enc = (state.exportCfg && state.exportCfg.encoding) || 'UTF-8（BOMあり）';
  const _bom = _enc.indexOf('BOMなし') >= 0 ? '' : '\ufeff';
  const blob = new Blob([_bom + text], { type: (fmt === 'json' ? 'application/json' : 'text/csv') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const ext = fmt === 'excel' ? 'csv' : (fmt === 'pdf' ? 'txt' : fmt);
  a.download = `${dispFileName(id).replace(/\.[^.]+$/, '')}.${ext}`;
  document.body.appendChild(a); a.click(); a.remove();
  toast(`${fmt === 'excel' ? 'Excel' : fmt.toUpperCase()} をダウンロードしました（モック）`);
}

/* ── 行ダウンロードの hover メニュー ──────────────────────────────
   表のスクロール領域で切れないよう position:fixed で body 直下に出す（data-tip と同じ考え方）。 */
let dlMenuEl = null, dlMenuTimer = null, dlMenuBound = false;

function closeDlMenu() {
  clearTimeout(dlMenuTimer); dlMenuTimer = null;
  document.querySelectorAll('.dl-menu').forEach((m) => m.remove());
  dlMenuEl = null;
}
/** アイコン→メニューの隙間で閉じないよう、少し遅らせて閉じる */
function closeDlMenuSoon() { clearTimeout(dlMenuTimer); dlMenuTimer = setTimeout(closeDlMenu, 140); }

function openDlMenu(anchor) {
  closeDlMenu();
  const id = anchor.dataset.dlmenu;
  const box = document.createElement('div');
  box.className = 'dl-menu';
  box.setAttribute('role', 'menu');
  box.innerHTML = DL_FORMATS.map(([fmt, label]) => `<button type="button" role="menuitem" data-dl-fmt="${fmt}">${label}</button>`).join('');
  document.body.appendChild(box);
  const r = anchor.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  let left = r.left + r.width / 2 - b.width / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - b.width - 6));
  let top = r.bottom + 6;
  if (top + b.height > window.innerHeight - 6) top = Math.max(6, r.top - b.height - 6);
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(top)}px`;
  box.onmouseenter = () => { clearTimeout(dlMenuTimer); };
  box.onmouseleave = closeDlMenuSoon;
  box.querySelectorAll('[data-dl-fmt]').forEach((b2) => {
    b2.onclick = (e) => { e.stopPropagation(); const fmt = b2.dataset.dlFmt; closeDlMenu(); downloadResultFile(id, fmt); };
  });
  dlMenuEl = box;
}

/** ダウンロードアイコン（data-dlmenu）に hover メニューを付ける */
function bindDlMenus(scope) {
  if (!dlMenuBound) {
    dlMenuBound = true;
    document.addEventListener('scroll', closeDlMenu, true);   // 表をスクロールしたら fixed 位置がずれるので閉じる
    window.addEventListener('resize', closeDlMenu);
  }
  (scope || document).querySelectorAll('[data-dlmenu]').forEach((el) => {
    el.onmouseenter = () => { clearTimeout(dlMenuTimer); openDlMenu(el); };
    el.onmouseleave = closeDlMenuSoon;
    /* タッチ／キーボード用：クリックでもトグルできる */
    el.onclick = (e) => { e.stopPropagation(); if (dlMenuEl) closeDlMenu(); else openDlMenu(el); };
  });
}

/** ダウンロード形式の選択（テーブルのスクロール領域で切れないよう固定表示） */
function renderDlMenu() {
  if (!state.dlMenu) return '';
  const f = byId(FILES_DATA, state.dlMenu);
  if (!f) return '';
  return `
  <div class="dl-pop-back" id="dlPopBack">
    <div class="dl-pop">
      <div class="dl-pop-head">${esc(dispFileName(f.id))}</div>
      <button data-dl="csv" data-file="${f.id}">CSVをダウンロード</button>
      <button data-dl="json" data-file="${f.id}">JSONをダウンロード</button>
      <button data-dl="pdf" data-file="${f.id}">PDFをダウンロード</button>
      <button class="dl-pop-cancel" id="dlPopCancel">キャンセル</button>
    </div>
  </div>`;
}

/** 差戻ダイアログのみ（承認はワンクリック。差戻理由は必須） */
function openFlowDialog(fileId, action) {
  if (action === 'approve') {
    runFlowAction(fileId, 'approve', '');
    return;
  }
  state.flowDialog = { fileId, action, comment: '' };
  render();
}

/** 確認画面：必須項目が空のまま確認しようとしたときの注意ダイアログ */
function renderReviewConfirmAskDialog() {
  if (!state.reviewConfirmAsk) return '';
  return `
  <div class="modal-back" id="rvAskBack">
    <div class="modal" style="width:min(520px,100%)">
      <div class="modal-head"><b>ご確認ください</b><span class="spacer"></span><button class="icon-btn" id="rvAskClose"><span class="ico i-close"></span></button></div>
      <div class="modal-canvas" style="background:#fff;display:block;padding:16px 18px">
        <p style="margin:0;font-size:13px;line-height:1.7;color:var(--text)">確認をした場合は以後の修正ができなくなります。確認前に更新したい場合は保存を選択してください。</p>
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="btn" id="rvAskCancel">キャンセル</button>
        <button class="btn primary" id="rvAskOk">確認する</button>
      </div>
    </div>
  </div>`;
}
function renderReviewRequiredDialog() {
  if (!state.reviewRequiredOpen) return '';
  const list = state.reviewReadTab === 'table' ? OCR_TABLES.default : OCR_FIELDS.b6;
  const dirty = state.reviewDirty[state.reviewId] || {};
  const missing = list.filter((x) => x.required && !String(dirty[x.key] !== undefined ? dirty[x.key] : (x.value || '')).trim());
  return `
  <div class="modal-back" id="rvReqBack">
    <div class="modal" style="width:min(520px,100%)">
      <div class="modal-head"><b>ご注意</b><span class="spacer"></span><button class="icon-btn" id="rvReqClose"><span class="ico i-close"></span></button></div>
      <div class="modal-canvas" style="background:#fff;display:block;padding:16px 18px">
        <p style="margin:0 0 8px;font-size:13px;color:var(--text)">必須項目を確認してください</p>
        <ul class="rv-req-list">${missing.map((x) => `<li>・${esc(x.label)}</li>`).join('')}</ul>
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="btn" id="rvReqCancel">キャンセル</button>
        <button class="btn primary" id="rvReqShowErr">エラー箇所を表示</button>
      </div>
    </div>
  </div>`;
}

function renderFlowDialog() {
  const d = state.flowDialog;
  if (!d) return '';
  const f = byId(FILES_DATA, d.fileId);
  if (!f) return '';
  const { stages } = flowOf(f);
  const c = catOf(f.layout) || {};
  const canSubmit = String(d.comment || '').trim().length > 0;
  const hrows = historyRowsOf(f); const history = hrows.length ? `<table class="flowhist"><thead><tr><th>操作</th><th>実行者</th><th>日時</th><th>コメント</th></tr></thead><tbody>${
      hrows.map((h) => `<tr class="${h.voided ? 'is-voided' : ''}"><td>${esc(h.action)}${h.voided ? ' <span class="muted">（無効）</span>' : ''}</td><td>${esc(h.user)}</td><td>${esc(h.at)}</td><td>${esc(h.comment || '—')}</td></tr>`).join('')
    }</tbody></table>`
    : '<p class="muted">まだ処理履歴はありません。</p>';
  return `
  <div class="modal-back" id="flowBack">
    <div class="modal flow-return-modal" style="width:min(560px,100%)">
      <div class="modal-head"><b>差戻（確認者へ）</b><span class="spacer"></span><button class="icon-btn" id="flowClose"><span class="ico i-close"></span></button></div>
      <div class="modal-meta">
        <span>ファイル：${esc(f.name)}</span>
        <span>帳票タイプ：${esc(dispLayout(f.layout))}</span>
        <span>${esc(STATUS[f.status].label)}</span>
      </div>
      <div class="modal-canvas" style="background:#fff;display:block;padding:16px">
        <h4 class="flowhist-title" style="margin-top:0">進捗（差戻後）</h4>
        ${flowStepsHtml(f, { detail: false, compact: true })}
        <p class="flowdesc">承認${stages === 2 ? '（2段）' : ''}から<strong>確認者へ直接差し戻し</strong>ます。確認者が再確認したあと、承認は最初からやり直しになります。</p>
        <label class="fldlabel"><i class="req">*</i>差戻理由</label>
        <textarea class="fld w100" id="flowComment" rows="4" placeholder="差戻理由を入力してください（必須）" required>${esc(d.comment)}</textarea>
        ${canSubmit ? '' : '<p class="flow-req-hint">理由を入力すると差戻できます</p>'}
        <h4 class="flowhist-title">処理履歴</h4>
        ${history}
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="btn" id="flowCancel">キャンセル</button>
        <button class="btn danger" id="flowOk" ${canSubmit ? '' : 'disabled'}>差戻す</button>
      </div>
    </div>
  </div>`;
}

/** エクスポート設定（客户回答：横向／竖向／結合、列名・列順・エンコード・空値、最大1万件） */
/**
 * エクスポート設定ダイアログ。
 * 出力方式（ラジオカード）／CSV オプション（2 カラムのラベル付きフィールド）／プレビュー
 * （ファイル名はその場で編集可）／フッター（キャンセル・保存）という構成。
 * 保存は localStorage に永続化して閉じる。キャンセル（×・背景クリック含む）は開いた時点に戻す。
 *
 * 以前ここに置いていた注記（列名・列順は帳票タイプごとに設定／出力対象＝絞り込み結果／
 * 結合出力は最大 10000 件）は画面から外し、設計文書の §4 注記に移した。
 */
const EXPORT_CFG_KEY = 'demo-export-cfg-v1';

function loadExportCfg() {
  try {
    const raw = localStorage.getItem(EXPORT_CFG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}
function saveExportCfg() {
  try { localStorage.setItem(EXPORT_CFG_KEY, JSON.stringify(state.exportCfg)); } catch (_) { /* ignore */ }
}

/**
 * エクスポート結果のプレビュー（現在の設定に追随するモック）。
 * 帳票タイプの抽出項目（ensureTypeFields）を列、現在の絞り込み結果を行として先頭 N 行を表示。
 */
/**
 * エクスポート内容のプレビュー。
 * 製品の出力は「項目名／項目値」を 1 行ずつ並べる形式（帳票 1 件ごとに
 * 項目名／項目値のヘッダー行で区切る）。出力方式によって形を変える：
 *   vertical  ：項目名／項目値（1 項目 1 行）＋帳票ごとの見出し行
 *   horizontal：1 帳票 1 行の横持ち（列＝抽出項目）
 *   combine   ：一般項目＋表格項目を Left Join（1 人 1 行）
 */
/**
 * 出力ファイル名。ファイルツリー（読取結果一覧）の名前をそのまま使う。
 *  - 1 件のみ：その帳票名（拡張子は .csv に差し替え）
 *  - 結合出力：先頭の帳票名＋「_結合」＋件数
 *  - 複数帳票：先頭の帳票名＋「_ほか N 件」
 */
function exportFileName() {
  /* 設定で名前が指定されていればそれを優先（帳票タイプ設定のファイル名欄） */
  const custom = (state.exportCfg && state.exportCfg.fileName) ? String(state.exportCfg.fileName).trim() : '';
  if (custom) return custom.replace(/\.[A-Za-z0-9]+$/, '');
  const files = visibleFiles();
  if (!files.length) return '出力データ';
  /* ファイルツリーの名前から拡張子だけ落として .csv にする */
  const base = (name) => String(name || '').replace(/\.[A-Za-z0-9]+$/, '');
  return base(files[0].name);
}

function renderExportDialog() {
  if (!state.exportOpen) return '';
  const C = state.exportCfg;
  const radio = (name, value, label, desc) => `
    <label class="exp-radio${C[name] === value ? ' on' : ''}">
      <input type="radio" name="${name}" value="${value}" ${C[name] === value ? 'checked' : ''} data-expcfg="${name}" />
      <span class="exp-radio-body"><b>${esc(label)}</b><span class="exp-radio-desc">${esc(desc)}</span></span>
    </label>`;
  const field = (label, control, wide) => `
    <label class="exp-field${wide ? ' is-wide' : ''}"><span class="exp-field-label">${esc(label)}</span>${control}</label>`;
  const select = (key, options) => `<select class="fld exp-control" data-expcfg="${key}">${options.map((o) => `<option ${C[key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;

  return `
  <div class="modal-back" id="expBack">
    <div class="modal exp-modal" style="width:min(820px,100%)">
      <div class="modal-head"><b>エクスポート設定</b><span class="spacer"></span><button class="icon-btn" id="expClose"><span class="ico i-close"></span></button></div>
      <div class="modal-canvas exp-canvas">
        

        <section class="exp-block">
        
        
        <div class="exp-fields">
          <label class="exp-field"><span class="exp-field-label"><i class="req">*</i>文字エンコード（CSV・JSON）</span>
            <select class="fld exp-control" data-expcfg="encoding">
              <option ${C.encoding === 'UTF-8（BOMあり）' ? 'selected' : ''}>UTF-8（BOMあり）</option>
              <option ${C.encoding === 'UTF-8（BOMなし）' ? 'selected' : ''}>UTF-8（BOMなし）</option>
              <option ${C.encoding === 'Shift_JIS（S-JIS）' ? 'selected' : ''}>Shift_JIS（S-JIS）</option>
            </select>
          </label>
        </div>
        <div class="exp-checks">
          <label class="exp-check"><input type="checkbox" data-expcfg="combineFiles" ${C.combineFiles ? 'checked' : ''} /><span>複数ファイルを1ファイルにまとめる</span></label>
          <label class="exp-check"><input type="checkbox" data-expcfg="requiredOnly" ${C.requiredOnly ? 'checked' : ''} /><span>必須項目のみ出力</span></label>
          <label class="exp-check"><input type="checkbox" data-expcfg="fileNameFromInput" ${C.fileNameFromInput !== false ? 'checked' : ''} /><span>入力ファイル名を出力ファイル名にする</span></label>
          ${C.fileNameFromInput === false ? `<label class="exp-field is-wide exp-filefield"><span class="exp-field-label"><i class="req">*</i>ファイル名</span><span class="exp-filename"><input class="fld exp-name-input" id="expFileName" type="text" value="${esc((C && C.fileName) || '')}" placeholder="ファイル名を入力してください" aria-label="ファイル名" /><span class="exp-file-ext">.csv</span></span></label>` : ''}
        </div>
      </section>
      </div>
      <div class="modal-foot exp-foot">
        <span class="spacer"></span>
        <button class="btn" id="expCancel">キャンセル</button>
        <button class="btn primary" id="expSave"><span class="ico i-save"></span>保存</button>
      </div>
    </div>
  </div>`;
}

/** ページプレビューのモーダル。帳票のページ画像だけを見せる（操作ボタンのバーは置かない） */
function renderPreviewModal() {
  if (!state.pvOpen) return '';
  const u = previewTarget();
  const total = Math.max(1, Number(u && u.pages) || 1);
  const pn = Math.min(Math.max(1, state.pvPage), total);
  /* 閉じる＝右上の × か背景クリック。複数ページのときだけ左右のオーバーレイ矢印でページ送り */
  const nav = (dir) => `<button type="button" class="pv-nav ${dir}" id="pv${dir === 'prev' ? 'Prev' : 'Next'}"
      title="${dir === 'prev' ? '前のページ' : '次のページ'}" aria-label="${dir === 'prev' ? '前のページ' : '次のページ'}"
      ${dir === 'prev' ? (pn <= 1 ? 'disabled' : '') : (pn >= total ? 'disabled' : '')}><span aria-hidden="true">${dir === 'prev' ? '‹' : '›'}</span></button>`;
  return `
  <div class="pv-back" id="pvBack" role="dialog" aria-label="ページプレビュー">
    <button type="button" class="pv-close" id="pvClose" title="閉じる" aria-label="閉じる"><span class="ico i-close" aria-hidden="true"></span></button>
    ${total > 1 ? nav('prev') : ''}
    <div class="pv-stage">
      <div class="sheet-zoom" style="transform:scale(${state.pvZoom}) rotate(${state.pvRotate}deg)">${mockSheet(pn, total, u && u.layout)}</div>
      </div>
    ${total > 1 ? nav('next') : ''}
  </div>`;
}

/* ===================== 5-b4. 帳票設定／利用設定の各一覧 ===================== */

const cfgState = { ticketQ: '', sceneQ: '', userQ: '', pickQ: '', userGroup: '' };

function cfgHeader(title, actions) {
  return `<div class="cfg-head">
    <h1 class="cfg-title">${esc(title)}</h1>
    <span class="spacer"></span>
    ${actions || ''}
  </div>`;
}

function cfgSearch(id, placeholder, value) {
  return `<div class="cfg-search"><input class="fld" id="${id}" placeholder="${esc(placeholder)}" value="${esc(value)}" /><span class="mag ico i-view"></span></div>`;
}

/** 互換：旧テーブル一覧は左リスト＋右 Step1 に統合済み */
function renderTicketTypes() {
  return renderTicketDetail();
}


/** 外部API連携（客户回答：外部システムから API 呼び出し／Webhook／ハッシュで二重取込防止） */
/* ── アクセス設定（外部API）: 通知先URL / APIキー管理 / API URL ── */
const ACCESS_TABS = [
  { id: 'notify', label: '通知先URL' },
  { id: 'keys', label: 'APIキー管理' },
  { id: 'url', label: 'API URL' },
];

const ACCESS_STATE = {
  tab: 'notify',              // notify | keys | url（既定は通知先URL）
  notifyEditing: false,
  notifyDraft: '',
  notifyUrl: '',
  signKey: '',
};

/** SK- + 32桁の16進（署名鍵・APIキー共通のダミー形式） */
function randomHexKey() {
  let out = '';
  for (let i = 0; i < 32; i += 1) out += '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
  return 'SK-' + out;
}

const API_KEY_STATUS = { '7日間': 7, '1年': 365, '3年': 1095 };
function shiftStamp(base, days) {
  const d = new Date(String(base).replace(/-/g, '/'));
  d.setDate(d.getDate() + days);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function endOfDay(stamp) {
  return String(stamp).slice(0, 10) + ' 23:59:59';
}

let ACCESS_KEYS = [
  { id: 'ak1', name: 'tz', key: 'SK-D434F02F394A44E78C7B5F7186A07E28', created: '2026-08-20 10:33:14', from: '2026-08-20 00:00:00', to: '2029-08-20 23:59:59', status: '有効', owner: 'test202604010001' },
  { id: 'ak2', name: 'test', key: 'SK-CBEA34FA5CC94D83B253815B52AF51D9', created: '2026-05-08 09:41:44', from: '2026-05-08 00:00:00', to: '2029-05-08 23:59:59', status: '有効', owner: 'test202604010001' },
  { id: 'ak3', name: '112', key: 'SK-5C93E0E432D4D3FADB9A23DF7A93419', created: '2026-04-21 11:29:09', from: '2026-04-21 00:00:00', to: '2026-04-28 23:59:59', status: '有効', owner: 'test202604010001' },
];
let ACCESS_KEY_EDIT = null;   // { mode: 'add' | 'edit', id?, name, term }

/** 外部API：公開エンドポイント一覧（URL はデモ用のダミー） */
const API_BASE = 'https://llmocr.example.jp/api-admin/ai/open/v1';
const API_MODULES = [
  { id: 'upload', name: 'ファイルアップロード', method: 'POST', path: '/files/upload', desc: 'PDF／画像をアップロードし、document_id を発行します。' },
  { id: 'recognize', name: '帳票読取', method: 'POST', path: '/recognize', desc: 'アップロード済み文書の読取を開始します（fileNo 指定）。' },
  { id: 'task-one', name: '帳票読取結果照会', method: 'GET', path: '/task/single/{fileNo}', desc: '1 件の読取結果（項目・値・ステータス）を照会します。' },
  { id: 'task-batch', name: 'タスク読取結果照会', method: 'GET', path: '/task/batch/{batchNo}', desc: 'バッチ単位で読取結果をまとめて照会します。' },
  { id: 'classify-batch', name: '分類結果照会', method: 'GET', path: '/classify/batch/{batchNo}', desc: 'バッチ単位で分類結果（帳票タイプ判定）を照会します。' },
];

/** アクセス設定：通知先URLタブ（既定は閲覧のみ。「編集」で編集モードに入る） */
function renderAccessNotifyTab() {
  const S = ACCESS_STATE;
  const editing = !!S.notifyEditing;
  const v = editing ? S.notifyDraft : S.notifyUrl;
  const actions = editing
    ? '<button class="btn teal" id="accNotifySave">保存</button>'
    : '<button class="btn teal" id="accNotifyEdit">編集</button>';
  return `
  <section class="access-card">
    <div class="access-card-head">
      <h2 class="access-card-title">外部通知設定</h2>
      ${actions}
    </div>
    <label class="access-field">
      <span class="access-label">通知先URL</span>
      <input class="fld access-readonly" id="accNotifyUrl" value="${esc(v)}" ${editing ? '' : 'readonly'} placeholder="通知先URLを入力してください" />
    </label>
    <label class="access-field">
      <span class="access-label">署名鍵</span>
      <span class="access-inline">
        <input class="fld access-readonly" id="accSignKey" value="${esc(S.signKey)}" readonly placeholder="生成ボタンをクリックしてください" />
        ${editing ? '<button class="btn teal" id="accSignGen">生成</button>' : ''}
      </span>
    </label>
  </section>`;
}

function renderAccessKeysTab() {
  const rows = ACCESS_KEYS.map((k, i) => `
    <tr>
      <td style="color:var(--text-2)">${i + 1}</td>
      <td>${esc(k.name)}</td>
      <td><code class="access-key">${esc(k.key)}</code></td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(k.created)}</td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(k.from)}</td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(k.to)}</td>
      <td><span class="st ${k.status === '有効' ? 'ok' : 'wait'}"><span class="dot"></span>${esc(k.status)}</span></td>
      <td style="color:var(--text-2)">${esc(k.owner)}</td>
      <td class="access-ops"><div class="acts">
        <button class="act-text" data-acckey="edit" data-id="${esc(k.id)}"><span class="ico i-edit"></span>編集</button>
        <button class="act-text danger" data-acckey="del" data-id="${esc(k.id)}"><span class="ico i-delete"></span>削除</button>
      </div></td>
    </tr>`).join('');
  return `
  <section class="access-card">
    <div class="access-card-head">
      <h2 class="access-card-title">APIキー</h2>
      <button class="btn teal" id="accKeyAdd">新規追加</button>
    </div>
    <div class="tablewrap">
      <table class="access-table">
        <thead><tr>
          <th style="width:56px">No.</th><th style="width:140px">API名</th><th style="width:300px">APIキー</th>
          <th style="width:170px">作成日時</th><th style="width:170px">開始日</th><th style="width:170px">終了日</th>
          <th style="width:90px">ステータス</th><th style="width:180px">作成者</th>
          <th style="width:170px">操作・処理</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="9" class="empty-cell">データなし</td></tr>'}</tbody>
      </table>
    </div>
  </section>`;
}

/** アクセス設定：API URLタブ */
function renderAccessUrlTab() {
  const modules = API_MODULES.map((m) => {
    const url = API_BASE + m.path;
    return `
    <section class="api-module">
      <h4 class="api-module-name">${esc(m.name)}</h4>
      <div class="api-url-row">
        <span class="k">API URL</span>
        <code class="api-url">${esc(url)}</code>
        <button type="button" class="icon-btn api-copy" data-copy="${esc(url)}" title="URLをコピー" aria-label="URLをコピー"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="5.2" y="5.2" width="8.3" height="8.3" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.8 3.4V3.1a1.4 1.4 0 0 0-1.4-1.4H3.6a1.4 1.4 0 0 0-1.4 1.4v5.8a1.4 1.4 0 0 0 1.4 1.4h.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
      </div>
    </section>`;
  }).join('');
  return `<div class="api-modules">${modules}</div>`;
}

/** ユーザー追加／編集ダイアログ（製品の「ユーザー追加」に合わせる） */

/* ══ 一覧の「操作・処理履歴」を操作記録に正規化（serve.py 注入） ══
   状態そのもの（読取完了／出力済み／読取中…）は履歴ではないので空にし、
   確認・承認・出力などの実行者が分かる記録だけを残す。 */
(function normalizeFileHistory() {
  var STATUS_TEXT = /^(読取完了|読取中|読取待ち|確認中|確認済み|承認済み|出力済み|分類中|差戻中|読取失敗|—|-)$/;
  var PROGRESS_TEXT = /(処理中|作業中|より差戻|ページ）$)/;
  FILES_DATA.forEach(function (f) {
    var h = String(f.history || '').trim();
    if (!h || h === '—') { f.history = ''; return; }
    if (STATUS_TEXT.test(h) || PROGRESS_TEXT.test(h)) {
      /* 操作記録があればそれを使い、無ければ空欄（＝まだ操作されていない） */
      var recs = (f.flow || []).filter(function (x) { return !x.voided; });
      f.history = recs.length ? recordText(recs[recs.length - 1]) : '';
      return;
    }
    if (/^[^:：]*(担当者|実行者)[:：]/.test(h)) return;   /* すでに操作記録 */
    f.history = h;                                        /* 失敗・差戻などの事象は残す */
  });
  /* 操作記録の文言：確認担当者: ○○ ／ 承認1担当者: ○○ ／ 出力担当者: ○○（CSV） */
  function recordText(r) {
    var who = r.user || '';
    var act = String(r.action || '');
    if (!act) return who ? '実行者: ' + who : '';
    if (act.indexOf('差戻') === 0) return '差戻: 確認者へ' + (r.comment ? '（' + r.comment + '）' : '');
    if (act === '出力' || act === 'CSV出力') return '出力担当者: ' + who + '（CSV）';
    if (act === '確認') return '確認担当者: ' + who;
    return act + '担当者: ' + who;                        /* 承認1 / 承認2 … */
  }
  window.__recordText = recordText;
})();
/* ══ 承認廃止に伴い、モックのステータスを新体系（6 種）へ寄せる ══ */
(function remapApprovalStatuses() {
  var REMAP = { classifying: 'waiting', checking: 'reading', approved: 'confirmed', returned: 'done' };
  FILES_DATA.forEach(function (f) { if (REMAP[f.status]) f.status = REMAP[f.status]; });
})();


/* グループ＝権限のバケツ（serve.py 注入）：読取／確認／承認／管理者 */
var GROUP_OPS = {
  gu: ['view', 'upload'],
  gc: ['view', 'fix', 'confirm'],
  ga: ['view', 'approve'],
  gm: ['view', 'upload', 'fix', 'confirm', 'approve', 'export', 'settings']
};
(function applyGroupModel() {
  var list = (typeof GROUPS !== 'undefined' && GROUPS) || null;
  if (!list) return;
  var upload = ['閲覧', 'アップロード'];
  var confirm = ['閲覧', '確認'];
  var approve = ['閲覧', '確認', '承認'];
  var all = ['閲覧', 'アップロード', '確認', '承認', '出力'];
  var bucket = [
    { id: 'gu', name: '読取グループ', kind: upload.join('、'), roles: upload.slice(), desc: '閲覧・アップロードを担当', userIds: ['u2', 'u6', 'u7'] },
    { id: 'gc', name: '確認グループ', kind: confirm.join('、'), roles: confirm.slice(), desc: '確認と OCR 結果の修正', userIds: ['u1', 'u3', 'u5', 'u8'] },
    { id: 'ga', name: '承認グループ', kind: approve.join('、'), roles: approve.slice(), desc: '承認（1 段目・2 段目）', userIds: ['u4', 'u5'] },
    { id: 'gm', name: '管理者グループ', kind: all.join('、'), roles: all.slice(), desc: 'すべての権限', userIds: ['u1', 'u9'] }
  ];
  list.length = 0;
  bucket.forEach(function (g) { list.push(g); });
  /* アップロード権限もバケツ ID で持つ（業務区分ごとの担当） */
  var up = (typeof UPLOAD_PERMS !== 'undefined' && UPLOAD_PERMS) || null;
  if (up) {
    up.b1 = ['gu'];
    up.b2 = ['gu'];
    up.b3 = ['gu'];
    up.b4 = ['gu'];
    up.b5 = ['gu'];
    up.b6 = ['gu'];
  }
  /* 帳票タイプ × 閲覧 の対象を「グループ」で定義（閲覧できない帳票は一覧に出ない） */
  var perms = (typeof TICKET_PERMS !== 'undefined' && TICKET_PERMS) || null;
  var layoutIds = (typeof LAYOUT !== 'undefined' && LAYOUT) ? LAYOUT.map(function (l) { return l.id; }) : [];
  var assign = {
    gc: ['l1', 'l2', 'l3', 'l7', 'l8', 'l9', 'l10', 'l11'],
    ga: ['l1', 'l4', 'l5', 'l6', 'l10', 'l12'],
    gu: ['l1', 'l4', 'l7']
  };
  if (perms) {
    var seen = {};
    Object.keys(assign).forEach(function (gid) {
      assign[gid].forEach(function (lid) {
        if (!perms[lid]) perms[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
        perms[lid].view = [gid];
        seen[lid] = true;
      });
    });
    /* どのグループにも割り当てられていない帳票タイプは管理者のみ閲覧可 */
    layoutIds.forEach(function (lid) {
      if (seen[lid]) return;
      if (!perms[lid]) perms[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
      if (!perms[lid].view || !perms[lid].view.length) perms[lid].view = ['gm'];
    });
  }
  /* グループから操作権限を導出（複数所属は和集合） */
  /* ── 帳票タイプ単位の工作流（工程の並びと承認段数） ── */
  var WF_SEQ = ['アップロード', '読取', '確認', '承認', '出力'];
  var resolveLayoutId = function (idOrType) {
    if (!idOrType) return null;
    var direct = (LAYOUT || []).filter(function (l) { return l.id === idOrType; })[0];
    if (direct) return direct.id;
    if (typeof layoutIdOfTicketType === 'function') {
      var t = (typeof TICKET_TYPES !== 'undefined' ? TICKET_TYPES : []).filter(function (x) { return x.id === idOrType; })[0];
      return layoutIdOfTicketType(t) || null;
    }
    return null;
  };
  window.catStagesOf = function (layoutId) {
    layoutId = resolveLayoutId(layoutId);
    var lay = (LAYOUT || []).filter(function (l) { return l.id === layoutId; })[0];
    if (!lay) return null;
    var cat = (CATEGORY || []).filter(function (c) { return c.id === lay.category; })[0];
    if (!cat) return null;
    var cfg = APPROVAL_CONFIG[cat.id] || {};
    return (cfg.stages === undefined || cfg.stages === null) ? null : Math.max(0, Number(cfg.stages) || 0);
  };
  window.setCatStages = function (layoutId, n) {
    layoutId = resolveLayoutId(layoutId);
    var lay = (LAYOUT || []).filter(function (l) { return l.id === layoutId; })[0];
    if (!lay) return;
    var cat = (CATEGORY || []).filter(function (c) { return c.id === lay.category; })[0];
    if (!cat) return;
    if (!APPROVAL_CONFIG[cat.id]) APPROVAL_CONFIG[cat.id] = { need: true };
    APPROVAL_CONFIG[cat.id].stages = Math.max(0, Math.min(6, Number(n) || 0));
    APPROVAL_CONFIG[cat.id].need = Number(n) > 0;
  };
  /* 帳票タイプ設定に出す「帳票タイプの工作流」ブロック */
  window.catFlowBlockFor = function (t) {
    var lid = resolveLayoutId(t && t.id) || (t && t.id);
    var lay = (LAYOUT || []).filter(function (l) { return l.id === lid; })[0];
    var cat = lay ? (CATEGORY || []).filter(function (c) { return c.id === lay.category; })[0] : null;
    if (!cat) return '';
    var declared = window.catStagesOf(t.id);
    var assigned = (typeof stageCountOf === 'function') ? stageCountOf(t.id) : 0;
    var stages = (declared === null) ? assigned : Math.min(declared, assigned || declared);
    var nodes = WF_SEQ.map(function (label) {
      if (label !== '承認') return '<span class="wf-node is-fixed">' + label + '</span>';
      var on = stages > 0;
      return '<span class="wf-node wf-approve' + (on ? ' on' : '') + '">承認' + (stages > 1 ? ' ×' + stages : '') + (on ? '' : '（なし）') + '</span>';
    }).join('<span class="wf-arrow">→</span>');
    var input = '<input type="number" class="fld wf-stage-input" data-cat-stage-input="1" min="0" max="9" step="1"'
      + ' value="' + stages + '" aria-label="承認段数" />';
    return '<div class="wiz-field is-col"><span class="wl">帳票タイプの工作流</span>'
      + '<div class="catflow-box">'
      + '<div class="catflow-cat">帳票タイプ：<b>' + (typeof dispCat === 'function' ? dispCat(cat.id) : cat.name) + '</b></div>'
      + '<div class="wf-flow">' + nodes + '</div>'
      + '<div class="wf-stages"><span class="wf-stages-l">承認段数</span>' + input
      + '<span class="wf-stages-unit">段（0＝承認なし）</span></div>'
      + '</div></div>';
  };
  window.opsFromGroups = function (uid) {
    var out = [];
    (window.GROUPS || list).forEach(function (g) {
      if ((g.userIds || []).indexOf(uid) < 0) return;
      (GROUP_OPS[g.id] || []).forEach(function (op) { if (out.indexOf(op) < 0) out.push(op); });
    });
    return out;
  };
  window.GROUP_OPS = GROUP_OPS;
})();

function renderUserAddDialog() {
  const d = USER_ADD_DRAFT;
  if (!d) return '';
  const isNew = d.mode !== 'edit';
  return `
  <div class="modal-back" id="userAddBack">
    <div class="modal user-add-modal" style="width:min(560px,100%)">
      <div class="modal-head"><b>${isNew ? 'ユーザー追加' : 'ユーザー編集'}</b><span class="spacer"></span><button class="icon-btn" id="userAddClose"><span class="ico i-close"></span></button></div>
      <div class="modal-canvas user-add-canvas">
        <label class="user-add-field">
          <span class="user-add-label"><i class="req">*</i>ユーザー名</span>
          <input class="fld" id="userAddName" value="${esc(d.name)}" placeholder="ユーザー名を入力してください" />
        </label>
        <label class="user-add-field">
          <span class="user-add-label"><i class="req">*</i>メールアドレス</span>
          <input class="fld" id="userAddEmail" value="${esc(d.email)}" placeholder="メールアドレスを入力してください" />
        </label>
        <label class="user-add-field">
          <span class="user-add-label"><i class="req">*</i>権限</span>
          <select class="fld" id="userAddRole">
            ${ROLES.map((r) => `<option value="${esc(r.id)}" ${r.id === d.roleId ? 'selected' : ''}>${esc(r.name)}（${esc(r.code)}）</option>`).join('')}
          </select>
        </label>
        <!-- <p class="grp-note user-add-hint">所属グループと操作権限は<b>ユーザーグループ</b>側で設定します（役割＝グループ全員の操作、所属ユーザー＝メンバ）。</p> -->
        <label class="user-add-field">
          <span class="user-add-label"><i class="req">*</i>データ権限</span>
          <select class="fld" id="userAddDataPerm">
            ${DATA_PERMISSIONS.map((p) => `<option ${p === d.dataPerm ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </label>
        <div class="user-add-field">
          <span class="user-add-label">ステータス</span>
          <span class="user-add-status">
            <span class="user-add-status-text">${d.status === '有効' ? '有効' : '無効'}</span>
            <input type="checkbox" id="userAddStatus" ${d.status === '有効' ? 'checked' : ''} aria-label="ステータス" />
          </span>
        </div>
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="btn" id="userAddCancel">キャンセル</button>
        <button class="btn teal" id="userAddOk">OK</button>
      </div>
    </div>
  </div>`;
}

/** APIキー追加／編集ダイアログ */
function renderAccessKeyDialog() {
  const d = ACCESS_KEY_EDIT;
  if (!d) return '';
  const isEdit = d.mode === 'edit';
  const terms = Object.keys(API_KEY_STATUS);
  return `
  <div class="modal-back" id="accKeyBack">
    <div class="modal access-key-modal" style="width:min(560px,100%)">
      <div class="modal-head"><b>${isEdit ? 'API キー編集' : 'API キー'}</b><span class="spacer"></span><button class="icon-btn" id="accKeyClose"><span class="ico i-close"></span></button></div>
      <div class="modal-canvas access-key-canvas">
        <label class="access-field">
          <span class="access-label">名称</span>
          <input class="fld" id="accKeyName" value="${esc(d.name)}" placeholder="入力してください" />
        </label>
        ${isEdit ? '' : `
        <label class="access-field">
          <span class="access-label">有効期限</span>
          <select class="fld" id="accKeyTerm">${terms.map((t) => `<option ${t === (d.term || '1年') ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </label>`}
      </div>
      <div class="modal-foot">
        <span class="spacer"></span>
        <button class="btn" id="accKeyCancel">キャンセル</button>
        <button class="btn teal" id="accKeyOk">OK</button>
      </div>
    </div>
  </div>`;
}

function renderApiPage() {
  const tab = ACCESS_STATE.tab || 'url';
  const body = tab === 'notify' ? renderAccessNotifyTab() : tab === 'keys' ? renderAccessKeysTab() : renderAccessUrlTab();
  return `${cfgHeader('API設定', '')}
  <div class="access-tabs" role="tablist">
    ${ACCESS_TABS.map((t) => `<button type="button" role="tab" class="access-tab ${tab === t.id ? 'on' : ''}" data-acctab="${t.id}" aria-selected="${tab === t.id}">${esc(t.label)}</button>`).join('')}
  </div>
  <div class="access-body">${body}</div>`;
}
/** ユーザー → 所属グループ（帳票権限の付与単位）。uid 経由で GROUPS を逆引きする */
function userGroups(u) {
  return groupsOfUser(u && u.uid);
}

/** ユーザー管理。タブで「ユーザー一覧」と「ユーザーグループ」を切替える。
 *  所属・操作権限はグループ側で付与する（ユーザー編集では触らない）。 */
function renderUsers() {
  const tab = state.userTab === 'group' ? 'group' : 'user';
  const tabs = `<div class="perm-tabs" role="tablist" aria-label="ユーザー管理の種類">
      <button type="button" class="perm-tab${tab === 'user' ? ' on' : ''}" data-user-tab="user" role="tab" aria-selected="${tab === 'user'}">ユーザー一覧</button>
      <button type="button" class="perm-tab${tab === 'group' ? ' on' : ''}" data-user-tab="group" role="tab" aria-selected="${tab === 'group'}">ユーザーグループ<span class="perm-tab-sub">帳票権限</span></button>
    </div>`;
  if (tab === 'group') {
    return `${cfgHeader('ユーザー管理', '')}
    <div class="roles-page">${tabs}
      ${renderGroupList()}
    </div>
    ${groupFormDialog()}`;
  }
  return `${cfgHeader('ユーザー管理', `<span class="cfg-head-spacer"></span><button class="btn primary" data-useradd="1"><span class="ico i-add"></span>ユーザー追加</button>`)}
  <div class="roles-page">${tabs}${renderUserList()}</div>`;
}

/** ユーザー一覧（フラット。所属グループ列を持つ） */
function renderUserList() {
  const q = cfgState.userQ.toLowerCase();
  const gsel = cfgState.userGroup || '';
  const rows = ENT_USERS.filter((u) => {
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (gsel && !userGroups(u).some((g) => g.id === gsel)) return false;
    return true;
  });
  const body = rows.length === 0 ? '<tr><td colspan="8" class="empty-cell">データなし</td></tr>'
    : rows.map((u, i) => {
      const gs = userGroups(u);
      const gHtml = gs.length
        ? gs.map((g) => `<span class="pill grp-pill ${groupKindClass(g.kind)}" title="${esc(g.desc || '')}">${esc(g.name)}</span>`).join('')
        : '<span class="muted">未所属</span>';
      return `<tr>
      <td style="color:var(--text-2)">${i + 1}</td>
      <td>${esc(u.name)}</td>
      <td>${esc(u.email)}</td>
      <td><span class="pill">${esc(u.role)}</span></td>
      <td><div class="grp-members">${gHtml}</div></td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(u.created)}</td>
      <td><span class="st ${u.status === '有効' ? 'ok' : 'wait'}"><span class="dot"></span>${esc(u.status)}</span></td>
      <td><div class="acts">
        <button class="act-text" data-useredit="${u.id}">編集</button>
        <button class="act-text" data-usertoggle="${u.id}">${u.status === '有効' ? '無効化' : '有効化'}</button>
      </div></td></tr>`;
    }).join('');
  return `<div class="cfg-filters">
    <div class="field"><span class="lbl">ユーザー名</span><input class="fld" id="cfgUserQ" placeholder="キーワードを入力" value="${esc(cfgState.userQ)}" /></div>
    <div class="field"><span class="lbl">メールアドレス</span><input class="fld" placeholder="入力してください" /></div>
    <div class="field"><span class="lbl">権限</span><select class="fld"><option>選択してください</option>${ROLES.map((r) => `<option>${esc(r.name)}</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">所属グループ</span><select class="fld" id="cfgUserGroup"><option value="">選択してください</option>${GROUPS.map((g) => `<option value="${esc(g.id)}" ${g.id === gsel ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">ステータス</span><select class="fld"><option>選択してください</option><option>有効</option><option>無効</option></select></div>
    <span class="spacer"></span>
    <button class="btn primary" id="cfgUserSearch"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
    <button class="btn" id="cfgUserReset"><span class="ico i-refresh"></span>リセット</button>
  </div>
  <div class="tablewrap"><table>
    <thead><tr><th style="width:56px">番号</th><th>ユーザー名</th><th>メールアドレス</th><th style="width:110px">権限</th>
      <th style="width:230px">所属グループ</th><th style="width:160px">作成時間</th><th style="width:90px">ステータス</th><th style="width:150px;text-align:right">操作</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

/** 権限設定（利用設定 → 権限設定。原型 PermissionsPage 準拠） */
function roleRows() {
  const F = state.roleFilters;
  const nq = (F.name || '').trim().toLowerCase();
  return ROLES.filter((r) => {
    if (nq && !String(r.name || '').toLowerCase().includes(nq)) return false;
    if (F.status && r.status !== F.status) return false;
    return true;
  });
}

/** 権限設定：メニュー到達とボタン操作 */
function renderRoles() {
  return `<div class="roles-page">${renderRoleList()}</div>
  ${roleFormDialog()}${menuPermDialog()}`;
}

/** 権限（ロール）一覧。メニュー到達権限だけを持つ（帳票権限はグループ側） */
function renderRoleList() {
  const D = state.roleDraft;
  const rows = roleRows();
  const pages = Math.max(1, Math.ceil(rows.length / state.rolePerPage));
  if (state.rolePage > pages) state.rolePage = pages;
  const start = (state.rolePage - 1) * state.rolePerPage;
  const view = rows.slice(start, start + state.rolePerPage);

  const body = view.length === 0
    ? '<tr><td colspan="7" class="empty-cell">データがありません</td></tr>'
    : view.map((r, i) => `<tr>
      <td class="roles-no">${start + i + 1}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.code)}</td>
      <td>${esc(r.desc)}</td>
      <td class="roles-time">${esc(r.created)}</td>
      <td><span class="status-badge ${r.status === '有効' ? 'on' : 'off'}">${esc(r.status)}</span></td>
      <td><div class="acts roles-acts">
        <button type="button" class="act-text" data-rolemenu="${r.id}">メニュー権限</button>
        <button type="button" class="act-text" data-roleedit="${r.id}">編集</button>
        <button type="button" class="act-text danger" data-roledel="${r.id}">削除</button>
      </div></td>
    </tr>`).join('');

  const pagesHtml = [];
  const pageList = [];
  if (pages <= 7) {
    for (let p = 1; p <= pages; p++) pageList.push(p);
  } else if (state.rolePage <= 3) {
    pageList.push(1, 2, 3, 4, 5, '…', pages);
  } else if (state.rolePage >= pages - 2) {
    pageList.push(1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages);
  } else {
    pageList.push(1, '…', state.rolePage - 1, state.rolePage, state.rolePage + 1, '…', pages);
  }
  pageList.forEach((p, idx) => {
    if (p === '…') pagesHtml.push('<span class="pg-ellipsis">…</span>');
    else pagesHtml.push(`<button type="button" class="pg ${p === state.rolePage ? 'on' : ''}" data-rolepage="${p}">${p}</button>`);
  });

  return `
  <div class="roles-page">
    <div class="roles-filters">
      <div class="roles-filter-fields">
        <label class="roles-field">
          <span class="lbl">権限名</span>
          <input class="fld" id="roleName" placeholder="権限名" value="${esc(D.name || '')}" />
        </label>
        <label class="roles-field">
          <span class="lbl">ステータス</span>
          <select class="fld" id="roleStatus">
            <option value="" ${!D.status ? 'selected' : ''}>選択してください</option>
            <option value="有効" ${D.status === '有効' ? 'selected' : ''}>有効</option>
            <option value="無効" ${D.status === '無効' ? 'selected' : ''}>無効</option>
          </select>
        </label>
  </div>
      <div class="roles-filter-actions">
        <button type="button" class="btn primary" id="roleSearch"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
        <button type="button" class="btn" id="roleReset"><span class="ico i-refresh"></span>リセット</button>
      </div>
    </div>

    <div class="roles-toolbar">
      <button type="button" class="btn primary" data-roleadd="1"><span class="ico i-add"></span>新規権限作成</button>
    </div>

    <div class="tablewrap roles-table">
      <table>
        <thead><tr>
          <th style="width:64px">番号</th>
          <th>権限名</th>
          <th style="width:140px">権限ID</th>
          <th>概要</th>
          <th style="width:160px">作成時間</th>
          <th style="width:96px">ステータス</th>
          <th style="width:220px">操作・処理</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>

    <div class="pager roles-pager">
      <span class="roles-pager-count">検索結果 ${rows.length} 件中</span>
      <div class="roles-pager-right">
        <select data-roleper>${[10, 20, 50].map((n) => `<option value="${n}" ${n === state.rolePerPage ? 'selected' : ''}>${n}件ずつ</option>`).join('')}</select>
        <button type="button" class="pg" data-rolepage="${Math.max(1, state.rolePage - 1)}" ${state.rolePage <= 1 ? 'disabled' : ''}>‹</button>
        <span class="pages">${pagesHtml.join('')}</span>
        <button type="button" class="pg" data-rolepage="${Math.min(pages, state.rolePage + 1)}" ${state.rolePage >= pages ? 'disabled' : ''}>›</button>
        <label class="roles-goto"><input class="pginput" data-rolegoto value="${state.rolePage}" /> ページへ</label>
      </div>
    </div>
  </div>`;
}

/* ── ユーザーグループ一覧（帳票権限の付与単位） ────────────────────────── */

function groupRows() {
  const F = state.groupFilters;
  const q = (F.q || '').trim().toLowerCase();
  return GROUPS.filter((g) => {
    if (q && !String(g.name || '').toLowerCase().includes(q) && !String(g.desc || '').toLowerCase().includes(q)) return false;
    if (F.kind && g.kind !== F.kind) return false;
    return true;
  });
}

/** グループに所属するユーザー名（多対多の逆引き） */
function groupUserNames(g) {
  const names = (g.userIds || []).map((uid) => userName(uid)).filter(Boolean);
  return names.length ? names : [];
}

function renderGroupList() {
  const D = state.groupDraft;
  const rows = groupRows();
  const pages = Math.max(1, Math.ceil(rows.length / state.groupPerPage));
  if (state.groupPage > pages) state.groupPage = pages;
  const start = (state.groupPage - 1) * state.groupPerPage;
  const view = rows.slice(start, start + state.groupPerPage);

  const body = view.length === 0
    ? '<tr><td colspan="7" class="empty-cell">データがありません</td></tr>'
    : view.map((g, i) => {
      const members = groupUserNames(g);
      const tickets = groupTickets(g.id);
      const memberHtml = members.length
        ? members.slice(0, 3).map((n) => `<span class="pill">${esc(n)}</span>`).join('')
          + (members.length > 3 ? `<span class="pill more">+${members.length - 3}</span>` : '')
        : '<span class="muted">メンバーなし</span>';
      const ticketHtml = tickets.length
        ? `<b>${tickets.length}</b> 帳票タイプ`
        : '<span class="muted">未設定</span>';
      return `<tr>
      <td class="roles-no">${start + i + 1}</td>
      <td><span class="grp-name">${esc(g.name)}</span></td>
      <td><div class="grp-roles">${(groupRolesOf(g).length ? groupRolesOf(g) : [g.kind]).map((l) => `<span class="grp-role-chip">${esc(l)}</span>`).join('')}</div></td>
      <td>${esc(g.desc)}</td>
      <td><div class="grp-members">${memberHtml}</div></td>
      <td>${ticketHtml}</td>
      <td><div class="acts roles-acts">
        <button type="button" class="act-text" data-grpedit="${g.id}">編集</button>
        <button type="button" class="act-text danger" data-grpdel="${g.id}">削除</button>
      </div></td>
    </tr>`;
    }).join('');

  const pageList = [];
  if (pages <= 7) { for (let p = 1; p <= pages; p++) pageList.push(p); }
  else if (state.groupPage <= 3) pageList.push(1, 2, 3, 4, 5, '…', pages);
  else if (state.groupPage >= pages - 2) pageList.push(1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages);
  else pageList.push(1, '…', state.groupPage - 1, state.groupPage, state.groupPage + 1, '…', pages);
  const pagesHtml = pageList.map((p) => (p === '…'
    ? '<span class="pg-ellipsis">…</span>'
    : `<button type="button" class="pg ${p === state.groupPage ? 'on' : ''}" data-grppage="${p}">${p}</button>`)).join('');

  return `
    <div class="roles-filters">
      <div class="roles-filter-fields">
        <label class="roles-field">
          <span class="lbl">グループ名</span>
          <input class="fld" id="grpQ" placeholder="グループ名・概要" value="${esc(D.q || '')}" />
        </label>
        <label class="roles-field">
          <span class="lbl">操作権限</span>
          <select class="fld" id="grpKind">
            <option value="" ${!D.kind ? 'selected' : ''}>選択してください</option>
            ${GROUP_KINDS.map((k) => `<option value="${esc(k.label)}" ${D.kind === k.label ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="roles-filter-actions">
        <button type="button" class="btn primary" id="grpSearch"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
        <button type="button" class="btn" id="grpReset"><span class="ico i-refresh"></span>リセット</button>
      </div>
    </div>

    <div class="roles-toolbar">
      <button type="button" class="btn primary" data-grpadd="1"><span class="ico i-add"></span>新規グループ作成</button>
    </div>

    <div class="tablewrap roles-table">
      <table>
        <thead><tr>
          <th style="width:64px">番号</th>
          <th style="width:180px">グループ名</th>
          <th style="width:240px">操作権限</th>
          <th>概要</th>
          <th style="width:230px">所属ユーザー</th>
          <th style="width:130px">帳票権限</th>
          <th style="width:150px">操作・処理</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>

    <div class="pager roles-pager">
      <span class="roles-pager-count">検索結果 ${rows.length} 件中</span>
      <div class="roles-pager-right">
        <select data-grpper>${[10, 20, 50].map((n) => `<option value="${n}" ${n === state.groupPerPage ? 'selected' : ''}>${n}件ずつ</option>`).join('')}</select>
        <button type="button" class="pg" data-grppage="${Math.max(1, state.groupPage - 1)}" ${state.groupPage <= 1 ? 'disabled' : ''}>‹</button>
        <span class="pages">${pagesHtml}</span>
        <button type="button" class="pg" data-grppage="${Math.min(pages, state.groupPage + 1)}" ${state.groupPage >= pages ? 'disabled' : ''}>›</button>
        <label class="roles-goto"><input class="pginput" data-grpgoto value="${state.groupPage}" /> ページへ</label>
      </div>
    </div>`;
}

/** 権限の新規作成／編集ダイアログ（新規権限作成・権限編集で共用） */
function roleFormDialog() {
  const f = state.permForm;
  if (!f) return '';
  const isNew = f.mode === 'new';
  const on = f.status === '有効';
  return `<div class="modal-back" id="permFormBack"><div class="modal perm-modal">
    <div class="modal-head"><b>${isNew ? '新規権限作成' : '権限編集'}</b><span class="spacer"></span><button class="icon-btn" id="permFormClose" aria-label="閉じる"><span class="ico i-close"></span></button></div>
    <div class="perm-body">
      <label class="perm-row"><span class="lbl req">権限名</span><input class="fld" id="permFormName" value="${esc(f.name || '')}" placeholder="権限名を入力してください" /></label>
      <label class="perm-row"><span class="lbl req">権限ID</span><input class="fld" id="permFormCode" value="${esc(f.code || '')}" placeholder="権限IDを入力してください" /></label>
      <label class="perm-row"><span class="lbl">概要</span><textarea class="fld" id="permFormDesc" placeholder="概要を入力してください">${esc(f.desc || '')}</textarea></label>
      <div class="perm-row"><span class="lbl">ステータス</span>
        <button type="button" class="tgl ${on ? '' : 'off'}" id="permFormStatus" role="switch" aria-checked="${on}"><span class="tgl-txt">${on ? '有効' : '無効'}</span><span class="tgl-knob"></span></button>
      </div>
    </div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" id="permFormCancel">キャンセル</button><button class="btn primary" id="permFormOk">OK</button></div>
  </div></div>`;
}

/* ── ユーザーグループの作成／編集ダイアログ ─────────────────────────────
 * タブは 2 つ。①基本情報（グループ名・役割・所属ユーザー）
 *              ②帳票権限（このグループが担当する帳票タイプ × 操作）
 * ②は【帳票権限表】をグループ側から見た転置で、帳票タイプ詳細／帳票権限管理と
 * 同じ TICKET_PERMS を読み書きする（保存先は 1 つ）。 */
function groupFormDialog() {
  const f = state.groupForm;
  if (!f) return '';
  const isNew = f.mode === 'new';
  const tab = f.tab === 'tickets' ? 'tickets' : 'basic';
  const members = (f.userIds || []).length;

  const tabs = `<div class="perm-tabs is-inner" role="tablist" aria-label="グループの設定">
      <button type="button" class="perm-tab${tab === 'basic' ? ' on' : ''}" data-grp-tab="basic" role="tab" aria-selected="${tab === 'basic'}">基本情報</button>
      <button type="button" class="perm-tab${tab === 'tickets' ? ' on' : ''}" data-grp-tab="tickets" role="tab" aria-selected="${tab === 'tickets'}">帳票権限</button>
    </div>`;

  const basic = `
    <div class="perm-body">
      <label class="perm-row"><span class="lbl req">グループ名</span><input class="fld" id="grpFormName" value="${esc(f.name || '')}" placeholder="例：住民異動窓口" /></label>
      <div class="perm-row"><span class="lbl req">操作権限</span>
        <div class="asg-mode-pills grp-kind-pills" role="tablist" aria-label="ワークフロー設定">
          ${GROUP_NODES.map((n) => { const on = groupRolesOf(f).indexOf(n.label) >= 0; return `<button type="button" class="asg-mode-pill groupNodePills${on ? ' on' : ''}" data-grp-kind="${esc(n.label)}" role="checkbox" aria-checked="${on}">${esc(n.label)}</button>`; }).join('')}
        </div>
      </div>
      <!-- <p class="grp-note">このグループが担当する権限を選びます。工作流の定義（工程の並び・承認段数）は 帳票タイプ で設定します。選んだノードは所属ユーザー全員に適用されます（OCR結果修正は確認に含まれます）。</p> -->
      <label class="perm-row"><span class="lbl">概要</span><textarea class="fld" id="grpFormDesc" placeholder="概要を入力してください">${esc(f.desc || '')}</textarea></label>
      <div class="perm-row is-col"><span class="lbl">所属ユーザー（${members} 名）</span>
        <div class="grp-users">
          ${USERS.map((u) => `<label class="perm-pick"><input type="checkbox" class="cb" data-grp-user="${u.id}" ${(f.userIds || []).includes(u.id) ? 'checked' : ''} /><span>${esc(u.name)}</span><span class="perm-pick-sub">${esc(groupsOfUser(u.id).filter((g) => g.id !== f.id).map((g) => g.name).join('、') || '他のグループなし')}</span></label>`).join('')}
        </div>
        <!-- <p class="grp-note">ここで選んだユーザーがこのグループの担当者プールに入ります。担当が割り当てられると、ここから 1 名にランダムで割り当てられます。</p> -->
      </div>
    </div>`;

  /* 帳票権限タブ：帳票タイプ単位で「担当する」を選ぶ（権限は基本情報のワークフロー設定で決まる） */
  const myOps = groupOpKeysOf(f);
  const ticketRows = CATEGORY.map((c, i) => {
    const on = groupHasCategory(f, c.id);
    const biz = byId(BUSINESS, c.business) || {};
    const list = LAYOUT.filter((l) => (catOf(l.id) || {}).id === c.id);
    const n = list.reduce((mx, l) => Math.max(mx, approvalStageCountOf(l.id)), 0);
    const chips = (on ? groupOpKeysOf(f) : []).map((k) => `<span class="perm-chip">${esc(permActLabel(k))}</span>`).join('');
    const stageHtml = n === 0
      ? '<span class="muted">承認なし</span>'
      : Array.from({ length: n }, (_, idx) => {
          const k = idx + 1;
          const isOn = list.some((l) => stageTargetsOf(l.id, idx).indexOf(f.id) >= 0);
          const unset = !list.some((l) => stageTargetsOf(l.id, idx).length);
          return `<button type="button" class="stage-chip${isOn ? ' on' : ''}${unset ? ' is-unset' : ''}" data-grp-stage="${c.id}:${k}" title="承認${k} の担当にする">承認${k}</button>`;
        }).join('');
    return `<tr${on ? ' class="is-on"' : ''}>
      <td class="roles-no">${i + 1}</td>
      <td>${esc(dispCat(c.id))}<div class="sub">${esc(biz.name || '')} ／ 帳票タイプ ${list.length} 件</div></td>
      <td class="permcell"><label class="grp-tk"><input type="checkbox" class="cb" data-grp-cat="${c.id}" ${on ? 'checked' : ''} /><span class="grp-tk-l">担当する</span></label></td>
      <td class="permcell"><div class="stage-chips">${stageHtml}</div></td>
      <td>${chips || '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');

  const tickets = `
    <div class="perm-body is-flush">
      <div class="tablewrap grp-tk-wrap">
        <table class="grp-tk-table grp-cat-table">
          <thead><tr><th style="width:56px">番号</th><th>帳票タイプ</th><th style="width:130px">担当</th><th style="width:240px">承認の段</th><th>付与される権限</th></tr></thead>
          <tbody>${ticketRows}</tbody>
        </table>
      </div>
    </div>`;


  return `<div class="modal-back" id="grpFormBack"><div class="modal perm-modal grp-modal">
    <div class="modal-head"><b>${isNew ? '新規グループ作成' : 'グループ編集'}</b><span class="spacer"></span><button class="icon-btn" id="grpFormClose" aria-label="閉じる"><span class="ico i-close"></span></button></div>
    ${tabs}
    ${tab === 'tickets' ? tickets : basic}
    <div class="modal-foot">
      <span class="muted">${isNew ? '未保存' : `${esc(f.name || '')} ／ ${esc(f.kind || '')}`}</span>
      <span class="spacer"></span>
      <button class="btn" id="grpFormCancel">キャンセル</button>
      <button class="btn primary" id="grpFormOk">OK</button>
    </div>
  </div></div>`;
}

/** ノード配下のリーフ（＝実メニュー）id を集める */
function menuPermLeaves(node) {
  return node.children ? node.children.flatMap(menuPermLeaves) : [node.id];
}

/** メニュー権限ダイアログ（システムレベル：画面到達権限のツリー） */
function menuPermDialog() {
  const m = state.menuPerm;
  if (!m) return '';
  const role = byId(ROLES, m.roleId) || {};
  const checked = m.checked || [];
  const closed = m.closed || [];
  const nodeHtml = (n) => {
    const leaves = menuPermLeaves(n);
    const on = leaves.filter((id) => checked.includes(id)).length;
    const caret = n.children
      ? `<span class="mpcaret ico i-caret-down ${closed.includes(n.id) ? 'closed' : ''}" data-mptoggle="${n.id}"></span>`
      : '<span class="mpcaret"></span>';
    const kids = n.children && !closed.includes(n.id) ? `<ul>${n.children.map(nodeHtml).join('')}</ul>` : '';
    return `<li>${caret}<label class="mpnode"><input type="checkbox" class="cb" data-mpnode="${n.id}" ${on === leaves.length ? 'checked' : ''} /><span class="mplabel">${esc(n.label)}</span></label>${kids}</li>`;
  };
  /* ツリー上の「全選択」「全展開」の現在値をスイッチの見た目に反映する */
  const allOn = MENU_LEAVES.length > 0 && MENU_LEAVES.every((id) => checked.includes(id));
  const expanded = closed.length === 0;
  /* ラベル／スイッチ／現在値の並び。スイッチはアプリ共通の .tgl を使う */
  const mpSwitch = (label, attr, on, val) => `<div class="mp-sw">
        <span class="mp-sw-label">${label}</span>
        <button type="button" class="tgl${on ? '' : ' off'}" ${attr}="1" role="switch" aria-checked="${on}" aria-label="${label}"><span class="tgl-knob"></span></button>
        <span class="mp-sw-val">${val}</span>
      </div>`;
  return `<div class="modal-back" id="menuPermBack"><div class="modal perm-modal mp-modal">
    <div class="modal-head"><b>メニュー権限</b><span class="spacer"></span><button class="icon-btn" id="menuPermClose" aria-label="閉じる"><span class="ico i-close"></span></button></div>
    <div class="perm-body">
      <div class="perm-row"><span class="lbl">権限名</span><div class="mp-idchip">${esc(role.name || '')}</div></div>
      <div class="perm-row"><span class="lbl">権限ID</span><div class="mp-idchip">${esc(role.code || '')}</div></div>
      <div class="mp-block">
        <div class="mp-block-label">メニュー権限</div>
        <div class="mp-panel">
          <div class="mp-toolbar">
            ${mpSwitch('すべて選択/すべて解除', 'data-mpall', allOn, allOn ? 'はい' : 'いいえ')}
            ${mpSwitch('もっと見る/折りたたみ', 'data-mpexpand', expanded, expanded ? 'もっと見る' : '折りたたみ')}
          </div>
          <div class="mptree" id="mpTree"><ul>${MENU_TREE.map(nodeHtml).join('')}</ul></div>
        </div>
      </div>
    </div>
    <div class="modal-foot"><span class="spacer"></span><button class="btn" id="menuPermCancel">キャンセル</button><button class="btn primary" id="menuPermOk">OK</button></div>
  </div></div>`;
}

/** セキュリティ設定 */
/** セキュリティ設定（データ保存期限／IPアドレスホワイトリスト／アイドルセッションの 3 モジュール） */
function renderSecurity() {
  const opts = (list, cur) => list.map((v) => `<option ${cur === v ? 'selected' : ''}>${v}</option>`).join('');
  return `<div class="sec-page">${cfgHeader('セキュリティ設定')}
  <div class="sec-grid">
    <section class="sec-card">
      <div class="sec-head">
        <h4>データ保存期限設定</h4>
        <select class="fld sec-ctl" data-sec="retention">${opts(['7日', '14日', '1ヶ月', '2ヶ月', '3ヶ月', '6ヶ月', '12ヶ月'], SECURITY.retention)}</select>
      </div>
      <p class="cfg-note">読取データの自動削除サイクルを設定します。システムは設定に基づき、保持期間を超えた読取記録および関連ファイルを自動的に削除します。</p>
    </section>
    <section class="sec-card">
      <div class="sec-head">
        <h4>IPアドレスホワイトリスト設定</h4>
        <select class="fld sec-ctl" data-sec="ipEnabled">${opts(['無効', '有効'], SECURITY.ipEnabled)}</select>
      </div>
      <p class="cfg-note">有効にすると、指定された特定のIPアドレスからのみアクセスが可能になります。</p>
    </section>
    <section class="sec-card">
      <div class="sec-head">
        <h4>アイドルセッション設定</h4>
        <label class="sec-inline"><span class="sec-lbl">自動ログアウト時間</span><select class="fld sec-ctl" data-sec="idle">${opts(['15分', '30分', '60分', '2時間', '制限なし'], SECURITY.idle)}</select></label>
      </div>
      <p class="cfg-note">ユーザーが操作を行わない状態でログインを維持する時間を設定します。閾値を超えると自動的にログアウトされます。</p>
      <p class="cfg-note">設定が有効になると、すべてのオンラインユーザーは次回のログイン時に新しいポリシーが適用されます。</p>
    </section>
  </div>
  <div class="cfg-actions sec-actions"><button class="btn" id="secClose">閉じる</button><button class="btn primary" id="secSave"><span class="ico i-save"></span>保存</button></div>
  </div>`;
}

/** ログ設定 */
function renderLogs() {
  const body = SECURITY.logs.map((l, i) => `<tr>
    <td style="white-space:nowrap;color:var(--text-2)">${esc(l.at)}</td>
    <td>${esc(l.user)}</td>
    <td><span class="pill">${esc(l.type)}</span></td>
    <td style="white-space:nowrap;color:var(--text-2)">${esc(l.ip)}</td>
    <td><span class="st ${l.result === '成功' ? 'ok' : 'ng'}"><span class="dot"></span>${esc(l.result)}</span></td>
    <td class="hist done">${esc(l.note)}</td></tr>`).join('');
  return `${cfgHeader('ログ設定', `<button class="btn" data-logexport="1"><span class="ico i-export"></span>ダウンロード</button>`)}
  <div class="cfg-filters">
    <div class="field"><span class="lbl">期間</span><div class="di"><input class="fld date" type="date" value="2026-10-01" /><span class="sep">-</span><input class="fld date" type="date" value="2026-10-14" /></div></div>
    <div class="field"><span class="lbl">メールアドレス</span><input class="fld" placeholder="入力してください" /></div>
    <div class="field"><span class="lbl">イベント</span><select class="fld"><option>選択してください</option>${[...new Set(SECURITY.logs.map((l) => l.type))].map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div class="field"><span class="lbl">操作結果</span><select class="fld"><option>選択してください</option><option>成功</option><option>失敗</option></select></div>
    <span class="spacer"></span>
    <button class="btn primary"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
    <button class="btn"><span class="ico i-refresh"></span>リセット</button>
  </div>
  <div class="tablewrap"><table>
    <thead><tr><th style="width:170px">操作日時</th><th>メールアドレス</th><th style="width:120px">イベント種別</th><th style="width:140px">IPアドレス</th><th style="width:100px">操作結果</th><th>備考</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}



/** 複数選択（ユーザー）。絞り込み用 mselect とは別系統（data-wms*）で扱う。 */
function wizMulti(id, placeholder, opts, current, hint) {
  const list = current || [];
  const open = state.dd === id;
  const label = (v) => (opts.find((o) => o[0] === v) || [])[1] || v;
  const summary = list.length === 0 ? `<span class="ph">${esc(placeholder)}</span>`
    : list.length === 1 ? esc(label(list[0]))
      : `${esc(label(list[0]))} <span class="more">+${list.length - 1}</span>`;
  const body = opts.length
    ? opts.map((o) => `<label class="msrow"><input type="checkbox" class="cb" data-wmsopt="${id}" value="${o[0]}" ${list.includes(o[0]) ? 'checked' : ''} /><span>${esc(o[1])}${o[2] ? `<em class="sub">${esc(o[2])}</em>` : ''}</span></label>`).join('')
    : '<div class="msrow empty">選択肢なし</div>';
  return `<div class="ms ${open ? 'open' : ''} ${list.length ? 'has' : ''}" data-ms="${id}" title="${esc(list.map(label).join('、'))}">
    <div class="msbtn" data-wmsbtn="${id}"><span class="txt">${summary}</span><span class="caret2 ico i-caret-down"></span></div>
    <div class="msmenu">${body}<div class="msfoot"><button class="link" data-wmsclear="${id}">クリア</button></div></div>
  </div>${hint ? `<p class="wiz-hint">${esc(hint)}</p>` : ''}`;
}

/** ① AI分類設定：右ペインの帳票カード（原型 Step1ClassificationSettings） */
function sceneFormsPane(sc) {
  const ids = sc.formIds || [];
  const cards = ids.map((fid) => {
    const f = byId(CLASSIFY_FORMS, fid);
    if (!f) return '';
    return `<div class="typecard"><span class="tc-body"><span class="tc-name">${esc(f.name)}</span>`
      + `<span class="cat-badge">${esc(f.category)}</span></span>`
      + `<span class="tc-del" data-typedel="${f.id}" title="削除"><span class="ico i-close"></span></span></div>`;
  }).join('');
  const full = ids.length >= MAX_CLASSIFY_FORMS;
  /* 見出しは出さず、右寄せで「選択済み n/20」＋「帳票追加」 */
  return '<div class="scene-types"><div class="scene-types-head">'
    + `<span class="selcount">選択済み ${ids.length}/${MAX_CLASSIFY_FORMS}</span>`
    + `<button class="btn sm" id="scAddType" ${full ? 'disabled' : ''}><span class="ico i-add"></span>帳票追加</button></div>`
    + '<div class="typecards">' + (cards || '<p class="muted">「帳票追加」から分類対象の帳票を選択してください</p>') + '</div></div>';
}

/** ② 効果テスト：左ペイン（アップロード／原型 Step2ClassificationEffectTest） */
function sceneTestPane(sc) {
  const t = SCENE_TESTS[sc.id] || {};
  return '<div class="wiz-pane"><div class="scene-drop" id="scDrop">'
    + '<svg class="cloud" viewBox="0 0 48 34" aria-hidden="true">'
    + '<path d="M13 26h22a7 7 0 0 0 .6-13.9A10 10 0 0 0 16 10.5 6.5 6.5 0 0 0 13 26Z"/>'
    + '<path d="M24 33V19m0 0-5 5m5-5 5 5"/></svg>'
    + '<p class="sd-title">ここにファイルをドラッグ・ドロップ</p>'
    + '<p class="sd-note">単一のファイルをアップロードできます。最大20MB、各ファイルは最大10ページです。ファイル形式は png, jpg, jpeg, pdf, tif, tiff です。</p>'
    + '<button class="btn primary" id="scPickFile"><span class="ico i-upload"></span>ファイル選択</button>'
    + '<input type="file" id="scFile" accept=".png,.jpg,.jpeg,.pdf,.tif,.tiff" hidden />'
    + (t.fileName ? `<div class="sd-file"><b>${esc(t.fileName)}</b>${t.fileSize ? `<span class="muted">（${esc(t.fileSize)}）</span>` : ''}<button class="link" id="scClearFile">クリア</button></div>` : '')
    + '</div></div>';
}

/** ② 効果テスト：右ペイン「分類結果」 */
function sceneResultPane(sc) {
  const t = SCENE_TESTS[sc.id] || {};
  const rows = (t.results || []).map((r) => `<tr><td class="muted">${r.rank}</td><td>${esc(r.formName)}</td>`
    + `<td><span class="cat-badge">${esc(r.category)}</span></td><td class="conf">${r.confidence.toFixed(1)} %</td></tr>`).join('');
  const body = (t.tested && rows)
    ? `<table class="scene-result"><thead><tr><th>順位</th><th>帳票タイプ</th><th>区分</th><th>自信度</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p class="muted center">ファイルをアップロードすると、分類結果がここに表示されます</p>';
  return '<div class="scene-types"><div class="scene-result-head"><span class="srh">分類結果</span></div>'
    + '<div class="scene-result-body">' + body + '</div></div>';
}

/** 「帳票追加」ピッカー（原型 FormPickerModal） */
function sceneFormPicker(sc) {
  const avail = CLASSIFY_FORMS.filter((f) => !(sc.formIds || []).includes(f.id));
  const q = (cfgState.pickQ || '').toLowerCase();
  const list = avail.filter((f) => !q || f.name.toLowerCase().includes(q));
  return '<div class="modal-back" id="scPickBack"><div class="modal sc-picker">'
    + '<div class="modal-head"><b>帳票タイプの選択</b><span class="spacer"></span><button class="icon-btn" id="scPickClose"><span class="ico i-close"></span></button></div>'
    + `<div class="sc-pick-search search-wrap"><input id="scPickQ" placeholder="帳票名を入力してください" value="${esc(cfgState.pickQ || '')}" /></div>`
    + '<div class="sc-pick-list">'
    + (list.length
      ? list.map((f) => `<button type="button" class="sc-pick-row" data-pickform="${f.id}"><span class="pf-name">${esc(f.name)}</span><span class="cat-badge">${esc(f.category)}</span></button>`).join('')
      : '<p class="muted center">該当する帳票がありません</p>')
    + '</div>'
    + `<div class="modal-foot"><span class="muted">候補 ${avail.length} 件</span><span class="spacer"></span><button class="btn" id="scPickCancel">閉じる</button></div>`
    + '</div></div>';
}

/** 業務シーンの名称変更ダイアログ */
function sceneRenameDialog() {
  const r = state.sceneRename;
  return '<div class="modal-back" id="scRenameBack"><div class="modal sc-picker">'
    + '<div class="modal-head"><b>業務シーン名称変更</b><span class="spacer"></span><button class="icon-btn" id="scRenameClose"><span class="ico i-close"></span></button></div>'
    + `<div class="sc-pick-search search-wrap"><input id="scRenameInput" value="${esc(r.value)}" placeholder="業務シーン名を入力してください" /></div>`
    + '<div class="modal-foot"><span class="spacer"></span><button class="btn" id="scRenameCancel">キャンセル</button><button class="btn primary" id="scRenameOk">保存</button></div>'
    + '</div></div>';
}

/** 業務シーンの編集（① AI分類設定 → ② 効果テスト／原型 ClassificationWizardPage 準拠） */
function sceneEditor(sc) {
  const stepNo = state.sceneStep || 1;
  const bar = '<div class="wiz">' + ['AI分類設定', '効果テスト'].map((lb, i) =>
    '<button class="wiz-step ' + (stepNo === i + 1 ? 'on' : '') + ' ' + (stepNo > i + 1 ? 'done' : '') + '" data-scenestep="' + (i + 1) + '">'
    + '<span class="wiz-no">' + (i + 1) + '</span><span class="wiz-label">' + lb + '</span></button>'
    + (i === 0 ? '<span class="wiz-line ' + (stepNo > 1 ? 'on' : '') + '"></span>' : '')).join('') + '</div>';

  const left = stepNo === 1
    ? '<div class="wiz-pane">'
    + `<div class="wiz-field"><span class="wl">業務シーン ID</span><div class="wv code">${esc(sc.sceneId)}</div></div>`
    + `<label class="wiz-field"><span class="wl req">業務シーン名</span><input class="fld w100" id="scName" value="${esc(sc.name)}" /></label>`
    + `<label class="wiz-field"><span class="wl">業務シーンの説明</span><input class="fld w100" id="scDesc" placeholder="業務シーンの説明を入力してください" value="${esc(sc.desc || '')}" /></label>`
    + '</div>'
    : sceneTestPane(sc);

  return '<section class="type-main">' + bar
    + '<div class="wiz-body">' + left + (stepNo === 1 ? sceneFormsPane(sc) : sceneResultPane(sc)) + '</div>'
    + '<div class="wiz-foot">'
    + '<button class="btn danger" id="scDelete"><span class="ico i-delete"></span>削除</button>'
    + '<span class="spacer"></span>'
    + '<button class="btn" id="scClose">閉じる</button>'
    + (stepNo > 1 ? '<button class="btn" id="scPrev">前へ</button>' : '')
    + (stepNo < 2 ? '<button class="btn" id="scNext">次へ</button>' : '')
    + `<button class="btn primary" id="scSave">${stepNo === 1 ? '保存＆テスト' : '完成'}</button>`
    + '</div></section>'
    + (state.scenePick ? sceneFormPicker(sc) : '')
    + (state.sceneRename ? sceneRenameDialog() : '');
}

/** 業務シーン設定（左：業務シーン一覧／右：選択時のみ編集） */
function renderBizScenes() {
  const q = (cfgState.sceneQ || '').toLowerCase();
  const list = BIZ_SCENES.filter((b) => !q || b.name.toLowerCase().includes(q));
  const sc = byId(BIZ_SCENES, state.sceneId);
  const items = list.map((b) => {
    const open = state.sceneMenu === b.id;
    return '<div class="type-item ' + (sc && sc.id === b.id ? 'on' : '') + '" data-sceneid="' + b.id + '">'
      + '<span class="ti-name" title="' + esc(b.name) + '">' + esc(b.name) + '</span>'
      + '<button type="button" class="ti-more" data-scenemenu="' + b.id + '" title="メニュー"><span class="ico i-more"></span></button>'
      + (open ? '<div class="ti-menu">'
        + '<button type="button" data-scenerename="' + b.id + '">名称変更</button>'
        + '<button type="button" class="danger" data-scenedel="' + b.id + '">削除</button>'
        + '</div>' : '')
      + '</div>';
  }).join('');

  return '<div class="typedetail nl-classify">'
    + '<aside class="type-list">'
    + '<h2 class="type-list-title">業務シーン設定</h2>'
    + '<div class="type-list-tools">'
    + '<div class="type-search search-wrap"><input id="sceneQ" placeholder="業務シーンを検索" value="' + esc(cfgState.sceneQ || '') + '" /><span class="mag ico i-view"></span></div>'
    + '<button class="btn primary block" id="sceneAdd">+ 業務シーン追加</button>'
    + '</div>'
    + '<div class="type-items">' + (items || '<p class="muted" style="padding:10px">該当なし</p>') + '</div>'
    + '</aside>'
    + (sc ? sceneEditor(sc) : '<section class="type-main scene-empty"></section>')
    + '</div>';
}

/** ① の必須チェック（業務シーン名のみ。データ権限は帳票タイプ側で管理） */
function validateSceneStep1(sc) {
  if (!sc) return false;
  if (!(sc.name || '').trim()) { toast('業務シーン名を入力してください'); return false; }
  return true;
}

/** ② 効果テスト：ファイル投入 → モックの分類結果を生成（原型 createMockClassificationResults） */
function setSceneTestFile(name, size) {
  const sc = byId(BIZ_SCENES, state.sceneId);
  if (!sc) return;
  const forms = (sc.formIds || []).map((id) => byId(CLASSIFY_FORMS, id)).filter(Boolean);
  const src = forms.length ? forms : CLASSIFY_FORMS.slice(0, 3);
  SCENE_TESTS[sc.id] = {
    fileName: name,
    fileSize: typeof fmtSize === 'function' ? fmtSize(size) : '',
    tested: true,
    results: src.map((f, i) => ({
      rank: i + 1, formName: f.name, category: f.category,
      confidence: Number((96 - i * 4.5).toFixed(1)),
    })),
  };
  render();
}

/** 業務シーン設定のイベント */
function bindBizScenes() {
  const q = $('#sceneQ');
  if (q) { q.oninput = () => { cfgState.sceneQ = q.value; }; q.onchange = () => render(); q.onkeydown = (e) => { if (e.key === 'Enter') render(); }; }

  const cur = () => byId(BIZ_SCENES, state.sceneId);
  const ask = (msg) => (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(msg) : true);

  /* ── 左リスト ── */
  document.querySelectorAll('[data-sceneid]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest && e.target.closest('.ti-menu, .ti-more')) return;
      state.sceneId = el.dataset.sceneid; state.sceneStep = 1; state.sceneMenu = null; render();
    };
  });
  document.querySelectorAll('[data-scenemenu]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.scenemenu;
      state.sceneMenu = state.sceneMenu === id ? null : id;
      render();
    };
  });
  document.querySelectorAll('[data-scenerename]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const sc = byId(BIZ_SCENES, b.dataset.scenerename);
      state.sceneMenu = null;
      if (sc) state.sceneRename = { id: sc.id, value: sc.name };
      render();
    };
  });
  document.querySelectorAll('[data-scenedel]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.scenedel;
      const sc = byId(BIZ_SCENES, id);
      if (!ask(`「${sc ? sc.name : id}」を削除しますか？`)) return;
      const i = BIZ_SCENES.findIndex((x) => x.id === id);
      if (i >= 0) BIZ_SCENES.splice(i, 1);
      delete SCENE_TESTS[id];
      if (state.sceneId === id) { state.sceneId = null; state.sceneStep = 1; }
      state.sceneMenu = null;
      render(); toast('業務シーンを削除しました');
    };
  });
  const add = $('#sceneAdd');
  if (add) add.onclick = () => {
    cfgState.sceneQ = '';
    const ns = {
      id: 'cls-' + Date.now(), name: '新規業務シーン',
      sceneId: String(2077224056968261700 + BIZ_SCENES.length + 1),
      desc: '', formIds: [], userIds: [], updatedAt: nowStamp(),
    };
    BIZ_SCENES.unshift(ns);
    state.sceneId = ns.id; state.sceneStep = 1; render();
    toast('業務シーンを追加しました（モック）');
  };
  /* ── ウィザード ── */
  document.querySelectorAll('[data-scenestep]').forEach((b) => {
    b.onclick = () => {
      const next = Number(b.dataset.scenestep);
      if (next > 1 && !validateSceneStep1(cur())) return;
      state.sceneStep = next; render();
    };
  });
  const nx = $('#scNext');
  if (nx) nx.onclick = () => { if (!validateSceneStep1(cur())) return; state.sceneStep = 2; render(); };
  const pv = $('#scPrev');
  if (pv) pv.onclick = () => { state.sceneStep = 1; render(); };
  const cl = $('#scClose');
  if (cl) cl.onclick = () => { state.sceneId = null; state.sceneStep = 1; state.scenePick = false; state.sceneRename = null; render(); };
  const del = $('#scDelete');
  if (del) del.onclick = () => {
    const id = state.sceneId;
    const sc = byId(BIZ_SCENES, id);
    if (!ask(`「${sc ? sc.name : id}」を削除しますか？`)) return;
    const i = BIZ_SCENES.findIndex((x) => x.id === id);
    if (i >= 0) BIZ_SCENES.splice(i, 1);
    delete SCENE_TESTS[id];
    state.sceneId = null; state.sceneStep = 1; render(); toast('業務シーンを削除しました');
  };

  /* ── 帳票追加 ── */
  const at = $('#scAddType');
  if (at) at.onclick = () => { cfgState.pickQ = ''; state.scenePick = true; render(); };
  const closePick = () => { state.scenePick = false; cfgState.pickQ = ''; render(); };
  const pb = $('#scPickBack'); if (pb) pb.onclick = (e) => { if (e.target === pb) closePick(); };
  const pc = $('#scPickClose'); if (pc) pc.onclick = closePick;
  const pca = $('#scPickCancel'); if (pca) pca.onclick = closePick;
  const pq = $('#scPickQ');
  if (pq) { pq.oninput = () => { cfgState.pickQ = pq.value; }; pq.onchange = () => render(); pq.onkeydown = (e) => { if (e.key === 'Enter') render(); }; }
  document.querySelectorAll('[data-pickform]').forEach((b) => {
    b.onclick = () => {
      const sc = cur(); if (!sc) return;
      const ids = sc.formIds || (sc.formIds = []);
      if (ids.length >= MAX_CLASSIFY_FORMS) { toast(`1業務シーンあたり最大${MAX_CLASSIFY_FORMS}種類までです`); return; }
      if (!ids.includes(b.dataset.pickform)) ids.push(b.dataset.pickform);
      state.scenePick = false; cfgState.pickQ = '';
      render(); toast('帳票を追加しました');
    };
  });
  document.querySelectorAll('[data-typedel]').forEach((b) => {
    b.onclick = () => {
      const sc = cur(); if (!sc) return;
      sc.formIds = (sc.formIds || []).filter((x) => x !== b.dataset.typedel);
      render();
    };
  });

  /* ── 名称変更ダイアログ ── */
  const closeRename = () => { state.sceneRename = null; render(); };
  const rb = $('#scRenameBack'); if (rb) rb.onclick = (e) => { if (e.target === rb) closeRename(); };
  const rc = $('#scRenameClose'); if (rc) rc.onclick = closeRename;
  const rca = $('#scRenameCancel'); if (rca) rca.onclick = closeRename;
  const ri = $('#scRenameInput'); if (ri) ri.oninput = () => { state.sceneRename.value = ri.value; };
  const rok = $('#scRenameOk');
  if (rok) rok.onclick = () => {
    const r = state.sceneRename; if (!r) return;
    const el = $('#scRenameInput');
    const v = ((el ? el.value : r.value) || '').trim();
    if (!v) { toast('業務シーン名を入力してください'); return; }
    const sc = byId(BIZ_SCENES, r.id);
    if (sc) { sc.name = v; sc.updatedAt = nowStamp(); }
    state.sceneRename = null; render(); toast('名称を変更しました');
  };

  /* ── ② 効果テスト ── */
  const pf = $('#scPickFile'); const fi = $('#scFile');
  if (pf && fi) pf.onclick = () => fi.click();
  if (fi) fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) setSceneTestFile(f.name, f.size); };
  const drop = $('#scDrop');
  if (drop) {
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => {
      e.preventDefault(); drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setSceneTestFile(f.name, f.size);
    };
  }
  const cf = $('#scClearFile');
  if (cf) cf.onclick = () => { delete SCENE_TESTS[state.sceneId]; render(); };

  /* ── 保存／完成 ── */
  const sv = $('#scSave');
  if (sv) sv.onclick = () => {
    const sc = cur(); if (!sc) return;
    const nm = $('#scName'); const ds = $('#scDesc');
    if (nm) { if (!nm.value.trim()) { toast('業務シーン名を入力してください'); return; } sc.name = nm.value.trim(); }
    if (ds) sc.desc = ds.value;
    sc.updatedAt = nowStamp();
    if ((state.sceneStep || 1) === 1) {
      if (!validateSceneStep1(sc)) return;
      state.sceneStep = 2; render(); toast('保存しました。効果テストへ進みます');
      return;
    }
    state.sceneId = null; state.sceneStep = 1; render(); toast('保存しました');
  };
}

/** 帳票タイプ詳細のステップ（製品：AI分類設定 → AI読取設定 → 処理ルール設定 → 効果テスト） */
const TYPE_STEPS = [
  { no: 1, id: 'classify', label: 'AI分類設定' },
  { no: 2, id: 'ocr', label: 'AI読取設定' },
  { no: 3, id: 'rule', label: '処理ルール設定' },
  { no: 4, id: 'test', label: '効果テスト' },
];

/** 帳票タイプ設定を開く（左リスト＋右 Step1。業務シーン設定と同じ構成） */
function openTicketTypes() {
  const t = byId(TICKET_TYPES, state.typeId) || TICKET_TYPES[0];
  openTicketDetail(t ? t.id : null);
}

/** 帳票タイプを選んで開く（タグ同期。左リスト付き） */
function openTicketDetail(typeId) {
  const t = (typeId && byId(TICKET_TYPES, typeId)) || byId(TICKET_TYPES, state.typeId) || TICKET_TYPES[0];
  if (state.page !== 'ticketDetail' && state.page !== 'ticketTypes') state.typeReturn = state.page;
  if (!isTabOpen('ticketDetail')) state.tabs.push('ticketDetail');
  if (t) state.typeId = t.id;
  state.typeStep = 1;
  state.typeZoom = 1;
  state.typePage = 1;
  state.typeItemMenu = null;
  state.page = 'ticketDetail';
  state.dd = null;
  state.navMenu = null;
  render();
}

/** 業務シーン設定を開く（タグ同期） */
function openBizScenes(sceneId) {
  if (sceneId) state.sceneId = sceneId;
  state.sceneStep = state.sceneStep || 1;
  state.sceneMenu = null;
  openTab('bizScenes');
}


function ensureTypeFields() {
  if (state.typeFields) return state.typeFields;
  state.typeFields = [
    { id: 'tf1', name: '計画書区分', prompt: '出力形式：新規／変更', sample: '', required: true },
    { id: 'tf2', name: '提出日', prompt: '提出日を西暦で抽出', sample: '', required: true },
    { id: 'tf3', name: '宛先1', prompt: '宛先1を抽出', sample: '', required: false },
    { id: 'tf4', name: '住所', prompt: '住所を抽出', sample: '', required: true },
    { id: 'tf5', name: '氏名', prompt: '「殿」の前の宛名を抽出', sample: '', required: true },
    { id: 'tf6', name: '電話番号', prompt: '電話番号を半角で抽出', sample: '', required: false },
    { id: 'tf7', name: 'メールアドレス', prompt: 'メールアドレスを抽出', sample: '', required: false },
    { id: 'tf8', name: '会社名', prompt: '会社名を抽出', sample: '', required: false },
  ];
  return state.typeFields;
}

/** ステップごとの右ペイン内容 */
function typePane(step, t) {
  if (step === 1) {
    const idNum = 2101850553637335041 + TICKET_TYPES.indexOf(t);
    const help = '<span class="ico i-help"></span>';
    const lid = layoutIdOfTicketType(t);
    const cfg = lid ? approvalOf(lid) : { need: true, stages: 1 };
    const p = lid ? permsOf(lid) : { confirm: [], approve: [], reapprove: [] };
    const stage = !cfg.need ? 0 : cfg.stages;
    const stageSeg = [
      { v: 0, label: '承認不要' },
      { v: 1, label: '1段承認' },
      { v: 2, label: '2段承認' },
    ].map((s) =>
      `<button type="button" class="wiz-seg-btn ${stage === s.v ? 'on' : ''}" data-tp-stage="${s.v}" ${lid ? '' : 'disabled'}>${s.label}</button>`
    ).join('');
    /* ワークフロー編集の権限があるときだけ、承認フロー／担当の設定を出す（serve.py 注入） */
function canEditWorkflow_() {
  return (typeof window !== 'undefined' && window.__demoPerm && window.__demoPerm.menu && window.__demoPerm.menu.canReach)
    ? window.__demoPerm.menu.canReach('settings-type-workflow')
    : true;
}
    const flowBlock = [
      '<div class="wiz-field"><span class="wl req">承認フロー</span>',
      '<div class="wiz-seg" role="radiogroup" aria-label="承認フロー">' + stageSeg + '</div>',
      '<p class="wiz-hint">帳票タイプごとに承認段数を決めます。2段のときだけ再承認担当を設定します。</p></div>',
      /* 確認・承認の担当：権限者（ロール）またはユーザー。権限者はランダム割当 */
      '<div class="wiz-field"><span class="wl req">確認担当</span>',
      '<div class="wiz-users" data-tp-act="confirm">' + typeAssigneeChips('confirm', p.confirm) + '</div></div>',
      stage >= 1
        ? ('<div class="wiz-field"><span class="wl req">承認担当（1段目）</span>'
          + '<div class="wiz-users" data-tp-act="approve">' + typeAssigneeChips('approve', p.approve) + '</div></div>')
        : '',
      stage >= 2
        ? ('<div class="wiz-field"><span class="wl req">再承認担当</span>'
          + '<div class="wiz-users" data-tp-act="reapprove">' + typeAssigneeChips('reapprove', p.reapprove) + '</div></div>')
        : '',
    ].join('');
    return [
      '<div class="wiz-field"><span class="wl">帳票タイプ ID</span><div class="wv code">' + idNum + '</div></div>',
      '<label class="wiz-field"><span class="wl req">帳票名</span><input class="fld w100" id="tpName" value="' + esc(t.name) + '" /></label>',
      '<label class="wiz-field"><span class="wl">自動のグループ基準 ' + help + '</span>',
      '<input class="fld w100" id="tpGroup" placeholder="グループの基準を入力してください（例：ページ番号、申請書番号、日付など）" value="' + esc(t.groupKey || '') + '" /></label>',
      '<label class="wiz-field"><span class="wl">説明文 ' + help + '</span>',
      '<div class="wiz-textarea">',
      '<textarea class="fld w100" id="tpDesc" rows="5" maxlength="200" placeholder="説明文を入力してください">' + esc(t.desc || '') + '</textarea>',
      '<div class="wiz-ta-actions">',
      '<span class="wiz-count"><span id="tpCount">' + (t.desc || '').length + '</span> / 200</span>',
      '<button type="button" class="fab" id="tpDescAi" title="AIで説明文を生成"><span class="ico i-scan"></span></button>',
      '<button type="button" class="fab plain" id="tpDescClear" title="クリア"><span class="ico i-delete"></span></button>',
      '</div></div></label>',
    ].join('');
  }
  if (step === 2) {
    const fields = ensureTypeFields();
    const tab = state.typeReadTab === 'table' ? 'table' : 'text';
    const prompt = state.typePrompt || '';
    const menu = state.typeMenu;
    const tplMenu = menu === 'tpl'
      ? `<div class="tp2-menu" data-tpmenu="tpl">
          <button type="button" data-tpact="dl-tpl">テンプレートをダウンロード</button>
          <button type="button" data-tpact="dl-bulk">一括ダウンロード</button>
          <button type="button" data-tpact="import-bulk">一括インポート</button>
        </div>` : '';
    const gearMenu = menu === 'gear'
      ? `<div class="tp2-menu" data-tpmenu="gear">
          <button type="button" data-tpact="export-cfg">エクスポート設定</button>
          <button type="button" data-tpact="model-cfg">読取モデル設定</button>
        </div>` : '';
    const rows = fields.map((f, i) => `<tr>
        <td class="tp2-no">${i + 1}</td>
        <td><input class="fld tp2-in" data-tpf="${f.id}" data-k="name" value="${esc(f.name)}" /></td>
        <td><input class="fld tp2-in" data-tpf="${f.id}" data-k="prompt" value="${esc(f.prompt)}" /></td>
        <td><input class="fld tp2-in" data-tpf="${f.id}" data-k="sample" placeholder="正解サンプルを入力してください" value="${esc(f.sample || '')}" /></td>
        <td class="tp2-req"><label class="switch sm"><input type="checkbox" data-tpf="${f.id}" data-k="required" ${f.required ? 'checked' : ''} /><span></span></label></td>
        <td class="tp2-ops"><button type="button" class="icon-btn" data-tpdel="${f.id}" title="削除"><span class="ico i-delete"></span></button><span class="tp2-drag" title="並び替え">☰</span></td>
      </tr>`).join('');
    const tableBody = fields.length
      ? `<div class="tp2-tablewrap"><table class="tp2-table">
          <thead><tr><th>番号</th><th>項目名</th><th>プロンプト</th><th>正解サンプル</th><th>必須項目</th><th>操作・処理</th></tr></thead>
          <tbody>${rows}</tbody></table></div>`
      : `<div class="tp2-empty"><span class="ico i-multi"></span><p>データなしです。項目を追加した後また確認してください</p></div>`;
    return `<div class="tp2-pane">
      <div class="tp2-head">
        <div class="tp2-tabs">
          <button type="button" class="tp2-tab ${tab === 'text' ? 'on' : ''}" data-tpread="text">テキスト読取</button>
          <button type="button" class="tp2-tab ${tab === 'table' ? 'on' : ''}" data-tpread="table">テーブル情報読取</button>
        </div>
        <div class="tp2-tools">
          <button type="button" class="btn primary sm" data-tpai="1"><span class="ico i-scan"></span>AI自動生成</button>
          <div class="tp2-icon-wrap">
            <button type="button" class="icon-btn ${menu === 'tpl' ? 'on' : ''}" data-tpmenu-toggle="tpl" title="テンプレート"><span class="ico i-file"></span></button>
            ${tplMenu}
          </div>
          <div class="tp2-icon-wrap">
            <button type="button" class="icon-btn ${menu === 'gear' ? 'on' : ''}" data-tpmenu-toggle="gear" title="設定"><span class="ico i-setting"></span></button>
            ${gearMenu}
          </div>
        </div>
      </div>
      ${tab === 'text' ? `
      <div class="tp2-prompt-wrap">
        <textarea class="fld w100 tp2-prompt" id="tpGlobalPrompt" rows="3" maxlength="2000" placeholder="ここに全体の背景と共通ルールを入力してください（例：一般的な請求書です。原文のまま抽出し、内容を捏造しないでください）。特定の項目に対する抽出ルールは、下記のリストに入力してください">${esc(prompt)}</textarea>
        <!-- 入力欄の中に左右の丸ボタン（左＝ペン、右＝クリア） -->
        <button type="button" class="fab pen" id="tpPromptAi" title="プロンプトをAI生成"><span class="ico i-edit"></span></button>
        <button type="button" class="fab plain" id="tpPromptClear" title="クリア"><span class="ico i-delete"></span></button>
        <div class="tp2-prompt-meta"><span id="tpPromptCount">${prompt.length}</span> / 2000</div>
      </div>
      ${tableBody}
      <button type="button" class="btn sm tp2-add" data-tpadd="1">+ 項目追加（${fields.length}/100）</button>
      ` : `<div class="tp2-empty tall"><p>テーブル情報読取の詳細設定は Demo ではプレースホルダーです。<br />タブ切替のみ動作します。</p></div>`}
    </div>`;
  }
  if (step === 3) {
    return '<div class="wiz-empty"><p class="wiz-empty-title">処理ルール設定</p>'
      + '<p class="muted">読取後の値の変換・突合・出力ルールを設定します。</p>'
      + '<table class="wiz-table"><thead><tr><th>ルール</th><th>対象項目</th><th>内容</th></tr></thead><tbody>'
      + '<tr><td>辞書突合</td><td><code>address</code></td><td>市町村名辞書で正規化</td></tr>'
      + '<tr><td>日付正規化</td><td><code>birthday</code></td><td>和暦 → 西暦（YYYY-MM-DD）</td></tr>'
      + '<tr><td>必須チェック</td><td><code>name</code></td><td>空の場合は「要確認」にする</td></tr>'
      + '</tbody></table></div>';
  }
  return '<div class="wiz-empty"><p class="wiz-empty-title">効果テスト</p>'
    + '<p class="muted">テスト帳票で分類・読取の精度を確認します。</p>'
    + '<table class="wiz-table"><thead><tr><th>項目</th><th>正解</th><th>読取結果</th><th>判定</th></tr></thead><tbody>'
    + '<tr><td>氏名</td><td>山田 太郎</td><td>山田 太郎</td><td><span class="st ok"><span class="dot"></span>一致</span></td></tr>'
    + '<tr><td>住所</td><td>千代田区…</td><td>千代田区…</td><td><span class="st ok"><span class="dot"></span>一致</span></td></tr>'
    + '<tr><td>生年月日</td><td>1985-04-02</td><td>1985-04-02</td><td><span class="st ok"><span class="dot"></span>一致</span></td></tr>'
    + '</tbody></table><p class="wiz-score">精度：<b>98.2%</b>（サンプル 120 件）</p></div>';
}

/** 帳票タイプ設定（左：タイプ一覧／右：選択中の Step1〜4） */
function renderTicketDetail() {
  if (!state.typeStep) state.typeStep = 1;
  if (!state.typePage) state.typePage = 1;
  if (!state.typeZoom) state.typeZoom = 1;
  const q = (cfgState.ticketQ || '').toLowerCase();
  const list = TICKET_TYPES.filter((x) => !q || x.name.toLowerCase().includes(q));
  let t = byId(TICKET_TYPES, state.typeId);
  if (!t && list[0]) { state.typeId = list[0].id; t = list[0]; }
  const items = list.map((x) => {
    const open = state.typeItemMenu === x.id;
    return '<div class="type-item ' + (t && t.id === x.id ? 'on' : '') + '" data-typeid="' + x.id + '">'
      + '<span class="ti-name" title="' + esc(x.name) + '">' + esc(x.name) + '</span>'
      + '<button type="button" class="ti-more" data-typemenu="' + x.id + '" title="メニュー"><span class="ico i-more"></span></button>'
      + (open ? '<div class="ti-menu">'
        + '<button type="button" data-typerename="' + x.id + '">名称変更</button>'
        + '<button type="button" class="danger" data-typedel="' + x.id + '">削除</button>'
        + '</div>' : '')
      + '</div>';
  }).join('');

  const leftList = '<aside class="type-list">'
    + '<h2 class="type-list-title">帳票設定-タイプ</h2>'
    + '<div class="type-list-tools">'
    + '<div class="type-search search-wrap"><input id="typeQ" placeholder="タイプを検索" value="' + esc(cfgState.ticketQ || '') + '" /><span class="mag ico i-view"></span></div>'
    + '<button class="btn primary block" id="typeAdd" data-cfg="addType">+ タイプ追加</button>'
    + '</div>'
    + '<div class="type-items">' + (items || '<p class="muted" style="padding:10px">該当なし</p>') + '</div>'
    + '</aside>';

  if (!t) {
    return '<div class="typedetail">' + leftList
      + '<section class="type-main scene-empty"><p class="muted center" style="padding:40px">タイプを選択または追加してください</p></section></div>';
  }

  const step = state.typeStep;
  const stepBar = '<div class="wiz">' + TYPE_STEPS.map((st) =>
    '<button class="wiz-step ' + (step === st.no ? 'on' : '') + ' ' + (step > st.no ? 'done' : '') + '" data-typestep="' + st.no + '">'
    + '<span class="wiz-no">' + st.no + '</span><span class="wiz-label">' + st.label + '</span></button>'
    + (st.no < 4 ? '<span class="wiz-line ' + (step > st.no ? 'on' : '') + '"></span>' : '')).join('')
    + '<button class="icon-btn wiz-full" title="全画面表示"><span class="ico i-multi"></span></button></div>';

  const zoomBar = '<div class="wiz-tools">'
    + '<button class="icon-btn" id="tpFit" title="幅に合わせる"><span class="ico i-multi"></span></button>'
    + '<button class="icon-btn" id="tpRotL" title="左に回転"><span class="ico i-reset"></span></button>'
    + '<button class="icon-btn" id="tpRotR" title="右に回転"><span class="ico i-refresh"></span></button>'
    + '<button class="icon-btn" id="tpZoomIn" title="拡大"><span class="ico i-zoom-in"></span></button>'
    + '<button class="icon-btn" id="tpZoomOut" title="縮小"><span class="ico i-zoom-out"></span></button></div>';

  const preview = '<div class="wiz-preview"><div class="wiz-canvas">'
    + '<button class="wiz-nav left" id="tpPrev" title="前のページ">‹</button>'
    + '<div class="wiz-sheet" style="transform:scale(' + state.typeZoom + ')">' + mockSheet(state.typePage, 3, layoutIdOfTicketType(t)) + '</div>'
    + '<button class="wiz-nav right" id="tpNext" title="次のページ">›</button></div>'
    + '<div class="wiz-pager"><b>' + state.typePage + '</b><span>/ 3</span></div></div>';

  return '<div class="typedetail">'
    + leftList
    + '<section class="type-main">' + stepBar + zoomBar
    + '<div class="wiz-body">' + preview + '<div class="wiz-pane">' + typePane(step, t) + '</div></div>'
    + '<div class="wiz-foot">'
    + (step === 1 ? '<button class="btn primary" id="tpReupload"><span class="ico i-upload"></span>再アップロード</button>' : '')
    + '<span class="spacer"></span>'
    + '<button class="btn" id="tpClose">閉じる</button>'
    + '<button class="btn" id="tpPrevStep"' + (step <= 1 ? ' disabled' : '') + '>前へ</button>'
    + '<button class="btn" id="tpNextStep"' + (step >= 4 ? ' disabled' : '') + '>次へ</button>'
    + '<button class="btn primary" id="tpSave">保存</button>'
    + '</div></section></div>';
}

/** 帳票タイプ詳細のイベント */
function bindTicketDetail() {
  const q = $('#typeQ');
  if (q) {
    q.oninput = () => { cfgState.ticketQ = q.value; };
    q.onchange = () => render();
    q.onkeydown = (e) => { if (e.key === 'Enter') render(); };
  }
  document.querySelectorAll('[data-typeid]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest && e.target.closest('.ti-menu, .ti-more')) return;
      state.typeId = el.dataset.typeid;
      state.typeStep = 1;
      state.typeItemMenu = null;
      state.typePage = 1;
      state.typeZoom = 1;
      render();
    };
  });
  document.querySelectorAll('[data-typemenu]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.typemenu;
      state.typeItemMenu = state.typeItemMenu === id ? null : id;
      render();
    };
  });
  document.querySelectorAll('[data-typerename]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const t = byId(TICKET_TYPES, b.dataset.typerename);
      state.typeItemMenu = null;
      if (!t) return;
      const name = (typeof window !== 'undefined' && window.prompt) ? window.prompt('帳票タイプ名', t.name) : t.name;
      if (name && name.trim()) { t.name = name.trim(); t.updatedAt = nowStamp(); toast('名称を変更しました'); }
      render();
    };
  });
  document.querySelectorAll('[data-typedel]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.typedel;
      const ask = (typeof window !== 'undefined' && typeof window.confirm === 'function') ? window.confirm('この帳票タイプを削除しますか？') : true;
      if (!ask) return;
      const i = TICKET_TYPES.findIndex((x) => x.id === id);
      if (i >= 0) TICKET_TYPES.splice(i, 1);
      if (state.typeId === id) state.typeId = (TICKET_TYPES[0] && TICKET_TYPES[0].id) || null;
      state.typeItemMenu = null;
      toast('削除しました');
      render();
    };
  });
  document.querySelectorAll('[data-typestep]').forEach((b) => {
    b.onclick = () => { state.typeStep = Number(b.dataset.typestep); render(); };
  });
  const nx = $('#tpNextStep'); if (nx) nx.onclick = () => { state.typeStep = Math.min(4, state.typeStep + 1); state.typeMenu = null; render(); };
  const pvStep = $('#tpPrevStep'); if (pvStep) pvStep.onclick = () => { state.typeStep = Math.max(1, state.typeStep - 1); state.typeMenu = null; render(); };
  const cl = $('#tpClose'); if (cl) cl.onclick = () => {
    if (isTabOpen('ticketDetail')) closeTab('ticketDetail');
    else { state.page = state.typeReturn || 'home'; render(); }
  };
  const zi = $('#tpZoomIn'); if (zi) zi.onclick = () => { state.typeZoom = Math.min(2, state.typeZoom + 0.15); render(); };
  const zo = $('#tpZoomOut'); if (zo) zo.onclick = () => { state.typeZoom = Math.max(0.5, state.typeZoom - 0.15); render(); };
  const ft = $('#tpFit'); if (ft) ft.onclick = () => { state.typeZoom = 1; render(); };
  const pv = $('#tpPrev'); if (pv) pv.onclick = () => { state.typePage = Math.max(1, state.typePage - 1); render(); };
  const nxt = $('#tpNext'); if (nxt) nxt.onclick = () => { state.typePage = Math.min(3, state.typePage + 1); render(); };
  const ru = $('#tpReupload'); if (ru) ru.onclick = () => toast('サンプル帳票を再アップロードします（モック）');
  const sv = $('#tpSave'); if (sv) sv.onclick = () => {
    const t = byId(TICKET_TYPES, state.typeId);
    const nm = $('#tpName'); const ds = $('#tpDesc'); const gk = $('#tpGroup');
    if (nm && nm.value.trim()) t.name = nm.value.trim();
    if (ds) t.desc = ds.value;
    if (gk) t.groupKey = gk.value;
    toast('帳票タイプを保存しました');
    render();
  };
  const ds = $('#tpDesc');
  if (ds) ds.oninput = () => { const c = $('#tpCount'); if (c) c.textContent = ds.value.length; };
  const descAi = $('#tpDescAi');
  if (descAi) descAi.onclick = (e) => {
    e.preventDefault();
    const t = byId(TICKET_TYPES, state.typeId);
    const sample = `${t.name}の自動分類・読取に用いる説明文です。申請内容の要点を簡潔に記載してください。`;
    t.desc = sample.slice(0, 200);
    render();
    toast('説明文を生成しました（モック）');
  };
  const descClear = $('#tpDescClear');
  if (descClear) descClear.onclick = (e) => {
    e.preventDefault();
    const t = byId(TICKET_TYPES, state.typeId);
    t.desc = '';
    render();
  };
  /* 承認フロー段数（説明文の下） */
  document.querySelectorAll('[data-cat-stage-input]').forEach((el) => {
      el.onchange = () => { setCatStages(state.typeId, el.value); render(); };
    });
    document.querySelectorAll('[data-tp-stage]').forEach((b) => {
    b.onclick = () => {
      const t = byId(TICKET_TYPES, state.typeId);
      const lid = layoutIdOfTicketType(t);
      if (!lid) return;
      if (!TICKET_PERMS[lid]) TICKET_PERMS[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
      const p = TICKET_PERMS[lid];
      const v = Number(b.dataset.tpStage);
      if (v === 0) {
        p.approve = [];
        p.reapprove = [];
      } else if (v === 1) {
        if (!p.approve.length) p.approve = [state.currentUser || 'u1'];
        p.reapprove = [];
      } else {
        if (!p.approve.length) p.approve = [state.currentUser || 'u1'];
        if (!p.reapprove.length) {
          const other = USERS.map((u) => u.id).find((id) => !p.approve.includes(id));
          p.reapprove = [other || p.approve[0]];
        }
      }
      render();
    };
  });
  /* フロー担当：药丸で権限者／ユーザーを切替え（同時選択不可） */
  document.querySelectorAll('[data-asg-mode]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const [act, mode] = (b.dataset.asgMode || '').split(':');
      if (!act || !mode) return;
      const t = byId(TICKET_TYPES, state.typeId);
      const lid = layoutIdOfTicketType(t);
      if (!lid) return;
      if (!TICKET_PERMS[lid]) TICKET_PERMS[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
      const list = TICKET_PERMS[lid][act] || [];
      const curMode = assigneeModeOf(act, list);
      state.asgMode = { ...(state.asgMode || {}), [act]: mode };
      if (curMode !== mode) {
        /* モード切替時は反対側の選択をクリア */
        TICKET_PERMS[lid][act] = [];
      }
      render();
    };
  });
  const toggleAssignee = (act, id) => {
    const t = byId(TICKET_TYPES, state.typeId);
    const lid = layoutIdOfTicketType(t);
    if (!lid) return;
    if (!TICKET_PERMS[lid]) TICKET_PERMS[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
    if (!['confirm', 'approve', 'reapprove'].includes(act)) return;
    const list = TICKET_PERMS[lid][act] || (TICKET_PERMS[lid][act] = []);
    const i2 = list.indexOf(id);
    if (i2 >= 0) {
      if (act === 'approve' && list.length <= 1) { toast('承認担当は1名以上必要です'); return; }
      list.splice(i2, 1);
    } else if (byId(USERS, id)) {
      /* ユーザー選択 → 権限者側を全部外し、ユーザーは単選 */
      TICKET_PERMS[lid][act] = [id];
      state.asgMode = { ...(state.asgMode || {}), [act]: 'user' };
    } else {
      /* 権限者選択 → ユーザー側を全部外し、権限者は複数可 */
      const rolesOnly = list.filter((x) => byId(ROLES, x));
      if (!rolesOnly.includes(id)) rolesOnly.push(id);
      TICKET_PERMS[lid][act] = rolesOnly;
      state.asgMode = { ...(state.asgMode || {}), [act]: 'role' };
    }
    render();
  };
  document.querySelectorAll('[data-tp-assignee-opt],[data-tp-assignee-rm]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const raw = b.dataset.tpAssigneeOpt || b.dataset.tpAssigneeRm || '';
      const parts = raw.split(':');
      toggleAssignee(parts[0], parts[1]);
    };
  });
  document.querySelectorAll('[data-tp-assignee]').forEach((b) => {
    b.onclick = () => {
      const raw = b.dataset.tpAssignee || '';
      const parts = raw.split(':');
      toggleAssignee(parts[0], parts[1]);
    };
  });
  /* AI読取設定（ステップ2） */
  document.querySelectorAll('[data-tpread]').forEach((b) => {
    b.onclick = () => { state.typeReadTab = b.dataset.tpread; state.typeMenu = null; render(); };
  });
  const tpai = document.querySelector('[data-tpai]');
  if (tpai) tpai.onclick = () => {
    const fields = ensureTypeFields();
    if (fields.length >= 100) { toast('項目は最大100件です'); return; }
    fields.push({ id: 'tf' + Date.now(), name: '緊急連絡先', prompt: '氏名と電話番号を抽出する', sample: '', required: false });
    fields.push({ id: 'tf' + (Date.now() + 1), name: 'メールアドレス', prompt: '半角英数字で抽出する', sample: '', required: false });
    toast('AI自動生成しました（Demo）');
    render();
  };
  document.querySelectorAll('[data-tpmenu-toggle]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const k = b.dataset.tpmenuToggle;
      state.typeMenu = state.typeMenu === k ? null : k;
      render();
    };
  });
  document.querySelectorAll('[data-tpact]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const act = b.dataset.tpact;
      state.typeMenu = null;
      if (act === 'export-cfg') {
        const saved = loadExportCfg();
        if (saved) state.exportCfg = Object.assign({}, state.exportCfg, saved);
        /* キャンセルで戻せるように、開いた時点の設定を控えておく */
        state.exportCfgSnapshot = Object.assign({}, state.exportCfg);
        state.exportOpen = true; render(); toast('エクスポート設定を開きました（帳票タイプのフィールドマッピング）'); return;
      }
      const msgs = {
        'dl-tpl': 'テンプレートをダウンロードしました（Demo）',
        'dl-bulk': '一括ダウンロードを開始しました（Demo）',
        'import-bulk': '一括インポート（Demo）',
        'model-cfg': '読取モデル設定（Demo）',
      };
      render();
      toast(msgs[act] || act);
    };
  });
  const gp = $('#tpGlobalPrompt');
  if (gp) {
    gp.oninput = () => {
      state.typePrompt = gp.value;
      const c = $('#tpPromptCount'); if (c) c.textContent = gp.value.length;
    };
  }
  const tpPromptAi = $('#tpPromptAi');
  if (tpPromptAi) tpPromptAi.onclick = () => {
    state.typePrompt = '空白文字列抽出ルール：内容が見つからない、または曖昧な場合は "" を出力してください。';
    render();
    toast('共通プロンプトを生成しました（Demo）');
  };
  const tpPromptClear = $('#tpPromptClear');
  if (tpPromptClear) tpPromptClear.onclick = () => {
    state.typePrompt = '';
    render();
  };
  document.querySelectorAll('[data-tpf]').forEach((el) => {
    const apply = () => {
      const f = ensureTypeFields().find((x) => x.id === el.dataset.tpf);
      if (!f) return;
      const k = el.dataset.k;
      f[k] = el.type === 'checkbox' ? el.checked : el.value;
    };
    el.onchange = apply;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') el.oninput = apply;
  });
  document.querySelectorAll('[data-tpdel]').forEach((b) => {
    b.onclick = () => {
      state.typeFields = ensureTypeFields().filter((x) => x.id !== b.dataset.tpdel);
      render();
    };
  });
  const tpadd = document.querySelector('[data-tpadd]');
  if (tpadd) tpadd.onclick = () => {
    const fields = ensureTypeFields();
    if (fields.length >= 100) { toast('項目は最大100件です'); return; }
    fields.push({ id: 'tf' + Date.now(), name: '項目' + (fields.length + 1), prompt: '', sample: '', required: false });
    render();
  };
  document.querySelectorAll('[data-expcfg]').forEach((el) => {
    el.onchange = () => {
      const k = el.dataset.expcfg;
      state.exportCfg[k] = el.type === 'checkbox' ? el.checked : el.value;
      render();
    };
  });
}

/** 権限の割り当て先を小さなチップで表示（ユーザー＝グレー／ロール＝緑） */
function permChips(list) {
  if (!list || !list.length) return '<span class="perm-empty">—</span>';
  return list.map((id) => `<span class="perm-chip ${permTargetKind(id)}">${esc(permTargetName(id))}</span>`).join('');
}

/** 帳票権限管理：上＝帳票タイプ×4操作、下＝業務シーン×アップロード */
function renderPermissions() {
  const rows = LAYOUT.map((l, i) => {
    const p = permsOf(l.id);
    const cat = catOf(l.id) || {};
    return `<tr>
      <td class="roles-no no is-sticky">${i + 1}</td>
      <td class="is-sticky"><div class="pt-name">${esc(dispLayout(l.id))}</div><div class="pt-sub">${esc(dispBiz(cat.business))} ／ ${esc(dispCat(cat.id))}</div></td>
      ${permCellsOf(l)}
      <td class="acts"><button class="act-text" data-permclear="${l.id}">クリア</button></td>
    </tr>`;
  }).join('');

  const upRows = BUSINESS.slice().sort((a, b) => a.order - b.order).map((b, i) => {
    const targets = uploadPermsOf(b.id);
    return `<tr>
      <td class="roles-no">${i + 1}</td>
      <td>${esc(dispBiz(b.id))}</td>
      <td class="permcell"><button type="button" class="perm-cell" data-uploadcell="${b.id}" title="アップロード：${esc(targets.map(permTargetName).join('、') || '未設定')}">${permChips(targets)}</button></td>
      <td><div class="acts"><button class="act-text" data-uploadclear="${b.id}">クリア</button></div></td>
    </tr>`;
  }).join('');

  /* 上表：帳票タイプ単位で「閲覧→確認→承認→再承認」。下表：業務シーン単位のアップロード。
   * セルクリックで編集。メニュー権限とは別テーブル。 */
  return `${cfgHeader('帳票権限管理', '')}
  <h3 class="cfg-sub">帳票タイプ権限（帳票タイプ × 操作）</h3>
  <div class="tablewrap"><table class="perm-matrix">
    <thead><tr><th class="is-sticky" style="width:64px">番号</th><th class="is-sticky" style="width:300px;left:64px">帳票タイプ</th>
      ${permHeadOf()}
      <th class="acts" style="width:90px">操作</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7" class="empty-cell">データなし</td></tr>'}</tbody></table></div>
  <h3 class="cfg-sub">アップロード権限（業務シーン単位）</h3>
  <p class="muted cfg-note">新規アップロード画面で選べる業務シーンは、ここに割り当てたグループ／ユーザーに限定されます。<b>システム管理者</b>（権限設定の R1）は表の割当に依らず全業務シーンへアップロードできます。</p>
  <div class="tablewrap"><table>
    <thead><tr><th style="width:60px">番号</th><th>業務シーン</th>
      <th style="width:280px">アップロード</th>
      <th style="width:90px;text-align:right">操作</th></tr></thead>
    <tbody>${upRows || '<tr><td colspan="4" class="empty-cell">データなし</td></tr>'}</tbody></table></div>
  ${permCellDialog()}`;
}

/** 帳票／アップロード権限のセル編集ダイアログ（グループ／ユーザーは药丸で切替え） */
function permCellDialog() {
  const c = state.permCell;
  if (!c) return '';
  const isUpload = c.kind === 'upload';
  const cur = permTargetsForCell(c);
  let mode = c.mode || assigneeModeOf(isUpload ? 'confirm' : c.act, cur);
  if (mode === 'role') mode = 'group'; /* 旧データ互換 */
  c.mode = mode;
  const actLabel = isUpload ? 'アップロード' : permActLabel(c.act);
  const actHint = isUpload ? 'この業務シーンへファイルをアップロードできる' : permActHint(c.act);
  const targetLabel = isUpload ? '業務シーン' : '帳票タイプ';
  const targetName = isUpload ? dispBiz(c.bizId) : dispLayout(c.layoutId);
  const title = isUpload ? 'アップロード権限の設定' : '帳票権限の設定';
  const groupPicks = GROUPS.map((o) =>
    `<label class="perm-pick"><input type="checkbox" class="cb" data-permpick="g:${o.id}" ${cur.includes(o.id) ? 'checked' : ''} /><span>${esc(o.name)}</span><span class="perm-pick-sub">${esc(o.kind)} ・ ${esc(assigneeUserNames(o.userIds))}</span></label>`
  ).join('');
  /* ユーザーは単選（radio）。未選択も可（もう一度クリックで外すのは bind 側）。 */
  const userPicks = USERS.map((o) =>
    `<label class="perm-pick"><input type="radio" class="cb" name="permUserPick" data-permpick="u:${o.id}" ${cur.includes(o.id) ? 'checked' : ''} /><span>${esc(o.name)}</span></label>`
  ).join('');
  return `<div class="modal-back" id="permCellBack"><div class="modal perm-modal pc-modal">
    <div class="modal-head"><b>${esc(title)}</b><span class="spacer"></span><button class="icon-btn" id="permCellClose"><span class="ico i-close"></span></button></div>
    <div class="perm-body">
      <div class="perm-target">
        <span class="pt-l"><span class="pt-k">${esc(targetLabel)}</span><b>${esc(targetName)}</b></span>
        <span class="pt-l"><span class="pt-k">業務操作</span><b class="accent">${esc(actLabel)}</b><span class="pt-hint">${esc(actHint)}</span></span>
      </div>
      <div class="asg-mode-pills perm-mode-pills" role="tablist" aria-label="権限の種類">
        <button type="button" class="asg-mode-pill${mode === 'group' ? ' on' : ''}" data-perm-mode="group" role="tab" aria-selected="${mode === 'group'}">グループ</button>
        <button type="button" class="asg-mode-pill${mode === 'user' ? ' on' : ''}" data-perm-mode="user" role="tab" aria-selected="${mode === 'user'}">ユーザー</button>
      </div>
      <div class="perm-pick-cols one">
        ${mode === 'user'
          ? `<div class="perm-pick-col"><p class="ppc-h">ユーザー（単選）</p>${userPicks}</div>`
          : `<div class="perm-pick-col"><p class="ppc-h">グループ（複数可）</p>${groupPicks}</div>`}
      </div>
    </div>
    <div class="modal-foot"><span class="muted">${esc(targetName)} ／ ${esc(actLabel)}</span><span class="spacer"></span><button class="btn" id="permCellCancel">キャンセル</button><button class="btn primary" id="permCellOk">OK</button></div>
  </div></div>`;
}


/* ===================== 5-c. ホーム（ご利用履歴） ===================== */

function historyRows() {
  const F = state.hFilters;
  const inRange = (v) => {
    if (!F.from && !F.to) return true;
    const d = day(v);
    if (F.from && d < F.from) return false;
    if (F.to && d > F.to) return false;
    return true;
  };
  const multi = (sel, val) => !sel || sel.length === 0 || sel.includes(val);
  const uq = (F.user || '').trim().toLowerCase();
  return HISTORY.filter((h) => inRange(h.startedAt)
    && multi(F.layout, h.layout)
    && multi(F.biz, h.biz)
    && (!uq || String(h.user || '').toLowerCase().includes(uq)));
}

function renderHome() {
  const F = state.hFilters;
  const rows = historyRows();
  const pages = Math.max(1, Math.ceil(rows.length / state.hPerPage));
  if (state.hPage > pages) state.hPage = pages;
  const view = rows.slice((state.hPage - 1) * state.hPerPage, state.hPage * state.hPerPage);
  const layouts = LAYOUT.map((l) => [l.id, dispLayout(l.id)]);
  const bizOpts = BUSINESS.map((b) => [b.id, b.name]);

  const body = view.length === 0
    ? '<tr><td colspan="8" class="empty-cell">データなし</td></tr>'
    : view.map((h) => `<tr>
      <td style="color:var(--text-2)">${h.no}</td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(h.reqId)}</td>
      <td><span class="type-pill" title="${esc(dispLayout(h.layout))}">${esc(dispLayout(h.layout))}</span></td>
      <td style="white-space:nowrap">${esc(h.call)}</td>
      <td style="white-space:nowrap">${h.pages}</td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(h.startedAt)}</td>
      <td style="white-space:nowrap;color:var(--text-2)">${esc(h.updatedAt)}</td>
      <td style="white-space:nowrap">${esc(h.user)}</td>
    </tr>`).join('');

  const pagesHtml = [];
  const set = new Set([1, 2, 3, 4, 5, 6, pages, state.hPage - 1, state.hPage, state.hPage + 1]);
  const list = [...set].filter((x) => x >= 1 && x <= pages).sort((a, b) => a - b);
  let prev = 0;
  list.forEach((x) => {
    if (x - prev > 1) pagesHtml.push('<span style="color:var(--text-3)">…</span>');
    pagesHtml.push(`<button class="pg ${x === state.hPage ? 'on' : ''}" data-hpage="${x}">${x}</button>`);
    prev = x;
  });

  return `
  <div class="homepanel">
    <div class="section-tab">ご利用履歴</div>
    <div class="homefilter">
      <div class="home-filter-row">
        <div class="home-field">
          <span class="lbl">期間</span>
          <div class="home-date-range">
            <span class="ico i-calendar" aria-hidden="true"></span>
            <input type="date" id="hFrom" aria-label="期間 開始" value="${esc(F.from)}" />
            <span class="range-sep">-</span>
            <input type="date" id="hTo" aria-label="期間 終了" value="${esc(F.to)}" />
      </div>
        </div>
        <div class="home-field">
          <span class="lbl">帳票タイプ</span>
          ${hmselect('hLayout', '選択してください', layouts, F.layout)}
        </div>
        <div class="home-field">
          <span class="lbl">ユーザー</span>
          <input class="fld" id="hUser" placeholder="入力してください" value="${esc(F.user || '')}" />
        </div>
        <div class="home-field">
        </div>
        <div class="home-field">
          <span class="lbl">業務シーン</span>
          ${hmselect('hBiz', '選択してください', bizOpts, F.biz)}
        </div>
        <div class="home-filter-actions">
          <button class="btn primary" id="hSearch"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
        <button class="btn" id="hReset" ${hasHomeFilters() ? '' : 'disabled'}><span class="ico i-refresh"></span>リセット</button>
      </div>
      </div>
    </div>
  </div>

  <div class="upload-actions" style="margin-top:14px">
    <button class="btn dl-btn" id="hDownload"><span class="ico i-export"></span>ダウンロード</button>
    <span class="up-note"><span class="info-i">i</span>最大2万件ファイルのダウンロードが可能</span>
    ${hasHomeFilters() ? `<button class="link" id="hClearAll">条件をすべて解除</button>` : ''}
  </div>

  <div class="tablewrap">
    <table>
      <thead><tr>
        <th style="width:5%">番号</th><th style="width:14%">リクエストID</th><th style="width:27%">帳票タイプ</th><th style="width:8%">呼び出し方法</th>
        <th style="width:6%">ページ数</th><th style="width:12%">開始日時</th><th style="width:12%">更新日時</th><th style="width:16%">ユーザー</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
  <div class="pager">
    <span>検索結果 <b>${rows.length}</b> 件中</span>
    <select data-hper>${[10, 20, 50, 100].map((n) => `<option ${n === state.hPerPage ? 'selected' : ''}>${n}件ずつ</option>`).join('')}</select>
    <span class="pages">${pagesHtml.join('')}</span>
    <input class="pginput" data-hgoto value="${state.hPage}" /> <span>ページへ</span>
  </div>`;
}

/** 検索実行（結果件数をフィードバックし、押下が効いたことを可視化する） */
function runSearch(kind) {
  if (kind === 'home') {
    state.hPage = 1;
    render();
    const n = historyRows().length;
    toast(`検索しました：${n} 件が該当しました`);
  } else {
    state.resultPage = 1;
    render();
    toast(`検索しました：${visibleFiles().length} 件が該当しました`);
  }
}

/** アップロード一覧に読取中（処理中）のものがあるか */
const upHasProgress = () => state.uploads.some((u) => u.status === 'reading');

/** 絞り込み条件が1つでも指定されているか */
const hasHomeFilters = () => {
  const F = state.hFilters;
  return !!((F.from && F.from !== HOME_FROM) || (F.to && F.to !== HOME_TO)
    || (F.layout && F.layout.length) || (F.user && String(F.user).trim())
    || (F.biz && F.biz.length));
};
const hasResultFilters = () => {
  const F = state.filters;
  return !!(F.name
    || F.createdFrom || F.createdTo || F.updatedFrom || F.updatedTo
    || F.readFrom || F.readTo || F.checkedFrom || F.checkedTo || F.approvedFrom || F.approvedTo
    || F.status.length || (F.biz && F.biz.length) || F.layout.length
    || F.createdBy.length || F.confirmedBy.length || F.approvedBy.length);
};

/** 表示中の履歴をCSVでダウンロード（モックデータから生成） */
function downloadHistoryCsv() {
  const rows = historyRows();
  const LIMIT = 20000;
  const head = ['番号', 'リクエストID', '帳票タイプ', '呼び出し方法', 'ページ数', '開始日時', '更新日時', 'ユーザー'];
  const lines = [head.join(',')].concat(rows.slice(0, LIMIT).map((h) => [
    h.no, h.reqId, `"${dispLayout(h.layout).replace(/"/g, '""')}"`, h.call, h.pages, h.startedAt, h.updatedAt, h.user,
  ].join(',')));
  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ご利用履歴_${rows.length}件.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(rows.length + ' 件をCSVでダウンロードしました');
}

/* ===================== 5-d. アップロード画面（新規アップロード） ===================== */

/** マイタスク：未対応／対応済 + 絞り込み */
function renderMyTasks() {
  const tab = state.myTaskTab === 'done' ? 'done' : 'pending';
  const F = state.myTaskFilters || {};
  const pendingN = myTaskRows('pending').length;
  const doneN = myTaskRows('done').length;
  const rows = myTaskRows(tab).filter((r) => passesMyTaskFilters(r.file) && passesMyTaskKind(r));
  const stCls = (s) => (s === 'done' || s === 'confirmed' || s === 'approved' || s === 'exported' ? 'ok' : s === 'failed' || s === 'returned' ? 'ng' : 'wait');
  const bizOpts = BUSINESS.map((b) => `<option value="${b.id}" ${F.biz === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
  const catOpts = CATEGORY.map((c) => `<option value="${c.id}" ${F.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const body = rows.length === 0
    ? `<tr><td colspan="8" class="empty-cell">${tab === 'pending' ? '未対応のタスクはありません' : '対応済のタスクはありません'}</td></tr>`
    : rows.map((r) => {
      const f = r.file;
      const cfg = approvalOf(f.layout);
      const kindMeta = r.kind === 'reapprove'
        ? { label: '要再承認', cls: 'reapprove', act: '再承認する', targets: cfg.reapproveGroups }
        : r.kind === 'approve'
          ? { label: cfg.stages >= 2 ? '要承認（1段目）' : '要承認', cls: 'approve', act: '承認する', targets: cfg.approveGroups }
          : { label: '要確認', cls: 'confirm', act: '確認する', targets: cfg.confirmGroups };
      const actLabel = tab === 'done' ? '详情' : kindMeta.act;
      /* 未対応＝割当先／対応済＝処理者。データ権限が自身のみの人は自分の行だけ見える */
      const assigneeUid = taskOwnerUid(f, r.kind, tab);
      const assignee = userName(assigneeUid) || assigneeUserNames(kindMeta.targets);
      return `<tr data-task="${f.id}" data-task-kind="${r.kind}">
        <td class="name"><button class="fn link" data-task-open="${f.id}">${esc(dispFileName(f.id))}</button></td>
        <td><span class="task-kind ${kindMeta.cls}">${esc(kindMeta.label)}</span></td>
        <td>${esc(dispLayout(f.layout))}</td>
        <td><span class="st ${stCls(f.status)}">${esc(STATUS[f.status].label)}</span></td>
        <td class="nowrap muted">${esc(f.createdAt || '—')}</td>
        <td class="nowrap muted">${esc(f.updatedAt || '—')}</td>
        <td class="sub" title="${esc(assignee)}">${esc(assignee)}</td>
        <td style="text-align:right"><button class="btn ${tab === 'done' ? '' : 'primary'} sm" data-task-open="${f.id}">${actLabel}</button></td>
      </tr>`;
    }).join('');
  return `
  <section class="result-panel mytasks-panel" aria-label="マイタスク">
    <div class="pane-tabs mytask-pane-tabs" role="tablist">
      <button type="button" class="pane-tab ${tab === 'pending' ? 'on' : ''}" data-mytab="pending" role="tab">未対応${pendingN ? `（${pendingN}）` : ''}</button>
      <button type="button" class="pane-tab ${tab === 'done' ? 'on' : ''}" data-mytab="done" role="tab">対応済${doneN ? `（${doneN}）` : ''}</button>
    </div>
    <div class="result-content">
      <div class="mytask-filters">
        <label class="field"><span class="lbl">ファイル名</span><input class="fld" id="mtName" placeholder="ファイル名" value="${esc(F.name || '')}" /></label><label class="field"><span class="lbl">タスク種別</span><select class="fld" id="mtKind"><option value="">すべて</option><option value="confirm" ${F.kind === 'confirm' ? 'selected' : ''}>要確認</option><option value="approve" ${F.kind === 'approve' ? 'selected' : ''}>要承認</option><option value="reapprove" ${F.kind === 'reapprove' ? 'selected' : ''}>要再承認</option></select></label>
        <label class="field"><span class="lbl">業務カテゴリ</span><select class="fld" id="mtBiz"><option value="">すべて</option>${bizOpts}</select></label>
        <label class="field"><span class="lbl">帳票タイプ</span><select class="fld" id="mtCat"><option value="">すべて</option>${catOpts}</select></label>
        <label class="field"><span class="lbl">更新日時</span><span class="range"><input class="fld" type="date" id="mtUpdatedFrom" value="${esc(F.updatedFrom || '')}" /><span>〜</span><input class="fld" type="date" id="mtUpdatedTo" value="${esc(F.updatedTo || '')}" /></span></label>
        <label class="field"><span class="lbl">作成日時</span><span class="range"><input class="fld" type="date" id="mtCreatedFrom" value="${esc(F.createdFrom || '')}" /><span>〜</span><input class="fld" type="date" id="mtCreatedTo" value="${esc(F.createdTo || '')}" /></span></label>
        <label class="field"><span class="lbl">担当者</span><input class="fld" id="mtAssignee" placeholder="ユーザ名で検索" value="${esc(F.assignee || '')}" /></label>
        <span class="mytask-filter-spacer"></span>
        <div class="mytask-filter-acts filter-acts">
          <button type="button" class="btn primary filter-act" id="mtSearch" title="検索" aria-label="検索"><svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>検索</button>
          <button type="button" class="btn filter-act" id="mtReset" title="リセット" aria-label="リセット"><span class="ico i-refresh" aria-hidden="true"></span>リセット</button>
        </div>
      </div>
      <div class="tablewrap">
        <table class="mytask-table">
          <thead><tr>
            <th>ファイル名</th><th>タスク種別</th><th>帳票タイプ</th><th>ステータス</th><th>作成日時</th><th>更新日時</th><th>担当</th><th style="text-align:right">操作</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

/** 左の設定メニュー（renderCfgNav）を出さない設定画面。全幅（1 カラム）で見せる。 */
/* 利用設定の各画面は、左の設定メニューを出さず全幅で表示する */
const CFG_NO_SIDEBAR = ['users', 'roles', 'security', 'logs', 'api'];

/** 帳票設定／利用設定の左メニュー（製品の構成に合わせる） */
function renderCfgNav() {
  const groups = [
    { title: '帳票設定', items: [['ticketDetail', '帳票タイプ設定'], ['bizScenes', '業務シーン設定']] },
    /* 外部API連携は利用設定メニューへ移動（左メニューでの二重掲載を避ける） */
    { title: '権限', items: [['permissions', '帳票権限管理']] },
    { title: '利用設定', items: [['users', 'ユーザー管理'], ['roles', '権限設定'], ['security', 'セキュリティ設定'], ['logs', 'ログ設定']] },
  ];
  return `
  <aside class="panel sidenav-panel">
    ${groups.map((g) => `
      <div class="sidenav-title">${esc(g.title)}</div>
      <nav class="sidenav">
        ${g.items.map(([id, label]) => `<button class="sidenav-item ${(state.page === id || (id === 'ticketDetail' && state.page === 'ticketTypes')) ? 'on' : ''}" data-cfgpage="${id}">${esc(label)}</button>`).join('')}
      </nav>`).join('')}
  </aside>`;
}

/**
 * ファイル一覧の左カラム（ファイルツリーのみ）。
 * 新規アップロードは頂栏独立メニューのためサイドバーなし。
 */
function renderSidebarPane() {
  const treeTip = '表示次元を切替えできます。業務シーン・帳票タイプ名は変更不可（ファイル名のみ変更可）。同階層はドラッグで並び替えできます';
  return `
  <aside class="panel side with-tree">
  <div class="sidenav-panel">
      <div class="sidenav-title">ファイル一覧 <span class="info-i" data-tip="${esc(treeTip)}">i</span></div>
    </div>
    ${renderTreePanel()}
  </aside>`;
}

function renderUpload() {
  const picked = state.uploads.filter((u) => state.upPicked[u.id]).length;
  const stMap = {
    classifying: ['分類中', 'mid'],
    waiting: ['読取待ち', 'wait'],
    reading: ['読取中', 'mid'],
    done: ['読取完了', 'ok'],
    failed: ['読取失敗', 'ng'],
  };
  const typeCandidates = layoutsForBiz(state.upBiz);
  const upPages = Math.max(1, Math.ceil(state.uploads.length / state.upPerPage));
  if (state.upPage > upPages) state.upPage = upPages;
  const view = state.uploads.slice((state.upPage - 1) * state.upPerPage, state.upPage * state.upPerPage);
  const rows = view.length === 0
    ? ''
    : view.map((u, idx) => {
      const [label, cls] = stMap[u.status] || ['—', 'wait'];
      const no = (state.upPage - 1) * state.upPerPage + idx + 1;
      const opts = typeCandidates.length ? typeCandidates : savedTemplates();
      const typeOptions = opts.map((l) => `<option value="${l.id}" ${l.id === u.layout ? 'selected' : ''}>${esc(dispLayout(l.id))}</option>`).join('');
      const typeCell = u.status === 'classifying'
        ? '<span class="type-auto">自動判別中…</span>'
        : `<select class="type-select" data-uptype="${u.id}" title="分類結果を確認し、必要なら帳票タイプを選び直してください" ${u.status === 'reading' ? 'disabled' : ''}>${typeOptions}</select>`;
      const canPick = u.status === 'waiting' || u.status === 'failed';
      return `<tr class="${state.upPicked[u.id] ? 'pick' : ''}" data-uprow="${u.id}">
        <td><input type="checkbox" class="cb" data-uppick="${u.id}" ${state.upPicked[u.id] ? 'checked' : ''} ${canPick ? '' : 'disabled'} /></td>
        <td class="up-no">${no}</td>
        <td class="name"><span class="fn" title="${esc(u.name)}">${esc(u.name)}</span></td>
        <td class="nowrap">${fmtSize(u.size)}</td>
        <td class="nowrap muted">1-${u.pages}</td>
        <td class="nowrap muted">${esc(u.uploadedAt)}</td>
        <td><span class="st ${cls}"><span class="dot"></span>${label}${u.status === 'classifying' || u.status === 'reading' ? '<span class="spin"></span>' : ''}</span></td>
        <td class="up-type">${typeCell}</td>
        <td class="hist ${u.error ? 'cur' : 'done'}">${esc(u.error || '—')}</td>
        <td class="up-ops-cell"><div class="acts act-icons">
          <button class="act" data-preview="${u.id}" data-page="1" data-tip="プレビュー" aria-label="プレビュー"><span class="ico i-view" aria-hidden="true"></span></button>
          <button class="act danger" data-upact="del" data-id="${u.id}" data-tip="削除" aria-label="削除"><span class="ico i-delete" aria-hidden="true"></span></button>
        </div></td></tr>`;
    }).join('');

  const allowedBiz = ensureUpBizAllowed();
  const canUp = allowedBiz.length > 0 && canUploadBiz(state.upBiz);
  const bizOptions = allowedBiz.length
    ? allowedBiz.map((b) =>
      `<option value="${b.id}" ${b.id === state.upBiz ? 'selected' : ''}>${esc(b.name)}</option>`
    ).join('')
    : '<option value="">アップロード可能な業務シーンがありません</option>';

  return `
  <div class="upload-page">
    <section class="upload-card">
      <div class="up-class-row">
        <label class="up-class-label" for="upBizSelect">業務シーンの選択 <span class="info-i" data-tip="アップロード前に業務シーンの選択が必要です。選択できるのはアップロード権限のある業務シーンのみです。選択した業務シーンに紐づく帳票タイプの範囲で帳票を自動判別します。">i</span></label>
        <select class="fld up-biz-select" id="upBizSelect"${allowedBiz.length ? '' : ' disabled'}>${bizOptions}</select>
    </div>
      ${canUp ? `<div class="dropzone nl-dropzone ${state.dragOver ? 'over' : ''}" id="dropzone">
    <svg class="cloud" viewBox="0 0 48 34" aria-hidden="true">
      <path d="M13 26h22a7 7 0 0 0 .6-13.9A10 10 0 0 0 16 10.5 6.5 6.5 0 0 0 13 26Z"/>
      <path d="M24 33V19m0 0-5 5m5-5 5 5"/>
    </svg>
    <div class="dz-title">ここにファイルをドラッグ・ドロップ</div>
        <div class="dz-note">単一または複数のファイル、および ZIP 圧縮パッケージをアップロードできます。最大50MB、各ファイルは最大50ページです。ファイル形式はJPG、JPEG、PNG、HEIC、PDF、ZIPです。ZIP内の有効ファイルは展開後に一覧へ追加され、ZIP自体は表示されません。</div>
    <button class="btn primary" id="pickBtn"><span class="ico i-upload"></span>ファイル選択</button>
        <input type="file" id="fileInput" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.zip" hidden />
  </div>` : `<div class="dropzone nl-dropzone up-no-perm" aria-disabled="true">
    <div class="dz-title">アップロード権限がありません</div>
    <div class="dz-note">現在のユーザーに割り当てられたアップロード権限のある業務シーンがありません。帳票権限管理でアップロード担当を設定してください。</div>
  </div>`}
    </section>

    <section class="upload-card upload-list-card">
  <h2 class="sec-title">アップロード済ファイル</h2>
  <div class="upload-actions">
        <button class="btn primary" id="upRead" ${picked ? '' : 'disabled'} title="読取待ちのファイルを読取り、ファイル一覧へ移動します">選択帳票読取</button>
        <button class="btn danger-ghost" id="upDel" ${picked ? '' : 'disabled'}><span class="ico i-delete"></span>一括削除</button>
    <span class="up-count">合計 <b>${state.uploads.length}</b> 件のファイル</span>
        <span class="up-note"><span class="info-i">i</span>${upHasProgress() ? '読取処理中のファイルがあります（結果一覧でも進捗を確認できます）' : 'ファイルリストは7日後に自動的にクリアされます'}</span>
  </div>
  <div class="tablewrap up-table">
    <table>
      <thead><tr>
        <th style="width:36px"><input type="checkbox" class="cb" data-upall="1" /></th>
            <th style="width:48px">No.</th>
            <th>ファイル名</th><th>ファイルサイズ</th><th>ページ番号</th><th>アップロード日時</th><th>ステータス</th><th>帳票タイプ</th><th>エラー理由</th><th class="up-ops-cell" style="width:120px">操作・処理</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="empty-cell">データなし</td></tr>'}</tbody>
    </table>
  </div>
  <div class="pager up-pager">
    <span class="pages">
      <button class="pg" data-uppage="${Math.max(1, state.upPage - 1)}" ${state.upPage === 1 ? 'disabled' : ''}>‹</button>
      ${Array.from({ length: Math.min(6, upPages) }, (_, i) => `<button class="pg ${state.upPage === i + 1 ? 'on' : ''}" data-uppage="${i + 1}">${i + 1}</button>`).join('')}
      ${upPages > 7 ? '<span style="color:var(--text-3)">…</span>' : ''}
      ${upPages > 6 ? `<button class="pg ${state.upPage === upPages ? 'on' : ''}" data-uppage="${upPages}">${upPages}</button>` : ''}
      <button class="pg" data-uppage="${Math.min(upPages, state.upPage + 1)}" ${state.upPage === upPages ? 'disabled' : ''}>›</button>
    </span>
    <select data-upperpage>${[10, 20, 50, 100].map((n) => `<option ${n === state.upPerPage ? 'selected' : ''}>${n}件ずつ</option>`).join('')}</select>
    <input class="pginput" data-upgoto value="${state.upPage}" /> <span>ページへ</span>
      </div>
    </section>
  </div>
`;
}


function render() {
  const app = $('#app');
  let route = ['home', 'upload', 'result', 'myTasks', 'review', 'ticketTypes', 'ticketDetail', 'bizScenes', 'permissions', 'api', 'users', 'roles', 'security', 'logs'].includes(state.page) ? state.page : 'result';   // 不正値は読取結果一覧へ
  /* メニュー権限の無い画面は開かず、到達可能な先頭へ寄せる（削除線ではなく非表示） */
  if (route !== 'review' && !canReachPage(route)) {
    const fallback = ['home', 'upload', 'result', 'myTasks'].find((p) => canReachPage(p)) || 'home';
    state.page = fallback;
    route = fallback;
  }
  const isUpload = route === 'upload';
  const isHome = route === 'home';
  const isMyTasks = route === 'myTasks';
  const isReview = route === 'review';   // 読取結果確認ページ（全幅）
  /* 旧 ticketTypes ルートは左リスト＋右 Step1 に統合 */
  if (route === 'ticketTypes') {
    state.page = 'ticketDetail';
    if (!state.typeId && TICKET_TYPES[0]) state.typeId = TICKET_TYPES[0].id;
    route = 'ticketDetail';
  }
  const isTypeList = false;
  const isTypeDetail = route === 'ticketDetail';      // 左：タイプ一覧／右：Step1〜4
  const isCfg = ['permissions', 'api', 'users', 'roles', 'security', 'logs'].includes(route);
  const isScene = route === 'bizScenes';        // 業務シーン設定（左：業務シーンリスト／右：ガイド or 編集）
  const isFullPane = isTypeDetail || isScene;
  const noSidePane = CFG_NO_SIDEBAR.includes(route);   // 利用設定の各画面：左の設定メニューを出さず全幅で見せる
  app.dataset.page = route;
  app.innerHTML = `
  <header class="topbar">
    <div class="logo"><img src="./assets/logo.webp" alt="LLMOCR" /></div>
    <nav class="nav">
      ${renderTopNav()}
    </nav>
    <div class="topright">
      ${(() => {
        const me = currentProfile();
        const actors = DEMO_ACTORS.map((a) => {
          const u = byId(USERS, a.id);
          const on = state.currentUser === a.id;
          return `<button type="button" class="usermenu-actor${on ? ' on' : ''}" role="menuitemradio" aria-checked="${on}" data-demo-actor="${a.id}" title="${esc(a.hint)}">`
            + `<span class="ua-name">${esc(u ? u.name : a.id)}</span>`
            + `<span class="ua-hint">${esc(a.hint)}</span>`
            + `</button>`;
        }).join('');
        return `
      <div class="userpick ${state.userMenuOpen ? 'open' : ''}" data-userpick="1">
        <button type="button" class="userpick-trigger" id="userMenuBtn" aria-expanded="${state.userMenuOpen ? 'true' : 'false'}" aria-haspopup="menu">
          <span class="avatar" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg></span>
          <span class="userpick-name">${esc(me.name)}</span>
          
          <span class="ico ${state.userMenuOpen ? 'i-caret-up' : 'i-caret-down'} userpick-caret" aria-hidden="true"></span>
        </button>
        <div class="usermenu" role="menu">
          <div class="usermenu-head">
            <div class="usermenu-name">${esc(me.name)}</div>
            <div class="usermenu-email">${esc(me.email)}</div>
            <span class="usermenu-role">権限：${esc(me.roleLabel)}</span>
            ${me.hint ? `<p class="usermenu-hint">${esc(me.hint)}</p>` : ''}
          </div>
          <div class="usermenu-acts">
            <button type="button" class="usermenu-item" role="menuitem" data-user-act="account">アカウント情報</button>
            <button type="button" class="usermenu-item" role="menuitem" data-user-act="logout">ログアウト</button>
          </div>
        </div>
      </div>`;
      })()}
    </div>
  </header>
  ${renderTabbar()}
  <main class="layout ${(isHome || isUpload || isMyTasks || isFullPane) ? 'layout-home' : (noSidePane || isTypeList ? 'layout-pane layout-noside' : 'layout-pane')}">
    ${(isHome || isUpload || isMyTasks || isReview || isFullPane || noSidePane || isTypeList) ? '' : (isCfg ? renderCfgNav() : renderSidebarPane())}
    <div class="maincol ${(isHome || isUpload || isMyTasks || isReview) ? 'wide' : ''}">
      ${'' /* 読取結果一覧はステータスタブを先頭に置く */}
      ${isHome ? renderHome()
        : isMyTasks ? renderMyTasks()
          : isScene ? renderBizScenes()
            : isTypeDetail ? renderTicketDetail()
          : isTypeList ? renderTicketTypes()
          : isReview ? renderReview()
          : isCfg ? (route === 'permissions' ? renderPermissions()
                : route === 'api' ? renderApiPage()
                  : route === 'users' ? renderUsers()
                    : route === 'roles' ? renderRoles()
                      : route === 'security' ? renderSecurity()
                        : route === 'logs' ? renderLogs() : '')
            : (isUpload ? renderUpload() : `<section class="result-panel" aria-label="ファイル一覧">${renderTabs()}<div class="result-content">${renderFilters()}${renderTable()}</div></section>`)}
    </div>
  </main>
  ${renderPreviewModal()}
  ${renderDlMenu()}
  ${renderFlowDialog()}
  ${renderAccessKeyDialog()}
  ${renderUserAddDialog()}
  ${renderReviewConfirmAskDialog()} ${renderReviewRequiredDialog()}
  ${renderSaveHistoryDialog()}
  ${renderExportDialog()}
  <div class="toast" id="toast"></div>`;
  bind();
}

/* ============================== 6. イベント ============================== */

let dragSrc = null;

function bind() {
  // ツリー（ホーム／アップロード画面には存在しないため null ガードする。
  //         ここで例外を投げると以降のバインドが全て止まり、タブやメニューが無反応になる）
  const treeEl = $('#tree');
  if (treeEl) bindTree(treeEl);

  /* 右上ユーザーメニュー */
  const userBtn = $('#userMenuBtn');
  if (userBtn) {
    userBtn.onclick = (e) => {
      e.stopPropagation();
      state.userMenuOpen = !state.userMenuOpen;
      render();
    };
  }
  document.querySelectorAll('[data-user-act]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const act = b.dataset.userAct;
      state.userMenuOpen = false;
      render();
      if (act === 'account') toast('アカウント情報（モック）');
      else if (act === 'logout') toast('ログアウトしました（モック）');
    };
  });
  /* デモ：現在ユーザを切替えて閲覧／マイタスクの違いを見せる */
  

  // ヘッダー／タブバー → 対応タブを開く／前面化（メニューとタグを同期）
  document.querySelectorAll('[data-opentab]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest('[data-closetab]')) return;
      state.navMenu = null;
      const id = el.dataset.opentab;
      if (tabDef(id)) { openTab(id); return; }
      toast(`「${el.textContent.trim()}」は本デモでは未実装です（製品側の画面）`);
    };
  });
  // サブメニュー付きメニュー（開閉は CSS の :hover / .open。再描画すると mouseleave が効かなくなるため JS では描画しない）
  document.querySelectorAll('[data-navmenu]').forEach((el) => {
    const key = el.dataset.navmenu;
    el.onclick = (e) => {
      if (e.target.closest('[data-navitem]')) return;
      state.navMenu = state.navMenu === key ? null : key;
      render();
    };
  });
  document.querySelectorAll('[data-navitem]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.navitem;
      state.navMenu = null;
      const page = id === 'ticketDetail' ? 'ticketDetail' : id;
      if (!canReachPage(page)) { toast('この画面を開く権限がありません'); return; }
      if (id === 'ticketDetail') { openTicketTypes(); return; }
      if (id === 'bizScenes') { openBizScenes(state.sceneId); return; }
      if (TABS_DEF[id]) { openTab(id); return; }
      state.page = id;
      render();
    };
  });
  document.querySelectorAll('[data-closetab]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); closeTab(b.dataset.closetab); };
  });

  bindTreeExtra(treeEl);
  bindResultPanel();
  bindUploadPanel();
  bindHomePanel();
  bindPaneNav();
  bindMyTasks();
  bindPreviewModal();
  bindCfgPages();
  bindFlowDialogs();
  bindReview();
  bindTicketDetail();
  bindBizScenes();
  bindDdCommon();
  bindDlMenus();
  bindPermDialogs();
  bindTips();
}

/** data-tip 用のツールチップ（固定配置なのでテーブルのスクロール領域でも切れない） */
function bindTips(root) {
  const scope = root || document;
  /* 再描画でホバー中の要素ごと DOM から消えると mouseleave が飛ばず、
     ツールチップが body に残り続ける（次のホバーと二重に重なって見える）。毎回掃除する。 */
  document.querySelectorAll('body > .tip').forEach((t) => t.remove());
  scope.querySelectorAll('[data-tip]').forEach((el) => {
    el.onmouseenter = () => {
      const tip = document.createElement('div');
      tip.className = 'tip';
      tip.textContent = el.dataset.tip;
      document.body.appendChild(tip);
      const r = el.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      /* 中央寄せが画面外へはみ出す場合は、要素の左端に合わせる（長い説明文で左端に張り付くのを防ぐ） */
      const centered = r.left + r.width / 2 - t.width / 2;
      let left = centered;
      if (centered < 6 || centered + t.width > window.innerWidth - 6) {
        left = Math.max(6, Math.min(r.left, window.innerWidth - t.width - 6));
      }
      let top = r.top - t.height - 8;
      if (top < 6) top = r.bottom + 8;              // 上に余白がなければ下に出す
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      el._tip = tip;
    };
    el.onmouseleave = () => { if (el._tip) { el._tip.remove(); el._tip = null; } };
    el.onclick = ((prev) => function (e) { if (this._tip) { this._tip.remove(); this._tip = null; } return prev ? prev.call(this, e) : undefined; })(el.onclick);
  });
}

/** ツリーのクリック／ドラッグ操作 */
function bindTree(treeEl) {
  treeEl.addEventListener('click', (e) => {
    const node = e.target.closest('.node');
    if (!node) return;
    const type = node.dataset.type, id = node.dataset.id, key = type + ':' + id;
    if (e.target.closest('[data-rename]')) {
      e.stopPropagation();
      if (type !== 'file') { toast('業務シーン・帳票タイプ名は変更できません'); return; }
      startRename(node, type, id);
      return;
    }
    if (e.target.dataset.tw || e.target.closest('[data-tw]')) {
      state.open[key] = state.open[key] === false;
      const t = $('#tree');
      if (t) { t.innerHTML = renderTree(); bindTips(t); }
      return;
    }
    state.activeNode = { type, id };
    state.resultPage = 1;
    render();
  });
  treeEl.addEventListener('dragstart', (e) => {
    const n = e.target.closest('.node');
    if (!n || n.dataset.type === 'all') return;
    dragSrc = n;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', n.dataset.type + ':' + n.dataset.id);
  });
  treeEl.addEventListener('dragover', (e) => {
    const n = e.target.closest('.node');
    if (!n || !dragSrc || n === dragSrc) return;
    const st = dragSrc.dataset.type, tt = n.dataset.type;
    /* 同種ノード＝並び替え／ファイル→カテゴリ（または業務）＝移動 */
    if (st === tt && (st === 'biz' || st === 'cat' || st === 'file')) { e.preventDefault(); n.classList.add('dragover'); }
    else if (st === 'file' && (tt === 'cat' || tt === 'biz' || tt === 'all')) { e.preventDefault(); n.classList.add('dragover'); }
  });
  treeEl.addEventListener('dragleave', (e) => { const n = e.target.closest('.node'); if (n) n.classList.remove('dragover'); });
  treeEl.addEventListener('drop', (e) => {
    const t = e.target.closest('.node');
    if (!t || !dragSrc) return;
    e.preventDefault();
    t.classList.remove('dragover');
    const st = dragSrc.dataset.type, sid = dragSrc.dataset.id;
    const tt = t.dataset.type, tid = t.dataset.id;
    let ok = false;
    if (st === tt && (st === 'biz' || st === 'cat' || st === 'file')) {
      ok = reorderTreeSibling(st, sid, tid);
      if (ok) toast('並び順を変更しました');
    } else if (st === 'file') {
      if (tt === 'all') ok = moveFileToFolder(sid, null);
      else if (tt === 'cat' || tt === 'biz') ok = moveFileToFolder(sid, tid);
      if (ok) toast('ファイルを移動しました');
    }
    dragSrc = null;
    if (ok) render();
  });

  /* 表示次元のピル型スイッチ（左：業務シーン／右：帳票タイプ） */
  const applyTreeView = (next) => {
    state.treeView = next === 'cat' ? 'cat' : 'biz-cat';
    /* 表示次元に無い種別が選択中なら「すべて」へ戻す */
    if (state.treeView === 'cat' && state.activeNode && state.activeNode.type === 'biz') {
      state.activeNode = { type: 'all', id: 'all' };
    }
    state.resultPage = 1;
    render();
  };
  document.querySelectorAll('[data-treeview]').forEach((b) => {
    b.onclick = () => applyTreeView(b.dataset.treeview);
  });

  const treeQ = $('#treeQ');
  if (treeQ) {
    /* 検索語はタブ件数と一覧の絞り込みにも効く。全体を再描画したうえで入力欄にフォーカスと
       キャレットを戻す（ツリーだけ差し替えると一覧とタブ件数が追随しない）。 */
    treeQ.oninput = (e) => {
      const v = e.target.value;
      state.q = v; state.resultPage = 1;
      render();
      const el = $('#treeQ');
      if (el) { el.focus(); try { el.setSelectionRange(v.length, v.length); } catch (_) { /* 未対応要素は無視 */ } }
    };
    treeQ.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); render(); } };
  }
}

/** ツリーの展開／折りたたみ（ツリーが無い画面でも data-exp を処理する） */
function bindTreeExtra(treeEl) {
  const expandAll = document.querySelector('[data-exp="all"]');
  if (expandAll) expandAll.onclick = () => {
    const setAll = (nodes, v) => nodes.forEach((n) => { state.open[n.type + ':' + n.id] = v; if (n.children) setAll(n.children, v); });
    setAll(buildTree(), true);
    const t = $('#tree'); if (t) { t.innerHTML = renderTree(); bindTips(t); }
  };
  const collapseAll = document.querySelector('[data-exp="none"]');
  if (collapseAll) collapseAll.onclick = () => {
    const setAll = (nodes, v) => nodes.forEach((n) => { state.open[n.type + ':' + n.id] = v; if (n.children) setAll(n.children, v); });
    setAll(buildTree(), false);
    const t = $('#tree'); if (t) { t.innerHTML = renderTree(); bindTips(t); }
  };
  const toggleMore = document.querySelector('[data-exp="more"]');
  if (toggleMore) toggleMore.onclick = () => { state.filterMore = !state.filterMore; render(); };
}

/** 読取結果一覧（タブ・絞り込み・テーブル） */
/** ファイル一覧テーブル：横スクロール位置を保持し、ドラッグで左右に動かせる */
function bindResultTableScroll() {
  const el = document.querySelector('.result-tablewrap');
  if (!el) return;
  if (state.resultScrollLeft > 0) el.scrollLeft = state.resultScrollLeft;
  el.onscroll = () => { state.resultScrollLeft = el.scrollLeft; };
  let dragging = false;
  let startX = 0;
  let startLeft = 0;
  el.onpointerdown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, label, .ms, .act, .cb')) return;
    dragging = true;
    startX = e.clientX;
    startLeft = el.scrollLeft;
    el.classList.add('is-dragging');
    try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };
  el.onpointermove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    el.scrollLeft = startLeft - (e.clientX - startX);
  };
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
  };
  el.onpointerup = endDrag;
  el.onpointercancel = endDrag;
  el.onlostpointercapture = endDrag;
}

function bindResultPanel() {
  bindResultTableScroll();
  // もっと見る／閉じる（一覧パネル側で確実にバインド）
  document.querySelectorAll('[data-exp="filter"]').forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.filterOpen = !state.filterOpen;
      state.filterMore = false;
      render();
    };
  });
  document.querySelectorAll('[data-result-preview]').forEach((b) => {
    b.onclick = () => openPreview(b.dataset.resultPreview);
  });
  const batchRead = $('#batchRead');
  if (batchRead) batchRead.onclick = () => {
    const targets = visibleFiles().filter((f) => state.picked[f.id] && !f._proc);
    if (!targets.length) return;
    state.picked = {};
    targets.forEach((f) => startReRead(f.id));
  };
  const batchDelete = $('#batchDelete');
  if (batchDelete) batchDelete.onclick = () => {
    const targets = new Set(visibleFiles().filter((f) => state.picked[f.id]).map((f) => f.id));
    if (!targets.size || !window.confirm(`選択した ${targets.size} 件を削除しますか？`)) return;
    FILES_DATA.forEach((f) => { if (targets.has(f.id)) f._proc = false; });
    FILES_DATA = FILES_DATA.filter((f) => !targets.has(f.id));
    state.picked = {}; render(); toast(`${targets.size} 件を削除しました`);
  };
  // タブ
  document.querySelectorAll('[data-tab]').forEach((el) => { el.onclick = () => { state.tab = el.dataset.tab; state.resultPage = 1; render(); }; });

  // 絞り込み
  const bindVal = (id, key) => { const el = $('#' + id); if (el) el.onchange = () => { state.filters[key] = el.value; state.resultPage = 1; render(); }; };
  bindVal('createdFrom', 'createdFrom'); bindVal('createdTo', 'createdTo');
  bindVal('updatedFrom', 'updatedFrom'); bindVal('updatedTo', 'updatedTo');
  bindVal('readFrom', 'readFrom'); bindVal('readTo', 'readTo');
  bindVal('checkedFrom', 'checkedFrom'); bindVal('checkedTo', 'checkedTo');
  bindVal('approvedFrom', 'approvedFrom'); bindVal('approvedTo', 'approvedTo');

  // 複数選択ドロップダウン（1条件内 OR）
  document.querySelectorAll('[data-msbtn]').forEach((b) => {
    b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.msbtn; state.dd = state.dd === id ? null : id; render(); };
  });
  document.querySelectorAll('[data-fs]').forEach((el) => {
    el.onchange = () => { state.filters[el.dataset.fs] = el.value; state.resultPage = 1; render(); };
  });
  document.querySelectorAll('[data-msclear]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.msclear;
      if (id === 'hLayout') state.hFilters.layout = [];
      else if (id === 'hBiz') state.hFilters.biz = [];
      else state.filters[id] = '';
      state.resultPage = 1; state.hPage = 1; render();
    };
  });
}

/** ドロップダウンの外側クリックで閉じる */
function bindDdCommon() {
  document.body.onclick = (e) => {
    const t = e.target;
    const insideDd = t.closest && t.closest('[data-msbtn],[data-ms]');
    const insideMenu = t.closest && t.closest('[data-navmenu],[data-navitem]');
    const insideUser = t.closest && t.closest('[data-userpick],[data-user-act],[data-demo-actor]');
    const insideScene = t.closest && t.closest('[data-scenemenu],.ti-menu');
    const insideTypeItem = t.closest && t.closest('[data-typemenu],.ti-menu');
    let changed = false;
    if (state.dd && !insideDd) { state.dd = null; changed = true; }
    if (state.navMenu && !insideMenu) { state.navMenu = null; changed = true; }
    if (state.userMenuOpen && !insideUser) { state.userMenuOpen = false; changed = true; }
    if (state.sceneMenu && !insideScene) { state.sceneMenu = null; changed = true; }
    if (state.typeItemMenu && !insideTypeItem) { state.typeItemMenu = null; changed = true; }
    if (changed) render();
  };
}

/** フローダイアログ／エクスポート設定ダイアログのイベント */
function bindFlowDialogs() {
  const back = $('#flowBack');
  if (back) {
    const close = () => { state.flowDialog = null; render(); };
    const cc = $('#flowClose'); if (cc) cc.onclick = close;
    const cn = $('#flowCancel'); if (cn) cn.onclick = close;
    back.onclick = (e) => { if (e.target === back) close(); };
    const ta = $('#flowComment');
    if (ta) {
      ta.oninput = () => {
        state.flowDialog.comment = ta.value;
        const btn = $('#flowOk');
        if (btn) btn.disabled = !String(ta.value || '').trim();
        const hint = document.querySelector('.flow-req-hint');
        if (hint) hint.style.display = String(ta.value || '').trim() ? 'none' : '';
      };
      setTimeout(() => { try { ta.focus(); } catch (_) {} }, 0);
    }
    const ok = $('#flowOk');
    const leaveReviewToMyTasks = (fileId, myTab) => {
    /* 確認メッセージ（同意待ち）の間は遷移しない */
    if (state.reviewConfirmAsk) return;
      const tid = reviewTabId(fileId);
      if (isTabOpen(tid)) {
        state.tabs = state.tabs.filter((x) => x !== tid);
        if (state.reviewSessions) delete state.reviewSessions[fileId];
      }
      if (!isTabOpen('myTasks')) state.tabs.push('myTasks');
      state.page = 'myTasks';
      state.myTaskTab = myTab;
      state.reviewViewOnly = false;
      render();
    };
    if (ok) ok.onclick = () => {
      const d = state.flowDialog;
      const c = String(d.comment || '').trim();
      if (!c) { toast('差戻理由を入力してください'); return; }
      const fileId = d.fileId;
      state.flowDialog = null;
      runFlowAction(fileId, 'return', c);
      leaveReviewToMyTasks(fileId, 'pending');
    };
  }
  const eb = $('#expBack');
  if (eb) {
    const close = () => {
      /* キャンセル（×・背景クリックも同じ）は開いた時点の設定に戻す */
      if (state.exportCfgSnapshot) state.exportCfg = Object.assign({}, state.exportCfgSnapshot);
      state.exportOpen = false; render();
    };
    const ec = $('#expClose'); if (ec) ec.onclick = close;
    const eca = $('#expCancel'); if (eca) eca.onclick = close;
    eb.onclick = (e) => { if (e.target === eb) close(); };
    document.querySelectorAll('[data-expcfg]').forEach((el) => {
      el.onchange = () => {
        const k = el.dataset.expcfg;
        state.exportCfg[k] = el.type === 'checkbox' ? el.checked : (el.type === 'radio' ? el.value : el.value);
        if (el.type === 'radio') { state.exportCfg[k] = el.value; }
        render();
      };
    });
    /* 出力ファイル名：プレビュー欄で直接入力する。
       1 文字ごとに全体を再描画するとフォーカスが飛ぶので、ここだけは state を直接更新する
       （表示しているのは input 自身なので、再描画しなくても見た目は追随する）。 */
    const fn = $('#expFileName');
    if (fn) {
      fn.oninput = () => {
        state.exportCfg.fileName = String(fn.value).replace(/\.csv\s*$/i, '').trim();
      if (!state.exportCfg.fileName) state.exportCfg.fileName = exportFileName();
      };
    }
    const sv = $('#expSave');
    if (sv) sv.onclick = () => {
      saveExportCfg();
      state.exportCfgSnapshot = Object.assign({}, state.exportCfg);
      state.exportOpen = false; render();
      toast('エクスポート設定を保存しました');
    };
  }
}

/**
 * 読取結果确认／详情ページ（llm ocr NL ResultDetailPage に合わせて復元）
 * 上バー左：戻る／ファイル名／前へ次へ／プレビュー操作（reset・回転・拡大縮小）
 * 上バー右：統計・履歴・ダウンロード ／ 左ペイン：プレビュー ／ 右ペイン：OCR項目・CTA
 */
function renderReview() {
  const f = byId(FILES_DATA, state.reviewId) || FILES_DATA[0];
  if (!f) return '<div class="empty-cell">対象の帳票がありません。</div>';
  ensureSaveHistory(f);
  if (['confirmed', 'approved', 'exported', 'returned'].includes(f.status)) ensureConfirmAudit(f);
  if (!state.reviewPage) state.reviewPage = 1;
  if (!state.reviewPages) state.reviewPages = REVIEW_DOC.pages;
  if (state.reviewRotate == null) state.reviewRotate = 0;
  if (!state.reviewReadTab) state.reviewReadTab = 'text';
  const fl = reviewFootFlags(f);
  const readonly = fl.readonly;
  const phase = fl.phase;
  const isApproveUi = phase === 'approve' || phase === 'export';
  const phaseLabel = phase === 'approve' ? '承認' : phase === 'confirm' ? '確認' : phase === 'export' ? '出力' : '详情';
  const textFields = OCR_FIELDS.b6;
  const tableFields = OCR_TABLES.default;
  const dirty = state.reviewDirty[f.id] || {};
  const fieldList = state.reviewReadTab === 'table' ? tableFields : textFields;
  const audit = isApproveUi ? confirmAuditOf(f) : null;
  const visible = state.reviewOnlyErr
    ? fieldList.filter((x) => x.hasError || dirty[x.key] !== undefined)
    : fieldList;
  const dirtyCount = Object.keys(dirty).length || (audit ? audit.changes.length : 0);
  /* 確認済みは画面側で保持（製品と同じ：確認ボタン／一括確認で確定） */
  const confirmedMap = state.reviewConfirmed[f.id] || {};
  const confirmedCount = fieldList.filter((x) => confirmedMap[x.key]).length || (isApproveUi ? fieldList.length : 0);
  const totalCount = fieldList.length;
  const pending = Math.max(0, totalCount - confirmedCount);
  const confirmedN = confirmedCount;
  const missingRequired = fieldList.filter((x) => x.required && !String(dirty[x.key] !== undefined ? dirty[x.key] : (x.value || '')).trim());
  const ro = readonly ? 'readonly tabindex="-1"' : '';
  const page = Math.min(Math.max(1, state.reviewPage), state.reviewPages);
  const rot = ((state.reviewRotate % 360) + 360) % 360;
  const cfg = approvalOf(f.layout);
  const tip = `閲覧権限：${groupNames(cfg.viewGroups)} ／ 確認担当：${assigneeUserNames(cfg.confirmGroups)} ／ 承認担当：${assigneeUserNames(cfg.approveGroups)}${cfg.stages === 2 ? ` ／ 再承認担当：${assigneeUserNames(cfg.reapproveGroups)}` : ''} ／ 出力：${assigneeUserNames(cfg.exportGroups)}`;
  const backLabel = state.reviewReturn === 'myTasks' ? 'マイタスクに戻る' : '一覧に戻る';

  const flowInfo = flowOf(f);
  const approveBtnLabel = (flowInfo.stages === 2 && flowInfo.done >= 1) ? '再承認' : '承認';
  let footCta = '';
  if (fl.canConfirm) {
    footCta = dsCta('rvConfirm', '確認', 'confirm', false);
  } else if (fl.canExport) {
    footCta = dsCta('rvExport', '出力', 'approve', false);
  }

  const flowStrip = `<div class="rv-flow-strip">${flowStepsHtml(f, { compact: true, detail: false })}</div>`;

  /* JSON モード：name/value/children 配列。一括確認・エラーのみ表示は出さない */
  const jsonNodes = fieldList.map((x) => ({
    name: x.label,
    value: dirty[x.key] !== undefined ? dirty[x.key] : (x.value || ''),
    children: null,
  }));
  const jsonHtml = (() => {
    const lines = ['['];
    jsonNodes.forEach((node, i) => {
      const comma = i < jsonNodes.length - 1 ? ',' : '';
      const val = node.value == null || node.value === ''
        ? '<span class="jv-null">null</span>'
        : `<span class="jv-str">"${esc(String(node.value))}"</span>`;
      lines.push('  {');
      lines.push(`    <span class="jv-key">"name"</span>: <span class="jv-str">"${esc(node.name)}"</span>,`);
      lines.push(`    <span class="jv-key">"value"</span>: ${val},`);
      lines.push(`    <span class="jv-key">"children"</span>: <span class="jv-null">null</span>`);
      lines.push(`  }${comma}`);
    });
    lines.push(']');
    return `<pre class="json-view json-view-dark" aria-label="読取結果 JSON">${lines.join('\n')}</pre>`;
  })();
  const changeMap = Object.fromEntries((audit ? audit.changes : []).map((c) => [c.key, c]));
  const fieldsHtml = state.reviewTab === 'json'
    ? jsonHtml
    : (visible.length === 0
      ? '<p class="rv-empty">表示する項目がありません</p>'
      : `<div class="rv-field-list${isApproveUi ? ' is-approve' : ''}">${visible.map((x) => {
          const key = x.key;
          const val = dirty[key] !== undefined ? dirty[key] : (x.value || '');
          const err = x.hasError ? ' has-error' : '';
          const isConfirmed = !!confirmedMap[key] || isApproveUi;
          const isCorrected = dirty[key] !== undefined || !!changeMap[key];
          const num = fieldList.findIndex((y) => y.key === key);
          const stateCls = isCorrected ? ' is-corrected' : (isConfirmed ? ' is-confirmed' : '');
          const stateLabel = isCorrected ? '<span class="rv-field-state mod">修正済み</span>'
            : isConfirmed ? '<span class="rv-field-state ok">確認済み</span>' : '';
          const focusCls = state.reviewFocusKey === key ? ' is-focus' : '';
          if (isApproveUi) {
            const ch = changeMap[key];
            const from = ch ? ch.from : (OCR_ORIGINAL.text[key] !== undefined ? OCR_ORIGINAL.text[key] : val);
            return `<div class="rv-field-row is-ro${err}${stateCls}${focusCls}" data-field-key="${esc(key)}">
              <div class="rv-field-inner">
                <span class="rv-field-label">${esc(fieldNum(num))}${esc(x.label)}${x.required ? '<i class="rv-req">*</i>' : ''}</span>
                ${ch
                  ? `<div class="rv-field-diff"><span class="from" title="読取結果（原文）">${from === '' || from == null ? '（空）' : esc(String(from))}</span><span class="arrow" aria-hidden="true">→</span><span class="to" title="確認者の修正">${esc(String(ch.to))}</span></div>`
                  : `<div class="rv-field-ro">${val === '' || val == null ? '<span class="muted">（空）</span>' : esc(String(val))}</div>`}
          </div>
              <div class="rv-field-state-row">${stateLabel}</div>
      </div>`;
          }
          return `<div class="rv-field-row${err}${stateCls}${focusCls}" data-field-key="${esc(key)}"><label class="rv-field-inner">`
            + `<span class="rv-field-label">${esc(fieldNum(num))}${esc(x.label)}${x.required ? '<i class="rv-req">*</i>' : ''}</span>`
            + `<input class="rv-field-input" data-ocr="${esc(key)}" value="${esc(val)}" ${ro} />`
            + `</label><div class="rv-field-state-row">${stateLabel}</div></div>`;
        }).join('')}</div>`);

  /* 承認：差分と全項目をタブで切り替える（同時表示で情報過多にしない） */
  if (isApproveUi && !state.reviewApprovePane) {
    state.reviewApprovePane = (audit && audit.changes.length) ? 'diff' : 'fields';
  }
  const approveAuditHtml = isApproveUi ? renderApproveAudit(f, fieldsHtml) : '';

  const fileLabel = REVIEW_DOC.fileName;
  const bboxSource = [...OCR_FIELDS.b6, ...OCR_TABLES.default];
  const showBBox = !state.reviewPos;
  const marksHtml = showBBox
    ? `<div class="doc-marks review-marks">${bboxSource.filter((x) => x.bbox).map((x) => {
        const b = x.bbox;
        const on = state.reviewFocusKey === x.key ? ' on' : '';
        const err = x.hasError ? ' err' : '';
        return `<button type="button" class="doc-mark-box${on}${err}" data-bbox="${esc(x.key)}" title="${esc(x.label)}" style="top:${b.t}%;left:${b.l}%;width:${b.w}%;height:${b.h}%"></button>`;
      }).join('')}</div>`
    : '';
  const previewDoc = `<div class="doc-sheet review-doc">
      <img class="review-doc-img" src="${REVIEW_DOC.image}" alt="${esc(REVIEW_DOC.title)}" draggable="false" />
      ${marksHtml}
    </div>`;

  return `
  <div class="reviewpage nl-review" data-review-phase="${phase}">
    <div class="review-bar nl-review-bar${isApproveUi ? ' is-approve' : ''}">
      <div class="rv-left">
        <button type="button" class="rv-back" id="rvBack"><span class="ico i-back"></span>${backLabel}</button>
        <span class="rv-file" title="${esc(fileLabel)}">${esc(fileLabel)}</span>
        <div class="rv-nav-btns">
          <button type="button" class="btn rv-page-btn" id="rvPrev" ${page <= 1 ? 'disabled' : ''}>前へ</button>
          <button type="button" class="btn rv-page-btn" id="rvNext" ${page >= state.reviewPages ? 'disabled' : ''}>次へ</button>
      </div>
        <div class="rv-tools-inline" role="toolbar" aria-label="プレビュー操作">
          <button type="button" class="icon-btn rv-tool" id="rvFit" title="リセット">${RV_ICON.reset}</button>
          <button type="button" class="icon-btn rv-tool" id="rvRotL" title="左回転">${RV_ICON.rotL}</button>
          <button type="button" class="icon-btn rv-tool" id="rvRotR" title="右回転">${RV_ICON.rotR}</button>
          <button type="button" class="icon-btn rv-tool" id="rvZoomIn" title="拡大">${RV_ICON.zoomIn}</button>
          <button type="button" class="icon-btn rv-tool" id="rvZoomOut" title="縮小">${RV_ICON.zoomOut}</button>
    </div>
        </div>
      <div class="rv-bar-right">
        <div class="rv-stat-groups">
          ${isApproveUi
            ? `<div class="rv-stat-group">
                <span>${esc(phaseLabel)}中</span>
                ${dirtyCount > 0 ? `<span>確認者の修正 ${dirtyCount}</span>` : ''}
              </div>`
            : `<div class="rv-stat-group">
                <span>確認待ち <b class="accent">: ${pending}</b></span>
                <span>確認済み <b class="accent-warm">: ${confirmedN}</b></span>
            </div>
              <div class="rv-stat-group">
                <span>項目合計 <b>: ${totalCount}</b></span>
                <span>修正済み <b class="accent-warm">: ${dirtyCount}</b></span>
              </div>`}
          ${isApproveUi ? '' : '<button type="button" class="rv-guide" id="rvGuide"><span class="ico i-error"></span>操作ガイド</button>'}
          </div>
        
        </div>
      </div>
    ${flowStrip}
    <div class="review-body nl-review-body${isApproveUi ? ' is-approve' : ''}">
      <section class="rv-pane nl-preview-pane">
        <div class="rv-preview-stage">
          <button type="button" class="rv-side-nav left" id="rvPagePrev" ${page <= 1 ? 'disabled' : ''} aria-label="前のページ"><span class="ico i-back"></span></button>
          <div class="rv-preview-canvas${state.reviewZoom > 1 ? ' is-zoomed' : ''}">
            <div class="rv-pdf-wrap" style="transform:scale(${state.reviewZoom}) rotate(${rot}deg);transform-origin:center center">
              ${previewDoc}
        </div>
        </div>
          <button type="button" class="rv-side-nav right" id="rvPageNext" ${page >= state.reviewPages ? 'disabled' : ''} aria-label="次のページ"><span class="ico i-arrow"></span></button>
      </div>
        <div class="rv-page-input">
          <input class="pginput" id="rvPageInput" inputmode="numeric" value="${page}" aria-label="現在のページ" />
          <span>/ ${state.reviewPages}</span>
    </div>
        <div class="rv-preview-foot">
          <label class="switch rv-pos-switch" for="rvPos" title="ONで項目位置（bbox）を非表示">
            <span class="switch-text">項目位置を非表示</span>
            <input type="checkbox" id="rvPos" ${state.reviewPos ? 'checked' : ''} />
            <span class="switch-track" aria-hidden="true"></span>
          </label>
        </div>
      </section>

      <section class="rv-right nl-ocr-pane">
        ${isApproveUi ? '' : `<div class="rv-mode-row">
          <div class="rv-mode-toggle">
            <button class="rv-mode-btn ${state.reviewTab === 'preview' ? 'on' : ''}" data-rvtab="preview">Preview</button>
            <button class="rv-mode-btn ${state.reviewTab === 'json' ? 'on' : ''}" data-rvtab="json">JSON</button>
          </div>
        </div>
        <div class="rv-read-tabs">
          <button class="rv-read-tab ${state.reviewReadTab === 'text' ? 'on' : ''}" data-rvread="text">テキスト読取</button>
          <button class="rv-read-tab ${state.reviewReadTab === 'table' ? 'on' : ''}" data-rvread="table">テーブル情報読取</button>
        </div>`}
        ${isApproveUi
          ? `<div class="rv-doctype">
              <div class="rv-doctype-label"><span class="muted">読取文書タイプ : </span><b>${esc(dispLayout(REVIEW_DOC.layoutId) || REVIEW_DOC.title)}</b></div>
              <div class="rv-doctype-toggles"></div>
            </div>
            ${approveAuditHtml}`
          : `${state.reviewTab === 'json' ? '' : `<div class="rv-doctype">
          <div class="rv-doctype-label"><span class="muted">読取文書タイプ : </span><b>${esc(dispLayout(REVIEW_DOC.layoutId) || REVIEW_DOC.title)}</b></div>
          <div class="rv-doctype-toggles">
            <label class="switch"><span>エラー箇所のみ表示</span><input type="checkbox" id="rvOnlyErr" ${state.reviewOnlyErr ? 'checked' : ''} /></label>
            <label class="chk-inline"><input type="checkbox" id="rvBulkConfirm" ${state.reviewBulkConfirm ? 'checked' : ''} /><span>一括確認</span></label>
          </div>
        </div>`}
        <div class="rv-scroll${state.reviewTab === 'json' ? ' is-json' : ''}">${fieldsHtml}</div>`}
        <div class="review-foot nl-review-foot${isApproveUi ? ' is-approve' : ''}">
          <div class="rv-foot-left">
            <span class="rv-foot-note" title="${esc(tip)}">担当：確認 ${esc(assigneeUserNames(cfg.confirmGroups))}・承認 ${esc(assigneeUserNames(cfg.approveGroups))}${cfg.stages === 2 ? `・再承認 ${esc(assigneeUserNames(cfg.reapproveGroups))}` : ''}</span>
          </div>
          <div class="rv-foot-actions">
      <button class="btn" id="rvClose">閉じる</button>
            ${fl.canSave ? '<button class="btn primary" id="rvSave">保存</button>' : ''}
            ${footCta}
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

/** 帳票設定／利用設定の各一覧 */
function bindCfgPages() {
  document.querySelectorAll('[data-cfgpage]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.cfgpage;
      state.navMenu = null;
      if (id === 'ticketDetail') { openTicketTypes(); return; }
      if (id === 'bizScenes') { openBizScenes(state.sceneId); return; }
      if (TABS_DEF[id]) { openTab(id); return; }
      state.page = id; render();
    };
  });
  const q = (sel, key) => { const el = $(sel); if (el) { el.oninput = () => { cfgState[key] = el.value; }; el.onchange = () => render(); el.onkeydown = (e) => { if (e.key === 'Enter') render(); }; } };
  q('#cfgTicketQ', 'ticketQ'); q('#cfgSceneQ', 'sceneQ');

  /* アクセス設定：タブ切替 */
  document.querySelectorAll('[data-acctab]').forEach((b) => {
    b.onclick = () => { ACCESS_STATE.tab = b.dataset.acctab; render(); };
  });
  /* アクセス設定：通知先URLタブ */
  const notifyEdit = $('#accNotifyEdit');
  if (notifyEdit) notifyEdit.onclick = () => {
    ACCESS_STATE.notifyEditing = true;
    ACCESS_STATE.notifyDraft = ACCESS_STATE.notifyUrl;
    render();
    const el = $('#accNotifyUrl');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  };
  const notifySave = $('#accNotifySave');
  if (notifySave) notifySave.onclick = () => {
    const input = $('#accNotifyUrl');
    if (input) ACCESS_STATE.notifyUrl = input.value;
    ACCESS_STATE.notifyEditing = false;
    render();
    toast('通知先URLを保存しました');
  };
  const notifyInput = $('#accNotifyUrl');
  if (notifyInput) {
    notifyInput.oninput = () => { ACCESS_STATE.notifyDraft = notifyInput.value; };
  }
  const signGen = $('#accSignGen');
  if (signGen) signGen.onclick = () => {
    ACCESS_STATE.signKey = randomHexKey();
    render();
    toast('署名鍵を生成しました');
  };
  /* アクセス設定：APIキー管理タブ */
  const keyAdd = $('#accKeyAdd');
  if (keyAdd) keyAdd.onclick = () => {
    ACCESS_KEY_EDIT = { mode: 'add', name: '', term: '1年' };
    render();
    const el = $('#accKeyName'); if (el) el.focus();
  };
  document.querySelectorAll('[data-acckey]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (b.dataset.acckey === 'del') {
        ACCESS_KEYS = ACCESS_KEYS.filter((k) => k.id !== id);
        render();
        toast('APIキーを削除しました');
        return;
      }
      const k = ACCESS_KEYS.find((x) => x.id === id);
      if (!k) return;
      ACCESS_KEY_EDIT = { mode: 'edit', id, name: k.name };
      render();
    };
  });
  /* アクセス設定：APIキーダイアログ */
  if (ACCESS_KEY_EDIT) {
    const back = $('#accKeyBack');
    const closeKeyDlg = () => { ACCESS_KEY_EDIT = null; render(); };
    if (back) back.onclick = (e) => { if (e.target === back) closeKeyDlg(); };
    const x = $('#accKeyClose'); if (x) x.onclick = closeKeyDlg;
    const cancel = $('#accKeyCancel'); if (cancel) cancel.onclick = closeKeyDlg;
    const nameInput = $('#accKeyName');
    if (nameInput) nameInput.oninput = () => { ACCESS_KEY_EDIT.name = nameInput.value; };
    const termInput = $('#accKeyTerm');
    if (termInput) termInput.onchange = () => { ACCESS_KEY_EDIT.term = termInput.value; };
    const ok = $('#accKeyOk');
    if (ok) ok.onclick = () => {
      const name = (ACCESS_KEY_EDIT.name || '').trim();
      if (!name) { toast('名称を入力してください'); return; }
      if (ACCESS_KEY_EDIT.mode === 'edit') {
        const k = ACCESS_KEYS.find((x2) => x2.id === ACCESS_KEY_EDIT.id);
        if (k) k.name = name;
        toast('APIキーを更新しました');
      } else {
        const term = ACCESS_KEY_EDIT.term || '1年';
        const created = nowStamp();
        ACCESS_KEYS = [{
          id: 'ak' + Date.now(),
          name,
          key: randomHexKey(),
          created,
          from: String(created).slice(0, 10) + ' 00:00:00',
          to: endOfDay(shiftStamp(created, API_KEY_STATUS[term] || 365)),
          status: '有効',
          owner: 'test202604010001',
        }, ...ACCESS_KEYS];
        toast('APIキーを追加しました');
      }
      ACCESS_KEY_EDIT = null;
      render();
    };
  }
  /* API URL コピー */
  document.querySelectorAll('[data-copy]').forEach((b) => {
    b.onclick = async () => {
      const text = b.dataset.copy || '';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
        }
        toast('API URL をコピーしました');
      } catch (err) {
        toast('コピーできませんでした。URL を選択してコピーしてください');
      }
    };
  });

  // ユーザー管理
  const uq = $('#cfgUserQ');
  if (uq) { uq.oninput = () => { cfgState.userQ = uq.value; }; uq.onchange = () => render(); uq.onkeydown = (e) => { if (e.key === 'Enter') render(); }; }
  const us = $('#cfgUserSearch'); if (us) us.onclick = () => { render(); toast('検索しました（モック）'); };
  const ug = $('#cfgUserGroup'); if (ug) ug.onchange = () => { cfgState.userGroup = ug.value; render(); };
  const ur = $('#cfgUserReset'); if (ur) ur.onclick = () => {
    cfgState.userQ = ''; cfgState.userGroup = ''; render(); toast('絞り込み条件をリセットしました');
  };
  /* ユーザー追加：製品と同じ入力ダイアログを開く */
  const ua = document.querySelector('[data-useradd]');
  if (ua) ua.onclick = () => {
    USER_ADD_DRAFT = {
      mode: 'new',
      id: null,
      uid: null,
      name: '',
      email: '',
      roleId: ((ROLES.find((r) => r.name === 'システム管理者') || ROLES[0]) || {}).id || '',
      dataPerm: DATA_PERMISSIONS[1] || DATA_PERMISSIONS[0],
      status: '有効',
    };
    render();
    const el = $('#userAddName'); if (el) el.focus();
  };
  if (USER_ADD_DRAFT) {
    const back = $('#userAddBack');
    const closeDlg = () => { USER_ADD_DRAFT = null; render(); };
    if (back) back.onclick = (e) => { if (e.target === back) closeDlg(); };
    const x = $('#userAddClose'); if (x) x.onclick = closeDlg;
    const cancel = $('#userAddCancel'); if (cancel) cancel.onclick = closeDlg;
    const nm = $('#userAddName'); if (nm) nm.oninput = () => { USER_ADD_DRAFT.name = nm.value; };
    const em = $('#userAddEmail'); if (em) em.oninput = () => { USER_ADD_DRAFT.email = em.value; };
    const rl = $('#userAddRole'); if (rl) rl.onchange = () => { USER_ADD_DRAFT.roleId = rl.value; };
    const dp = $('#userAddDataPerm'); if (dp) dp.onchange = () => { USER_ADD_DRAFT.dataPerm = dp.value; };
    const st = $('#userAddStatus');
    if (st) st.onchange = () => {
      USER_ADD_DRAFT.status = st.checked ? '有効' : '無効';
      render();
    };
    const ok = $('#userAddOk');
    if (ok) ok.onclick = () => {
      const d = USER_ADD_DRAFT;
      if (!d.name.trim()) { toast('ユーザー名を入力してください'); return; }
      if (!d.email.trim()) { toast('メールアドレスを入力してください'); return; }
      const role = ROLES.find((r) => r.id === d.roleId) || ROLES[0];
      if (d.mode === 'edit') {
        const u = ENT_USERS.find((x) => x.id === d.id);
        if (u) {
          u.name = d.name.trim();
          u.email = d.email.trim();
          u.role = role ? role.name : u.role;
          u.dataPerm = d.dataPerm;
          u.status = d.status;
        }
        USER_ADD_DRAFT = null;
        render();
        toast('ユーザーを更新しました');
        return;
      }
      /* 追加：帳票権限側のユーザー（USERS）にも同じ人物を登録して uid で結ぶ。
       * 所属・操作権限はユーザーグループ側で後から付ける。 */
      const uid = 'u' + Date.now();
      USERS.push({ id: uid, name: d.name.trim() });
      const ent = {
        id: 'U' + Date.now(),
        uid,
        name: d.name.trim(),
        email: d.email.trim(),
        role: role ? role.name : 'アップロード者',
        dataPerm: d.dataPerm,
        created: nowStamp(),
        status: d.status,
      };
      ENT_USERS.unshift(ent);
      USER_ADD_DRAFT = null;
      render();
      toast('ユーザーを追加しました。所属はユーザーグループで設定してください');
    };
  }
  document.querySelectorAll('[data-usertoggle]').forEach((b) => {
    b.onclick = () => { const u = ENT_USERS.find((x) => x.id === b.dataset.usertoggle); u.status = u.status === '有効' ? '無効' : '有効'; render(); toast(`ユーザーを${u.status}にしました`); };
  });
  /* ユーザー編集：追加と同じダイアログを編集モードで開く */
  document.querySelectorAll('[data-useredit]').forEach((b) => {
    b.onclick = () => {
      const u = ENT_USERS.find((x) => x.id === b.dataset.useredit);
      if (!u) return;
      const r = ROLES.find((x) => x.name === u.role);
      USER_ADD_DRAFT = {
        mode: 'edit',
        id: u.id,
        uid: u.uid,
        name: u.name,
        email: u.email,
        roleId: (r && r.id) || (((ROLES.find((x) => x.name === 'システム管理者') || ROLES[0]) || {}).id) || '',
        dataPerm: u.dataPerm || DATA_PERMISSIONS[0],
        status: u.status,
      };
      render();
      const el = $('#userAddName'); if (el) el.focus();
    };
  });
  // 権限設定
  const roleName = $('#roleName');
  if (roleName) roleName.oninput = () => { state.roleDraft.name = roleName.value; };
  const roleStatus = $('#roleStatus');
  if (roleStatus) roleStatus.onchange = () => { state.roleDraft.status = roleStatus.value; };
  const roleSearch = $('#roleSearch');
  if (roleSearch) roleSearch.onclick = () => {
    state.roleFilters = { name: state.roleDraft.name || '', status: state.roleDraft.status || '' };
    state.rolePage = 1;
    render();
    toast(`検索しました：${roleRows().length} 件が該当しました`);
  };
  const roleReset = $('#roleReset');
  if (roleReset) roleReset.onclick = () => {
    state.roleDraft = { name: '', status: '' };
    state.roleFilters = { name: '', status: '' };
    state.rolePage = 1;
    render();
    toast('絞り込み条件をリセットしました');
  };
  /* メニュー権限（システムレベル）ダイアログ */
  document.querySelectorAll('[data-rolemenu]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.rolemenu;
      state.menuPerm = { roleId: id, checked: (MENU_PERMS[id] || []).slice(), closed: [] };
      render();
    };
  });
  /* 権限編集ダイアログ */
  document.querySelectorAll('[data-roleedit]').forEach((b) => {
    b.onclick = () => {
      const r = byId(ROLES, b.dataset.roleedit);
      if (!r) return;
      state.permForm = { mode: 'edit', id: r.id, name: r.name, code: r.code, desc: r.desc === '—' ? '' : r.desc, status: r.status };
      render();
    };
  });
  document.querySelectorAll('[data-roledel]').forEach((b) => {
    b.onclick = () => {
      if (!window.confirm('この権限を削除しますか？')) return;
      const i = ROLES.findIndex((r) => r.id === b.dataset.roledel);
      if (i >= 0) ROLES.splice(i, 1);
      render();
      toast('権限を削除しました');
    };
  });
  const ra = document.querySelector('[data-roleadd]');
  if (ra) ra.onclick = () => {
    state.permForm = { mode: 'new', id: null, name: '', code: '', desc: '', status: '有効' };
    render();
  };
  document.querySelectorAll('[data-rolepage]').forEach((b) => {
    b.onclick = () => { if (b.disabled) return; state.rolePage = Number(b.dataset.rolepage) || 1; render(); };
  });
  const rolePer = document.querySelector('[data-roleper]');
  if (rolePer) rolePer.onchange = () => { state.rolePerPage = Number(rolePer.value) || 10; state.rolePage = 1; render(); };
  const roleGo = document.querySelector('[data-rolegoto]');
  if (roleGo) roleGo.onchange = () => {
    const n = Number(roleGo.value) || 1;
    const max = Math.max(1, Math.ceil(roleRows().length / state.rolePerPage));
    state.rolePage = Math.min(max, Math.max(1, n));
    render();
  };

  /* ── 権限設定：タブ（権限 / ユーザーグループ） ───────────────────── */
  document.querySelectorAll('[data-role-tab]').forEach((b) => {
    b.onclick = () => { state.roleTab = b.dataset.roleTab === 'group' ? 'group' : 'role'; render(); };
  });

  /* ── ユーザー管理：タブ（ユーザー一覧 / ユーザーグループ） ────────── */
  document.querySelectorAll('[data-user-tab]').forEach((b) => {
    b.onclick = () => { state.userTab = b.dataset.userTab === 'group' ? 'group' : 'user'; render(); };
  });

  /* ── ユーザーグループ ──────────────────────────────────────────── */
  const grpQ = $('#grpQ');
  if (grpQ) grpQ.oninput = () => { state.groupDraft.q = grpQ.value; };
  if (grpQ) grpQ.onkeydown = (e) => { if (e.key === 'Enter') { state.groupFilters = { ...state.groupDraft }; state.groupPage = 1; render(); } };
  const grpKind = $('#grpKind');
  if (grpKind) grpKind.onchange = () => { state.groupDraft.kind = grpKind.value; };
  const grpSearch = $('#grpSearch');
  if (grpSearch) grpSearch.onclick = () => {
    state.groupFilters = { ...state.groupDraft };
    state.groupPage = 1;
    render();
    toast(`検索しました：${groupRows().length} 件が該当しました`);
  };
  const grpReset = $('#grpReset');
  if (grpReset) grpReset.onclick = () => {
    state.groupDraft = { q: '', kind: '' };
    state.groupFilters = { q: '', kind: '' };
    state.groupPage = 1;
    render();
    toast('絞り込み条件をリセットしました');
  };
  document.querySelectorAll('[data-grppage]').forEach((b) => {
    b.onclick = () => { if (b.disabled) return; state.groupPage = Number(b.dataset.grppage) || 1; render(); };
  });
  const grpPer = document.querySelector('[data-grpper]');
  if (grpPer) grpPer.onchange = () => { state.groupPerPage = Number(grpPer.value) || 10; state.groupPage = 1; render(); };
  const grpGo = document.querySelector('[data-grpgoto]');
  if (grpGo) grpGo.onchange = () => {
    const n = Number(grpGo.value) || 1;
    const max = Math.max(1, Math.ceil(groupRows().length / state.groupPerPage));
    state.groupPage = Math.min(max, Math.max(1, n));
    render();
  };
  const grpAdd = document.querySelector('[data-grpadd]');
  if (grpAdd) grpAdd.onclick = () => {
    state.groupForm = { mode: 'new', id: 'g' + Date.now(), name: '', kind: '確認', desc: '', userIds: [], tab: 'basic' };
    render();
  };
  document.querySelectorAll('[data-grpedit]').forEach((b) => {
    b.onclick = () => {
      const g = byId(GROUPS, b.dataset.grpedit);
      if (!g) return;
      state.groupForm = { mode: 'edit', id: g.id, name: g.name, kind: g.kind || '確認', desc: g.desc || '', userIds: (g.userIds || []).slice(), tab: 'basic' };
      render();
    };
  });
  document.querySelectorAll('[data-grpdel]').forEach((b) => {
    b.onclick = () => {
      const g = byId(GROUPS, b.dataset.grpdel);
      if (!g) return;
      const used = groupTickets(g.id).length;
      const msg = used
        ? `「${g.name}」を削除しますか？\n${used} 件の帳票タイプで担当に設定されています。削除するとそれらは未設定になります。`
        : `「${g.name}」を削除しますか？`;
      if (!window.confirm(msg)) return;
      /* 帳票権限表からも参照を外す（宙に浮いた担当を残さない） */
      Object.keys(TICKET_PERMS).forEach((lid) => {
        const p = TICKET_PERMS[lid];
        Object.keys(p).forEach((k) => { p[k] = (p[k] || []).filter((x) => x !== g.id); });
      });
      const i = GROUPS.findIndex((x) => x.id === g.id);
      if (i >= 0) GROUPS.splice(i, 1);
      render();
      toast('グループを削除しました');
    };
  });

  /* グループ作成／編集ダイアログ */
  if (state.groupForm) {
    const back = $('#grpFormBack');
    const closeGrp = () => { state.groupForm = null; render(); };
    if (back) back.onclick = (e) => { if (e.target === back) closeGrp(); };
    const gc = $('#grpFormClose'); if (gc) gc.onclick = closeGrp;
    const gx = $('#grpFormCancel'); if (gx) gx.onclick = closeGrp;
    document.querySelectorAll('[data-grp-tab]').forEach((b) => {
      b.onclick = () => { state.groupForm.tab = b.dataset.grpTab; render(); };
    });
    const gn = $('#grpFormName');
    if (gn) gn.oninput = () => { state.groupForm.name = gn.value; };
    const gd = $('#grpFormDesc');
    if (gd) gd.oninput = () => { state.groupForm.desc = gd.value; };
    document.querySelectorAll('[data-grp-kind]').forEach((b) => {
      b.onclick = () => {
        const g = state.groupForm;
        if (!g) return;
        const roles = toggleGroupRole(g, b.dataset.grpKind);
        state.groupForm.kind = roles.join('、');
        state.groupForm.roles = roles;
        render();
      };
    });
    /* 所属ユーザー：多対多なのでチェックで増減。render しないと件数表示が追随しない */
    document.querySelectorAll('[data-grp-cat]').forEach((cb) => {
      cb.onchange = () => {
        const g = state.groupForm;
        if (!g) return;
        applyGroupCategory(g, cb.dataset.grpCat, cb.checked);
        render();
      };
    });
    /* 承認の段：カテゴリ内の全帳票タイプのその段だけに、グループを入れ／外しする */
    document.querySelectorAll('[data-grp-stage]').forEach((b) => {
      b.onclick = () => {
        const g = state.groupForm;
        if (!g) return;
        const parts = String(b.dataset.grpStage).split(':');
        const catId = parts[0];
        const stageIdx = Math.max(0, (Number(parts[1]) || 1) - 1);
        const joined = LAYOUT.some((l) => (catOf(l.id) || {}).id === catId
          && stageTargetsOf(l.id, stageIdx).indexOf(g.id) >= 0);
        if (!joined) applyGroupCategoryOps(g, catId, true);
        setGroupCategoryStage(g, catId, stageIdx, !joined);
        render();
      };
    });
    document.querySelectorAll('[data-grp-user]').forEach((cb) => {
      cb.onchange = () => {
        const uid = cb.dataset.grpUser;
        const cur = state.groupForm.userIds || [];
        state.groupForm.userIds = cb.checked ? cur.concat([uid]) : cur.filter((x) => x !== uid);
        render();
      };
    });
    /* 帳票権限：チェックのたびに TICKET_PERMS を書き換える（保存先は帳票権限表と共通） */
    document.querySelectorAll('[data-grp-tk]').forEach((cb) => {
      cb.onchange = () => {
        const [lid, act] = cb.dataset.grpTk.split(':');
        const gid = state.groupForm.id;
        const p = TICKET_PERMS[lid] || (TICKET_PERMS[lid] = { view: [], confirm: [], approve: [], reapprove: [] });
        const cur = p[act] || [];
        p[act] = cb.checked ? (cur.includes(gid) ? cur : cur.concat([gid])) : cur.filter((x) => x !== gid);
        render();
      };
    });
    const gok = $('#grpFormOk');
    if (gok) gok.onclick = () => {
      const f = state.groupForm;
      if (!String(f.name || '').trim()) { toast('グループ名を入力してください'); return; }
      const exist = byId(GROUPS, f.id);
      if (exist) {
        exist.name = f.name.trim();
        exist.kind = f.kind;
        exist.roles = groupRolesOf(f);
        exist.desc = f.desc || '';
        exist.userIds = (f.userIds || []).slice();
      } else {
        GROUPS.push({ id: f.id, name: f.name.trim(), kind: groupRolesOf(f).join('、'), roles: groupRolesOf(f), desc: f.desc || '', userIds: (f.userIds || []).slice() });
      }
      state.groupForm = null;
      render();
      toast('グループを保存しました');
    };
  }

  // セキュリティ設定（3 モジュール。変更は保存で確定する）
  document.querySelectorAll('[data-sec]').forEach((el) => {
    el.onchange = () => {
      SECURITY[el.dataset.sec] = el.value;
      toast('設定を変更しました（保存で確定）');
    };
  });
  const secSave = $('#secSave');
  if (secSave) secSave.onclick = () => toast('セキュリティ設定を保存しました（モック）');
  const secClose = $('#secClose');
  if (secClose) secClose.onclick = () => { location.hash = '#page=home'; };
  // ログ設定
  const le = document.querySelector('[data-logexport]');
  if (le) le.onclick = () => {
    const head = ['操作日時', 'メールアドレス', 'イベント種別', 'IPアドレス', '操作結果', '備考'];
    const lines = [head.join(',')].concat(SECURITY.logs.map((l) => [l.at, l.user, l.type, l.ip, l.result, l.note].join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `操作ログ_${SECURITY.logs.length}件.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`${SECURITY.logs.length} 件のログをダウンロードしました`);
  };

  /* ── 帳票権限（業務レベル）：セルをクリックして担当を編集 ── */
  document.querySelectorAll('[data-permcell]').forEach((b) => {
    b.onclick = () => {
      const [layoutId, act] = b.dataset.permcell.split(':');
      state.permCell = { kind: 'ticket', layoutId, act };
      render();
    };
  });
  document.querySelectorAll('[data-permclear]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.permclear;
      TICKET_PERMS[id] = { view: [], confirm: [], approve: [], reapprove: [], stages: [] };
      render();
      toast(`「${dispLayout(id)}」の権限をクリアしました`);
    };
  });
  document.querySelectorAll('[data-uploadcell]').forEach((b) => {
    b.onclick = () => {
      state.permCell = { kind: 'upload', bizId: b.dataset.uploadcell };
      render();
    };
  });
  document.querySelectorAll('[data-uploadclear]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.uploadclear;
      UPLOAD_PERMS[id] = [];
      render();
      toast(`「${dispBiz(id)}」のアップロード権限をクリアしました`);
    };
  });

  document.querySelectorAll('[data-cfg]').forEach((b) => {
    b.onclick = () => {
      const act = b.dataset.cfg, id = b.dataset.id;
      const idx = (arr) => arr.findIndex((x) => x.id === id);
      if (act === 'addType') {
        cfgState.ticketQ = '';
        const nt = { id: 'T' + Date.now(), name: `新規タイプ_${TICKET_TYPES.length + 1}`, type: '非定型帳票', project: 0, updatedAt: nowStamp(), user: '佐藤 美子' };
        TICKET_TYPES.unshift(nt);
        state.typeId = nt.id;
        state.typeStep = 1;
        state.typeItemMenu = null;
        state.page = 'ticketDetail';
        if (!isTabOpen('ticketDetail')) state.tabs.push('ticketDetail');
        render();
        toast('タイプを追加しました（モック）');
        return;
      }
      else if (act === 'delType') {
        TICKET_TYPES.splice(idx(TICKET_TYPES), 1);
        if (state.typeId === id) state.typeId = (TICKET_TYPES[0] && TICKET_TYPES[0].id) || null;
        toast('削除しました');
      }
      else if (act === 'editType') { openTicketDetail(id); return; }
      else if (act === 'addScene') { cfgState.sceneQ = ''; BIZ_SCENES.unshift({ id: 'cls-' + Date.now(), name: `新規業務シーン${BIZ_SCENES.length + 1}`, sceneId: String(2077224056968261700 + BIZ_SCENES.length + 1), desc: '', formIds: [], userIds: [], updatedAt: nowStamp() }); toast('業務シーンを追加しました（モック）'); }
      else if (act === 'delScene') { BIZ_SCENES.splice(idx(BIZ_SCENES), 1); toast('削除しました'); }
      else if (act === 'editScene') { toast('業務シーンの詳細（判別対象の帳票選択）は製品側の画面です'); return; }
      render();
    };
  });
}

/** 権限系ダイアログ（権限作成／編集・メニュー権限・帳票権限セル）のイベント */
function bindPermDialogs() {
  const closeAll = () => { state.permForm = null; state.menuPerm = null; state.permCell = null; render(); };
  const wire = (backId, closeIds) => {
    const back = $(backId);
    if (back) back.onclick = (e) => { if (e.target === back) closeAll(); };
    closeIds.forEach((id) => { const el = $('#' + id); if (el) el.onclick = closeAll; });
  };

  /* ── 権限の新規作成／編集 ── */
  const f = state.permForm;
  if (f) {
    wire('#permFormBack', ['permFormClose', 'permFormCancel']);
    const name = $('#permFormName'); if (name) name.oninput = () => { f.name = name.value; };
    const code = $('#permFormCode'); if (code) code.oninput = () => { f.code = code.value; };
    const desc = $('#permFormDesc'); if (desc) desc.oninput = () => { f.desc = desc.value; };
    const st = $('#permFormStatus');
    if (st) st.onclick = () => {
      f.status = f.status === '有効' ? '無効' : '有効';
      st.classList.toggle('off', f.status !== '有効');
      st.querySelector('.tgl-txt').textContent = f.status;
      st.setAttribute('aria-checked', String(f.status === '有効'));
    };
    const ok = $('#permFormOk');
    if (ok) ok.onclick = () => {
      if (!String(f.name || '').trim()) { toast('権限名を入力してください'); return; }
      if (!String(f.code || '').trim()) { toast('権限IDを入力してください'); return; }
      if (f.mode === 'new') {
        const id = 'R' + Date.now();
        ROLES.unshift({ id, name: f.name.trim(), code: f.code.trim(), desc: f.desc.trim() || '—', created: nowStamp(), status: f.status });
        MENU_PERMS[id] = [];
        state.rolePage = 1;
        state.permForm = null; render();
        toast('権限を作成しました');
      } else {
        const r = byId(ROLES, f.id);
        if (r) { r.name = f.name.trim(); r.code = f.code.trim(); r.desc = f.desc.trim() || '—'; r.status = f.status; }
        state.permForm = null; render();
        toast('権限を更新しました');
      }
    };
  }

  /* ── メニュー権限（システムレベルの画面到達権限ツリー） ── */
  const m = state.menuPerm;
  if (m) {
    wire('#menuPermBack', ['menuPermClose', 'menuPermCancel']);
    const findNode = (id) => { let hit = null; const walk = (ns) => ns.forEach((n) => { if (n.id === id) hit = n; else if (n.children) walk(n.children); }); walk(MENU_TREE); return hit; };
    const leavesOf = (id) => { const n = findNode(id); return n ? menuPermLeaves(n) : []; };
    /* 子を持つノードの id（折りたたみ対象）を上から順に集める */
    const branchIds = () => { const out = []; const w = (ns) => ns.forEach((n) => { if (n.children) { out.push(n.id); w(n.children); } }); w(MENU_TREE); return out; };
    /* すべて選択／すべて解除（スイッチが ON なら解除） */
    document.querySelectorAll('[data-mpall]').forEach((b) => {
      b.onclick = () => {
        const allOn = MENU_LEAVES.length > 0 && MENU_LEAVES.every((id) => m.checked.includes(id));
        m.checked = allOn ? [] : MENU_LEAVES.slice();
        render();
      };
    });
    /* もっと見る／折りたたみ（スイッチが ON なら全折りたたみ） */
    document.querySelectorAll('[data-mpexpand]').forEach((b) => {
      b.onclick = () => {
        m.closed = (m.closed || []).length === 0 ? branchIds() : [];
        render();
      };
    });
    document.querySelectorAll('[data-mptoggle]').forEach((c) => {
    c.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = c.dataset.mptoggle;
        const i = m.closed.indexOf(id);
        if (i >= 0) m.closed.splice(i, 1); else m.closed.push(id);
      render();
    };
  });
    document.querySelectorAll('[data-mpnode]').forEach((cb) => {
      const leaves = leavesOf(cb.dataset.mpnode);
      const on = leaves.filter((l) => m.checked.includes(l)).length;
      cb.indeterminate = on > 0 && on < leaves.length;    // 半選択（親ノード）
      cb.onclick = (e) => {
      e.stopPropagation();
        if (cb.checked) leaves.forEach((l) => { if (!m.checked.includes(l)) m.checked.push(l); });
        else m.checked = m.checked.filter((l) => !leaves.includes(l));
      render();
    };
  });
    const ok = $('#menuPermOk');
    if (ok) ok.onclick = () => {
      MENU_PERMS[m.roleId] = m.checked.slice();
      state.menuPerm = null; render();
      toast('メニュー権限を保存しました');
    };
  }

  /* ── 帳票／アップロード権限のセル編集（药丸でグループ／ユーザーを切替え） ── */
  const c = state.permCell;
  if (c) {
    wire('#permCellBack', ['permCellClose', 'permCellCancel']);
    document.querySelectorAll('[data-perm-mode]').forEach((b) => {
      b.onclick = () => {
        const mode = b.dataset.permMode;
        if (!mode || c.mode === mode) return;
        c.mode = mode;
        render();
      };
    });
    /* ユーザーは単選＋再クリックで解除 */
    document.querySelectorAll('[data-permpick^="u:"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (el.dataset.wasChecked === '1') {
          el.checked = false;
          el.dataset.wasChecked = '0';
          e.preventDefault();
        } else {
          document.querySelectorAll('[data-permpick^="u:"]').forEach((x) => { x.dataset.wasChecked = '0'; });
          el.dataset.wasChecked = '1';
        }
      });
      if (el.checked) el.dataset.wasChecked = '1';
    });
    const ok = $('#permCellOk');
    if (ok) ok.onclick = () => {
      const mode = c.mode === 'user' ? 'user' : 'group';
      const groups = [...document.querySelectorAll('[data-permpick^="g:"]')].filter((cb) => cb.checked).map((cb) => cb.dataset.permpick.split(':')[1]);
      const users = [...document.querySelectorAll('[data-permpick^="u:"]')].filter((cb) => cb.checked).map((cb) => cb.dataset.permpick.split(':')[1]);
      const picked = mode === 'user' ? users.slice(0, 1) : groups;
      if (c.kind === 'upload') {
        setPermTargetsForCell(c, picked);
        state.permCell = null; render();
        toast(`「${dispBiz(c.bizId)}」のアップロード権限を更新しました`);
        return;
      }
      setPermTargetsForCell(c, picked);
      state.permCell = null; render();
      toast(`「${dispLayout(c.layoutId)}」の${permActLabelOf(c.act)}権限を更新しました`);
    };
  }
}

/** ページプレビュー（画像だけを見せるモーダル。閉じる＝× と背景クリック、複数ページは左右の矢印） */
function bindPreviewModal() {
  document.querySelectorAll('[data-preview]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      state.pvId = b.dataset.preview || null;
      state.pvOpen = true;
      state.pvPage = Number(b.dataset.page) || 1;
      state.pvZoom = 1;
      state.pvRotate = 0;
      render();
    };
  });
  const closePv = () => { state.pvOpen = false; render(); };
  const pvClose = $('#pvClose'); if (pvClose) pvClose.onclick = closePv;
  const pvBack = $('#pvBack'); if (pvBack) pvBack.onclick = (e) => { if (e.target === pvBack) closePv(); };
  const pvPrev = $('#pvPrev'); if (pvPrev) pvPrev.onclick = () => { state.pvPage = Math.max(1, state.pvPage - 1); render(); };
  const pvNext = $('#pvNext'); if (pvNext) pvNext.onclick = () => {
    const t = previewTarget();
    const total = Math.max(1, Number(t && t.pages) || 1);
    state.pvPage = Math.min(total, state.pvPage + 1); render();
  };
}

/** ホーム（ご利用履歴） */
function bindHomePanel() {
  const hFrom = $('#hFrom'); if (hFrom) hFrom.onchange = () => { state.hFilters.from = hFrom.value; state.hPage = 1; render(); };
  const hTo = $('#hTo'); if (hTo) hTo.onchange = () => { state.hFilters.to = hTo.value; state.hPage = 1; render(); };
  const hUser = $('#hUser'); if (hUser) hUser.oninput = () => { state.hFilters.user = hUser.value; };
  document.querySelectorAll('[data-hopt]').forEach((cb) => {
    cb.onclick = (e) => {
      e.stopPropagation();
      const key = { hLayout: 'layout', hBiz: 'biz' }[cb.dataset.hopt];
      if (!key) return;
      const cur = (state.hFilters[key] || []).slice();
      const i = cur.indexOf(cb.value);
      if (cb.checked && i < 0) cur.push(cb.value);
      if (!cb.checked && i >= 0) cur.splice(i, 1);
      state.hFilters[key] = cur; state.hPage = 1; render();
    };
  });
  const emptyHomeFilters = () => ({ from: '', to: '', layout: [], user: '', biz: [] });
  const defaultHomeFilters = () => ({ from: HOME_FROM, to: HOME_TO, layout: [], user: '', biz: [] });
  const hSearch = $('#hSearch'); if (hSearch) hSearch.onclick = () => {
    const el = $('#hUser');
    if (el) state.hFilters.user = el.value;
    runSearch('home');
  };
  const hClearAll = $('#hClearAll'); if (hClearAll) hClearAll.onclick = () => { state.hFilters = emptyHomeFilters(); state.hPage = 1; render(); toast('条件をすべて解除しました'); };
  const hReset = $('#hReset'); if (hReset) hReset.onclick = () => { state.hFilters = defaultHomeFilters(); state.hPage = 1; render(); toast('絞り込み条件をリセットしました'); };
  document.querySelectorAll('[data-hpage]').forEach((b) => { b.onclick = () => { state.hPage = Number(b.dataset.hpage); render(); }; });
  const hPer = document.querySelector('[data-hper]'); if (hPer) hPer.onchange = () => { state.hPerPage = Number(hPer.value.replace(/\D/g, '')); state.hPage = 1; render(); };
  const hGo = document.querySelector('[data-hgoto]'); if (hGo) hGo.onchange = () => { const n = Number(hGo.value) || 1; state.hPage = Math.max(1, n); render(); };
  const hDl = $('#hDownload'); if (hDl) hDl.onclick = downloadHistoryCsv;

}

/** マイタスク */
function bindMyTasks() {
  document.querySelectorAll('[data-mytab]').forEach((b) => {
    b.onclick = () => { state.myTaskTab = b.dataset.mytab; render(); };
  });
  const readMtFilters = () => {
    state.myTaskFilters = {
      name: ($('#mtName') || {}).value || '',
      biz: ($('#mtBiz') || {}).value || '',
      cat: ($('#mtCat') || {}).value || '',
      updatedFrom: ($('#mtUpdatedFrom') || {}).value || '',
      updatedTo: ($('#mtUpdatedTo') || {}).value || '',
      createdFrom: ($('#mtCreatedFrom') || {}).value || '',
      createdTo: ($('#mtCreatedTo') || {}).value || '',
      assignee: ($('#mtAssignee') || {}).value || '', kind: ($('#mtKind') || {}).value || '',
    };
  };
  const mtSearch = $('#mtSearch');
  if (mtSearch) mtSearch.onclick = () => { readMtFilters(); render(); };
  const mtReset = $('#mtReset');
  if (mtReset) mtReset.onclick = () => {
    state.myTaskFilters = { name: '', biz: '', cat: '', kind: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' };
    render();
  };
  ['mtName', 'mtAssignee'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.onkeydown = (e) => { if (e.key === 'Enter') { readMtFilters(); render(); } };
  });
  /* ファイル名クリック＝帳票のページプレビュー（読取結果一覧の「详情」と同じ）
     操作ボタン（確認する／承認する／详情）は従来どおり確認画面へ遷移する。 */
  document.querySelectorAll('[data-task-open]').forEach((b) => {
    b.onclick = (e) => {
      const isName = b.classList.contains('fn') || b.closest('td.name');
      if (isName) {
        if (e) e.stopPropagation();
        openPreview(b.dataset.taskOpen);
        return;
      }
      openReview(b.dataset.taskOpen, {
        returnPage: 'myTasks',
        viewOnly: state.myTaskTab === 'done',
      });
    };
  });
}

/** ファイル一覧の行操作・ダウンロード */
function bindPaneNav() {
  // 読取結果一覧のフロー操作（プレビュー／修正／確認／承認／差戻／出力）
  document.querySelectorAll('[data-act][data-file]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const act = b.dataset.act, id = b.dataset.file;
      if (act === 'delete') { FILES_DATA = FILES_DATA.filter((x) => x.id !== id); render(); toast('削除しました'); return; }
      if (act === 'detail') { openPreview(id); return; }   // 详情＝帳票のページプレビュー（確認画面ではない）
      if (act === 'confirm') { openReview(id, { returnPage: 'result' }); return; }
      if (act === 'export') { toast('CSV 出力は確認・承認完了後に実行できます'); return; }
      runFlowAction(id, act);
    };
  });

  const dlb = $('#dlPopBack');
  if (dlb) dlb.onclick = (e) => { if (e.target === dlb) { state.dlMenu = null; render(); } };
  const dlc = $('#dlPopCancel'); if (dlc) dlc.onclick = () => { state.dlMenu = null; render(); };
  document.querySelectorAll('[data-dl]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      state.dlMenu = null;
      downloadResultFile(b.dataset.file, b.dataset.dl);
      render();
    };
  });

  document.querySelectorAll('[data-page]').forEach((b) => {
    b.onclick = () => {
      const page = b.dataset.page;
      if (page === state.page) return;
      state.page = page; state.dd = null; state.picked = {}; state.upPicked = {};
      if (page === 'upload') state.filterOpen = false;
      render();
    };
  });

}

/** アップロード画面（新規アップロード） */
function bindUploadPanel() {
  const upBizSel = $('#upBizSelect');
  if (upBizSel) upBizSel.onchange = () => { state.upBiz = upBizSel.value; render(); };
  const dz = $('#dropzone');
  if (dz) {
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { stop(e); if (!state.dragOver) { state.dragOver = true; dz.classList.add('over'); } }));
    ['dragleave', 'dragend'].forEach((ev) => dz.addEventListener(ev, (e) => { stop(e); state.dragOver = false; dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => {
      stop(e);
      state.dragOver = false; dz.classList.remove('over');
      const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
      addUploadedFiles(files.map((f) => [f.name, f.size]));
    });
    dz.onclick = (e) => { if (e.target.closest('#pickBtn') || e.target === dz) { const fi = $('#fileInput'); if (fi) fi.click(); } };
  }
  const fi = $('#fileInput');
  if (fi) fi.onchange = () => { addUploadedFiles([...fi.files].map((f) => [f.name, f.size])); fi.value = ''; };
  const pick = $('#pickBtn'); if (pick) pick.onclick = (e) => { e.stopPropagation(); const f = $('#fileInput'); if (f) f.click(); };
  document.querySelectorAll('[data-uppick]').forEach((cb) => { cb.onclick = (e) => { e.stopPropagation(); state.upPicked[cb.dataset.uppick] = cb.checked; render(); }; });
  document.querySelectorAll('[data-uppage]').forEach((b) => { b.onclick = () => { state.upPage = Number(b.dataset.uppage); render(); }; });
  const uPer = document.querySelector('[data-upperpage]'); if (uPer) uPer.onchange = () => { state.upPerPage = Number(uPer.value.replace(/\D/g, '')); state.upPage = 1; render(); };
  const uGo = document.querySelector('[data-upgoto]'); if (uGo) uGo.onchange = () => { state.upPage = Math.max(1, Number(uGo.value) || 1); render(); };
  const upAll = $('[data-upall]'); if (upAll) upAll.onclick = () => {
    const selectable = state.uploads.filter((u) => u.status === 'waiting' || u.status === 'failed');
    const allOn = selectable.length > 0 && selectable.every((u) => state.upPicked[u.id]);
    selectable.forEach((u) => { state.upPicked[u.id] = !allOn; });
    render();
  };
  const upDel = $('#upDel'); if (upDel) upDel.onclick = () => {
    const n = Object.values(state.upPicked).filter(Boolean).length;
    state.uploads = state.uploads.filter((u) => !state.upPicked[u.id]); state.upPicked = {};
    render(); toast(n + ' 件を削除しました');
  };
  const upRead = $('#upRead');
  if (upRead) upRead.onclick = () => {
    /* 分類完了（読取待ち／失敗の再実行）のみ。分類中は対象外 */
    const targets = state.uploads.filter((u) => state.upPicked[u.id] && (u.status === 'waiting' || u.status === 'failed'));
    if (!targets.length) {
      toast('読取待ちの帳票を選択してください。要確認（自動分類中）の帳票は完了後にタイプを確認してから読取できます');
      return;
    }
    targets.forEach((u) => {
      u.status = 'reading';
      u.error = '';
      u._proc = true;
      u.history = '読取処理中（0秒経過）';
      promoteUploadToResult(u);
    });
    state.upPicked = {};
    startReading(targets);
    /* 読取中でも即座に読取結果一覧へ遷移する（進行中のまま一覧で進捗確認） */
    if (!isTabOpen('result')) state.tabs.push('result');
    state.page = 'result';
    state.tab = 'reading';
    /* 新規行が絞り込み・ツリー検索・ツリー選択で隠れないよう、表示条件を既定に戻してから一覧へ移る */
    state.filters = { ...defaultFilters(), createdFrom: HOME_FROM, createdTo: HOME_TO };
    state.q = '';
    state.filterOpen = false;
    state.resultPage = 1;
    state.activeNode = { type: 'all', id: 'all' };
    render();
    toast(`選択した ${targets.length} 件の読取を開始しました（読取結果一覧へ移動）`);
  };
  document.querySelectorAll('[data-uptype]').forEach((sel) => {
    sel.onchange = () => {
      const u = state.uploads.find((x) => x.id === sel.dataset.uptype);
      if (!u) return;
      u.layout = sel.value; u.auto = false;
      u.history = `帳票タイプ「${dispLayout(u.layout)}」に手動で分類`;
      render();
      toast(`帳票タイプを「${dispLayout(u.layout)}」に変更しました`);
    };
  });
  document.querySelectorAll('[data-upact]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const u = state.uploads.find((x) => x.id === b.dataset.id); if (!u) return;
      if (b.dataset.upact === 'del') { state.uploads = state.uploads.filter((x) => x.id !== u.id); toast('削除しました'); }
      else if (b.dataset.upact === 'manual') {
        const sel = document.querySelector(`[data-uptype="${u.id}"]`);
        if (sel) { sel.focus(); toast('帳票タイプを選択してください'); }
        return;
      }
      else toast('プレビュー（モック）');
      render();
    };
  });

  document.querySelectorAll('[data-batchdl]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const fmt = b.dataset.batchdl;
      const ids = Object.keys(state.picked).filter((id) => state.picked[id]);
      if (!ids.length) { toast('ダウンロードするファイルを選択してください'); return; }
      const label = fmt === 'excel' ? 'Excel' : fmt.toUpperCase();
      toast(`${ids.length} 件を${label}でダウンロードしました（モック）`);
    };
  });
  const sb = $('#searchBtn'); if (sb) sb.onclick = () => runSearch('result');
  const rb = $('#resetBtn');
  if (rb) rb.onclick = () => {
    state.filters = defaultFilters();
    state.resultPage = 1; render(); toast('絞り込み条件をリセットしました');
  };

  document.querySelectorAll('[data-chip]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.chip;
      if (k === 'createdAt') { state.filters.createdFrom = ''; state.filters.createdTo = ''; }
      else if (k === 'updatedAt') { state.filters.updatedFrom = ''; state.filters.updatedTo = ''; }
      else if (k === 'readAt') { state.filters.readFrom = ''; state.filters.readTo = ''; }
      else if (k === 'checkedAt') { state.filters.checkedFrom = ''; state.filters.checkedTo = ''; }
      else if (k === 'approvedAt') { state.filters.approvedFrom = ''; state.filters.approvedTo = ''; }
      else if (k === 'name') state.filters.name = '';
      else state.filters[k] = '';
      render();
    };
  });

  // テーブル
  document.querySelectorAll('[data-sort]').forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.sort;
      if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else state.sort = { key: k, dir: 'asc' };
      render();
    };
  });
  document.querySelectorAll('[data-pick]').forEach((cb) => { cb.onclick = (e) => { e.stopPropagation(); state.picked[cb.dataset.pick] = cb.checked; render(); }; });
  document.querySelectorAll('[data-pickall]').forEach((b) => {
    b.onclick = () => {
      const rows = visibleFiles().slice((state.resultPage - 1) * state.perPage, state.resultPage * state.perPage);
      const allOn = rows.every((f) => state.picked[f.id]);
      rows.forEach((f) => { state.picked[f.id] = !allOn; });
      render();
    };
  });
  document.querySelectorAll('[data-resultpage]').forEach((b) => { b.onclick = () => { state.resultPage = Number(b.dataset.resultpage); render(); }; });
  const resultGo = $('[data-resultgoto]');
  if (resultGo) {
    const go = () => { const max = Math.max(1, Math.ceil(visibleFiles().length / state.perPage)); state.resultPage = Math.min(max, Math.max(1, Math.trunc(Number(resultGo.value)) || 1)); render(); };
    resultGo.onchange = go;
    resultGo.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  }
  const pp = $('[data-perpage]'); if (pp) pp.onchange = () => { state.perPage = Number(pp.value.replace(/\D/g, '')); state.resultPage = 1; render(); };

  // 展開／折りたたみ・フィルタ開閉・ドロワー
}

function startRename(nodeEl, type, id) {
  /* ツリーではファイル名のみ変更可（業務シーン・帳票タイプはマスタ固定） */
  if (type !== 'file') {
    toast('業務シーン・帳票タイプ名は変更できません');
    return;
  }
  const key = 'file:' + id;
  const current = dispFileName(id);
  const label = $('.label', nodeEl);
  const input = document.createElement('input');
  input.className = 'rename'; input.value = current;
  label.replaceWith(input); input.focus(); input.select();
  const commit = (save) => {
    if (save && input.value.trim()) {
      state.rename[key] = input.value.trim();
      toast('ファイル表示名を変更しました（表示のみ）');
    }
    render();
  };
  input.onblur = () => commit(true);
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); input.onblur = null; commit(true); } if (e.key === 'Escape') { input.onblur = null; commit(false); } };
}

/* 動作確認用：URL ハッシュで初期状態を指定できる（例 #tab=failed&node=biz:b2&ms=status）
   デモ用のフック。本番実装では不要。 */
function applyHash() {
  const h = location.hash.replace(/^#/, '');
  if (!h) { state.page = 'home'; return; }   // ハッシュなし＝ホーム（ご利用履歴）
  h.split('&').forEach((kv) => {
    const i = kv.indexOf('=');
    const k = i < 0 ? kv : kv.slice(0, i);
    const val = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
    if (k === 'tab') state.tab = val;
    else if (k === 'node') { const [type, id] = val.split(':'); state.activeNode = { type, id }; }
    else if (k === 'ms') state.dd = val;
    else if (k === 'q') state.q = val;
    else if (k === 'name') state.filters.name = val;
    else if (k === 'rename') { const [target, text] = val.split('|'); state.rename[target] = text; }
    else if (k === 'f') { const [key, v2] = val.split(':'); state.filters[key] = v2; }
    else if (k === 'open') state.filterOpen = true;
    else if (k === 'page') state.page = ['home', 'upload', 'result', 'myTasks', 'review', 'ticketTypes', 'ticketDetail', 'bizScenes', 'permissions', 'api', 'users', 'roles', 'security', 'logs'].includes(val) ? val : 'result';
    else if (k === 'review' && val) {
      state.reviewId = val;
      state.page = 'review';
      const tid = reviewTabId(val);
      if (!state.tabs.includes(tid)) state.tabs.push(tid);
      state.reviewSessions = state.reviewSessions || {};
      if (!state.reviewSessions[val]) state.reviewSessions[val] = { returnPage: 'myTasks', viewOnly: false };
    }
    else if (k === 'tabs') {
      state.tabs = val.split(',').filter((x) => tabDef(x));
      if (!state.tabs.length) state.tabs = ['home'];
      const first = tabDef(state.tabs[0]);
      state.page = first ? first.route : 'home';
      if (isReviewTab(state.tabs[0])) state.reviewId = reviewTabFileId(state.tabs[0]);
    }
    else if (k === 'tree' && val) state.treeOpen = val !== '0';
    else if (k === 'tenant' && TENANTS.some((t) => t.id === val)) state.tenant = val;
    else if (k === 'pv' && val) { state.pvOpen = true; state.pvPage = Number(val) || 1; }   // 値なしの ?tree は無視（既定は開）
    else if (k === 'up') {   // デモ用：アップロード済ファイルを n 件用意する
      const n = Number(val) || 3;
      const samples = ['10_住民異動届_記入済.pdf', '02_令和8年度保育所等利用申込書.pdf', '01_児童手当 認定請求書.pdf', '02_就労証明書.pdf', '01_介護保険認定申請書（新規・更新）.pdf', '01_令和8年度分市民税・県民税申告書.pdf'];
      const created = [];
      for (let i = 0; i < n; i++) { const u = makeUpload(samples[i % samples.length]); created.push(u); state.uploads.push(u); }
      state._seedClassify = created;      // applyHash 完了後に分類タイマーを起動する
    }
  });
}

applyHash();
if (state._seedClassify) { const c = state._seedClassify; delete state._seedClassify; startClassifying(c); }
render();
window.__demo = {
  GROUPS, ROLE_MEMBERS, USER_OPS, LAYOUT, CATEGORY, BUSINESS, UPLOAD_PERMS, ROLES, catStagesOf, setCatStages, approvalStageCountOf, maxApprovalStageCount, stageTargetsOf, setStageTargets,
  state,
  FILES_DATA,
  openTab,
  closeTab,
  historyRows,
  visibleFiles,
  defaultFilters,
  passesFilters,
  filteredByConditionsOnly,
  buildTree,
  ensureTreeSeeded,
  addTreeFolder,
  moveFileToFolder,
  moveTreeFolder,
  deleteTreeFolder,
  folderById,
  activeFilterChips,
  render,
  TICKET_TYPES,
        BIZ_SCENES,
  TICKET_PERMS,
  UPLOAD_PERMS,
  uploadPermsOf,
  canUploadBiz,
  canTicketAct,
  uploadableBusiness,
  ensureUpBizAllowed,
  isTenantAdmin,
  TENANT_ADMIN_ROLE,
  dataPermOf,
  userHasOp,
  canSeeMyTask,
  taskOwnerUid,
  entUserByUid,
  MENU_TREE,
  MENU_PERMS,
  ENT_USERS,
  ROLES,
  SECURITY,
  TENANTS,
  HEADER_MENUS,
  openTicketDetail,
  openTicketTypes,
  openBizScenes,
  openReview,
  runFlowAction,
  availableActions,
  flowProgress,
  approvalOf,
  myTaskFiles,
  myTaskRows,
  passesMyTaskFilters,
  canExportFile,
  reviewFootFlags,
  ensureConfirmAudit,
  confirmAuditOf,
  layoutIdOfTicketType,
  typePane,
  typeAssigneeChips,
  assigneeModeOf,
  DEMO_ACTORS,
  currentProfile,
  renderUsers,
  assigneeUserIds,
  assigneeUserNames,
  pickRandomAssignee,
  ROLE_MEMBERS,
  roleMemberIds,
  canReachMenu,
  canReachPage,
  menuLeavesForUser,
  renderTopNav,
  PAGE_MENU_NODE,
  USER_OPS,
  userOpsOf,
};
