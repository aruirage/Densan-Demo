
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
