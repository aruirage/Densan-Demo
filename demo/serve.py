#!/usr/bin/env python3
"""帳票読取デモ用の簡易静的サーバ（モックデータのみ・外部通信なし）。
   Usage: python3 serve.py [port]   → http://127.0.0.1:<port>/
   キャッシュを無効化しているので、HTML/CSS/JS を編集して再読み込みすれば即反映されます。

   app.js の自己修復パッチ：
   この demo の app.js は外部プロセスが頻繁に再生成しており、ときに
   「参照されているのに定義だけ消えている」識別子（GROUPS / groupChildren /
   HISTORY_DEPTS など）を残したまま書き換わる。そのままだと ReferenceError で
   ページ全体が描画されないため、配信時に欠けている宣言だけを先頭へ注入する。
   （ファイル自体は書き換えないので、app.js が再生成されても影響を受けない）
"""
import sys, functools, http.server, socketserver, os, re

PORT = int(sys.argv[1]) if (len(sys.argv) > 1 and sys.argv[1].isdigit()) else 8787
DIR = os.path.dirname(os.path.abspath(__file__))

# 注入しても安全な「値定義」と「関数定義」。app.js に存在しない名前だけを注入する。
INJECT_VALUES = {
    'GROUPS': """var GROUPS = [
  { id: 'g-root', name: '組織ルート', parentId: null, userIds: [], roleIds: ['R1'] },
  { id: 'g3', name: '窓口グループ', parentId: 'g-root', userIds: ['u1', 'u2', 'u3'], roleIds: ['R5'] },
  { id: 'g1', name: '確認者グループ', parentId: 'g-root', userIds: ['u4', 'u5'], roleIds: ['R2', 'R3'] },
  { id: 'g2', name: '承認者グループ', parentId: 'g1', userIds: ['u4'], roleIds: ['R2'] },
  { id: 'g4', name: '子育て支援グループ', parentId: 'g-root', userIds: ['u6', 'u7'], roleIds: ['R3', 'R5'] },
  { id: 'g4a', name: '児童手当班', parentId: 'g4', userIds: ['u6'], roleIds: ['R3'] },
  { id: 'g5', name: '介護保険グループ', parentId: 'g-root', userIds: ['u8'], roleIds: ['R3'] },
  { id: 'g6', name: '税務グループ', parentId: 'g-root', userIds: ['u2', 'u6'], roleIds: ['R5'] }
];""",
    'GROUP_ROOT_ID': "var GROUP_ROOT_ID = 'g-root';",
    # HISTORY は app.js の後方で定義されるため、先頭では TDZ で参照できない。
    # 空配列で用意し、定義後に serve.py が差し込む初期化式で埋める。
    'HISTORY_DEPTS': "var HISTORY_DEPTS = [];",
    'ASSIGNEE_GROUP_IDS': "var ASSIGNEE_GROUP_IDS = ['g3', 'g1', 'g2', 'g4', 'g4a', 'g5', 'g6'];",
    # 外部セッションが定義ごと消すことがある定数（参照だけ残ると ReferenceError で全画面が落ちる）
    'CURRENT_PROFILE': """var CURRENT_PROFILE = {
  id: 'u1', name: '佐藤 一郎', email: 'ichiro.sato@itso.co.jp', roleLabel: 'システム管理者'
};
window.DEMO_ACTORS = window.DEMO_ACTORS || [
  { id: 'u1', email: 'ichiro.sato@itso.co.jp', hint: 'システム管理者：万能権限' },
  { id: 'u2', email: 'hanako.suzuki@itso.co.jp', hint: '確認者' },
  { id: 'u4', email: 'minoru.tanaka@itso.co.jp', hint: '承認者' },
  { id: 'u8', email: 'ryo.nakamura@itso.co.jp', hint: '確認者' }
];
if (typeof window.currentProfile !== 'function') {
  window.currentProfile = function currentProfile() {
    var u = (typeof byId === 'function' && typeof USERS !== 'undefined') ? byId(USERS, state.currentUser) : null;
    return u ? { id: u.id, name: u.name, email: u.id + '@demo.local', roleLabel: '一般', hint: '' } : CURRENT_PROFILE;
  };
}""",
    'ROLE_MEMBERS': """var ROLE_MEMBERS = {
  R1: ['u1'], R2: ['u3'], R3: ['u2', 'u6', 'u8'], R4: ['u4', 'u5'], R5: ['u7']
};""",
    'PERM_ACTS': """var PERM_ACTS = [
  { key: 'view', label: '閲覧', hint: '帳票を開いて内容を見る' },
  { key: 'confirm', label: '確認', hint: '読取結果を修正して確認済みにする' },
  { key: 'approve', label: '承認', hint: '1 段目の承認' },
  { key: 'reapprove', label: '再承認', hint: '2 段目の承認（2 段承認のときのみ設定）' }
];""",
}

INJECT_FUNCS = {
    'groupChildren': """function groupChildren(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  return gs.filter(function (g) { return g.parentId === id; });
}""",
    'groupDescendantIds': """function groupDescendantIds(id, out) {
  var acc = out || [];
  groupChildren(id).forEach(function (g) {
    if (acc.indexOf(g.id) < 0) { acc.push(g.id); groupDescendantIds(g.id, acc); }
  });
  return acc;
}""",
    'usersInGroupScope': """function usersInGroupScope(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  var ids = [id].concat(groupDescendantIds(id));
  var seen = {}, out = [];
  gs.forEach(function (g) {
    if (ids.indexOf(g.id) < 0) return;
    (g.userIds || []).forEach(function (uid) { if (!seen[uid]) { seen[uid] = 1; out.push(uid); } });
  });
  return out;
}""",
    'groupNameOf': """function groupNameOf(id) {
  var gs = (typeof GROUPS !== 'undefined' && GROUPS) || [];
  var hit = gs.filter(function (g) { return g.id === id; })[0];
  return hit ? hit.name : '';
}""",
    'renderGroupTree': "function renderGroupTree() { return ''; }",
}

DECL_RE = re.compile(r'\b(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)')

# app.js 内の文字列を配信時に置換する（外部プロセスが数秒で書き戻すため、
# ファイル編集では定着しないラベル修正はここで当てる）
STRING_FIXES = [
    ('要再承認（2段目）', '要再承認'),
    ('再承認担当（2段目）', '再承認担当'),
]


# ── 閲覧権限（客户④）を app.js に注入する ─────────────────────────────
# 外部プロセスが app.js を再生成してこれらの編集を消してしまうため、配信時に当てる。
# 万能角色（全权限）。ロール定義・ユーザー定義・権限判定の 3 箇所に注入する。
SUPER_ROLE = """
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
"""

PERM_HELPER = """/* 閲覧権限：権限のない帳票タイプは一覧・ツリー・件数に出さない（serve.py 注入） */
function canViewFile(f) {
  return (typeof window !== 'undefined' && window.__demoPerm && window.__demoPerm.canViewFile)
    ? window.__demoPerm.canViewFile(f) : true;
}
function _permList(list) {
  return list.filter(canViewFile);
}
"""

PERM_PATCHES = [
    # 一覧（visibleFiles）
    (r"(let list = scoped\(\)\.filter\(\(f\) => inTenant\(f\) && TAB_MATCH\[state\.tab\]\(f\) && inNode\(f, node\) && passesFilters\(f\) && matchesQuery\(f\))\)",
     r"\1 && canViewFile(f))"),
    # タブ件数の母集団（baseList）
    (r"(const baseList = \(\) => scoped\(\)\.filter\(\(f\) => inTenant\(f\) && inNode\(f, state\.activeNode\) && passesFilters\(f\) && matchesQuery\(f\))\)",
     r"\1 && canViewFile(f))"),
    # ファイルツリーの各カテゴリ配下
    (r"(FILES_DATA\.filter\(\(f\) => fileCatId\(f\) === catId)\)", r"\1 && canViewFile(f))"),
    # ツリーの「すべて」件数
    (r"(<span class=\"label\">すべて</span><span class=\"cnt\">\$\{scoped\(\)\.filter\(inTenant\)\.length\})",
     r"<span class=\"label\">すべて</span><span class=\"cnt\">${scoped().filter((f) => inTenant(f) && canViewFile(f)).length}"),
]


# グループ＝権限バケツ（読取／確認／承認／管理者）。メニュー権限表もこの 4 つに合わせる。
GROUP_MODEL = """
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
"""

WORKFLOW_GUARD = """/* ワークフロー編集の権限があるときだけ、承認フロー／担当の設定を出す（serve.py 注入） */
function canEditWorkflow_() {
  return (typeof window !== 'undefined' && window.__demoPerm && window.__demoPerm.menu && window.__demoPerm.menu.canReach)
    ? window.__demoPerm.menu.canReach('settings-type-workflow')
    : true;
}
"""


USER_GROUP_CHECKS = """<div class="grp-users is-compact">
            ${(typeof GROUPS !== 'undefined' ? GROUPS : []).map((g) => `<label class="perm-pick"><input type="checkbox" class="cb" data-userGrp="${g.id}" ${picked.includes(g.id) ? 'checked' : ''} /><span>${esc(g.name)}</span><span class="perm-pick-sub">${esc(g.kind || '')}</span></label>`).join('')}
          </div>"""


def hide_actor_switch(src):
    """ヘッダーの「担当者を切替え」を完全に外す（デモは管理者固定）。

    - 切替候補（DEMO_ACTORS）を空にしてボタン生成を止める
    - 切替ブロックの div と、切替ハンドラも削除する
    """
    # 切替候補を空にする（ボタンが 1 つも生成されなくなる）
    src = re.sub(r"(var|let|const)\s+DEMO_ACTORS\s*=\s*\[[\s\S]*?\];",
                 r"\1 DEMO_ACTORS = [];", src, count=1)
    src = re.sub(r"window\.DEMO_ACTORS\s*=\s*window\.DEMO_ACTORS\s*\|\|\s*\[[\s\S]*?\];",
                 "window.DEMO_ACTORS = [];", src, count=1)
    # 切替ブロック
    src = re.sub(r'<div class="usermenu-switch">[\s\S]*?</div>\s*(?=<div class="usermenu-acts">)', '', src, count=1)
    # 切替ハンドラ（要素が無いので実害は無いが、残しておくと将来復活したときに効いてしまう）
    src = re.sub(r"document\.querySelectorAll\('\[data-demo-actor\]'\)\.forEach\(\(b\) => \{[\s\S]*?\n  \}\);",
                 '', src, count=1)
    return src


FLOW_HIDE_CSS = """
/* 承認フロー／担当の設定は「帳票権限管理」に集約（帳票タイプ設定では非表示） */
.wiz-pane .wiz-field.flow-hidden { display: none !important; }
"""


def apply_html_title(html):
    """<title> を LLM OCR に統一する。"""
    if '<title>LLM OCR</title>' in html:
        return html
    return re.sub(r'<title>[^<]*</title>', '<title>LLM OCR</title>', html, count=1)


def apply_flow_hide(html):
    """index.html に「承認フロー欄を隠す」CSS を注入する。"""
    if 'flow-hidden' in html:
        return html
    return html.replace('</head>', '<style>' + FLOW_HIDE_CSS + '</style>\n</head>')


PERM_ACTS_FULL_SRC = """const PERM_ACTS = [
  { key: 'view', label: '閲覧', hint: '帳票を開いて内容を見る' },
  { key: 'upload', label: 'アップロード', hint: '帳票を取り込む' },
  { key: 'fix', label: 'OCR結果修正', hint: '読取結果を修正する' },
  { key: 'confirm', label: '確認', hint: '読取結果を確認済みにする' },
  { key: 'approve', label: '承認', hint: '1 段目の承認' },
  { key: 'reapprove', label: '再承認', hint: '2 段目の承認（2 段承認のときのみ）' },
  { key: 'export', label: 'CSV出力', hint: 'CSV を出力する' },
  { key: 'settings', label: '帳票設定変更', hint: '帳票タイプの設定を変更する' }
];"""

PERM_KEYS_FULL = ['upload', 'fix', 'export', 'settings']


def apply_full_perm_acts(src):
    """帳票権限表の操作を 8 つ（閲覧/アップロード/OCR結果修正/確認/承認/再承認/CSV出力/帳票設定変更）へ拡張。"""
    m = re.search(r"const PERM_ACTS = \[[\s\S]*?\n\];", src)
    if not m:
        return src
    if '帳票設定変更' in m.group(0):
        return src
    src = src[:m.start()] + PERM_ACTS_FULL_SRC + src[m.end():]
    # 既存の権限表に新キーを補う
    m2 = re.search(r"(const permsOf = \()", src)
    seed = ("\n/* 追加操作のキーを既存データへ補完（serve.py 注入） */\n"
            "Object.keys(TICKET_PERMS || {}).forEach(function (lid) {\n"
            "  var p = TICKET_PERMS[lid];\n"
            "  ['upload', 'fix', 'export', 'settings'].forEach(function (k) {\n"
            "    if (!Array.isArray(p[k])) p[k] = [];\n"
            "  });\n"
            "});\n")
    if m2:
        src = src[:m2.start()] + seed + src[m2.start():]
    return src


def apply_group_kind_input(src):
    """旧：2 択ピル→自由入力。現在は app.js の GROUP_KINDS（5 種ピル）を使うため何もしない。"""
    if 'GROUP_KINDS' in src or 'grpFormKind' in src:
        return src
    return src


PERM_TABLE_CSS = """
/* ══ 帳票権限管理・ユーザー管理の見た目を規整（serve.py 注入） ══ */
.perm-matrix { table-layout: fixed; min-width: 1520px; }
.perm-matrix th, .perm-matrix td { padding: 8px 10px !important; vertical-align: middle; }
.perm-matrix thead th { background: #eef5fd; color: #4a637c; font-weight: 600; white-space: nowrap; }
.perm-matrix th.is-sticky, .perm-matrix td.is-sticky {
  position: sticky; left: 0; z-index: 2; background: #fff; border-right: 1px solid var(--line);
}
.perm-matrix thead th.is-sticky { z-index: 3; background: #eef5fd; }
.perm-matrix th.is-sticky + th.is-sticky, .perm-matrix td.is-sticky + td.is-sticky { left: 64px; }
.perm-matrix td.no { color: var(--text-3); text-align: right; }
.perm-matrix .pt-name { font-size: 12.5px; color: var(--text); line-height: 1.45; }
.perm-matrix .pt-sub { font-size: 11px; color: var(--text-3); }
.perm-matrix td.acts, .perm-matrix th.acts { text-align: right; white-space: nowrap; }
.perm-matrix .perm-cell {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  width: 100%; min-height: 30px; padding: 3px 8px;
  border: 1px dashed var(--line-d); border-radius: 3px; background: #fff;
}
.perm-matrix .perm-cell:hover { border-style: solid; border-color: var(--accent); background: #f7faff; }
.perm-matrix .perm-cell .muted { color: var(--text-3); }
.perm-matrix .perm-chip { background: var(--accent-bg); color: var(--accent); }

/* ユーザー追加／編集：ラベルと値を 2 列グリッドで揃える */
.user-add-modal { width: min(680px, 100%) !important; }
.user-add-canvas {
  display: grid !important; grid-template-columns: 132px minmax(0, 1fr);
  gap: 14px 16px; align-items: start; padding: 20px 24px !important;
}
.user-add-field { display: contents !important; }
.user-add-label { padding-top: 8px; justify-content: flex-end; text-align: right; }
.user-add-field > .fld, .user-add-field > .user-add-status,
.user-add-field > .grp-users, .user-add-field > .user-ops,
.user-add-field > .grp-note, .user-add-field > .fld-wrap { grid-column: 2; }
.user-ops { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 14px; }
.grp-users.is-compact { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; }
.grp-note { color: var(--text-3); font-size: 11px; line-height: 1.6; grid-column: 2; }

/* 帳票設定-タイプ：幅 100% ＋ 左右 margin 12px で右にはみ出していたのを補正 */
.type-list .btn.block { width: calc(100% - 24px); box-sizing: border-box; }
"""


