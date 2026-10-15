/**
 * 読取結果確認ページ（demo/app.js の renderReview）の連動ハイライトを調整する追加スクリプト。
 *
 * 仕様:
 *  1. 「項目位置」スイッチはユーザー操作でのみ切り替える（連動で勝手に OFF にしない）
 *  2. プレビュー（左）は自動スクロールしない＝bbox が勝手に動かない
 *  3. 連動の対象はフィールド入力欄だけ。行・外枠・ラベルをクリックしても反応しない
 *  4. 右ペインも自動スクロールしない（行が飛ばない）
 *  5. 入力欄（またはその bbox）を選ぶと、項目位置が表示中のときだけ bbox をハイライト
 *  6. 右ペインの余白クリック／Esc でハイライト解除
 *
 * app.js は再描画で DOM を作り直し、state.reviewPos を連動で落とす箇所があるため、
 * document へのキャプチャ段階リスナー＋MutationObserver で毎回補正する。
 */

/* 万能角色（全権限）：この ID のロール／ユーザーはすべての制限を素通りする */
function isSuperUser() {
  if (typeof window !== 'undefined' && window.DEMO_FULL_ADMIN === true) return true;
  var h = window.__demo;
  if (!h || !h.state) return false;
  if (h.state.superUser) return true;
  var uid = h.state.currentUser;
  if (['u9', 'U9'].indexOf(uid) >= 0) return true;
  var users = h.ENT_USERS || [];
  var u = users.filter(function (x) { return x.uid === uid || x.id === uid; })[0];
  var roleIds = ['R9'];
  if (u) {
    if (u.superRole || roleIds.indexOf(u.roleId) >= 0) return true;
    var r = (h.ROLES || []).filter(function (x) { return x.name === u.role; })[0];
    if (r && roleIds.indexOf(r.id) >= 0) return true;
  }
  return false;
}
window.isSuperUser = isSuperUser;
  /* デモは管理者固定：制限を一切かけない（admin-mode.js が DEMO_FULL_ADMIN を立てる） */
  function adminMode() { return typeof window !== 'undefined' && window.DEMO_FULL_ADMIN === true; }