def apply_perm_table(html):
    """見た目を規整する CSS を index.html に注入する。"""
    if 'perm-matrix' in html:
        return html
    return html.replace('</head>', '<style>' + PERM_TABLE_CSS + '</style>\n</head>')


FOLDER_VISIBILITY = """
/* ファイル一覧の可視範囲は「業務区分（フォルダ）権限」で判定する（客户回答 ⑤）。
   UPLOAD_PERMS[bizId] に自分の所属グループが入っていれば、その業務区分の帳票はすべて見える。
   どの業務区分にも担当が入っていない場合は制限しない（デモが空にならないように）。 */
(function folderVisibility() {
  var prev = window.__demoPerm && window.__demoPerm.canViewFile;
  var CANON = { '確認': 'gc', '承認': 'ga', 'アップロード': 'gu', '全権限': 'gm', '管理': 'gm' };
  var CANON_IDS = ['gu', 'gc', 'ga', 'gm'];
  var groups = (window.__demo && window.__demo.GROUPS) || [];
  /* 旧グループ ID（g1…）→ 役割に応じた正規グループ（gu/gc/ga/gm）へ寄せる */
  function norm(id) {
    if (CANON_IDS.indexOf(id) >= 0) return id;
    var g = groups.filter(function (x) { return x.id === id; })[0];
    if (g && CANON[g.kind]) return CANON[g.kind];
    return id;
  }
  function myGroups() {
    var h = window.__demo;
    if (!h || !h.state) return [];
    var uid = h.state.currentUser;
    var out = [];
    (h.GROUPS || []).forEach(function (g) {
      if ((g.userIds || []).indexOf(uid) >= 0) out.push(g.id);
    });
    return out;
  }
  function bizIdOf(layoutId) {
    var h = window.__demo;
    var lay = (h.LAYOUT || []).filter(function (l) { return l.id === layoutId; })[0];
    if (!lay) return null;
    var cat = (h.CATEGORY || []).filter(function (c) { return c.id === lay.category; })[0];
    return cat ? cat.business : null;
  }
  function canView(f) {
    var h = window.__demo;
    if (!h || !f) return true;
    if (window.DEMO_FULL_ADMIN === true) return true;   /* 管理者固定＝全件見える */
    var up = h.UPLOAD_PERMS || {};
    var keys = Object.keys(up);
    if (!keys.length) return prev ? prev(f) : true;          /* フォルダ権限が未設定なら従来判定 */
    var mine = myGroups();
    var biz = bizIdOf(f.layout);
    var allowed = !!biz && (up[biz] || []).some(function (g) {
      return mine.indexOf(norm(g)) >= 0 || mine.indexOf(g) >= 0;
    });
    /* どの業務区分にも担当が入っていない場合は制限しない */
    var anyAssigned = keys.some(function (k) { return (up[k] || []).length > 0; });
    if (!anyAssigned) return prev ? prev(f) : true;
    return allowed;
  }
  if (window.__demoPerm) {
    window.__demoPerm.canViewFile = canView;
    window.__demoPerm.visibleLayouts = function () { return null; };
    window.__demoPerm.countVisible = function () {
      var h = window.__demo;
      return h ? (h.FILES_DATA || []).filter(canView).length : 0;
    };
  }
  /* 既存データの旧グループ ID も正規 ID へ寄せる（表示と判定が食い違わないように） */
  try {
    var h2 = window.__demo;
    if (h2 && h2.UPLOAD_PERMS) {
      Object.keys(h2.UPLOAD_PERMS).forEach(function (k) {
        h2.UPLOAD_PERMS[k] = (h2.UPLOAD_PERMS[k] || []).map(norm);
      });
    }
    if (h2 && h2.TICKET_PERMS) {
      Object.keys(h2.TICKET_PERMS).forEach(function (lid) {
        var p2 = h2.TICKET_PERMS[lid];
        ['view', 'confirm', 'approve', 'reapprove'].forEach(function (key) {
          if (Array.isArray(p2[key])) p2[key] = p2[key].map(norm);
        });
      });
    }
  } catch (e) { /* noop */ }
  window.__folderCanView = canView;
})();
"""


def apply_more_mock(src):
    """ファイル一覧のモックを増やす（実データ風の行を生成して FILES に追加）。"""
    if 'MOCK_EXTRA_APPLIED' in src:
        return src
    # FILES / LAYOUT の定義が終わった後（buildFiles の直前）に差し込む
    marker = "function buildFiles() {"
    i = src.find(marker)
    if i < 0:
        return src
    gen = """/* === 追加モック（serve.py 生成：実データ風のファイル一覧） === */
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
"""
    return src[:i] + gen + src[i:]


GRP_TK_CSS = """
/* ══ グループ編集の「帳票権限」表：帳票名が縦積みにならないよう列幅を確保する ══ */
.grp-tk-table { table-layout: fixed !important; min-width: 1080px; width: 100%; }
.grp-tk-table th, .grp-tk-table td { padding: 8px 8px !important; vertical-align: middle; }
.grp-tk-table th:nth-child(1),  .grp-tk-table td:nth-child(1)  { width: 48px; }
.grp-tk-table th:nth-child(2),  .grp-tk-table td:nth-child(2)  { width: 252px; }
.grp-tk-table th:nth-child(n+3),.grp-tk-table td:nth-child(n+3){ width: 104px; }
.grp-tk-table td:nth-child(2) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grp-tk-table td:nth-child(2) .sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grp-tk-table th { white-space: nowrap; }
.grp-tk { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.grp-tk .grp-tk-l { white-space: nowrap; }
.grp-tk-table .permcell { text-align: left; }
.grp-cat-table td { vertical-align: middle; }
.grp-cat-table .perm-chip { margin: 2px 4px 2px 0; display: inline-block; }
.stage-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.stage-chip {
  height: 24px; padding: 0 10px; border: 1px solid var(--line-d); border-radius: 3px;
  background: #fff; color: var(--text-3); font-size: 11.5px; cursor: pointer;
}
.stage-chip:hover { border-color: var(--accent); color: var(--accent); }
.stage-chip.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.stage-chip.is-unset { border-style: dashed; }

/* グループ一覧の「役割」：チップを折返して全部見せる */
.grp-roles { display: flex; flex-wrap: wrap; gap: 4px; }
.grp-role-chip {
  display: inline-flex; align-items: center; height: 22px; padding: 0 8px;
  border-radius: 3px; background: var(--accent-bg); color: var(--accent);
  font-size: 11.5px; white-space: nowrap;
}
.roles-table td { vertical-align: middle; }

/* 帳票タイプの工作流（帳票タイプ設定） */
.catflow-box { border: 1px solid var(--line-d); border-radius: 4px; background: #fbfdff; padding: 12px 14px; }
.catflow-cat { font-size: 12.5px; color: var(--text-2); margin-bottom: 10px; }
.catflow-cat b { color: var(--text); }
.catflow-shared { margin-left: 8px; font-size: 11px; color: var(--text-3); }
.catflow-box .wf-flow { margin-bottom: 10px; }
.wf-stage-input { width: 76px !important; text-align: right; padding-right: 8px; }
.wf-stages-unit { font-size: 12px; color: var(--text-3); }
.perm-matrix td.is-na { text-align: center; background: #fafcff; }
.perm-matrix td.is-unset { text-align: center; background: #fffaf2; }
/* 工程ステッパーの表示／非表示 */
.rv-flow-strip { position: relative; padding-right: 44px; }   /* トグルボタンと重ならないよう右に余白 */
.rv-flow-strip.is-collapsed:not(.is-hover-open) { padding-right: 0; }
.rv-flow-strip > .rv-flow-toggle { right: 4px; }
.rv-flow-hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-3); padding: 4px 2px;
}
.rv-flow-hint .ico { transform: rotate(-90deg); }
.rv-flow-strip > .rv-flow-toggle {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 26px; height: 26px; border: 1px solid var(--line-d); border-radius: 4px;
  background: #fff; color: var(--text-3); cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.rv-flow-strip > .rv-flow-toggle:hover { border-color: var(--accent); color: var(--accent); }
.rv-flow-strip.is-collapsed:not(.is-hover-open) > *:not(.rv-flow-togglebar):not(.rv-flow-toggle) { display: none !important; }
.rv-flow-strip.is-collapsed:not(.is-hover-open) > .rv-flow-toggle { display: none !important; }
.rv-flow-strip.is-collapsed:not(.is-hover-open) { min-height: 34px; display: flex; align-items: center; }
.rv-flow-strip.is-collapsed:not(.is-hover-open) > .rv-flow-togglebar { display: flex; }
.rv-flow-strip.is-collapsed.is-hover-open > .rv-flow-togglebar { display: none !important; }
.rv-flow-togglebar { display: flex; align-items: center; }
.rv-flow-togglebar .rv-flow-toggle {
  display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
  border: 1px solid var(--line-d); border-radius: 4px; background: #fff; color: var(--text-3);
  font-size: 12px; cursor: pointer;
}
.rv-flow-togglebar .rv-flow-toggle:hover { border-color: var(--accent); color: var(--accent); }
.rv-flow-togglebar .ico { transform: rotate(-90deg); }

/* 操作ガイドのポップオーバー */
.rv-guide-pop {
  position: fixed; z-index: 400; width: 320px; background: #fff;
  border: 1px solid var(--line-d); border-radius: 6px; box-shadow: 0 12px 32px rgba(31,47,61,.18);
  padding: 14px 16px 16px;
}
.rv-guide-head { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); }
.rv-guide-head b { flex: 1; }
.rv-guide-x { border: 0; background: none; font-size: 16px; line-height: 1; color: var(--text-3); cursor: pointer; }
.rv-guide-body { margin: 12px 0 10px; display: grid; gap: 8px; }
.rv-guide-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--text-2); }
.rv-guide-k { display: inline-flex; align-items: center; gap: 4px; }
.rv-guide-k kbd {
  display: inline-flex; align-items: center; height: 24px; padding: 0 8px;
  border: 1px solid var(--line-d); border-bottom-width: 2px; border-radius: 4px;
  background: #fff; color: var(--text); font-size: 11.5px; font-family: inherit;
}
.rv-guide-plus { color: var(--text-3); font-size: 11px; }
.rv-guide-note { display: flex; gap: 6px; font-size: 11px; line-height: 1.6; color: var(--text-3); border-top: 1px solid var(--line); padding-top: 10px; }
.rv-guide-ok {
  width: 100%; margin-top: 12px; height: 34px; border: 1px solid var(--line-d); border-radius: 4px;
  background: #fff; color: var(--text); font-size: 12.5px; cursor: pointer;
}
.rv-guide-ok:hover { border-color: var(--accent); color: var(--accent); }
.perm-matrix .unset-mark { color: #c67c2a; font-size: 11px; border: 1px dashed #e0b072; border-radius: 3px; padding: 2px 8px; }

/* ワークフロー設定：固定工程＋承認（任意 N 段） */
.wf-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.wf-node {
  display: inline-flex; align-items: center; height: 28px; padding: 0 12px;
  border: 1px solid var(--line-d); border-radius: 999px; background: #f7fafd;
  font-size: 12.5px; color: var(--text-2); white-space: nowrap;
}
.wf-node.is-fixed { color: var(--text-3); border-style: dashed; }
.wf-node.wf-approve { background: #fff; border-style: solid; cursor: pointer; color: var(--text); }
.wf-node.wf-approve:hover { border-color: var(--accent); }
.wf-node.wf-approve.on { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.wf-arrow { color: var(--text-3); font-size: 12px; padding: 0 2px; }
.wf-stages { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.wf-stages-l { font-size: 12px; color: var(--text-2); margin-right: 2px; }
.wf-stage-btn {
  height: 26px; padding: 0 12px; border: 1px solid var(--line-d); border-radius: 4px;
  background: #fff; color: var(--text-2); font-size: 12px; cursor: pointer;
}
.wf-stage-btn:hover { border-color: var(--accent); color: var(--accent); }
.wf-stage-btn.on { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); font-weight: 600; }
.wf-stages-hint { font-size: 11px; color: var(--text-3); margin-left: 4px; }
"""


RESULT_FREEZE_CSS = """
/* ══ ファイル一覧：末尾の「操作・処理」列だけ横スクロールでも固定する ══ */
.result-table { table-layout: fixed !important; min-width: 1720px !important; width: 100% !important; }
.result-table col { width: auto !important; }
/* 列幅（チェック / ファイル名 / 帳票タイプ / サイズ / ステータス / 作成者 / 確認者 / 承認者 / 作成日時 / 更新日時 / 操作・処理） */
.result-table th:nth-child(1),  .result-table td:nth-child(1)  { width: 40px; }
.result-table th:nth-child(2),  .result-table td:nth-child(2)  { width: 240px; }
.result-table th:nth-child(3),  .result-table td:nth-child(3)  { width: 200px; }
.result-table th:nth-child(4),  .result-table td:nth-child(4)  { width: 100px; }
.result-table th:nth-child(5),  .result-table td:nth-child(5)  { width: 110px; }
.result-table th:nth-child(6),  .result-table td:nth-child(6)  { width: 130px; }
.result-table th:nth-child(7),  .result-table td:nth-child(7)  { width: 130px; }
.result-table th:nth-child(8),  .result-table td:nth-child(8)  { width: 130px; }
.result-table th:nth-child(9),  .result-table td:nth-child(9)  { width: 150px; }
.result-table th:nth-child(10), .result-table td:nth-child(10) { width: 150px; }
.result-table th:nth-child(11), .result-table td:nth-child(11) { width: 150px; }
/* 横スクロール（全列を潰さずに表示） */
.result-content > .tablewrap, .result-panel .tablewrap { overflow-x: auto !important; }
.result-table th, .result-table td { overflow: hidden; text-overflow: ellipsis; }
/* 見出しと値の整列を揃える（確認者／承認者／作成日時／更新日時 の見出しも左寄せ）
   styles.css の th 中央寄せ（:not 連鎖で詳細度が高い）を上書きする */
.result-table thead th:nth-child(7),
.result-table thead th:nth-child(8),
.result-table thead th:nth-child(9),
.result-table thead th:nth-child(10) { text-align: left !important; }
.result-table td:nth-child(2), .result-table td:nth-child(3),
.result-table td:nth-child(6) { white-space: nowrap; }

/* 末尾の操作列だけ固定（右端に貼り付く） */
.result-table thead th:last-child,
.result-table td.result-actions-cell {
  position: sticky !important; right: 0; z-index: 3;
  background: #fff; box-shadow: -8px 0 10px -8px rgba(31, 47, 61, .18);
}
.result-table thead th:last-child { z-index: 4; background: #eef5fd; text-align: right !important; padding-right: 16px; }
.result-table tbody tr:hover td.result-actions-cell { background: #f7faff; }
.result-table tbody tr.is-picked td.result-actions-cell { background: #f2f7fd; }
.result-table .result-actions-cell { padding-left: 6px; padding-right: 6px; }
.result-table .result-actions-cell .acts { display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
.result-table .result-actions-cell .act-icon,
.result-table .result-actions-cell .icon-btn,
.result-table .result-actions-cell button { margin: 0; width: 24px; height: 24px; min-width: 24px; }
.result-table .result-actions-cell svg { width: 16px; height: 16px; }
"""


def apply_result_freeze(html):
    if 'result-actions-cell' in html and 'RESULT_FREEZE' in html:
        return html
    return html.replace('</head>', '<style>/* RESULT_FREEZE */' + RESULT_FREEZE_CSS + GRP_TK_CSS + '</style>\n</head>')


def apply_remove_group_hint(src):
    """ユーザーグループ画面の説明文（グループ＝付与単位の説明）を削除する。"""
    return re.sub(
        r'\s*<p class="perm-tab-hint">グループは[\s\S]*?</p>',
        '',
        src,
        count=1,
    )


GROUP_CAT_HELPERS = r"""/* 権限ラベル → 帳票権限表のキー（serve.py 注入） */
const GROUP_ROLE_OP_KEY = {
  '閲覧': 'view', 'アップロード': 'upload', '読取': 'read', 'OCR結果修正': 'fix', '確認': 'confirm',
  '承認': 'approve', '再承認': 'reapprove', '出力': 'export', '帳票設定変更': 'settings',
};
/** グループが持つ帳票権限のキー一覧 */
const groupOpKeysOf = (g) => groupRolesOf(g).map((l) => GROUP_ROLE_OP_KEY[l]).filter(Boolean);
/** グループがこのカテゴリを担当しているか（いずれかの帳票タイプで権限が付いていれば true） */
const groupHasCategory = (g, catId) => LAYOUT.some((l) => {
  const c = catOf(l.id) || {};
  if (c.id !== catId) return false;
  const p = permsOf(l.id);
  return groupOpKeysOf(g).some((k) => (p[k] || []).indexOf(g.id) >= 0);
});
/** カテゴリ担当の on/off を帳票権限表へ反映する */
function applyGroupCategory(g, catId, on) {
  const ops = groupOpKeysOf(g);
  LAYOUT.forEach((l) => {
    const c = catOf(l.id) || {};
    if (c.id !== catId) return;
    const p = permsOf(l.id);
    ops.forEach((k) => {
      if (!Array.isArray(p[k])) p[k] = [];
      if (on) { if (p[k].indexOf(g.id) < 0) p[k].push(g.id); }
      else { p[k] = p[k].filter((x) => x !== g.id); }
    });
  });
  return ops;
}

"""

GROUP_CAT_TAB = r"""/* 帳票権限タブ：帳票タイプ単位で「担当する」を選ぶ（権限は基本情報のワークフロー設定で決まる） */
  const myOps = groupOpKeysOf(f);
  const ticketRows = CATEGORY.map((c, i) => {
    const on = groupHasCategory(f, c.id);
    const biz = byId(BUSINESS, c.business) || {};
    const types = LAYOUT.filter((l) => (catOf(l.id) || {}).id === c.id).length;
    const chips = (on ? myOps : []).map((k) => `<span class="perm-chip">${esc(permActLabel(k))}</span>`).join('');
    return `<tr${on ? ' class="is-on"' : ''}>
      <td class="roles-no">${i + 1}</td>
      <td>${esc(dispCat(c.id))}<div class="sub">${esc(biz.name || '')} ／ 帳票タイプ ${types} 件</div></td>
      <td class="permcell"><label class="grp-tk"><input type="checkbox" class="cb" data-grp-cat="${c.id}" ${on ? 'checked' : ''} /><span class="grp-tk-l">担当する</span></label></td>
      <td>${chips || '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');

  const tickets = `
    <div class="perm-body is-flush">
      <div class="tablewrap grp-tk-wrap">
        <table class="grp-tk-table grp-cat-table">
          <thead><tr><th style="width:56px">番号</th><th>帳票タイプ</th><th style="width:130px">担当</th><th>付与される権限</th></tr></thead>
          <tbody>${ticketRows}</tbody>
        </table>
      </div>
    </div>`;
"""


def apply_group_role_cell(src):
    """グループ一覧の「役割」を 1 行のバッジから折返し可能なチップ群にする（列も広げる）。"""
    if 'grp-role-chip' in src:
        return src
    # ① 列幅：役割を広げ、概要を縮める
    src = src.replace('<th style="width:80px">役割</th>', '<th style="width:240px">役割</th>', 1)
    # ② セルの中身をチップの並びに
    old_cell = '<td><span class="grp-kind ${groupKindClass(g.kind)}">${esc(g.kind)}</span></td>'
    new_cell = ('<td><div class="grp-roles">${(groupRolesOf(g).length ? groupRolesOf(g) : [g.kind])'
                '.map((l) => `<span class="grp-role-chip">${esc(l)}</span>`).join(\'\')}</div></td>')
    if old_cell in src:
        src = src.replace(old_cell, new_cell, 1)
    return src


def apply_group_category_scope(src):
    """グループ編集の「帳票権限」タブを 帳票タイプ 単位の選択に置き換える。"""
    if 'data-grp-cat=' in src:
        return src
    anchor = "const GROUP_KINDS = ["
    if anchor not in src:
        return src
    src = src.replace(anchor, GROUP_CAT_HELPERS + anchor, 1)
    m = re.search(r"/\* 帳票権限タブ[\s\S]*?const tickets = `[\s\S]*?`;", src)
    if not m:
        return src
    src = src[:m.start()] + GROUP_CAT_TAB + src[m.end():]
    old2 = """    document.querySelectorAll('[data-grp-user]').forEach((cb) => {"""
    new2 = """    document.querySelectorAll('[data-grp-cat]').forEach((cb) => {
      cb.onchange = () => {
        const g = state.groupForm;
        if (!g) return;
        applyGroupCategory(g, cb.dataset.grpCat, cb.checked);
        render();
      };
    });
    document.querySelectorAll('[data-grp-user]').forEach((cb) => {"""
    if old2 in src:
        src = src.replace(old2, new2, 1)
    return src


STAGE_CHIPS_ROWS = r"""const ticketRows = CATEGORY.map((c, i) => {
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
  }).join('');"""

STAGE_HEADER = r"""<thead><tr><th style="width:56px">番号</th><th>帳票タイプ</th><th style="width:130px">担当</th><th style="width:240px">承認の段</th><th>付与される権限</th></tr></thead>"""

STAGE_HANDLER = r"""    /* 承認の段：カテゴリ内の全帳票タイプのその段だけに、グループを入れ／外しする */
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
"""

NEW_APPLY = r"""function applyGroupCategoryOps(g, catId, on) {
  const ops = groupOpKeysOf(g).filter((k) => k !== 'approve' && k !== 'reapprove');
  LAYOUT.forEach((l) => {
    const c = catOf(l.id) || {};
    if (c.id !== catId) return;
    const p = permsOf(l.id);
    ops.forEach((k) => {
      if (!Array.isArray(p[k])) p[k] = [];
      if (on) { if (p[k].indexOf(g.id) < 0) p[k].push(g.id); }
      else { p[k] = p[k].filter((x) => x !== g.id); }
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
}"""

OLD_HAS_CAT = "const groupHasCategory = (g, catId) => LAYOUT.some((l) => { const c = catOf(l.id) || {}; if (c.id !== catId) return false; const p = permsOf(l.id); return groupOpKeysOf(g).some((k) => (p[k] || []).indexOf(g.id) >= 0); });"
NEW_HAS_CAT = ("const groupHasApprovalStageOf = (g, layoutId) => { const n = Math.max(1, approvalStageCountOf(layoutId)); "
               "for (let si = 0; si < n; si++) if (stageTargetsOf(layoutId, si).indexOf(g.id) >= 0) return true; return false; };\n"
               "const groupHasCategory = (g, catId) => LAYOUT.some((l) => { const c = catOf(l.id) || {}; if (c.id !== catId) return false; "
               "const p = permsOf(l.id); if (groupOpKeysOf(g).some((k) => (p[k] || []).indexOf(g.id) >= 0)) return true; "
               "return groupHasApprovalStageOf(g, l.id); });")

OLD_LOOP = "groupsOfUser(me).forEach((g) => { const kind = GROUP_KINDS.find((k) => k.label === g.kind); (kind && kind.ops ? kind.ops : []).forEach(add); });"
NEW_LOOP = ("groupsOfUser(me).forEach((g) => { String(g.kind || '').split(/[、,]/).map((x) => x.trim()).filter(Boolean)"
            ".forEach((label) => { const kind = GROUP_KINDS.find((k) => k.label === label); (kind && kind.ops ? kind.ops : []).forEach(add); "
            "const key = (typeof GROUP_ROLE_OP_KEY !== 'undefined') && GROUP_ROLE_OP_KEY[label]; if (key && key !== 'settings') add(key); }); "
            "/* 帳票権限表の承認段に入っていれば 承認／再承認 を付与する */ "
            "LAYOUT.forEach((l) => { const n = Math.max(1, approvalStageCountOf(l.id)); for (let si = 0; si < n; si++) { "
            "if (stageTargetsOf(l.id, si).indexOf(g.id) >= 0) add(si === 0 ? 'approve' : 'reapprove'); } }); });")

def _patch_stage_selection(src):
    out = src
    report = []
    # A) 操作権限を 4 項目に（承認・再承認を外す）
    a_old = "const GROUP_NODES = ['閲覧', 'アップロード', '確認', '承認', '出力']"
    a_new = "const GROUP_NODES = ['閲覧', 'アップロード', '確認', '出力']"
    if a_old in out:
        out = out.replace(a_old, a_new, 1); report.append('A GROUP_NODES 4項目')
    # B) groupHasCategory に段を考慮
    mb = re.search(r"const groupHasCategory = \(g, catId\) => LAYOUT\.some\(\(l\) => \{[\s\S]*?\n\}\);", out)
    if mb:
        out = out[:mb.start()] + NEW_HAS_CAT + out[mb.end():]; report.append('B groupHasCategory')
    # C) applyGroupCategory を分割
    m = re.search(r"function applyGroupCategory\(g, catId, on\) \{[\s\S]*?\n\}", out)
    if m:
        out = out[:m.start()] + NEW_APPLY + out[m.end():]; report.append('C applyGroupCategory 分割')
    # D) カテゴリ表に行を追加
    m2 = re.search(r"const ticketRows = CATEGORY\.map[\s\S]*?\n  \}\)\.join\(''\);", out)
    if m2:
        out = out[:m2.start()] + STAGE_CHIPS_ROWS + out[m2.end():]; report.append('D ticketRows')
    # D2) ヘッダに「承認の段」列
    h_old = '<thead><tr><th style="width:56px">番号</th><th>帳票タイプ</th><th style="width:130px">担当</th><th>付与される権限</th></tr></thead>'
    if h_old in out:
        out = out.replace(h_old, STAGE_HEADER, 1); report.append('D2 ヘッダ')
    # E) 段チップのハンドラ
    m3 = re.search(r"(document\.querySelectorAll\('\[data-grp-cat\]'\)\.forEach[\s\S]*?\n    \}\);\n)", out)
    if m3:
        out = out[:m3.end()] + STAGE_HANDLER + out[m3.end():]; report.append('E 段ハンドラ')
    # F) userOpsOf：複数ラベル＋段から承認
    mf = re.search(r"groupsOfUser\(me\)\.forEach\(\(g\) => \{[\s\S]*?forEach\(add\);\s*\}\);", out)
    if mf:
        out = out[:mf.start()] + NEW_LOOP + out[mf.end():]; report.append('F userOps ループ')
    return out, report


TWO_STAGE_MOCK = """
/* ══ 2 段承認のモックデータ（serve.py 注入） ══
   帳票タイプを 2 段承認にし、1 段目だけ承認済みのファイルを数件用意する。 */
(function seedTwoStageApproval() {
  var two = { c1: 2, c4: 2, c5: 2 };   /* 住民異動届 / 利用申込 / 保育必要事由 */
  Object.keys(two).forEach(function (catId) {
    if (!APPROVAL_CONFIG[catId]) APPROVAL_CONFIG[catId] = { need: true };
    APPROVAL_CONFIG[catId].stages = 2;
    APPROVAL_CONFIG[catId].need = true;
    LAYOUT.forEach(function (l) {
      var c = catOf(l.id) || {};
      if (c.id !== catId) return;
      var p = TICKET_PERMS[l.id];
      if (!p) { p = TICKET_PERMS[l.id] = { view: [], confirm: [], approve: [], reapprove: [], stages: [] }; }
      var first = (p.approve && p.approve.length) ? p.approve.slice() : ['gc'];
      var second = (p.reapprove && p.reapprove.length) ? p.reapprove.slice() : ['ga'];
      p.approve = first;
      p.reapprove = second;
      p.stages = [first, second];
    });
  });
  /* 2 段目の承認待ち（1 段目は承認済み）を 4 件作る */
  var picked = 0;
  FILES_DATA.forEach(function (f) {
    if (picked >= 4) return;
    var c = catOf(f.layout) || {};
    if (!two[c.id]) return;
    if (f.status === 'approved' || f.status === 'exported') return;
    f.status = 'confirmed';
    f.history = '承認1済み（承認2待ち）';
    f.flow = [
      { action: '確認', user: '佐藤 一郎', at: '2026-10-14 10:12:00',
        comment: '確認担当者が必須項目を目視確認し、誤読箇所を修正しました' },
      { stage: 1, action: '承認1', user: '田中 実', at: '2026-10-14 15:20:00', comment: '' },
    ];
    f.confirmedAt = '2026-10-14 10:12:00';
    f.confirmedBy = 'u1';
    f.updatedAt = '2026-10-14 15:20:00';
    picked += 1;
  });
})();
"""


MYTASK_KIND_STAGE_FILTERS = '''
/* マイタスク：タスク種別での絞り込み（serve.py 注入） */
function passesMyTaskKind(r) {
  const F = state.myTaskFilters || {};
  if (F.kind && r.kind !== F.kind) return false;
  return true;
}

'''


def apply_mytask_filters(src):
    """マイタスクの絞り込みに「タスク種別」「承認段」を追加する。"""
    if 'mtKind' in src:
        return src
    # ① 絞り込み UI（ファイル名の直後）
    name_field = ('<label class="field"><span class="lbl">ファイル名</span>'
                  '<input class="fld" id="mtName" placeholder="ファイル名" value="${esc(F.name || \'\')}" /></label>')
    if name_field in src:
        add = (name_field
               + '<label class="field"><span class="lbl">タスク種別</span><select class="fld" id="mtKind">'
                 '<option value="">すべて</option>'
                 '<option value="confirm" ${F.kind === \'confirm\' ? \'selected\' : \'\'}>要確認</option>'
                 '<option value="approve" ${F.kind === \'approve\' ? \'selected\' : \'\'}>要承認</option>'
                 '<option value="reapprove" ${F.kind === \'reapprove\' ? \'selected\' : \'\'}>要再承認</option>'
                 '</select></label>'
               )
        src = src.replace(name_field, add, 1)
    # ② 読み取り
    src = src.replace("assignee: ($('#mtAssignee') || {}).value || '',",
                      "assignee: ($('#mtAssignee') || {}).value || '', kind: ($('#mtKind') || {}).value || '',", 1)
    # ③ リセット
    src = src.replace("state.myTaskFilters = { name: '', biz: '', cat: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' };",
                      "state.myTaskFilters = { name: '', biz: '', cat: '', kind: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' };", 1)
    # ④ state 初期値
    src = src.replace("myTaskFilters: { name: '', biz: '', cat: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' },",
                      "myTaskFilters: { name: '', biz: '', cat: '', kind: '', updatedFrom: '', updatedTo: '', createdFrom: '', createdTo: '', assignee: '' },", 1)
    # ⑤ 適用
    src = src.replace("const rows = myTaskRows(tab).filter((r) => passesMyTaskFilters(r.file));",
                      "const rows = myTaskRows(tab).filter((r) => passesMyTaskFilters(r.file) && passesMyTaskKind(r));", 1)
    # ⑥ 判定関数
    anchor = "function passesMyTaskFilters(f) {"
    if anchor in src:
        src = src.replace(anchor, MYTASK_KIND_STAGE_FILTERS + anchor, 1)
    return src