(function () {
  'use strict';

  var KEY_ATTR = 'focusPatched';
  var lastUserToggle = 0;    // ユーザーがスイッチを触った時刻

  function hook() {
    return window.__demo || null;
  }
  function isReviewPage() {
    return !!document.querySelector('.nl-review');
  }
  function posState() {
    var h = hook();
    return !!(h && h.state && h.state.reviewPos);
  }
  function posSwitch() {
    return document.getElementById('rvPos');
  }
  function clearBbox() {
    document.querySelectorAll('.nl-review .doc-mark-box.on').forEach(function (el) {
      el.classList.remove('on');
    });
  }
  function markBbox(key) {
    clearBbox();
    /* reviewPos=true は「項目位置を非表示」＝bbox が出ていないのでハイライト対象なし */
    if (!key || posState()) return;
    var box = document.querySelector('.nl-review .doc-mark-box[data-bbox="' + key + '"]');
    if (box) box.classList.add('on');
  }
  function clearRow() {
    document.querySelectorAll('.nl-review .rv-field-row.is-focus').forEach(function (row) {
      row.classList.remove('is-focus');
    });
  }
  function markRow(key) {
    clearRow();
    if (!key) return;
    var row = document.querySelector('.nl-review .rv-field-row[data-field-key="' + key + '"]');
    if (row) row.classList.add('is-focus');
  }
  function clearAll() {
    clearRow();
    clearBbox();
  }

  /* ── bbox ⇄ 入力欄の連動（クリックを app.js のハンドラより先に処理） ── */
  document.addEventListener('click', function (e) {
    if (!isReviewPage()) return;
    var t = e.target;
    if (!t || !t.closest) return;

    var box = t.closest('.nl-review .doc-mark-box[data-bbox]');
    if (box) {
      /* app.js 側の連動（スイッチ OFF・自動スクロール）を止める */
      e.stopPropagation();
      markRow(box.dataset.bbox);
      markBbox(box.dataset.bbox);
      return;
    }

    var inp = t.closest('.nl-review input[data-ocr]');
    if (inp) {
      e.stopPropagation();
      markRow(inp.dataset.ocr);
      markBbox(inp.dataset.ocr);
      return;
    }

    /* 行・外枠・ラベルのクリックでは連動させない（app.js の行ハンドラも止める／ハイライトは維持） */
    if (t.closest('.nl-review .rv-field-row')) {
      e.stopPropagation();
      return;
    }

    /* 余白クリックで解除 */
    if (t.closest('.nl-review .rv-scroll')) clearAll();
  }, true);

  /* Tab 移動や自動フォーカスでも連動（入力欄のみ） */
  document.addEventListener('focusin', function (e) {
    if (!isReviewPage()) return;
    var t = e.target;
    if (t && t.matches && t.matches('input[data-ocr]')) {
      markRow(t.dataset.ocr);
      markBbox(t.dataset.ocr);
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isReviewPage()) clearAll();
  }, true);

  /** 「確認」を必須項目の状態に関わらず確定させる（＝注意ダイアログを挟まない） */
  function runConfirmFromOverlay() {
    var h = hook();
    if (!h || !h.state) return;
    var id = h.state.reviewId;
    var f = (h.FILES_DATA || []).filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    closeRequiredDialog();
    /* 表示中の項目を確認済みにする（画面の「確認済み」カウンタと整合させる） */
    var map = (h.state.reviewConfirmed[id] = h.state.reviewConfirmed[id] || {});
    document.querySelectorAll('.nl-review input[data-ocr]').forEach(function (inp) {
      map[inp.dataset.ocr] = true;
    });
    h.state.reviewBulkConfirm = true;
    /* 確認アクション本体（app.js のフロー処理を再利用） */
    h.runFlowAction(id, 'confirm', '');
    h.state.reviewRequiredOpen = false;
    h.state.page = 'myTasks';
    h.state.myTaskTab = 'pending';
    h.render();
  }

  /* ── 「確認」は必須項目の注意ダイアログを出さずに、そのまま確定する ──
     app.js 側は必須が空だと state.reviewRequiredOpen を立てて注意ダイアログを出すため、
     クリックのたびにフラグを落として差し替える。 */
  function closeRequiredDialog() {
    var h = hook();
    if (h && h.state) h.state.reviewRequiredOpen = false;
    var back = document.getElementById('rvReqBack');
    if (back) back.remove();
  }

  document.addEventListener('click', function (e) {
    if (!isReviewPage()) return;
    var t = e.target;
    if (!t || !t.closest) return;

    /* 確認ボタン：必須項目の注意ダイアログを出さずに、そのまま確認を確定する。
       app.js 側は「必須が空なら注意ダイアログを出して return」するので、
       クリックを乗っ取り確認アクションを直接実行する。 */
    if (t.closest('#rvConfirm')) {
      e.stopPropagation();
      e.preventDefault();
      runConfirmFromOverlay();
      return;
    }
    /* 万一ダイアログが出てしまった場合：そのボタン操作は閉じるだけにする */
    if (t.closest('#rvReqBack')) {
      e.stopPropagation();
      closeRequiredDialog();
    }
  }, true);

  /* ── スイッチ／再描画の補正 ── */
  function syncSwitch() {
    var cb = posSwitch();
    if (!cb || cb.dataset[KEY_ATTR] === '1') return;
    cb.dataset[KEY_ATTR] = '1';
    cb.addEventListener('change', function () {
      lastUserToggle = Date.now();
      /* ON にしたら連動ハイライトは解除（開状態では素の枠だけ見せる） */
      if (cb.checked) clearAll();
      else clearBbox();
    });
  }

  function refresh() {
    if (!isReviewPage()) return;
    syncSwitch();
    var cb = posSwitch();
    if (!cb) return;
    var want = posState();
    /* 連動で OFF にされてしまった場合だけ戻す（直近のユーザー操作は尊重） */
    if (want && !cb.checked && Date.now() - lastUserToggle > 800) {
      cb.checked = true;
    }
    if (posState()) clearBbox();
  }

  var mo = new MutationObserver(function () {
    refresh();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }
})();

/* ══════════ 帳票タイプ フロー担当：権限者／ユーザー 2 次元ドロップダウン ══════════ */
/* ══════════════════════════════════════════════════════════════════════
   閲覧権限（客户回答 ④：権限のない帳票タイプは一覧上にも表示しない）
   TICKET_PERMS の「閲覧」に指定された主体（グループ／ロール／ユーザー）を
   展開し、現在ユーザーが見られる帳票タイプだけを許可する。
   ══════════════════════════════════════════════════════════════════════ */
(function permissionLayer() {
  function hook() { return window.__demo || null; }

  /** 主体 1 つに現在ユーザーが含まれるか */
  function inPrincipal(pid, uid) {
    var h = hook();
    if (!h) return false;
    if (pid === uid) return true;
    /* 本命：app.js 側の展開ヘルパに委譲する。
       assigneeUserIds は ユーザー／グループ／ロール の 3 種を解決して uid 配列を返す。
       GROUPS は app.js の top-level let なので window.GROUPS には生えない
       （＝ここで自前解決すると必ず失敗する）。 */
    if (typeof h.assigneeUserIds === 'function') {
      var expanded = h.assigneeUserIds([pid]) || [];
      if (expanded.indexOf(uid) >= 0) return true;
    }
    /* フォールバック（assigneeUserIds が無い版の app.js 用） */
    var groups = h.GROUPS || (window.GROUPS && window.GROUPS.length ? window.GROUPS : []) || [];
    var g = groups.filter(function (x) { return x.id === pid; })[0];
    if (g) return (g.userIds || []).indexOf(uid) >= 0;
    /* グループのロールも考慮（グループに複数ロールが付く想定） */
    if (g && (g.roleIds || []).length) {
      var hitRole = (g.roleIds || []).some(function (rid) {
        return ((h.roleMemberIds && h.roleMemberIds(rid)) || []).indexOf(uid) >= 0;
      });
      if (hitRole) return true;
    }
    /* ユーザーの所属グループ（ENT_USERS.groupIds）。uid と id の両方で照合する */
    var eu = (h.ENT_USERS || []).filter(function (u) { return u.uid === uid || u.id === uid; })[0];
    if (eu && (eu.groupIds || []).indexOf(pid) >= 0) return true;
    /* ロール */
    if (h.roleMemberIds) {
      var members = h.roleMemberIds(pid) || [];
      if (members.indexOf(uid) >= 0) return true;
    }
    return false;
  }

  /** 現在ユーザーの閲覧可能な帳票タイプ（layout id）集合 */
  function visibleLayouts() {
    if (adminMode()) return null;                /* 管理者固定＝全件 */
    var h = hook();
    if (window.isSuperUser && window.isSuperUser()) return null;   /* 万能＝制限なし */
    if (!h || !h.TICKET_PERMS) return null;   /* null＝制限なし */
    var uid = h.state && h.state.currentUser;
    var out = [];
    Object.keys(h.TICKET_PERMS).forEach(function (lid) {
      var p = h.TICKET_PERMS[lid] || {};
      var viewers = p.view || [];
      if (!viewers.length) return;            /* 閲覧未設定＝誰も見られない（製品は権限で制限） */
      var ok = viewers.some(function (pid) { return inPrincipal(pid, uid); });
      if (ok) out.push(lid);
    });
    return out;
  }

  /** ファイル 1 件が見られるか */
  function canViewFile(f) {
    var h = hook();
    if (!h || !f) return true;
    var layouts = visibleLayouts();
    if (layouts === null) return true;
    return layouts.indexOf(f.layout) >= 0;
  }

  window.__demoPerm = {
    inPrincipal: inPrincipal,
    visibleLayouts: visibleLayouts,
    canViewFile: canViewFile,
    /* デバッグ・検証用：見える件数 */
    countVisible: function () {
      var h = hook();
      if (!h) return -1;
      return (h.FILES_DATA || []).filter(canViewFile).length;
    },
  };
})();



/* ══════════ メニュー権限：親＝画面到達／子＝ボタン操作 ══════════
   MENU_PERMS に無いノードは到達不可。
   ・親（画面）が無い → メニュー／タブを**出さない**（削除線にしない）
   ・子（操作）が無い → 該当ボタンを disabled にする
   画面メニューの表示／非表示は app.js の renderTopNav／canReachPage が正。
   ここはボタン操作の無効化と、万一残ったナビの掃除だけを担う。
   ══════════════════════════════════════════════════════════════════════ */
(function menuPermission() {
  function hook() { return window.__demo || null; }

  function can(id) {
    var h = hook();
    if (h && typeof h.canReachMenu === 'function') return h.canReachMenu(id);
    return true;
  }

  function canReach(id) {
    return can(id);
  }

  /* ボタン ↔ 権限ノードの対応表 */
  var BUTTON_RULES = [
    { sel: '[data-cfg="addType"]', node: 'settings-type-add', what: 'タイプ追加' },
    { sel: '[data-cfg="editType"]', node: 'settings-type-edit', what: 'タイプ編集' },
    { sel: '[data-cfg="delType"]', node: 'settings-type-edit', what: 'タイプ編集' },
    { sel: '[data-cfg="editScene"]', node: 'settings-scenes-edit', what: '業務シーン編集' },
    { sel: '[data-cfg="addScene"]', node: 'settings-scenes-add', what: '業務シーン追加' },
    { sel: '[data-cfg="delScene"]', node: 'settings-scenes-del', what: '業務シーン削除' },
    { sel: '[data-useradd]', node: 'usage-users-add', what: 'ユーザー追加' },
    { sel: '[data-useredit]', node: 'usage-users-edit', what: 'ユーザー編集' },
    { sel: '[data-usertoggle]', node: 'usage-users-toggle', what: 'ユーザー無効化' },
    { sel: '[data-grpadd]', node: 'usage-groups-add', what: 'グループ追加' },
    { sel: '[data-grpedit]', node: 'usage-groups-edit', what: 'グループ編集' },
    { sel: '[data-grpdel]', node: 'usage-groups-del', what: 'グループ削除' },
    { sel: '[data-roleadd]', node: 'permissions-add', what: '権限作成' },
    { sel: '[data-roleedit]', node: 'permissions-edit', what: '権限編集' },
    { sel: '[data-roledel]', node: 'permissions-del', what: '権限削除' },
  ];

  function apply() {
    if (adminMode()) return;                     /* 管理者固定＝何も制限しない */
    var h = hook();
    if (!h || !h.state) return;

    /* ① ボタンを無効化（画面メニューは app.js 側で非表示済み） */
    BUTTON_RULES.forEach(function (r) {
      var ok = can(r.node);
      document.querySelectorAll(r.sel).forEach(function (el) {
        if (ok) {
          el.disabled = false;
          el.classList.remove('perm-off');
          if (el.dataset.permOff) { el.title = el.dataset.permOffTitle || ''; delete el.dataset.permOff; }
        } else {
          if (!el.dataset.permOff) {
            el.dataset.permOff = '1';
            el.dataset.permOffTitle = el.title || '';
          }
          el.disabled = true;
          el.classList.add('perm-off');
          el.title = '権限がありません（' + r.what + '）';
        }
      });
    });

    /* ② 万一残った到達不可ナビは削除線ではなく隠す */
    var NAV_NODES = { home: 'home', upload: 'upload', result: 'result', myTasks: 'myTasks',
      users: 'usage-users', roles: 'usage-permissions', security: 'usage-security',
      logs: 'usage-logs', api: 'usage-api', ticketDetail: 'settings-type', bizScenes: 'settings-scenes' };
    Object.keys(NAV_NODES).forEach(function (k) {
      var ok = canReach(NAV_NODES[k]);
      document.querySelectorAll('[data-opentab="' + k + '"],[data-navitem="' + k + '"]').forEach(function (el) {
        el.classList.remove('perm-off');
        el.hidden = !ok;
        if (!ok) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });
    });
    /* 子が全部隠れている親ドロップダウンも隠す */
    document.querySelectorAll('.navitem.hasmenu').forEach(function (el) {
      var kids = el.querySelectorAll('.navmenu-item');
      var any = false;
      kids.forEach(function (k) { if (!k.hidden) any = true; });
      el.hidden = kids.length > 0 && !any;
    });
  }

  window.__demoPerm = window.__demoPerm || {};
  window.__demoPerm.menu = {
    can: can, canReach: canReach, apply: apply,
    canWorkflow: function () { return canReach('settings-type-workflow'); },
  };

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { apply(); } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var off = t.closest('.perm-off');
    if (off) {
      e.stopPropagation();
      e.preventDefault();
      var tip = document.getElementById('toast');
      if (tip) { tip.textContent = '権限がありません'; tip.classList.add('on'); setTimeout(function () { tip.classList.remove('on'); }, 1800); }
    }
  }, true);
})();
/* ══════════ 担当／権限者の複数選択ドロップダウン：操作を滑らかにする ══════════
   ・開いたまま複数選択できる（選択のたびにパネルが閉じない）
   ・選択中は再描画後に自動で開き直す（キーで同一のドロップダウンを特定）
   ・パネル内に検索欄（入力中は再描画しない＝フォーカスと文字が消えない）
   ・外側クリック／Esc で閉じる、↑↓ + Enter でも選べる
   ══════════════════════════════════════════════════════════════════════════ */