HISTORY_NORMALIZE = """
/* ══ 一覧の「操作・処理履歴」を操作記録に正規化（serve.py 注入） ══
   状態そのもの（読取完了／出力済み／読取中…）は履歴ではないので空にし、
   確認・承認・出力などの実行者が分かる記録だけを残す。 */
(function normalizeFileHistory() {
  var STATUS_TEXT = /^(読取完了|読取中|読取待ち|確認中|確認済み（承認待ち）|承認済み|出力済み|分類中|差戻中|読取失敗|—|-)$/;
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
"""


def apply_actor_columns_fix(src):
    """確認者／承認者は「その操作が完了している場合だけ」入れる（未処理の行に担当者を出さない）。"""
    old = "approvedBy: r[13],"
    if old in src:
        return src.replace(old, "approvedBy: r[10] ? r[13] : null,", 1)
    return src


def apply_drop_flow_state_chip(src):
    """進捗バー下の状態チップ（承認2/2 待ち 等）を削除する（ステップ自体で現在地が分かるため）。"""
    old = ('<div class="oa-progress-foot"> <span class="oa-status ${p.state === \'returned\' ? \'ng\' : \'\'}">'
           '${esc(p.label)}</span> </div>')
    if old in src:
        return src.replace(old, '', 1)
    # 改行・空白の差異に耐えるよう正規表現でも試す
    return re.sub(r'<div class="oa-progress-foot">\s*<span class="oa-status[\s\S]*?</div>', '', src, count=1)


def apply_review_download_removal(src):
    """確認／承認画面のダウンロードボタンを外す（出力は「出力」工程＝出力権限の仕事）。"""
    old = '<button type="button" class="btn" id="rvDownload"><span class="ico i-download"></span>ダウンロード</button>'
    if old in src:
        src = src.replace(old, '', 1)
    return src


def apply_approve_ui_correction_chip(src):
    """承認画面（承認者は編集不可）の「修正 N」表示を「確認者の修正 N」にし、0 件なら出さない。"""
    old = '<span>修正 <b class="accent-warm">${dirtyCount}</b></span>'
    new = ('${dirtyCount > 0 ? `<span>確認者の修正 ${dirtyCount}</span>` : \'\'}')
    if old in src:
        src = src.replace(old, new, 1)
    # 承認サマリ側のチップも「確認者の修正」に（0 件なら出さない）
    old2 = '<span class="rv-approve-chip is-mod">修正 <b>${audit.changes.length}</b></span>'
    new2 = ('${audit.changes.length > 0 ? `<span class="rv-approve-chip is-mod">確認者の修正 <b>${audit.changes.length}</b></span>` : \'\'}')
    if old2 in src:
        src = src.replace(old2, new2, 1)
    return src


def apply_result_person_columns(src):
    """ファイル一覧に「確認者」「承認者」列を足す（誰が処理したか。作成者/確認者/承認者で絞り込み可能）。"""
    if '確認者</th>' in src:
        return src
    # ① colgroup：ステータス(120px)の後ろに 2 列
    col_old = '<col style="width:120px">\n        <col style="width:160px">'
    col_new = ('<col style="width:120px">\n        <col style="width:186px">\n        '
               '<col style="width:160px">')
    if col_old in src:
        src = src.replace(col_old, col_new, 1)
    # ② 見出し
    th_old = "${th('status', 'ステータス')}"
    th_new = (th_old
              + '<th style="width:186px">現在の担当</th>')
    if th_old in src:
        src = src.replace(th_old, th_new, 1)
    # ③ セル（ステータスセルの直後）
    m = re.search(r'(<td><span class="st \$\{stCls\(f\.status\)\}"[\s\S]*?</td>)', src)
    if m:
        cell = m.group(1)
        add = (cell
               + '<td class="sub" title="${esc(currentAssigneeOf(f))}">${esc(currentAssigneeOf(f))}</td>')
        src = src.replace(cell, add, 1)
    return src


def apply_drop_history_column(src):
    """ファイル一覧の「操作・処理履歴」列を削除する（履歴はマイタスク／ファイル詳細で見る）。"""
    if '"hist " +' in src or 'class="hist ' not in src:
        return src
    # 見出し
    src = src.replace("${th('history', '操作・処理履歴')}", "", 1)
    # セル
    src = re.sub(r'<td class="hist \$\{histCls\(f\.status\)\}"[^>]*>\$\{[^<]*?</td>', '', src, count=1)
    # colgroup（履歴列＝6 番目の col）… 実際は width:200 の 1 つ目
    src = src.replace('<col style="width:120px">\n        <col style="width:200px">', '<col style="width:120px">', 1)
    return src


def apply_history_normalize(src):
    """一覧の「操作・処理履歴」を操作記録に正規化するブロックを注入する。"""
    if 'normalizeFileHistory' in src:
        return src
    anchor = "function renderUserAddDialog"
    if anchor not in src:
        return src
    return src.replace(anchor, HISTORY_NORMALIZE + "\n" + anchor, 1)


def apply_two_stage_mock(src):
    """2 段承認のモック（カテゴリ設定＋承認待ちファイル）を注入する。"""
    if 'seedTwoStageApproval' in src:
        return src
    # catOf / LAYOUT / APPROVAL_CONFIG などが定義された後に当てる必要がある
    anchor = "function renderUserAddDialog"
    if anchor not in src:
        return src
    return src.replace(anchor, TWO_STAGE_MOCK + "\n" + anchor, 1)


def apply_file_click_preview(src):
    """ファイル一覧のファイル名クリックを「画像プレビュー」にする（確認画面ではなく）。"""
    return re.sub(
        r"b\.onclick = \(\) => openReview\(b\.dataset\.resultPreview, \{ viewOnly: true, returnPage: 'result' \}\);",
        "b.onclick = () => openPreview(b.dataset.resultPreview);",
        src,
        count=1,
    )


def apply_notes_to_comments(src):
    """画面の説明文（grp-note / wf-note）を HTML コメント化して非表示にする。

    文面はコード内にコメントとして残す（あとで戻せるように）。
    """
    import re as _re
    if '<!-- <p class="grp-note' in src:
        return src
    for pat in (r'<p class="grp-note[^"]*">[\s\S]*?</p>', r'<p class="wf-note">[\s\S]*?</p>'):
        src = _re.sub(pat, lambda m: '<!-- ' + m.group(0) + ' -->', src)
    return src


def apply_category_flow(src):
    """帳票タイプ設定に「帳票タイプの工作流」（工程＋承認段数）を出す。"""
    if 'catFlowBlockFor(t)' in src:
        return src
    # ① ブロックを step1 の配列に足す
    src = re.sub(r"flowBlock,\s*\n\s*\]\.join\(''\);",
                 "flowBlock,\n        catFlowBlockFor(t),\n    ].join('');", src, count=1)
    # ② 承認段数ボタンのハンドラを足す（タイプ詳細の描画後）
    src = src.replace("document.querySelectorAll('[data-tp-stage]').forEach((b) => {",
                      "document.querySelectorAll('[data-cat-stage-input]').forEach((el) => {\n"
                      "      el.onchange = () => { setCatStages(state.typeId, el.value); render(); };\n"
                      "    });\n"
                      "    document.querySelectorAll('[data-tp-stage]').forEach((b) => {", 1)
    # ③ カテゴリの段数を承認段数の決定に使う
    src = src.replace(
        "  const stageLists = stagesOf(layoutId);\n"
        "  const need = base.need !== false && stageLists.some((x) => (x || []).length);\n"
        "  /* 可変 N 段：担当が入っている段の数を段数とする */\n"
        "  const stages = need ? stageLists.filter((x) => (x || []).length).length : 0;",
        "  const stageLists = stagesOf(layoutId);\n"
        "  const assigned = stageLists.filter((x) => (x || []).length).length;\n"
        "  /* 帳票タイプの工作流で決めた承認段数（未設定なら担当から推定） */\n"
        "  const declared = (typeof catStagesOf === 'function') ? catStagesOf(layoutId) : null;\n"
        "  const stages = (declared === null) ? assigned : Math.min(declared, assigned || declared);\n"
        "  const need = base.need !== false && stages > 0;",
        1)
    return src


STAGE_MATRIX_HELPERS = r"""/* ══ 帳票タイプの承認段数 N に合わせて、帳票権限表の「承認」列を 承認1..N に展開する ══ */
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

"""


def apply_history_rows(src):
    """処理履歴に「アップロード」「読取」の行を先頭に足す（f.flow には確認以降しか無いため）。"""
    if 'historyRowsOf' in src:
        return src
    helper = """/* 処理履歴の行：アップロード → 読取 → （確認／承認…） */
const historyRowsOf = (f) => {
  const rows = [];
  const nameOf = (uid) => (byId(USERS, uid) || {}).name || uid || '';
  rows.push({ action: 'アップロード', user: nameOf(f.createdBy) || '—', at: f.createdAt || '', comment: '—' });
  rows.push({ action: '読取', user: 'システム（OCR／AI）', at: f.readAt || f.readDoneAt || '', comment: '—' });
  (f.flow || []).forEach((h) => rows.push(h));
  return rows;
};

"""
    anchor = "const GROUP_KINDS = ["
    if anchor not in src:
        return src
    src = src.replace(anchor, helper + anchor, 1)
    # 「履歴の元データ」と「行の描画」を必ずセットで置換する（片方だけだと hrows 未定義で落ちる）
    before = src
    src = re.sub(r"const history = \(f\.flow \|\| \[\]\)\.length\s*\?",
                 "const hrows = historyRowsOf(f); const history = hrows.length ?", src, count=1)
    if src == before:
        return src
    src = re.sub(r"f\.flow\.map\(\(h\) => `<tr class=\"\$\{h\.voided",
                 'hrows.map((h) => `<tr class="${h.voided', src, count=1)
    return src


def apply_stage_count_authoritative(src):
    """承認段数は「帳票タイプで配った N」を正とする（担当未設定の段があっても N 段で回す）。"""
    old = ("  const declared = (typeof catStagesOf === 'function') ? catStagesOf(layoutId) : null;\n"
           "  const stages = (declared === null) ? assigned : Math.min(declared, assigned || declared);\n"
           "  const need = base.need !== false && stages > 0;")
    new = ("  const declared = (typeof catStagesOf === 'function') ? catStagesOf(layoutId) : null;\n"
           "  /* 配った段数を正とする（担当が空の段は「承認者未設定」として後で警告する） */\n"
           "  const stages = (declared === null) ? assigned : declared;\n"
           "  const need = base.need !== false && stages > 0;")
    if old in src:
        src = src.replace(old, new, 1)
    # 担当が空の段は、最初に入っている段の担当にフォールバックして誰も進めなくならないようにする
    old2 = ("  const lists = cfg.stageAssignees || [cfg.approveGroups, cfg.reapproveGroups];\n"
            "  const idx = Math.min(done, lists.length - 1);      /* done 段まで承認済み → 次は done 番目（0 起点） */\n"
            "  return lists[idx] || lists[0] || [];")
    new2 = ("  const lists = cfg.stageAssignees || [cfg.approveGroups, cfg.reapproveGroups];\n"
            "  const idx = Math.min(done, Math.max(0, lists.length - 1));   /* done 段まで承認済み → 次は done 番目（0 起点） */\n"
            "  const cur = lists[idx] || [];\n"
            "  if (cur.length) return cur;\n"
            "  /* 未設定の段は、担当が入っている最初の段にフォールバック（承認者未設定で止まらないように） */\n"
            "  const first = lists.filter((x) => (x || []).length)[0];\n"
            "  return first || [];")
    if old2 in src:
        src = src.replace(old2, new2, 1)
    return src


def apply_stepper_toggle_btn(src):
    """工程ステッパーの右端に「表示／非表示」のトグルボタンを足す。"""
    old = '<div class="rv-flow-strip">${flowStepsHtml(f, { compact: true, detail: false })}</div>'
    if old not in src:
        return src
    # ボタンは置かない（既定は折りたたみ、ホバーで展開）
    return src


def apply_stepper_upload_step(src):
    """進捗ステッパーの先頭に「アップロード」工程を足す（既定の工作流は アップロード → 読取 → 確認 → 承認(N) → 出力）。"""
    old = ("const steps = [];\n\n  steps.push({\n    key: 'read', label: '読取',")
    if old not in src:
        # 改行・空白のゆれに耐えるよう正規表現でも試す
        m = re.search(r"const steps = \[\];\s*steps\.push\(\{\s*key: 'read', label: '読取',", src)
        if not m:
            return src
        return (src[:m.start()]
                + "const steps = [];\n  steps.push({ key: 'upload', label: 'アップロード', state: 'done', at: f.createdAt || '', user: '', comment: '' });\n"
                + "  steps.push({ key: 'read', label: '読取',"
                + src[m.end():])
    new = ("const steps = [];\n  steps.push({ key: 'upload', label: 'アップロード', state: 'done', at: f.createdAt || '', user: '', comment: '' });\n"
           "  steps.push({\n    key: 'read', label: '読取',")
    return src.replace(old, new, 1)


def apply_stepper_stage_label(src):
    """進捗ステッパーの承認ノード名を段番号どおりにする（3 段以上で「承認2」が重複していた）。"""
    bad = "label: stages === 1 ? '承認' : (n === 1 ? '承認1' : '承認2')"
    if bad not in src:
        return src
    return src.replace(bad, "label: stages === 1 ? '承認' : ('承認' + n)", 1)


def apply_stage_matrix(src):
    """帳票権限表を「承認1..N」の可変列にし、承認は段ごとに担当を割り当てられるようにする。"""
    if 'permHeadOf()' in src:
        return src
    anchor = "const GROUP_KINDS = ["
    if anchor not in src:
        return src
    src = src.replace(anchor, STAGE_MATRIX_HELPERS + anchor, 1)
    # ① 表の列（見出し・セル）を動的生成に
    src = re.sub(r"\$\{PERM_ACTS\.map\(\(a\) => `<td class=\"permcell\">[\s\S]*?join\(''\)\}",
                 "${permCellsOf(l)}", src, count=1)
    src = re.sub(r"\$\{PERM_ACTS\.map\(\(a\) => `<th style=\"width:190px\">\$\{a\.label\}</th>`\)\.join\(''\)\}",
                 "${permHeadOf()}", src, count=1)
    # ② セルダイアログ：現在値の取得と保存を段対応に
    src = src.replace("const cur = isUpload ? uploadPermsOf(c.bizId) : (permsOf(c.layoutId)[c.act] || []);",
                      "const cur = permTargetsForCell(c);", 1)
    src = src.replace("""      if (c.kind === 'upload') {
        UPLOAD_PERMS[c.bizId] = picked;
        state.permCell = null; render();
        toast(`「${dispBiz(c.bizId)}」のアップロード権限を更新しました`);
        return;
      }
      if (!TICKET_PERMS[c.layoutId]) TICKET_PERMS[c.layoutId] = { view: [], confirm: [], approve: [], reapprove: [] };
      TICKET_PERMS[c.layoutId][c.act] = picked;
      state.permCell = null; render();
      toast(`「${dispLayout(c.layoutId)}」の${permActLabel(c.act)}権限を更新しました`);""",
"""      if (c.kind === 'upload') {
        setPermTargetsForCell(c, picked);
        state.permCell = null; render();
        toast(`「${dispBiz(c.bizId)}」のアップロード権限を更新しました`);
        return;
      }
      setPermTargetsForCell(c, picked);
      state.permCell = null; render();
      toast(`「${dispLayout(c.layoutId)}」の${permActLabelOf(c.act)}権限を更新しました`);""", 1)
    # ③ クリア：段も消す
    src = src.replace("TICKET_PERMS[id] = { view: [], confirm: [], approve: [], reapprove: [] };",
                      "TICKET_PERMS[id] = { view: [], confirm: [], approve: [], reapprove: [], stages: [] };", 1)
    # ④ stagesOf：p.stages を優先（N 段）
    src = src.replace("""  const custom = APPROVAL_STAGES[layoutId];
  if (Array.isArray(custom) && custom.length) return custom.map((x) => (x || []).slice());
  const p = permsOf(layoutId);""",
"""  const custom = APPROVAL_STAGES[layoutId];
  if (Array.isArray(custom) && custom.length) return custom.map((x) => (x || []).slice());
  const p = permsOf(layoutId);
  if (Array.isArray(p.stages) && p.stages.length) return p.stages.map((x) => (x || []).slice());""", 1)
    # ⑤ グループの「承認」は全段に付与する
    src = src.replace("""function applyGroupCategory(g, catId, on) {
  const ops = groupOpKeysOf(g);""",
"""function applyGroupCategory(g, catId, on) {
  const ops = groupOpKeysOf(g);
  const stagesN = (typeof maxApprovalStageCount === 'function') ? maxApprovalStageCount() : 1;""", 1)
    src = src.replace("""    ops.forEach((k) => {
      if (!Array.isArray(p[k])) p[k] = [];
      if (on) { if (p[k].indexOf(g.id) < 0) p[k].push(g.id); }
      else { p[k] = p[k].filter((x) => x !== g.id); }
    });""",
"""    ops.forEach((k) => {
      if (!Array.isArray(p[k])) p[k] = [];
      if (on) { if (p[k].indexOf(g.id) < 0) p[k].push(g.id); }
      else { p[k] = p[k].filter((x) => x !== g.id); }
      /* 承認は 1〜N 段すべてに付与／解除する */
      if (k === 'approve') {
        for (let si = 0; si < Math.max(1, stagesN); si++) setStageTargets(l.id, si, on
          ? stageTargetsOf(l.id, si).concat(stageTargetsOf(l.id, si).indexOf(g.id) < 0 ? [g.id] : [])
          : stageTargetsOf(l.id, si).filter((x) => x !== g.id));
      }
    });""", 1)
    return src


def apply_user_ops_derive_fix(src):
    """グループの「操作権限」から操作キーを導出する処理を、複数ラベル対応に直す。

    グループの kind は「閲覧、アップロード」のように複数ラベルの連結なので、
    単一ラベル一致（GROUP_KINDS.find(k => k.label === g.kind)）では何も取れない。
    """
    if 'GROUP_ROLE_OP_KEY[label]' in src:
        return src
    old_loop = ("groupsOfUser(me).forEach((g) => { const kind = GROUP_KINDS.find((k) => k.label === g.kind); "
                "(kind && kind.ops ? kind.ops : []).forEach(add); });")
    new_loop = ("groupsOfUser(me).forEach((g) => { String(g.kind || '').split(/[、,]/).map((x) => x.trim())"
                ".filter(Boolean).forEach((label) => { const kind = GROUP_KINDS.find((k) => k.label === label); "
                "(kind && kind.ops ? kind.ops : []).forEach(add); "
                "const key = (typeof GROUP_ROLE_OP_KEY !== 'undefined') && GROUP_ROLE_OP_KEY[label]; "
                "if (key && key !== 'settings') add(key); }); });")
    if old_loop in src:
        src = src.replace(old_loop, new_loop, 1)
    # 「業務操作があれば CSV 出力を付随」は不要（出力は明示的な権限になった）
    src = src.replace("/* CSV出力は業務操作があれば付随。帳票設定変更はシステム権限ロール側 */ "
                      "if (out.some((k) => k === 'view' || k === 'confirm' || k === 'approve' || k === 'upload')) add('export');",
                      "/* 出力はグループの操作権限で明示的に付与する（自動付随はしない）。帳票設定変更はシステム権限側 */", 1)
    return src


def apply_rename_keep_extension(src):
    """ファイル名の変更では拡張子を変えられないようにする（名前だけ編集）。"""
    # ① 入力欄には拡張子を除いた名前を入れ、拡張子は固定表示にする
    old_in = """  const input = document.createElement('input');
  input.className = 'rename'; input.value = current;"""
    new_in = """  const _ext = (type === 'file') ? (String(current).match(/\\.[A-Za-z0-9]+$/) || [''])[0] : '';
  const input = document.createElement('input');
  input.className = 'rename';
  input.value = _ext ? String(current).slice(0, -_ext.length) : current;"""
    src = src.replace(old_in, new_in, 1)
    old_rep = "  label.replaceWith(input); input.focus(); input.select();"
    new_rep = ("  label.replaceWith(input);\n"
               "  if (_ext) { const _es = document.createElement('span'); _es.className = 'rename-ext'; "
               "_es.textContent = _ext; input.insertAdjacentElement('afterend', _es); }\n"
               "  input.focus(); input.select();")
    src = src.replace(old_rep, new_rep, 1)
    # ② 保存時：ユーザーが拡張子を打っても無視し、元の拡張子を付け直す
    old_set = "      state.rename[key] = input.value.trim();"
    new_set = ("      const _v = input.value.trim().replace(/\\.[A-Za-z0-9]+$/, '');\n"
               "      state.rename[key] = _ext ? (_v + _ext) : _v;")
    src = src.replace(old_set, new_set, 1)
    return src


def apply_tree_folder_rename(src):
    """ファイルツリーのフォルダ（業務シーン／帳票タイプ）も名称変更できるようにする。"""
    # ① ✎ ボタンをフォルダにも出す
    old_ops = """      const ops = n.type === 'file'
        ? [`<button class="redo" title="ファイル名を変更" data-rename="1"><span class="ico i-edit"></span></button>`]
        : [];"""
    new_ops = """      const ops = (n.type === 'file' || n.type === 'biz' || n.type === 'cat')
        ? [`<button class="redo" title="${n.type === 'file' ? 'ファイル名を変更' : 'フォルダ名を変更'}" data-rename="1"><span class="ico i-edit"></span></button>`]
        : [];"""
    src = src.replace(old_ops, new_ops, 1)

    # ② クリックハンドラの制限を外す
    old_h = "      if (type !== 'file') { toast('業務シーン・帳票タイプ名は変更できません'); return; }"
    new_h = ("      if (type !== 'file' && type !== 'biz' && type !== 'cat') "
             "{ toast('この項目の名称は変更できません'); return; }")
    src = src.replace(old_h, new_h, 1)

    # ③ startRename をフォルダ対応に
    old_s = """  /* ツリーではファイル名のみ変更可（業務シーン・帳票タイプはマスタ固定） */
  if (type !== 'file') {
    toast('業務シーン・帳票タイプ名は変更できません');
    return;
  }
  const key = 'file:' + id;
  const current = dispFileName(id);"""
    new_s = """  /* ファイル＝ファイル名、フォルダ（業務シーン／帳票タイプ）＝表示名を変更 */
  const key = type + ':' + id;
  const current = type === 'file' ? dispFileName(id) : (type === 'biz' ? dispBiz(id) : dispCat(id));"""
    src = src.replace(old_s, new_s, 1)
    src = src.replace("      toast('ファイル表示名を変更しました（表示のみ）');",
                      "      toast((type === 'file' ? 'ファイル表示名' : 'フォルダ表示名') + 'を変更しました（表示のみ）');", 1)
    return src


def apply_encoding_fix(src):
    """CSV/JSON の文字エンコード設定を実際の出力に反映（BOM あり/なし）。

    ダイアログ本体は app.js の縦積み＋スイッチ。ここでは出力時の BOM だけ当てる。
    """
    if 'class="switch exp-switch"' in src:
        old = "const blob = new Blob(['\\ufeff' + text], { type: 'text/plain;charset=utf-8' });"
        new = ("const _enc = (state.exportCfg && state.exportCfg.encoding) || 'UTF-8';\n"
               "  const _bom = _enc.indexOf('BOMなし') >= 0 ? '' : '\\ufeff';\n"
               "  const blob = new Blob([_bom + text], { type: (fmt === 'json' ? 'application/json' : 'text/csv') + ';charset=utf-8' });")
        if old in src:
            src = src.replace(old, new, 1)
        src = re.sub(r'\s*<button[^>]*data-batchdl="excel"[^>]*>[^<]*</button>', '', src)
        src = re.sub(r'\s*<button[^>]*data-dl="excel"[^>]*>[^<]*</button>', '', src)
        src = re.sub(r"\['excel', 'Excelをダウンロード'\],\s*", '', src)
        return src
    src = src.replace("select('encoding', ['UTF-8', 'Shift_JIS'])",
                      "select('encoding', ['UTF-8（BOMあり）', 'UTF-8（BOMなし）', 'Shift_JIS（S-JIS）'])")
    old = "const blob = new Blob(['\\ufeff' + text], { type: 'text/plain;charset=utf-8' });"
    new = ("const _enc = (state.exportCfg && state.exportCfg.encoding) || 'UTF-8（BOMあり）';\n"
           "  const _bom = _enc.indexOf('BOMなし') >= 0 ? '' : '\\ufeff';\n"
           "  const blob = new Blob([_bom + text], { type: (fmt === 'json' ? 'application/json' : 'text/csv') + ';charset=utf-8' });")
    if old in src:
        src = src.replace(old, new, 1)
    # Excel を全廃（要件は CSV/JSON/PDF の 3 形式）
    src = re.sub(r'\s*<button[^>]*data-batchdl="excel"[^>]*>[^<]*</button>', '', src)
    src = re.sub(r'\s*<button[^>]*data-dl="excel"[^>]*>[^<]*</button>', '', src)
    src = re.sub(r"\['excel', 'Excelをダウンロード'\],\s*", '', src)
    # 出力項目の範囲：必須項目のみ／全項目 の切り替え（客户要件）
    _chk = '''<label class="exp-check"><input type="checkbox" data-expcfg="includeFileName" ${C.includeFileName ? 'checked' : ''} /><span>入力ファイル名を出力項目に含める</span></label>'''
    _new = _chk + '''
          <label class="exp-check"><input type="checkbox" data-expcfg="requiredOnly" ${C.requiredOnly ? 'checked' : ''} /><span>必須項目のみを出力する（オフのときは全項目を出力）</span></label>'''
    src = src.replace(_chk, _new, 1)
    # 出力形式（CSV/JSON/PDF）のチェックは設定から削除（形式はダウンロード時に選ぶ）
    src = re.sub(r'\n\s*<label class="exp-check"><input type="checkbox" data-expcfg="format(?:Csv|Json|Pdf)"[^\n]*', '', src)
    src = re.sub(r'<div class="exp-checks">\s*</div>', '', src)
    # 設定は 3 つだけに絞る：文字コード／必須項目のみ／複数ファイルを1ファイルに
    src = re.sub(r'<section class="exp-block">\s*<h4 class="exp-sec">CSV オプション</h4>[\s\S]*?</section>', '', src)
    src = re.sub(r'\n\s*<label class="exp-check"><input type="checkbox" data-expcfg="includeFileName"[^\n]*', '', src)
    # 出力ファイル名は入力ファイル名と一致させるため、設定欄を外す
    src = re.sub(r'<label class="exp-field is-wide exp-filefield">[\s\S]*?</label>', '', src)
    # 説明文（注記）は全て削除
    src = re.sub(r'\s*<p class="exp-note">[\s\S]*?</p>', '', src)
    # 見出しと長い文言を整理（客户：見出し削除・文言短縮）
    src = src.replace('<h4 class="exp-sec">文字コード・出力オプション</h4>', '')
    src = src.replace('同一帳票タイプの複数ファイルを 1 ファイルにまとめる（1 ファイル複数レコード）', '複数ファイルを1ファイルにまとめる')
    src = src.replace('必須項目のみを出力する（オフのときは全項目を出力）', '必須項目のみ出力')
    # 文字エンコードは必須なので、ラベルに必須マークを付ける
    src = src.replace('<span class="exp-field-label">文字エンコード（CSV・JSON）</span>',
                      '<span class="exp-field-label"><i class="req">*</i>文字エンコード（CSV・JSON）</span>')
    # 出力ファイル名＝入力ファイル名 のスイッチ（既定オン）
    _req = '''<label class="exp-check"><input type="checkbox" data-expcfg="requiredOnly" ${C.requiredOnly ? 'checked' : ''} /><span>必須項目のみ出力</span></label>'''
    _add = _req + '''
          <label class="exp-check"><input type="checkbox" data-expcfg="fileNameFromInput" ${C.fileNameFromInput !== false ? 'checked' : ''} /><span>入力ファイル名を出力ファイル名にする</span></label>'''
    src = src.replace(_req, _add, 1)
    # スイッチ OFF のときだけ、出力ファイル名の入力欄を出す
    _sw = '''<label class="exp-check"><input type="checkbox" data-expcfg="fileNameFromInput" ${C.fileNameFromInput !== false ? 'checked' : ''} /><span>入力ファイル名を出力ファイル名にする</span></label>'''
    _sw2 = _sw + '''
          ${C.fileNameFromInput === false ? `<label class="exp-field is-wide exp-filefield"><span class="exp-field-label"><i class="req">*</i>ファイル名</span><span class="exp-filename"><input class="fld exp-name-input" id="expFileName" type="text" value="${esc((C && C.fileName) || '')}" placeholder="ファイル名を入力してください" aria-label="ファイル名" /><span class="exp-file-ext">.csv</span></span></label>` : ''}'''
    src = src.replace(_sw, _sw2, 1)
    # 文言を参考画面に合わせて短縮（変換方式／結合出力／出力名＝入力名）
    src = src.replace('<i class="req">*</i>文字エンコード（CSV・JSON）', '<i class="req">*</i>変換方式')
    src = src.replace('複数ファイルを1ファイルにまとめる', '結合出力')
    src = src.replace('入力ファイル名を出力ファイル名にする', '出力名＝入力名')
    # チェック項目を縦に揃える（2 カラム grid をやめる）
    # 検索栏の右アイコンを拡大アイコン → 虫眼鏡に（客户指摘）
    _svg = '<svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>'
    src = src.replace('<span class="mag ico i-view"></span>', '<span class="mag">' + _svg + '</span>')
    return src


def apply_read_op_finalize(src):
    """最終調整：読取は独立した操作権限なので、旧ラベル寄せ（読取→閲覧）を外す。

    GROUP_NODE_ALIAS は apply_group_nodes が注入するため、パイプラインの最後で当てる。
    """
    # 検索栏の右アイコンを虫眼鏡に（客户指摘）
    _svg = '<svg class="search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>'
    src = src.replace('<span class="mag ico i-view"></span>', '<span class="mag">' + _svg + '</span>')
    return src.replace("'読取': '閲覧', 'アップロード': 'アップロード',", "'アップロード': 'アップロード',", 1)