(function assigneeDropdown() {
  var openKey = null;          /* 開いているドロップダウンの識別キー */

  function keyOf(box) {
    if (!box) return null;
    var wrap = box.closest('[data-asg-wrap]');
    var host = box.closest('.modal, .wiz-field, .perm-pick-col, .wiz-pane');
    var act = box.dataset.asg || (wrap && wrap.dataset.asgWrap) || '';
    var mode = box.dataset.asgModeCur || '';
    var idx = host ? Array.prototype.indexOf.call(host.querySelectorAll('.asg-select'), box) : 0;
    return act + '|' + mode + '|' + idx;
  }
  function findByKey(key) {
    var all = document.querySelectorAll('.asg-select');
    for (var i = 0; i < all.length; i++) {
      if (keyOf(all[i]) === key) return all[i];
    }
    return null;
  }
  function closeAll(except) {
    document.querySelectorAll('.asg-select.is-open').forEach(function (el) {
      if (!except || el !== except) el.classList.remove('is-open');
    });
    if (!except) openKey = null;
  }
  function open(box) {
    if (!box) return;
    closeAll(box);
    box.classList.add('is-open');
    openKey = keyOf(box);
    ensureSearch(box);
    /* パネルが隠れないよう、スクロール領域内で上寄せする */
    var pane = box.closest('.wiz-pane');
    if (pane) {
      var paneTop = pane.getBoundingClientRect().top;
      var boxTop = box.getBoundingClientRect().top;
      pane.scrollTop = pane.scrollTop + (boxTop - paneTop) - 8;
    }
    var first = box.querySelector('.asg-opt:not(.asg-opt-hidden)');
    if (first) first.focus({ preventScroll: true });
  }

  /* ── パネル内の検索欄（一度だけ注入） ── */
  function ensureSearch(box) {
    var panel = box.querySelector('.asg-panel');
    if (!panel || panel.querySelector('.asg-search')) return;
    var bar = document.createElement('div');
    bar.className = 'asg-search';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '検索（名前で絞り込み）';
    input.setAttribute('aria-label', '検索');
    input.addEventListener('input', function () { filter(box, input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; filter(box, ''); closeAll(); }
      if (e.key === 'Enter') { e.preventDefault(); var f = box.querySelector('.asg-opt:not(.asg-opt-hidden)'); if (f) f.click(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); var f2 = box.querySelector('.asg-opt:not(.asg-opt-hidden)'); if (f2) f2.focus(); }
    });
    bar.appendChild(input);
    panel.insertBefore(bar, panel.firstChild);
  }
  function filter(box, q) {
    var query = String(q || '').trim().toLowerCase();
    var panel = box.querySelector('.asg-panel');
    if (!panel) return;
    var shown = 0;
    panel.querySelectorAll('.asg-opt').forEach(function (opt) {
      var hit = !query || (opt.textContent || '').toLowerCase().indexOf(query) >= 0;
      opt.classList.toggle('asg-opt-hidden', !hit);
      if (hit) shown++;
    });
    var empty = panel.querySelector('.asg-empty');
    if (!shown && !empty) {
      empty = document.createElement('div');
      empty.className = 'asg-empty';
      empty.textContent = '該当する候補がありません';
      panel.appendChild(empty);
    } else if (shown && empty) {
      empty.remove();
    }
  }

  /* ── クリック：開閉・選択・解除・外側クリック ── */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* ※ ×（タグ解除）はコントロールの内側にあるため、必ず先に判定して素通しする。
       そうしないとトグル処理がイベントを止めて、解除が効かなくなる。 */
    if (t.closest('[data-tp-assignee-opt]') || t.closest('[data-tp-assignee-rm]')) return;

    var tg = t.closest('[data-tp-assignee-toggle]');
    if (tg) {
      e.stopPropagation();
      e.preventDefault();
      var box = tg.closest('.asg-select');
      if (box.classList.contains('is-open')) { closeAll(); }
      else open(box);
      return;
    }
    /* モード切替（権限者／ユーザー）もパネル維持 */
    if (t.closest('[data-asg-mode]') || t.closest('[data-perm-mode]')) {
      setTimeout(function () { if (openKey) { var b2 = findByKey(openKey); if (b2) ensureSearch(b2); } }, 0);
      return;
    }
    if (t.closest('.asg-search')) return;             /* 検索欄操作では閉じない */
    if (!t.closest('.asg-select')) closeAll();
  }, true);

  /* ── キーボード：Esc で閉じる、↑↓ で移動、Enter で選択 ── */
  document.addEventListener('keydown', function (e) {
    var list = document.querySelector('.asg-select.is-open');
    if (!list) return;
    if (e.key === 'Escape') { closeAll(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    var opts = Array.prototype.slice.call(list.querySelectorAll('.asg-opt:not(.asg-opt-hidden)'));
    if (!opts.length) return;
    var cur = document.activeElement;
    var i = opts.indexOf(cur);
    if (e.key === 'Enter') { if (cur && cur.classList.contains('asg-opt')) { e.preventDefault(); cur.click(); } return; }
    e.preventDefault();
    var next = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
    opts[next].focus({ preventScroll: true });
  }, true);

  /* ── 再描画後に、開いていたドロップダウンを開き直す（選択の連続操作を保つ） ── */
  var pending = null;
  var mo = new MutationObserver(function () {
    if (!openKey) return;
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      var box = findByKey(openKey);
      if (box && !box.classList.contains('is-open')) {
        box.classList.add('is-open');
        ensureSearch(box);
      } else if (!box) {
        openKey = null;
      }
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ 確認画面：修正したら赤（エラー）表示を解除する ══════════
   app.js は初期値の hasError を描画し続けるので、
   入力があった項目はその場で赤を外し、対応する bbox も通常色に戻す。 */
(function clearErrorOnEdit() {
  function hook() { return window.__demo || null; }

  function clearFor(key) {
    if (!key) return;
    document.querySelectorAll('.nl-review .rv-field-row').forEach(function (row) {
      var inp = row.querySelector('input[data-ocr], textarea[data-ocr]');
      if (!inp || inp.dataset.ocr !== key) return;
      row.classList.remove('has-error');
      var t = row.querySelector('.rv-field-state');
      if (!t) {
        t = document.createElement('span');
        t.className = 'rv-field-state mod';
        t.textContent = '修正済み';
        var head = row.querySelector('.rv-field-head') || row;
        head.appendChild(t);
      }
    });
    document.querySelectorAll('.nl-review .doc-mark-box.err').forEach(function (box) {
      if (box.dataset.bbox === key) box.classList.remove('err');
    });
  }

  /* 入力・変更のたびに、その項目の赤を解除する */
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t || !t.dataset || !t.dataset.ocr) return;
    if (!t.closest('.nl-review')) return;
    clearFor(t.dataset.ocr);
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.dataset || !t.dataset.ocr) return;
    if (!t.closest('.nl-review')) return;
    clearFor(t.dataset.ocr);
  }, true);

  /* 再描画後：dirty に入っている項目の赤を落とす（戻ってきたときも反映） */
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      var h = hook();
      if (!h || !h.state || !document.querySelector('.nl-review')) return;
      var id = h.state.reviewId;
      var dirty = (h.state.reviewDirty || {})[id] || {};
      Object.keys(dirty).forEach(clearFor);
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ 担当／権限者：単選に統一（グループ・権限者・ユーザーとも 1 つだけ） ══════════
   app.js は権限者を複数選択できる。運用は「1 操作 = 1 主体」なので、
   ここで選択を 1 つに畳む（別のものを選ぶと置き換え、× で解除）。 */
(function singlePrincipal() {
  function hook() { return window.__demo || null; }

  function selectKey(sel) {
    var wrap = sel.closest('[data-asg-wrap]');
    var host = sel.parentElement;
    var idx = host ? Array.prototype.indexOf.call(host.querySelectorAll('.asg-select'), sel) : 0;
    return (sel.dataset.asg || (wrap && wrap.dataset.asgWrap) || '') + '|' + (sel.dataset.asgModeCur || '') + '|' + idx;
  }
  function findByKey(key) {
    var all = document.querySelectorAll('.asg-select');
    for (var i = 0; i < all.length; i++) if (selectKey(all[i]) === key) return all[i];
    return null;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* 選択肢：単選（同じものを再クリックで解除） */
    var opt = t.closest('[data-tp-assignee-opt]');
    if (opt) {
      e.stopPropagation();
      e.preventDefault();
      var h = hook();
      var sel = opt.closest('.asg-select');
      var key = sel ? selectKey(sel) : null;
      var raw = opt.dataset.tpAssigneeOpt || '';
      var parts = raw.split(':');
      var act = parts[0];
      var id = parts[1];
      if (!h || !act || !id) return;
      var tt = (h.TICKET_TYPES || []).filter(function (x) { return x.id === h.state.typeId; })[0];
      var lid = h.layoutIdOfTicketType ? h.layoutIdOfTicketType(tt) : null;
      if (!lid) return;
      if (!h.TICKET_PERMS[lid]) h.TICKET_PERMS[lid] = { view: [], confirm: [], approve: [], reapprove: [] };
      var cur = h.TICKET_PERMS[lid][act] || [];
      var isUser = (h.USERS || []).some(function (u) { return u.id === id; });
      var only = cur.length === 1 && cur[0] === id;
      h.TICKET_PERMS[lid][act] = only ? [] : [id];
      h.state.asgMode = Object.assign({}, h.state.asgMode || {}, (function () { var o = {}; o[act] = isUser ? 'user' : 'role'; return o })());
      h.render();
      /* 開いていたパネルを開き直す */
      if (key) {
        requestAnimationFrame(function () {
          var again = findByKey(key.replace('|' + (sel.dataset.asgModeCur || ''), '|' + (isUser ? 'user' : 'role')));
          if (again) again.classList.add('is-open');
        });
      }
      return;
    }

    /* × で解除（全部外す） */
    var rm = t.closest('[data-tp-assignee-rm]');
    if (rm) {
      e.stopPropagation();
      e.preventDefault();
      var h2 = hook();
      var sel2 = rm.closest('.asg-select');
      var key2 = sel2 ? selectKey(sel2) : null;
      var parts2 = (rm.dataset.tpAssigneeRm || '').split(':');
      if (!h2 || !parts2[0]) return;
      var tt2 = (h2.TICKET_TYPES || []).filter(function (x) { return x.id === h2.state.typeId; })[0];
      var lid2 = h2.layoutIdOfTicketType ? h2.layoutIdOfTicketType(tt2) : null;
      if (!lid2 || !h2.TICKET_PERMS[lid2]) return;
      h2.TICKET_PERMS[lid2][parts2[0]] = [];
      h2.render();
      if (key2) {
        requestAnimationFrame(function () {
          var again2 = findByKey(key2);
          if (again2) again2.classList.add('is-open');
        });
      }
      return;
    }
  }, true);

  /* 権限者モードの選択肢は「単選」なのでチェック印は 1 つだけ見せる（CSS 側で調整） */
  window.__demoSinglePrincipal = { selectKey: selectKey, findByKey: findByKey };
})();

/* ══════════ ユーザー権限（操作権限）の適用 ══════════
   ENT_USERS[].ops（閲覧／アップロード／確認／承認／CSV出力／帳票設定変更）
   OCR結果修正は確認に含まれる。未設定のユーザーは全許可（フォールバック）。 */
(function userOperationPermissions() {
  var ALL_OPS = ['view', 'upload', 'confirm', 'approve', 'reapprove', 'export'];

  function hook() { return window.__demo || null; }

  function normalizeOps(list) {
    if (!Array.isArray(list)) return list;
    var out = [];
    var seen = {};
    list.forEach(function (k) {
      var key = k === 'fix' ? 'confirm' : k;
      if (ALL_OPS.indexOf(key) < 0 || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function allowedOps() {
    if (adminMode()) return null;                /* 管理者固定＝全許可 */
    var h = hook();
    if (!h || !h.state) return null;
    if (window.isSuperUser && window.isSuperUser()) return null;   /* 万能＝全許可 */
    if (h.isTenantAdmin && h.isTenantAdmin(h.state.currentUser)) return null;
    var uid = h.state.currentUser;
    var list = h.ENT_USERS || [];
    var u = list.filter(function (x) { return x.uid === uid; })[0]
         || list.filter(function (x) { return x.id === uid; })[0];
    if (h.userOpsOf && u) return h.userOpsOf(u);
    if (u && Array.isArray(u.ops)) return normalizeOps(u.ops);
    if (u) {
      var r = (h.ROLES || []).filter(function (x) { return x.name === u.role || x.id === u.roleId; })[0];
      var table = window.ROLE_OPS || {};
      if (r && table[r.id]) return normalizeOps(table[r.id]);
    }
    return null;
  }

  function has(op) {
    var ops = allowedOps();
    if (ops === null) return true;
    var key = op === 'fix' ? 'confirm' : op;
    return ops.indexOf(key) >= 0;
  }

  /* ボタン ↔ 操作の対応（保存＝確認権限） */
  var RULES = [
    /* 帳票設定変更はシステム権限（メニュー権限の子ノード）で管理するため、ここでは扱わない */
    { sel: '#rvConfirm', op: 'confirm', what: '確認' },
    { sel: '#rvSave', op: 'confirm', what: '確認（OCR結果修正）' },
    /* 2 段目は「再承認」、1 段目は「承認」のどちらでも押せる */
    { sel: '#rvApprove', op: ['approve', 'reapprove'], what: '承認' },
    { sel: '#rvExport', op: 'export', what: 'CSV出力' },
    { sel: '#batchExport', op: 'export', what: 'CSV出力' },
    { sel: '[data-dlmenu]', op: 'export', what: 'CSV出力' },
    { sel: '#hDownload', op: 'export', what: 'CSV出力' },
    { sel: '#batchRead', op: 'upload', what: 'アップロード' },
  ];

  function apply() {
    if (adminMode()) return;                     /* 管理者固定＝何も制限しない */
    var h = hook();
    if (!h || !h.state) return;
    if (allowedOps() === null) return;
    RULES.forEach(function (r) {
      var ok = Array.isArray(r.op) ? r.op.some(has) : has(r.op);
      document.querySelectorAll(r.sel).forEach(function (el) {
        if (ok) {
          if (el.dataset.userOpOff) {
            el.disabled = false;
            el.classList.remove('user-op-off');
            el.title = el.dataset.userOpTitle || '';
            delete el.dataset.userOpOff;
            delete el.dataset.userOpTitle;
          }
        } else {
          if (!el.dataset.userOpOff) {
            el.dataset.userOpOff = '1';
            el.dataset.userOpTitle = el.title || '';
          }
          el.disabled = true;
          el.classList.add('user-op-off');
          el.title = '権限がありません（' + r.what + '）';
        }
      });
    });
  }

  window.__demoUserOps = { has: has, allowed: allowedOps, apply: apply, ALL: ALL_OPS };

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { apply() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ ユーザー追加／編集ダイアログ：所属グループのチェックを実データで埋める ══════════
   app.js 側のマークアップが再生成で消えることがあるため、描画後に DOM を補完する。 */
(function fillUserGroups() {
  function hook() { return window.__demo || null; }
  function fill() {
    var h = hook();
    var box = document.querySelector('.user-add-modal .grp-users');
    if (!h || !box) return;
    var groups = (h.GROUPS && h.GROUPS.length) ? h.GROUPS : (window.GROUPS || []);
    if (!groups.length || typeof groups[0] === 'string') return;   /* グループ実データが無いときは触らない */
    if (box.querySelector('input[type="checkbox"]')) return;       /* 既に描画済み */
    var d = h.userAddDraft ? h.userAddDraft() : null;
    var picked = (d && d.groupIds) || [];
    box.innerHTML = groups.map(function (g) {
      return '<label class="perm-pick"><input type="checkbox" class="cb" data-userGrp="' + g.id + '"'
        + (picked.indexOf(g.id) >= 0 ? ' checked' : '')
        + ' /><span>' + (g.name || g.id) + '</span><span class="perm-pick-sub">' + (g.kind || '') + '</span></label>';
    }).join('');
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { fill() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ 承認フロー／担当の設定は「帳票権限管理」に集約 ══════════
   帳票タイプ設定（step1）では、承認段数・担当の欄を出さない。 */
(function hideWorkflowFields() {
  /* 承認フロー（段数）も担当も「帳票権限管理／ユーザー管理」へ集約したので、ここでは一切出さない */
  var PAT = /^(承認フロー|確認担当|承認担当（1段目）|承認担当（2段目）|再承認担当|再承認担当（2段目）)$/;
  function hide() {
    document.querySelectorAll('.wiz-pane .wiz-field').forEach(function (f) {
      var wl = f.querySelector(':scope > .wl');
      if (!wl) return;
      var t = wl.textContent.trim().replace(/\s+/g, '');
      f.classList.toggle('flow-hidden', PAT.test(t));
    });
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { hide() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ グループの「役割」：自由入力（候補は datalist） ══════════ */
(function groupKindInput() {
  function hook() { return window.__demo || null; }
  function bind() {
    var h = hook();
    var el = document.getElementById('grpFormKind');
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('input', function () {
      if (h && h.state && h.state.groupDraft) h.state.groupDraft.kind = el.value;
    });
    el.addEventListener('change', function () {
      if (h && h.state && h.state.groupDraft) h.state.groupDraft.kind = el.value;
    });
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { bind() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ デモの「担当者切替」を DOM からも完全に排除 ══════════
   app.js が再生成されてマークアップが復活しても、描画直後に消す。 */
(function killActorSwitcher() {
  function kill() {
    var menu = document.querySelector('.userpick');
    if (!menu) return;
    menu.querySelectorAll('.usermenu-switch, [data-demo-actor]').forEach(function (el) {
      if (el.classList.contains('usermenu-switch')) el.remove();
      else el.remove();
    });
    var badge = menu.querySelector('.demo-badge');
    if (badge) badge.remove();
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { kill() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  /* 念のためクリックも遮断 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('[data-demo-actor]') || t.closest('.usermenu-switch'))) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();

/* ══════════ 操作ガイド（ショートカット説明）＋ 実際のキーボード操作 ══════════
   - ガイドボタンのホバーで説明（title）
   - クリックでショートカット一覧のポップオーバー
   - 一覧に載せたキーは実際に動く（Enter / Tab / Shift+Tab / ←→ / ± / Ctrl+S / Esc）
   - 権限で無効なボタンはショートカットでも押せない */
(function reviewGuideAndShortcuts() {
  var GUIDE_ID = '__rvGuidePop';
  var SHORTCUTS = [
    { label: '確定して次へ', keys: ['Enter'] },
    { label: '次の項目へ', keys: ['Tab'] },
    { label: '前の項目へ', keys: ['Shift', 'Tab'] },
    { label: '前のページ', keys: ['←'] },
    { label: '次のページ', keys: ['→'] },
    { label: 'ズームイン', keys: ['+'] },
    { label: 'ズームアウト', keys: ['-'] },
    { label: '保存', keys: ['Ctrl', 'S'] },
    { label: 'ガイドを閉じる', keys: ['Esc'] },
  ];

  function isReviewOpen() { return !!document.querySelector('.reviewpage'); }
  function fields() { return [].slice.call(document.querySelectorAll('.rv-field-input')).filter(function (el) { return !el.disabled && el.offsetParent !== null; }); }
  function clickIfEnabled(id) { var el = document.getElementById(id); if (el && !el.disabled && !el.classList.contains('perm-off') && !el.classList.contains('user-op-off')) { el.click(); return true; } return false; }
  function currentIndex() { var list = fields(); var i = list.indexOf(document.activeElement); return { list: list, i: i }; }

  function closeGuide() { var p = document.getElementById(GUIDE_ID); if (p) p.remove(); }

  function openGuide() {
    closeGuide();
    var btn = document.getElementById('rvGuide');
    if (!btn) return;
    var box = document.createElement('div');
    box.className = 'rv-guide-pop';
    box.id = GUIDE_ID;
    box.setAttribute('role', 'dialog');
    var rows = SHORTCUTS.map(function (s) {
      var keys = s.keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('<span class="rv-guide-plus">+</span>');
      return '<div class="rv-guide-row"><span class="rv-guide-l">' + s.label + '</span><span class="rv-guide-k">' + keys + '</span></div>';
    }).join('');
    box.innerHTML = '<div class="rv-guide-head"><span class="ico i-error"></span><b>ショートカットキーの説明</b><button type="button" class="rv-guide-x" aria-label="閉じる">×</button></div>'
      + '<div class="rv-guide-body">' + rows + '</div>'
      + '<p class="rv-guide-note"><span class="ico i-info"></span>赤色の項目は読取結果の信頼度が低い、辞書非対応、必須項目不対応などの異常を含み、目視確認が必要です</p>'
      + '<button type="button" class="rv-guide-ok">了解しました</button>';
    document.body.appendChild(box);
    var r = btn.getBoundingClientRect();
    var b = box.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - b.width - 8));
    var top = r.bottom + 8;
    if (top + b.height > window.innerHeight - 8) top = Math.max(8, r.top - b.height - 8);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    box.querySelector('.rv-guide-x').onclick = closeGuide;
    box.querySelector('.rv-guide-ok').onclick = closeGuide;
  }

  /* ガイドボタン：ホバーで説明、クリックで一覧 */
  function bindGuide() {
    var btn = document.getElementById('rvGuide');
    if (!btn) { closeGuide(); return; }
    if (btn.dataset.guideBound === '1') return;
    btn.dataset.guideBound = '1';
    btn.title = 'キーボード操作（ショートカット）の一覧を表示します';
    btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openGuide(); };
  }

  /* 実際のショートカット */
  document.addEventListener('keydown', function (e) {
    if (!isReviewOpen()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    var inField = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') { closeGuide(); return; }

    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      if (clickIfEnabled('rvSave')) { e.preventDefault(); }
      return;
    }

    if (e.key === 'Enter' && inField) {
      /* 確定して次へ：値を確定して次の項目へ。最後の項目なら保存相当（確認へ） */
      var cur = currentIndex();
      e.preventDefault();
      if (e.target && typeof e.target.blur === 'function') e.target.blur();
      if (cur.i >= 0 && cur.i < cur.list.length - 1) {
        var next = fields()[cur.i + 1];
        if (next) { next.focus(); try { next.setSelectionRange(next.value.length, next.value.length); } catch (_) {} }
      }
      return;
    }

    if (!inField) {
      if (e.key === 'ArrowLeft') { if (clickIfEnabled('rvPagePrev')) e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { if (clickIfEnabled('rvPageNext')) e.preventDefault(); return; }
      if (e.key === '+' || e.key === '=') { if (clickIfEnabled('rvZoomIn')) e.preventDefault(); return; }
      if (e.key === '-' || e.key === '_') { if (clickIfEnabled('rvZoomOut')) e.preventDefault(); return; }
    }
  }, true);

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { bindGuide(); } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ ワークフローの表示：既定は折りたたみ、ホバーで展開（ボタンなし） ══════════ */
(function stepperHoverReveal() {
  function apply() {
    var strip = document.querySelector('.rv-flow-strip');
    if (!strip) return;
    strip.classList.add('is-collapsed');
    var bar = strip.querySelector('.rv-flow-togglebar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'rv-flow-togglebar';
      bar.innerHTML = '<span class="rv-flow-hint"><span class="ico i-caret-down"></span>ワークフロー</span>';
      strip.appendChild(bar);
    }
    /* ホバーで一時展開（クリック不要） */
    strip.onmouseenter = function () { strip.classList.add('is-hover-open'); };
    strip.onmouseleave = function () { strip.classList.remove('is-hover-open'); };
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { apply(); } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ デモの「担当者切替」を DOM からも完全に排除 ══════════
   app.js が再生成されてマークアップが復活しても、描画直後に消す。 */
(function killActorSwitcher() {
  function kill() {
    var menu = document.querySelector('.userpick');
    if (!menu) return;
    menu.querySelectorAll('.usermenu-switch, [data-demo-actor]').forEach(function (el) {
      if (el.classList.contains('usermenu-switch')) el.remove();
      else el.remove();
    });
    var badge = menu.querySelector('.demo-badge');
    if (badge) badge.remove();
  }
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { kill() } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  /* 念のためクリックも遮断 */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('[data-demo-actor]') || t.closest('.usermenu-switch'))) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();

/* ══════════ 操作ガイド（ショートカット説明）＋ 実際のキーボード操作 ══════════
   - ガイドボタンのホバーで説明（title）
   - クリックでショートカット一覧のポップオーバー
   - 一覧に載せたキーは実際に動く（Enter / Tab / Shift+Tab / ←→ / ± / Ctrl+S / Esc）
   - 権限で無効なボタンはショートカットでも押せない */
(function reviewGuideAndShortcuts() {
  var GUIDE_ID = '__rvGuidePop';
  var SHORTCUTS = [
    { label: '確定して次へ', keys: ['Enter'] },
    { label: '次の項目へ', keys: ['Tab'] },
    { label: '前の項目へ', keys: ['Shift', 'Tab'] },
    { label: '前のページ', keys: ['←'] },
    { label: '次のページ', keys: ['→'] },
    { label: 'ズームイン', keys: ['+'] },
    { label: 'ズームアウト', keys: ['-'] },
    { label: '保存', keys: ['Ctrl', 'S'] },
    { label: 'ガイドを閉じる', keys: ['Esc'] },
  ];

  function isReviewOpen() { return !!document.querySelector('.reviewpage'); }
  function fields() { return [].slice.call(document.querySelectorAll('.rv-field-input')).filter(function (el) { return !el.disabled && el.offsetParent !== null; }); }
  function clickIfEnabled(id) { var el = document.getElementById(id); if (el && !el.disabled && !el.classList.contains('perm-off') && !el.classList.contains('user-op-off')) { el.click(); return true; } return false; }
  function currentIndex() { var list = fields(); var i = list.indexOf(document.activeElement); return { list: list, i: i }; }

  function closeGuide() { var p = document.getElementById(GUIDE_ID); if (p) p.remove(); }

  function openGuide() {
    closeGuide();
    var btn = document.getElementById('rvGuide');
    if (!btn) return;
    var box = document.createElement('div');
    box.className = 'rv-guide-pop';
    box.id = GUIDE_ID;
    box.setAttribute('role', 'dialog');
    var rows = SHORTCUTS.map(function (s) {
      var keys = s.keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('<span class="rv-guide-plus">+</span>');
      return '<div class="rv-guide-row"><span class="rv-guide-l">' + s.label + '</span><span class="rv-guide-k">' + keys + '</span></div>';
    }).join('');
    box.innerHTML = '<div class="rv-guide-head"><span class="ico i-error"></span><b>ショートカットキーの説明</b><button type="button" class="rv-guide-x" aria-label="閉じる">×</button></div>'
      + '<div class="rv-guide-body">' + rows + '</div>'
      + '<p class="rv-guide-note"><span class="ico i-info"></span>赤色の項目は読取結果の信頼度が低い、辞書非対応、必須項目不対応などの異常を含み、目視確認が必要です</p>'
      + '<button type="button" class="rv-guide-ok">了解しました</button>';
    document.body.appendChild(box);
    var r = btn.getBoundingClientRect();
    var b = box.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, window.innerWidth - b.width - 8));
    var top = r.bottom + 8;
    if (top + b.height > window.innerHeight - 8) top = Math.max(8, r.top - b.height - 8);
    box.style.left = Math.round(left) + 'px';
    box.style.top = Math.round(top) + 'px';
    box.querySelector('.rv-guide-x').onclick = closeGuide;
    box.querySelector('.rv-guide-ok').onclick = closeGuide;
  }

  /* ガイドボタン：ホバーで説明、クリックで一覧 */
  function bindGuide() {
    var btn = document.getElementById('rvGuide');
    if (!btn) { closeGuide(); return; }
    if (btn.dataset.guideBound === '1') return;
    btn.dataset.guideBound = '1';
    btn.title = 'キーボード操作（ショートカット）の一覧を表示します';
    btn.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openGuide(); };
  }

  /* 実際のショートカット */
  document.addEventListener('keydown', function (e) {
    if (!isReviewOpen()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    var inField = tag === 'input' || tag === 'textarea' || tag === 'select';

    if (e.key === 'Escape') { closeGuide(); return; }

    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      if (clickIfEnabled('rvSave')) { e.preventDefault(); }
      return;
    }

    if (e.key === 'Enter' && inField) {
      /* 確定して次へ：値を確定して次の項目へ。最後の項目なら保存相当（確認へ） */
      var cur = currentIndex();
      e.preventDefault();
      if (e.target && typeof e.target.blur === 'function') e.target.blur();
      if (cur.i >= 0 && cur.i < cur.list.length - 1) {
        var next = fields()[cur.i + 1];
        if (next) { next.focus(); try { next.setSelectionRange(next.value.length, next.value.length); } catch (_) {} }
      }
      return;
    }

    if (!inField) {
      if (e.key === 'ArrowLeft') { if (clickIfEnabled('rvPagePrev')) e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { if (clickIfEnabled('rvPageNext')) e.preventDefault(); return; }
      if (e.key === '+' || e.key === '=') { if (clickIfEnabled('rvZoomIn')) e.preventDefault(); return; }
      if (e.key === '-' || e.key === '_') { if (clickIfEnabled('rvZoomOut')) e.preventDefault(); return; }
    }
  }, true);

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = null; try { bindGuide(); } catch (e) { /* noop */ } });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

/* ══════════ 工程ステッパーの表示／非表示（折りたたみ） ══════════
   右上の小さなボタンで折りたたむ。状態は localStorage に保存する。 */

/* ══════════ ブラウザタブの名前を LLM OCR に固定 ══════════
   app 側が画面遷移で document.title を「LLM OCR - 帳票読取」のように書き換えるため、
   setter を上書きし、<title> 要素の書き換えも監視して戻す。 */
(function forceTabTitle() {
  var WANT = 'LLM OCR';
  try {
    Object.defineProperty(document, 'title', {
      configurable: true,
      get: function () { return WANT; },
      set: function () { /* app 側の設定は無視する */ },
    });
  } catch (_) { /* noop */ }

  function fixElement() {
    var t = document.querySelector('title');
    if (t && t.textContent !== WANT) t.textContent = WANT;
  }
  try {
    var t = document.querySelector('title');
    if (t) new MutationObserver(fixElement).observe(t, { childList: true, characterData: true, subtree: true });
    new MutationObserver(fixElement).observe(document.head, { childList: true });
  } catch (_) { /* noop */ }
  fixElement();
})();