def apply_export_format_block(src):
    """旧ダイアログへ出力オプションを足す。縦積みスイッチ版では何もしない。"""
    if 'class="switch exp-switch"' in src:
        return src
    old = '<section class="exp-block">\n          <h4 class="exp-sec">CSV オプション</h4>'
    new = '<section class="exp-block">\n        <h4 class="exp-sec">文字コード・出力オプション</h4>\n        <div class="exp-checks">\n          <label class="exp-check"><input type="checkbox" data-expcfg="formatCsv" ${C.formatCsv !== false ? \'checked\' : \'\'} /><span>CSV</span></label>\n          <label class="exp-check"><input type="checkbox" data-expcfg="formatJson" ${C.formatJson ? \'checked\' : \'\'} /><span>JSON</span></label>\n          <label class="exp-check"><input type="checkbox" data-expcfg="formatPdf" ${C.formatPdf ? \'checked\' : \'\'} /><span>PDF</span></label>\n        </div>\n        <div class="exp-fields">\n          <label class="exp-field"><span class="exp-field-label">文字エンコード（CSV・JSON）</span>\n            <select class="fld exp-control" data-expcfg="encoding">\n              <option ${C.encoding === \'UTF-8（BOMあり）\' ? \'selected\' : \'\'}>UTF-8（BOMあり）</option>\n              <option ${C.encoding === \'UTF-8（BOMなし）\' ? \'selected\' : \'\'}>UTF-8（BOMなし）</option>\n              <option ${C.encoding === \'Shift_JIS（S-JIS）\' ? \'selected\' : \'\'}>Shift_JIS（S-JIS）</option>\n            </select>\n          </label>\n        </div>\n        <div class="exp-checks">\n          <label class="exp-check"><input type="checkbox" data-expcfg="combineFiles" ${C.combineFiles ? \'checked\' : \'\'} /><span>同一帳票タイプの複数ファイルを 1 ファイルにまとめる（1 ファイル複数レコード）</span></label>\n          <label class="exp-check"><input type="checkbox" data-expcfg="includeFileName" ${C.includeFileName ? \'checked\' : \'\'} /><span>入力ファイル名を出力項目に含める</span></label>\n        </div>\n        <p class="exp-note">列名は横一列のヘッダー行、1 レコード＝1 行で出力します。列名・列順は帳票タイプごとに管理者が設定します。</p>\n      </section>\n      <section class="exp-block">\n        <h4 class="exp-sec">CSV オプション</h4>'
    # 旧「出力方式」（横向/縦向/結合）は廃止（列定義で表現するため）
    src = src.replace('<section class="exp-block">\n          <h4 class="exp-sec">出力方式</h4>\n          <div class="exp-radios">\n            ${radio(\'mode\', \'horizontal\', \'横向导出\', \'一般項目を横向に出力\')}\n            ${radio(\'mode\', \'vertical\', \'竖向导出\', \'一般項目を縦向に出力（現状）\')}\n            ${radio(\'mode\', \'combine\', \'結合导出\', \'一般項目と表格項目を Left Join で結合（1人1行）\')}\n          </div>\n        </section>', "")
    if old in src:
        return src.replace(old, new, 1)
    return src



def apply_list_cleanup(src):
    """ファイル一覧を整理：不要列・重複フィルタ・選択帳票読取を外し、現在の担当を出す。"""
    rep = []

    def sub(old, new, cnt=-1):
        nonlocal src
        if old in src:
            n = src.count(old)
            src = src.replace(old, new)
            rep.append(old[:34].replace('\n', ' ') + f' x{n}')
            return True
        return False

    # ① 現在の担当を求めるヘルパー
    helper = """/* 固定ワークフロー（アップロード→読取→確認→出力）で「いま誰が担当か」 */
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
"""
    anchor = "function passesFilters(f) {"
    if anchor in src and 'function currentAssigneeOf' not in src:
        src = src.replace(anchor, helper + anchor, 1)
        rep.append('currentAssigneeOf 追加')

    # ② ファイルサイズ・作成日時の列を削除
    sub("${th('size', 'ファイルサイズ')}", "")
    sub("<td class=\"result-size\">${fmtSize(f.size)}</td>", "")
    sub("${th('createdAt', '作成日時', 'class=\"col-created\"')}", "")
    sub('<td class="col-created" style="white-space:nowrap;color:var(--text-2)">${esc(f.createdAt)}</td>', "")
    sub('<col style="width:110px">\n        ', "")
    sub('<col style="width:160px">\n        <col style="width:160px">', '<col style="width:160px">')

    # ③ 承認者フィルタ・承認日の範囲を削除
    sub("<div class=\"field\"><span class=\"lbl\">承認者</span>${fselect('approvedBy', '選択してください', approvers, F.approvedBy)}</div>\n", "")
    sub("${range('承認日', 'approvedFrom', 'approvedTo')}", "")

    # ④ 結果一覧ツールバーから「選択帳票読取」を外す
    sub('<button class="btn primary sm" id="batchRead" ${pickedCount ? \'\' : \'disabled\'}>選択帳票読取</button>', "")

    # ⑤ 横スクロール幅を詰める（列が減ったため）
    sub("min-width: 1720px !important;", "min-width: 1240px !important;")
    return src


def apply_no_approval(src):
    """承認を全廃し、ワークフローを アップロード → 読取 → 確認 → 出力 に固定する。"""
    rep = []

    def sub(old, new, cnt=-1):
        nonlocal src
        if old in src:
            n = src.count(old)
            src = src.replace(old, new)
            rep.append(old[:36].replace('\n', ' ') + f' x{n}')
            return True
        return False

    # ① グループ操作権限：承認を外す
    sub("const GROUP_NODES = ['閲覧', 'アップロード', '読取', '確認', '承認', '出力']",
        "const GROUP_NODES = ['閲覧', 'アップロード', '読取', '確認', '出力']")
    # ② USER_OPS：承認を外す
    sub("{ key: 'read', label: '読取' }, { key: 'confirm', label: '確認' }, { key: 'approve', label: '承認' }, ",
        "{ key: 'read', label: '読取' }, { key: 'confirm', label: '確認' }, ")
    # ③ 帳票権限の操作から承認・再承認・帳票設定変更を外す（③の列＝客户の 5 項目）
    sub("  { key: 'approve', label: '承認', hint: '1 段目の承認' },\n  { key: 'reapprove', label: '再承認', hint: '2 段目の承認（2 段承認のときのみ）' },\n", "")
    sub("  { key: 'export', label: '出力', hint: 'CSV を出力する' },\n  { key: 'settings', label: '帳票設定変更', hint: '帳票タイプの設定を変更する' },\n",
        "  { key: 'export', label: '出力', hint: 'CSV を出力する' },\n")
    # ④ ステータス：承認まわりをタブ／順序から外す
    sub("const STATUS_ORDER = ['classifying', 'waiting', 'reading', 'done', 'failed', 'checking', 'confirmed', 'approved', 'returned', 'exported'];",
        "const STATUS_ORDER = ['waiting', 'reading', 'done', 'failed', 'confirmed', 'exported'];")
    sub("const TAB_STATUS = ['reading', 'done', 'failed', 'checking', 'confirmed', 'approved', 'returned', 'exported'];",
        "const TAB_STATUS = ['reading', 'done', 'failed', 'confirmed', 'exported'];")
    sub("confirmed: { key: 'confirmed', label: '確認済み（承認待ち）'", "confirmed: { key: 'confirmed', label: '確認済み'")
    # ⑤ ワークフロー：承認工程を消す（固定 4 工程）＋ 要約を「確認済み」に
    k = src.find("if (need) { for (let n = 1; n <= stages; n += 1)")
    if k > 0:
        m = src.find("let exportState = 'todo';", k)
        if m > k:
            src = src[:k] + src[m:]
            rep.append('flowProgress 承認ループ')
    sub("(stages === 2 ? `承認${done + 1}/${stages} 待ち` : '承認待ち')", "'確認済み'")
    # ⑥ マイタスク：承認タスクを出さない（未対応・対応済とも）
    sub("""      const pk = pendingApproveKind(f, cfg);
      if (pk === 'approve' && canSeeMyTask(f, 'approve', 'pending')) {
        rows.push({ file: f, kind: 'approve' });
      } else if (pk === 'reapprove' && canSeeMyTask(f, 'reapprove', 'pending')) {
        rows.push({ file: f, kind: 'reapprove' });
      }
""", "")
    sub("""      if (['approved', 'exported'].includes(f.status) && cfg.need !== false) {
        if (cfg.stages >= 2 && canSeeMyTask(f, 'reapprove', 'done')) {
          rows.push({ file: f, kind: 'reapprove' });
        } else if (canSeeMyTask(f, 'approve', 'done')) {
          rows.push({ file: f, kind: 'approve' });
        }
      }
""", "")
    # ⑥b 表示文言から「承認待ち」を消す
    src = src.replace("'確認済み・承認待ち'", "'確認済み'")
    src = src.replace("'承認1済み・再承認待ち'", "'確認済み'")
    src = src.replace("title: '確認して承認待ちへ'", "title: '確認済みにする'")
    src = src.replace("toast(need ? '確認しました（承認待ち）' : '確認しました（承認不要のため出力できます）')", "toast('確認しました')")
    src = src.replace("'確認済み（承認待ち）'", "'確認済み'")
    src = src.replace("確認済み（承認待ち）", "確認済み")
    # ⑦ 確認画面：承認者向けの注意書きを外す
    sub('<span class="rv-approve-hint">承認者は項目を編集できません。確認済み内容を照合してください。</span>', '')
    # ⑧ 帳票タイプ設定：工作流ブロックを出さない（固定のため設定不要）
    sub("      flowBlock,\n        catFlowBlockFor(t),\n    ].join('');", "    ].join('');")
    # フォルダ権限表から「承認1..N」列を外す（承認が無いため）
    sub('const permHeadOf = () => { const n = maxApprovalStageCount(); const appr = []; for (let k = 1; k <= n; k++) appr.push(\'<th style="width:132px">\' + (n === 1 ? \'承認\' : \'承認\' + k) + \'</th>\'); return PERM_COL_BASE.map((a) => \'<th style="width:132px">\' + a.label + \'</th>\').join(\'\') + appr.join(\'\') + PERM_COL_TAIL.map((a) => \'<th style="width:132px">\' + a.label + \'</th>\').join(\'\'); };',
        'const permHeadOf = () => PERM_COL_BASE.map((a) => \'<th style="width:132px">\' + a.label + \'</th>\').join(\'\') + PERM_COL_TAIL.map((a) => \'<th style="width:132px">\' + a.label + \'</th>\').join(\'\');')
    # 確認画面の CTA：確認 → 出力 のみ（承認・差戻は無し）
    sub('if (fl.canConfirm) { footCta = dsCta(\'rvConfirm\', \'確認\', \'confirm\', false); } else if (fl.canApprove || fl.canReturn || fl.canExport) { footCta = (fl.canReturn ? \'<button class="btn danger" id="rvReturn" title="確認者へ差戻（理由必須）"><span class="ico i-back"></span>差戻</button>\' : \'\') + (fl.canExport ? dsCta(\'rvExport\', \'出力\', \'approve\', false) : dsCta(\'rvApprove\', approveBtnLabel, \'approve\', !fl.canApprove)); }',
        "if (fl.canConfirm) { footCta = dsCta('rvConfirm', '確認', 'confirm', false); } else if (fl.canExport) { footCta = dsCta('rvExport', '出力', 'approve', false); }")
    # 承認ステップのループを無効化（固定 4 工程）
    sub('  if (need) {\n    for (let n = 1; n <= stages; n += 1) {', '  if (false) {\n    for (let n = 1; n <= stages; n += 1) {')
    # 確認画面 CTA：確認 → 出力 のみ（承認・差戻を削除）
    sub('  } else if (fl.canApprove || fl.canReturn || fl.canExport) {\n    footCta = (fl.canReturn ? \'<button class="btn danger" id="rvReturn" title="確認者へ差戻（理由必須）"><span class="ico i-back"></span>差戻</button>\' : \'\')\n      + (fl.canExport\n        ? dsCta(\'rvExport\', \'出力\', \'approve\', false)\n        : dsCta(\'rvApprove\', approveBtnLabel, \'approve\', !fl.canApprove));\n  }',
        "  } else if (fl.canExport) {\n    footCta = dsCta('rvExport', '出力', 'approve', false);\n  }\n")
    # 出力可能条件：確認済みなら出力できる（承認が無いため）
    sub("function canExportFile(f) { if (!f) return false; const { need } = flowOf(f); return f.status === 'approved' || f.status === 'exported' || (!need && f.status === 'confirmed'); }",
        "function canExportFile(f) { if (!f) return false; return f.status === 'confirmed' || f.status === 'approved' || f.status === 'exported'; }")
    # 確認済みの画面フラグ：出力のみ（承認・差戻は無し）
    sub("if (f.status === 'confirmed') {\n    if (need && done < stages) {\n      return {\n        phase: 'approve',\n        readonly: true,\n        canSave: false,\n        canConfirm: false,\n        canApprove: true,\n        canReturn: true,\n        canExport: false,\n        need, stages, done,\n      };\n    }\n    return {\n      phase: 'export',\n      readonly: true,\n      canSave: false,\n      canConfirm: false,\n      canApprove: false,\n      canReturn: true,\n      canExport: true,\n      need, stages, done,\n    };\n  }",
        "if (f.status === 'confirmed') {\n    return {\n      phase: 'export',\n      readonly: true,\n      canSave: false,\n      canConfirm: false,\n      canApprove: false,\n      canReturn: false,\n      canExport: true,\n      need, stages, done,\n    };\n  }")
    # ファイル一覧の行アクションを 詳細／確認／ダウンロード／削除 の 4 つに
    sub('`<button class="act ${canRedo ? \'\' : \'off\'}" data-act="redo" data-file="${f.id}" ${canRedo ? \'\' : \'disabled\'} data-tip="再読取" aria-label="再読取">${canRedo ? \'<span class="ico i-scan" aria-hidden="true"></span>\' : \'<span aria-hidden="true">−</span>\'}</button>`',
        '`<button class="act" data-act="confirm" data-file="${f.id}" data-tip="確認" aria-label="確認"><span class="ico i-edit" aria-hidden="true"></span></button>`')
    sub('/* 原型どおり：详情／再読取／ダウンロード／削除（確認・承認はマイタスク） */', '/* 行アクション：詳細／確認／ダウンロード／削除 */')
    sub("      if (act === 'redo') { startReRead(id); return; }\n      if (act === 'confirm' || act === 'approve' || act === 'return') {\n        toast('確認・承認はマイタスクから行ってください');\n        openTab('myTasks');\n        return;\n      }",
        "      if (act === 'confirm') { openReview(id, { returnPage: 'result' }); return; }")
    # 業務シーン・帳票タイプの絞り込み（左ツリーと重複）を外す
    sub('<div class="field"><span class="lbl">業務シーン</span>${fselect(\'biz\', \'選択してください\', bizOpts, F.biz)}</div>', "")
    sub('<div class="field"><span class="lbl">帳票タイプ</span>${fselect(\'layout\', \'選択してください\', layouts, F.layout)}</div>', "")
    # ⑨ 権限一覧から承認者ロールを外す
    sub("{ id: 'R4', name: '承認者', code: 'approver', desc: '確認済み帳票の承認・再承認。マイタスクの承認作業', created: '2025-10-01 00:00:00', status: '有効' },\n", "")
    return src, rep


def apply_export_pending_filter(src):
    """ファイル一覧のステータス絞り込みに「出力未済」を追加する（客户要件）。"""
    # ① 絞り込み述語：出力未済＝まだ出力していない（出力済以外）
    old_pred = "  if (!one(F.status, f.status)) return false;"
    new_pred = ("  if (F.status === 'notExported') { if (f.status === 'exported') return false; }\n"
                "  else if (!one(F.status, f.status)) return false;")
    if old_pred in src:
        src = src.replace(old_pred, new_pred, 1)
    # ② 選択肢に「出力未済」を足す
    old_opt = "const statusOpts = STATUS_ORDER.filter((k) => k !== 'waiting').map((k) => [k, STATUS[k].label, STATUS[k].unused]);"
    new_opt = ("const statusOpts = STATUS_ORDER.filter((k) => k !== 'waiting').map((k) => [k, STATUS[k].label, STATUS[k].unused])"
               ".concat([['notExported', '出力未済', false]]);")
    if old_opt in src:
        src = src.replace(old_opt, new_opt, 1)
    return src


def apply_confirm_message(src):
    """確認ボタン押下時に「以後の修正ができなくなる」旨のメッセージ（ダイアログ）を出す。"""
    # ① 確認ボタン：必須チェックの後、いきなり確定せずメッセージを出す
    old_tail = """    /* 全項目を確認済みにしてから、確認タスクを確定する */
    const map = state.reviewConfirmed[id] || (state.reviewConfirmed[id] = {});
    list.forEach((x) => { map[x.key] = true; });
    state.reviewBulkConfirm = true;
    runFlowAction(id, 'confirm', '');
    state.page = 'myTasks';
    state.myTaskTab = 'pending';
    render();
  };"""
    new_tail = """    /* 確認は取り消せないため、メッセージを出して同意を得てから確定する */
    state.reviewConfirmAsk = true;
    render();
  };"""
    if old_tail in src:
        src = src.replace(old_tail, new_tail, 1)
    # ② ダイアログの描画関数
    dialog_fn = """function renderReviewConfirmAskDialog() {
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
"""
    anchor = "function renderReviewRequiredDialog() {"
    if anchor in src and 'renderReviewConfirmAskDialog' not in src:
        src = src.replace(anchor, dialog_fn + anchor, 1)
        src = src.replace("${renderReviewRequiredDialog()}", "${renderReviewConfirmAskDialog()} ${renderReviewRequiredDialog()}", 1)
    # ③ バインド
    bind = """/* 確認メッセージ（同意してから確認を確定する） */
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
"""
    anchor2 = "const rqBack = $('#rvReqBack');"
    if anchor2 in src:
        src = src.replace(anchor2, bind + anchor2, 1)
    # ④ runFlowAction：確認は同意するまで確定しない（経路が複数あっても効く）
    guard_old = "function runFlowAction(fileId, action, comment) {"
    guard_new = ("function runFlowAction(fileId, action, comment) {\n"
                 "  /* 確認は取り消せないため、メッセージに同意するまで確定しない */\n"
                 "  if (action === 'confirm' && !state.reviewConfirmAgreed) {\n"
                 "    if (!state.reviewConfirmAsk) { state.reviewConfirmAsk = true; render(); }\n"
                 "    return;\n"
                 "  }")
    if guard_old in src and 'reviewConfirmAgreed' not in src.split('function runFlowAction')[1][:400]:
        src = src.replace(guard_old, guard_new, 1)
    # ⑤ 確認メッセージ表示中は画面遷移しない（裏でマイタスクへ飛ぶのを防ぐ）
    src = src.replace("const leaveReviewToMyTasks = (fileId, myTab) => {",
                      "const leaveReviewToMyTasks = (fileId, myTab) => {\n"
                      "    /* 確認メッセージ（同意待ち）の間は遷移しない */\n"
                      "    if (state.reviewConfirmAsk) return;")
    # ⑥ 出力後のステータス表記を「出力済」に（要件のステータス一覧に合わせる）
    src = src.replace("label: '出力済み'", "label: '出力済'")
    return src


def apply_group_roles_sync_fix(src):
    """グループ保存時、既存グループでも roles を kind から同期する（一覧のチップが古いままになるバグ）。"""
    old = "        exist.kind = f.kind;\n        exist.desc = f.desc || '';"
    new = "        exist.kind = f.kind;\n        exist.roles = groupRolesOf(f);\n        exist.desc = f.desc || '';"
    if old in src:
        src = src.replace(old, new, 1)
    return src


def apply_user_ops_align(src):
    """ユーザー側の操作権限をグループと同じ 6 項（閲覧/アップロード/確認/承認/再承認/出力）に揃える。

    帳票設定変更は重複するため業務権限から外し、システム権限（メニュー権限）に一本化する。
    """
    if "label: '再承認'" in src and "label: 'CSV出力'" not in src:
        return src
    src = src.replace("label: 'CSV出力'", "label: '出力'")
    new_ops = ("const USER_OPS = [ { key: 'view', label: '閲覧' }, { key: 'upload', label: 'アップロード' }, "
               "{ key: 'read', label: '読取' }, { key: 'confirm', label: '確認' }, { key: 'approve', label: '承認' }, "
               "{ key: 'export', label: '出力' }, ];")
    src = re.sub(r"const USER_OPS = \[[\s\S]*?\];", new_ops, src, count=1)
    # PERM_ACTS に無いキー（read など）もラベル表示できるようにする
    src = src.replace("const permActLabel = (key) => (PERM_ACTS.find((a) => a.key === key) || {}).label || key;",
                      "const permActLabel = (key) => ((PERM_ACTS.find((a) => a.key === key) || USER_OPS.find((o) => o.key === key) || {}).label) || key;")
    return src


def apply_group_role_label(src):
    """グループの役割欄のラベルを「操作権限」に統一する（ダイアログ・一覧・フィルタ）。"""
    src = src.replace('<span class="lbl req">ワークフロー設定</span>', '<span class="lbl req">操作権限</span>')
    src = src.replace('<span class="lbl req">役割（操作権限）</span>', '<span class="lbl req">操作権限</span>')
    src = src.replace('aria-label="ワークフロー設定">', 'aria-label="操作権限">')
    src = src.replace('<th style="width:240px">役割</th>', '<th style="width:240px">操作権限</th>')
    src = src.replace('<span class="lbl">役割</span>', '<span class="lbl">操作権限</span>')
    return src


def apply_default_admin_user(src):
    """デモの既定ユーザーをシステム管理者にする（既定権限＝システム管理者）。"""
    if "currentUser: 'u2'" in src:
        src = src.replace("currentUser: 'u2'", "currentUser: 'u1'", 1)
    if "currentUser: 'u3'" in src:
        src = src.replace("currentUser: 'u3'", "currentUser: 'u1'", 1)
    # 既定の権限（ロール）＝システム管理者
    src = src.replace("roleId: (ROLES[0] && ROLES[0].id) || ''",
                      "roleId: ((ROLES.find((r) => r.name === 'システム管理者') || ROLES[0]) || {}).id || ''")
    src = src.replace("roleId: (r && r.id) || (ROLES[0] && ROLES[0].id) || ''",
                      "roleId: (r && r.id) || (((ROLES.find((x) => x.name === 'システム管理者') || ROLES[0]) || {}).id) || ''")
    return src


def apply_menu_tree_groups(src):
    """メニュー権限ツリーの「ユーザー管理」を細分化し、グループ設定を子ノードに足す。"""
    old = ("{ id: 'usage-users-toggle', label: 'ユーザー無効化' },")
    new = ("{ id: 'usage-users-toggle', label: 'ユーザー無効化' },\n"
           "        { id: 'usage-groups-add', label: 'グループ追加' },\n"
           "        { id: 'usage-groups-edit', label: 'グループ編集' },\n"
           "        { id: 'usage-groups-del', label: 'グループ削除' },")
    if old not in src:
        return src
    src = src.replace(old, new, 1)
    # 既定のロール権限にも新ノードを足す（管理者系は全部、その他は閲覧相当のみ）
    for role in ["'R1'", "'R9'"]:
        marker = role + ': ['
        i = src.find(marker)
        if i < 0:
            continue
        j = src.find(']', i)
        if j < 0:
            continue
        seg = src[i:j]
        if 'usage-groups-add' not in seg:
            add = ", 'usage-groups-add', 'usage-groups-edit', 'usage-groups-del'"
            src = src[:j] + add + src[j:]
    return src


def apply_group_nodes(src):
    """グループの「役割」をワークフローノードの選択（複数・固定順・on/off）にする。"""
    if 'groupNodePills' in src:
        return src
    # ① 選択状態は roles 配列で持つ（kind は互換のためカンマ連結で保存）
    helper = """/* グループの役割＝ワークフローノード（複数選択・固定順）。serve.py 注入 */
/* 既定の工程：アップロード → 読取 → 確認 → 承認（0〜N 段・任意） → 出力 */
const WF_STEPS = ['アップロード', '読取', '確認', '承認', '出力'];
const WF_FIXED = ['アップロード', '読取', '確認', '出力'];       /* 常に存在する工程 */
/* グループが担当する権限（7 項目）。工作流の定義（工程の並び・承認段数）は帳票タイプ側。 */
const GROUP_NODES = ['閲覧', 'アップロード', '読取', '確認', '承認', '出力'].map((l) => ({ key: l, label: l }));
const GROUP_NODE_LABELS = GROUP_NODES.map((n) => n.label);
/* 旧ラベル（閲覧／再承認／アップロード／CSV出力 等）を新しい工程名へ寄せる */
const GROUP_NODE_ALIAS = {
  '読取': '閲覧', 'アップロード': 'アップロード', 'OCR結果修正': '確認', 'CSV出力': '出力',
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

"""
    anchor = "const GROUP_KINDS = ["
    if anchor not in src:
        return src
    src = src.replace(anchor, helper + anchor, 1)

    # ② 編集フォーム：ノードのピル（複数選択・固定順）
    old_pills = """          ${GROUP_KINDS.map((k) => `<button type="button" class="asg-mode-pill${f.kind === k.label ? ' on' : ''}" data-grp-kind="${esc(k.label)}" role="tab" aria-selected="${f.kind === k.label}">${esc(k.label)}</button>`).join('')}"""
    new_pills = """          ${GROUP_NODES.map((n) => { const on = groupRolesOf(f).indexOf(n.label) >= 0; return `<button type="button" class="asg-mode-pill groupNodePills${on ? ' on' : ''}" data-grp-kind="${esc(n.label)}" role="checkbox" aria-checked="${on}">${esc(n.label)}</button>`; }).join('')}"""
    if old_pills in src:
        src = src.replace(old_pills, new_pills, 1)
    # ラベルとヒント
    src = src.replace('<span class="lbl req">役割（操作権限）</span>', '<span class="lbl req">ワークフロー設定</span>')
    src = src.replace('<span class="lbl req">役割（ワークフローノード）</span>', '<span class="lbl req">ワークフロー設定</span>')
    src = src.replace('aria-label="役割（操作権限）">', 'aria-label="ワークフロー設定">')
    src = src.replace('aria-label="役割（ワークフローノード）">', 'aria-label="ワークフロー設定">')
    src = src.replace('aria-label="役割">', 'aria-label="ワークフロー設定">', 1)
    # 説明文を「ワークフロー設定」の言い回しに揃える
    src = src.replace(
        '役割は所属ユーザー全員の操作権限になります。OCR結果修正は確認に含まれます。ユーザー個別では設定しません。',
        'このグループが担当する権限を選びます。工作流の定義（工程の並び・承認段数）は 帳票タイプ で設定します。'
        '選んだノードは所属ユーザー全員に適用されます（OCR結果修正は確認に含まれます）。',
    )
    src = src.replace('<p class="grp-note">ここで選んだユーザーがこのグループの担当者プールに入ります。',
                      '<p class="grp-note">ここで選んだユーザーがこのグループの担当者プールに入ります。', 1)

    # ③ クリックで on/off（render で固定順・件数が追随する）
    old_click = """    document.querySelectorAll('[data-grp-kind]').forEach((b) => {
      b.onclick = () => { state.groupForm.kind = b.dataset.grpKind; render(); };
    });"""
    new_click = """    document.querySelectorAll('[data-grp-kind]').forEach((b) => {
      b.onclick = () => {
        const g = state.groupForm;
        if (!g) return;
        const roles = toggleGroupRole(g, b.dataset.grpKind);
        state.groupForm.kind = roles.join('、');
        state.groupForm.roles = roles;
        render();
      };
    });"""
    if old_click in src:
        src = src.replace(old_click, new_click, 1)
    # ④ 保存時に roles も反映（既存／新規どちらも）
    src = src.replace("exist.name = f.name.trim(); exist.kind = f.kind;",
                      "exist.name = f.name.trim(); exist.kind = groupRolesOf(f).join('、'); exist.roles = groupRolesOf(f);", 1)
    src = src.replace("GROUPS.push({ id: f.id, name: f.name.trim(), kind: f.kind,",
                      "GROUPS.push({ id: f.id, name: f.name.trim(), kind: groupRolesOf(f).join('、'), roles: groupRolesOf(f),", 1)
    return src


def apply_export_filename(src):
    """エクスポート設定の「ファイル名」を編集可能な入力欄にする。"""
    old_markup = ('<span class="exp-filename"><span class="ico i-file"></span>'
                  '${esc(exportFileName())}<span class="exp-file-ext">.csv</span></span>')
    new_markup = ('<span class="exp-filename">'
                  '<span class="ico i-file"></span>'
                  '<input class="fld exp-name-input" id="expFileName" type="text" '
                  'value="${esc((state.exportCfg && state.exportCfg.fileName) || exportFileName())}" '
                  'placeholder="ファイル名を入力してください" aria-label="ファイル名" />'
                  '<span class="exp-file-ext">.csv</span></span>')
    if old_markup in src:
        src = src.replace(old_markup, new_markup, 1)
    # 入力欄を編集可能に：二重描画を避けて input 自身を維持する
    src = src.replace('/* ファイル名は input 自身が値を保持するため、再描画で作り直さない\n       （表示しているのは input 自身なので、再描画しなくても見た目は追随する）。 */',
                      '/* ファイル名は input 自身が値を保持する（再描画で作り直さない）。 */')
    # exportCfg に fileName を足す
    src = src.replace("dateFormat: 'YYYY-MM-DD', merge: true, maxRows: 10000 }",
                      "dateFormat: 'YYYY-MM-DD', merge: true, maxRows: 10000, fileName: '' }")
    # 保存時に空なら既定名に戻す
    src = src.replace("""      state.exportCfg.fileName = String(fn.value).replace(/\.csv\s*$/i, '').trim();""",
                      """      state.exportCfg.fileName = String(fn.value).replace(/\.csv\s*$/i, '').trim();
      if (!state.exportCfg.fileName) state.exportCfg.fileName = exportFileName();""")
    # 出力名は設定のファイル名を優先
    old_fn = """function exportFileName() {
  const files = visibleFiles();
  if (!files.length) return '出力データ';
  /* ファイルツリーの名前から拡張子だけ落として .csv にする */
  const base = (name) => String(name || '').replace(/\.[A-Za-z0-9]+$/, '');
  return base(files[0].name);
}"""
    new_fn = """function exportFileName() {
  /* 設定で名前が指定されていればそれを優先（帳票タイプ設定のファイル名欄） */
  const custom = (state.exportCfg && state.exportCfg.fileName) ? String(state.exportCfg.fileName).trim() : '';
  if (custom) return custom.replace(/\.[A-Za-z0-9]+$/, '');
  const files = visibleFiles();
  if (!files.length) return '出力データ';
  /* ファイルツリーの名前から拡張子だけ落として .csv にする */
  const base = (name) => String(name || '').replace(/\.[A-Za-z0-9]+$/, '');
  return base(files[0].name);
}"""
    if old_fn in src:
        src = src.replace(old_fn, new_fn, 1)
    return src


def apply_export_foot(src):
    """エクスポート設定ダイアログのフッタを「キャンセル／保存」の 2 つにする。"""
    old = ('<button class="btn" id="expSave"><span class="ico i-save"></span>保存</button>\n'
           '        <button class="btn primary" id="expOk"><span class="ico i-export"></span>この設定で出力</button>')
    if old in src:
        return src.replace(old, '<button class="btn primary" id="expSave"><span class="ico i-save"></span>保存</button>', 1)
    # 改行や空白が変わっても消せるように正規表現で落とす
    return re.sub(r'\s*<button class="btn primary" id="expOk">[\s\S]*?</button>', '', src, count=1)


def apply_result_widths(src):
    """ファイル一覧の列幅を詰めて、既定幅で収まりやすくする。"""
    src = src.replace('<col class="col-name" style="width:260px">', '<col class="col-name" style="width:210px">')
    src = src.replace('<col style="width:220px">', '<col style="width:190px">', 1)
    src = src.replace('<col style="width:200px">', '<col style="width:170px">', 1)
    src = src.replace('.result-tablewrap .result-table{min-width:1474px', '.result-tablewrap .result-table{min-width:1474px')
    return src


def apply_perm_markup(src):
    """帳票権限管理の表に class/幅を付けてレイアウトを安定させる。"""
    if 'perm-matrix' in src:
        return src
    src = src.replace('<table>\n    <thead><tr><th style="width:60px">番号</th><th>帳票タイプ</th>',
                      '<table class="perm-matrix">\n    <thead><tr><th class="is-sticky" style="width:64px">番号</th><th class="is-sticky" style="width:300px;left:64px">帳票タイプ</th>', 1)
    src = src.replace('${PERM_ACTS.map((a) => `<th style="width:190px">${a.label}</th>`).join('')}',
                      '${PERM_ACTS.map((a) => `<th style="width:132px">${a.label}</th>`).join('')}', 1)
    src = src.replace('<th style="width:90px;text-align:right">操作</th>', '<th class="acts" style="width:90px">操作</th>', 1)
    # 行側：番号・帳票タイプを sticky に
    src = src.replace('<td class="roles-no">${i + 1}</td>\n      <td>${esc(dispLayout(l.id))}<div class="sub">${esc(dispBiz(cat.business))} ／ ${esc(dispCat(cat.id))}</div></td>',
                      '<td class="roles-no no is-sticky">${i + 1}</td>\n      <td class="is-sticky"><div class="pt-name">${esc(dispLayout(l.id))}</div><div class="pt-sub">${esc(dispBiz(cat.business))} ／ ${esc(dispCat(cat.id))}</div></td>', 1)
    src = src.replace('<td><div class="acts"><button class="act-text" data-permclear="${l.id}">クリア</button></div></td>',
                      '<td class="acts"><button class="act-text" data-permclear="${l.id}">クリア</button></td>', 1)
    # 見出し（小見出し）を段落から揃える
    src = src.replace('帳票タイプ権限（閲覧／確認／承認／再承認）', '帳票タイプ権限（帳票タイプ × 操作）')
    return src


def apply_demo_badge(src):
    """ヘッダーの「デモ」バッジ（担当切替の入口）を外す。"""
    return src.replace('<span class="demo-badge" title="デモ用の担当切替">デモ</span>', '')


def apply_grp_attr(src):
    """所属グループのチェック属性をハンドラ（data-userGrp）と一致させる。"""
    return src.replace('data-user-grp=', 'data-userGrp=')


def apply_menu_label_fix(src):
    """メニュー権限ツリーのノード名を調整する（帳票削除 → タイプ削除）。"""
    return src.replace("label: '帳票削除'", "label: 'タイプ削除'")


def apply_menu_trim(src):
    """メニュー権限ツリーから不要な項目を削除する（帳票追加）。"""
    if 'settings-type-form-add' not in src:
        return src
    src = re.sub(r"\s*\{ id: 'settings-type-form-add'[^}]*\},?", '', src)
    src = src.replace("'settings-type-form-add', ", "")
    return src


def apply_admin_nav(src):
    """管理者固定：ナビのメニュー到達判定を無効化して、全メニューを常に出す。"""
    if 'canReachPage(t.page)' not in src:
        return src
    src = src.replace('.filter((t) => canReachPage(t.page))', '.filter(() => true)', 1)
    src = src.replace('m.items.filter((it) => canReachMenu(it.menuNode || PAGE_MENU_NODE[it.id]))',
                      'm.items.filter(() => true)', 1)
    return src


def apply_user_group_checks(src):
    """ユーザー追加／編集ダイアログの「所属グループ」に実データのチェックを描画する。"""
    if 'data-userGrp' in src:
        return src
    return re.sub(
        r'<div class="grp-users is-compact">\s*</div>',
        USER_GROUP_CHECKS,
        src,
        count=1,
    )


# デモは「管理者＝全権限」で固定する（役割切替・権限制限は行わない）
FULL_ADMIN_MODE = """
/* デモは常に管理者（全権限）で動作する（serve.py 注入） */
(function forceFullAdmin() {
  window.DEMO_FULL_ADMIN = true;
  /* app.js 側の到達判定も無効化（関数宣言は後から上書きできる） */
  try { window.canReachPage = function () { return true; }; } catch (e) {}
  try { window.canReachMenu = function () { return true; }; } catch (e) {}
  /* 権限レイヤーが参照する管理者判定も常に true に */
  (function patchTenantAdmin(tries) {
    var h = window.__demo;
    if (h && h.isTenantAdmin) { h.isTenantAdmin = function () { return true; }; return; }
    if (tries > 0) setTimeout(function () { patchTenantAdmin(tries - 1); }, 120);
  })(20);
  /* 権限レイヤー：すべて許可 */
  window.__demoPerm = window.__demoPerm || {};
  window.__demoPerm.visibleLayouts = function () { return null; };
  window.__demoPerm.canViewFile = function () { return true; };
  window.__demoPerm.countVisible = function () {
    var h = window.__demo;
    return h && h.FILES_DATA ? h.FILES_DATA.length : 0;
  };
  window.isSuperUser = function () { return true; };
  window.__demoUserOps = window.__demoUserOps || {};
  window.__demoUserOps.allowed = function () { return null; };
  window.__demoUserOps.has = function () { return true; };
  window.__demoUserOps.apply = function () {};
  window.__demoPerm.menu = window.__demoPerm.menu || {};
  window.__demoPerm.menu.allowed = function () { return null; };
  window.__demoPerm.menu.can = function () { return true; };
  window.__demoPerm.menu.canReach = function () { return true; };
  window.__demoPerm.menu.canWorkflow = function () { return true; };
  window.__demoPerm.menu.apply = function () {};
  window.opsFromGroups = function () {
    return ['view', 'upload', 'fix', 'confirm', 'approve', 'export', 'settings'];
  };
})();
"""


def apply_workflow_guard(src):
    """step1 は「承認フロー（段数）」だけ表示する（担当の割当は帳票権限管理へ集約）。"""
    if 'flowBlockGuarded' in src:
        return src
    if 'const flowBlock = [' not in src:
        return src
    src = src.replace('const flowBlock = [', WORKFLOW_GUARD + '    const flowBlock = [', 1)
    return src


def apply_permission_patch(src):
    """閲覧権限のフックを app.js に注入（既に当たっていれば何もしない）。"""
    # 旧形式の手編集が残っていても二重にならないよう正規化する
    src = re.sub(r"\n *const canView = \(typeof window[^\n]*\n *\? window\.__demoPerm\.canViewFile\n *: null;", "", src)
    src = src.replace(" && (!canView || canView(f))", "")
    if 'var canViewFile' not in src:
        # canViewFile の定義を「function visibleFiles() {」の直前に差し込む（使用箇所より前）
        src = src.replace('function visibleFiles() {', PERM_HELPER + 'function visibleFiles() {', 1)
    for pat, rep in PERM_PATCHES:
        src = re.sub(pat, rep, src, count=1)
    return src


GUARD_BANNER = (
    "/* === injected by serve.py: 欠落している定義の自己修復パッチ（app.js 再生成対策） === */\n"
)


def _declared(src):
    """ソース内で宣言されている識別子（関数宣言・変数宣言）を集める。"""
    names = set(DECL_RE.findall(src))
    for m in re.finditer(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=', src):
        names.add(m.group(1))
    return names


def patched_app_js(path):
    """app.js を読み、欠けている宣言だけを先頭に注入して返す。"""
    with open(path, 'rb') as f:
        src = f.read().decode('utf-8')
    names = _declared(src)
    parts = []
    for name, code in INJECT_VALUES.items():
        if name not in names:
            parts.append(code)
    for name, code in INJECT_FUNCS.items():
        if name not in names:
            parts.append(code)
    # 注入する定数が無くても、以下のパッチは必ず当てる
    patched = (GUARD_BANNER + '\n'.join(parts) + '\n' + src) if parts else src
    for _a, _b in STRING_FIXES:
        patched = patched.replace(_a, _b)
    patched = apply_permission_patch(patched)
    patched = apply_workflow_guard(patched)
    patched = apply_more_mock(patched)
    patched = apply_remove_group_hint(patched)
    patched = apply_group_role_cell(patched)
    patched = apply_group_category_scope(patched)
    patched = apply_notes_to_comments(patched)
    patched = apply_mytask_filters(patched)
    patched = apply_actor_columns_fix(patched)
    patched = apply_drop_flow_state_chip(patched)
    patched = apply_review_download_removal(patched)
    patched = apply_approve_ui_correction_chip(patched)
    patched = apply_result_person_columns(patched)
    patched = apply_drop_history_column(patched)
    patched = apply_history_normalize(patched)
    patched = apply_file_click_preview(patched)
    patched, _stage_report = _patch_stage_selection(patched)
    patched = apply_category_flow(patched)
    patched = apply_history_rows(patched)
    patched = apply_stage_count_authoritative(patched)
    patched = apply_stepper_toggle_btn(patched)
    patched = apply_stepper_upload_step(patched)
    patched = apply_stepper_stage_label(patched)
    patched = apply_stage_matrix(patched)
    patched = apply_user_ops_derive_fix(patched)
    patched = apply_export_pending_filter(patched)
    patched = apply_confirm_message(patched)
    patched = apply_group_roles_sync_fix(patched)
    patched = apply_user_ops_align(patched)
    patched = apply_group_role_label(patched)
    patched = apply_default_admin_user(patched)
    patched = apply_menu_tree_groups(patched)
    patched = apply_group_nodes(patched)
    patched = apply_export_filename(patched)
    patched = apply_export_foot(patched)
    patched = apply_result_widths(patched)
    patched = apply_perm_markup(patched)
    patched = apply_demo_badge(patched)
    patched = apply_grp_attr(patched)
    patched = apply_menu_label_fix(patched)
    patched = apply_menu_trim(patched)
    patched = apply_group_kind_input(patched)
    patched = apply_full_perm_acts(patched)
    patched = apply_admin_nav(patched)
    patched = apply_user_group_checks(patched)
    patched = hide_actor_switch(patched)
    patched = apply_export_format_block(patched)
    patched = apply_list_cleanup(patched)
    patched, _no_appr = apply_no_approval(patched)
    patched = apply_rename_keep_extension(patched)
    patched = apply_tree_folder_rename(patched)
    patched = apply_encoding_fix(patched)
    patched = apply_read_op_finalize(patched)
    # グループ＝権限バケツ：GROUPS / TICKET_PERMS の定義後（レンダリング前）に当てる
    m_anchor = re.search(r"(function renderUserAddDialog)", patched)
    if m_anchor and 'GROUP_OPS' not in patched:
        patched = patched[:m_anchor.start()] + GROUP_MODEL + "\n" + patched[m_anchor.start():]
    # 閲覧権限の判定に必要な実データを __demo から読めるようにする
    if 'window.__demo = {' in patched and 'GROUPS,' not in patched.split('window.__demo = {')[1][:400]:
        patched = re.sub(r"(window\.__demo = \{)", r"\1\n  GROUPS, ROLE_MEMBERS, USER_OPS, LAYOUT, CATEGORY, BUSINESS, UPLOAD_PERMS, ROLES, catStagesOf, setCatStages, approvalStageCountOf, maxApprovalStageCount, stageTargetsOf, setStageTargets,", patched, count=1)
    # 万能角色は ROLES / MENU_PERMS の定義直後に差し込む（前方参照で TDZ を踏まないよう）
    m_perms = re.search(r"((?:var|let|const) MENU_PERMS = \{[\s\S]*?\n\};)", patched)
    if m_perms and 'SUPER_ROLE_ID' not in patched:
        # MENU_PERMS の直後に差し込む（ROLES / MENU_LEAVES も定義済みの位置）
        patched = patched[:m_perms.end()] + "\n" + SUPER_ROLE + patched[m_perms.end():]
    # HISTORY_DEPTS を HISTORY 定義の直後で初期化する（TDZ 回避）
    if 'var HISTORY_DEPTS = [];' in patched:
        m = re.search(r'(const\s+HISTORY\s*=\s*buildHistory\(\);\n)', patched)
        if m:
            init = ("HISTORY_DEPTS = [...new Set(HISTORY.map(function (h) { return h.dept; })"
                    ".filter(Boolean))];\n")
            patched = patched[:m.end()] + init + patched[m.end():]
    return patched.encode('utf-8')


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def do_GET(self):
        clean = self.path.split('?')[0]
        if clean in ('/', '/index.html'):
            target = os.path.join(DIR, 'index.html')
            if os.path.isfile(target):
                with open(target, 'rb') as f:
                    html = f.read().decode('utf-8')
                # 外部プロセスに消されても効くよう、追加スタイルを配信時に差し込む
                if 'type-assignee.css' not in html:
                    html = html.replace('</head>',
                                        '<link rel="stylesheet" href="./type-assignee.css" />\n</head>')
                # 管理者固定（全権限）：overlay の後に読ませる
                html = apply_html_title(html)
                html = apply_flow_hide(html)
                html = apply_perm_table(html)
                html = apply_result_freeze(html)
                if 'admin-mode.js' not in html:
                    html = html.replace('</body>',
                                        '<script src="./admin-mode.js"></script>\n</body>')
                body = html.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        if clean == '/folder-visibility.js':
            body = FOLDER_VISIBILITY.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if clean == '/admin-mode.js':
            body = (FULL_ADMIN_MODE + FOLDER_VISIBILITY).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if clean == '/app.js':
            target = os.path.join(DIR, 'app.js')
            if os.path.isfile(target):
                try:
                    body = patched_app_js(target)
                except Exception as exc:  # 失敗時はそのまま配信
                    sys.stderr.write('patch failed: %s\n' % exc)
                    return super().do_GET()
                self.send_response(200)
                self.send_header('Content-Type', 'text/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        return super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


def build_static(outdir):
    """配信時に注入している内容を反映した静的ファイル一式を出力する（Vercel 等の静的ホスティング用）。"""
    import shutil
    out = os.path.abspath(outdir)
    os.makedirs(out, exist_ok=True)

    # ① app.js（パッチ適用済み）
    with open(os.path.join(DIR, 'app.js'), 'rb') as f:
        js = patched_app_js(os.path.join(DIR, 'app.js'))
    with open(os.path.join(out, 'app.js'), 'wb') as f:
        f.write(js)

    # ② index.html（CSS 注入・admin-mode.js の読み込み込み）
    with open(os.path.join(DIR, 'index.html'), 'rb') as f:
        html = f.read().decode('utf-8')
    if 'type-assignee.css' not in html:
        html = html.replace('</head>', '<link rel="stylesheet" href="./type-assignee.css" />\n</head>')
    html = apply_html_title(html)
    html = apply_flow_hide(html)
    html = apply_perm_table(html)
    html = apply_result_freeze(html)
    if 'admin-mode.js' not in html:
        html = html.replace('</body>', '<script src="./admin-mode.js"></script>\n</body>')
    with open(os.path.join(out, 'index.html'), 'wb') as f:
        f.write(html.encode('utf-8'))

    # ③ 動的配信していた JS
    with open(os.path.join(out, 'admin-mode.js'), 'wb') as f:
        f.write((FULL_ADMIN_MODE + FOLDER_VISIBILITY).encode('utf-8'))
    with open(os.path.join(out, 'folder-visibility.js'), 'wb') as f:
        f.write(FOLDER_VISIBILITY.encode('utf-8'))

    # ④ 静的ファイル（CSS・overlay・assets）
    for name in ('styles.css', 'prompt-bar-fix.css', 'export-dialog.css', 'type-assignee.css',
                 'permissions-groups.css', 'brand-densan.css', 'review-focus-fix.js'):
        src = os.path.join(DIR, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(out, name))
    assets_src = os.path.join(DIR, 'assets')
    if os.path.isdir(assets_src):
        shutil.copytree(assets_src, os.path.join(out, 'assets'), dirs_exist_ok=True)

    print('built static site -> %s' % out, flush=True)
    for name in sorted(os.listdir(out)):
        print('  %s' % name, flush=True)


Handler.extensions_map.update({'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'})
handler = functools.partial(Handler, directory=DIR)
socketserver.TCPServer.allow_reuse_address = True
if len(sys.argv) >= 3 and sys.argv[1] == '--build':
    build_static(sys.argv[2])
    sys.exit(0)

with socketserver.TCPServer(('127.0.0.1', PORT), handler) as httpd:
    print(f'serving {DIR} at http://127.0.0.1:{PORT}/', flush=True)
    httpd.serve_forever()
