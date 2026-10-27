/* 配信バンドル（serve.py のパッチ適用後 app.js）のスモークテスト。
 *
 * app.js を直接読む result-ui.test.cjs は「生ソース」しか見ないため、
 * serve.py の注入で壊れても緑のままになる（2026-10-19 に 2 回やらかした）。
 * ここでは `serve.py --build` の成果物を読み、実際に配られる JS を検証する。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const DEMO = path.join(__dirname, '..');
const PYTHONS = [
  process.env.PYTHON,
  '/Users/jade/.workbuddy-ai/binaries/python/versions/3.13.12/bin/python3',
  'python3',
].filter(Boolean);

let cachedSource = null;

function buildBundle() {
  if (cachedSource) return cachedSource;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'densan-served-'));
  let lastErr = null;
  for (const py of PYTHONS) {
    try {
      execFileSync(py, ['serve.py', '--build', out], { cwd: DEMO, stdio: 'ignore', timeout: 120000 });
      cachedSource = fs.readFileSync(path.join(out, 'app.js'), 'utf8');
      return cachedSource;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('serve.py --build failed');
}

function servedApp() {
  const source = buildBundle();
  const noop = () => {};
  const el = () => ({
    style: { setProperty: noop }, dataset: {}, classList: { add: noop, remove: noop, contains: () => false },
    addEventListener: noop, appendChild: noop, remove: noop, querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0 }),
    setAttribute: noop, closest: () => null, innerHTML: '', textContent: '',
  });
  const win = { innerWidth: 1512, innerHeight: 950, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) };
  win.window = win;
  const doc = {
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    createElement: el, getElementById: () => null,
    body: el(), documentElement: el(), head: el(),
  };
  win.document = doc;
  const ctx = vm.createContext({
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    location: { hash: '', search: '', pathname: '/', href: 'http://localhost/' },
    history: { replaceState() {}, pushState() {} },
    window: win, document: doc, navigator: { userAgent: 'node' },
  });
  const cut = source.lastIndexOf('\napplyHash();');
  vm.runInContext(cut > 0 ? source.slice(0, cut) : source, ctx);
  return (code) => vm.runInContext(code, ctx);
}

test('served bundle: 一覧・ユーザー・権限の各画面が例外なく HTML を返す', () => {
  const run = servedApp();
  const screens = {
    tabs: 'renderTabs()',
    table: 'renderTable()',
    filters: 'renderFilters()',
    users: 'renderUsers()',
    permissions: 'renderPermissions()',
  };
  for (const [name, expr] of Object.entries(screens)) {
    let html = '';
    assert.doesNotThrow(() => { html = run(expr); }, `${name} が例外を投げた`);
    assert.equal(typeof html, 'string', name);
    assert.ok(html.length > 50, `${name} が空`);
  }
});

test('served bundle: 閲覧権限フックが未定義変数を参照していない', () => {
  const source = buildBundle();
  /* serve.py が const canView を消すので、裸の参照が残ると一覧が真っ白になる */
  assert.equal((source.match(/\(!canView \|\| canView\(f\)\)/g) || []).length, 0);
  assert.ok(source.includes('function canSeeFile'), 'canSeeFile が消えている');
  assert.ok(source.includes('canViewFile(f)'), 'canViewFile への置換が当たっていない');
});

test('served bundle: メニュー権限の葉が重複していない', () => {
  const run = servedApp();
  const leaves = JSON.parse(run('JSON.stringify(MENU_LEAVES)'));
  const dup = leaves.filter((id, i) => leaves.indexOf(id) !== i);
  assert.deepEqual(dup, [], `重複した葉: ${dup.join(', ')}`);
  /* グループ系の葉はちょうど 3 つ（追加／編集／削除） */
  const groupLeaves = leaves.filter((id) => id.startsWith('usage-groups-'));
  assert.deepEqual(groupLeaves.sort(), ['usage-groups-add', 'usage-groups-del', 'usage-groups-edit']);
});

test('served bundle: タブは 5 状態＋すべて（読取待ちを出さない）', () => {
  const run = servedApp();
  const ids = JSON.parse(run('JSON.stringify(TAB_STATUS)'));
  assert.deepEqual(ids, ['reading', 'done', 'failed', 'confirmed', 'exported']);
  const tabs = run('renderTabs()');
  assert.equal((tabs.match(/data-tab=/g) || []).length, 6);
  assert.doesNotMatch(tabs, /data-tab="waiting"/);
});

test('served bundle: 操作グループの最上位は「電算」で、削除不可', () => {
  const run = servedApp();
  const roots = JSON.parse(run('JSON.stringify(GROUPS.filter((g) => !g.parentId))'));
  assert.equal(roots.length, 1, '最上位グループは 1 つだけ');
  assert.equal(roots[0].name, '電算');
  assert.equal(roots[0].root, true);
  const others = JSON.parse(run('JSON.stringify(GROUPS.filter((g) => g.parentId))'));
  assert.ok(others.length > 0);
  others.forEach((g) => assert.equal(g.parentId, roots[0].id, `${g.name} の親が電算ではない`));
});

test('served bundle: 権限表の列数と各行のセル数が一致する', () => {
  const run = servedApp();
  const html = run('renderPermissions()');
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  assert.ok(tables.length >= 2, `権限表が見つからない（${tables.length} 表）`);
  tables.forEach((t, ti) => {
    const th = (t.match(/<th[\s>]/g) || []).length;
    assert.ok(th > 0, `表${ti} にヘッダが無い`);
    const body = t.slice(t.indexOf('<tbody'));
    (body.match(/<tr[\s\S]*?<\/tr>/g) || []).forEach((r, ri) => {
      const td = (r.match(/<td[\s>]/g) || []).length;
      const span = (r.match(/colspan="(\d+)"/) || [])[1];
      if (span) {
        /* 空状態の行は colspan でヘッダ数を埋める */
        assert.equal(Number(span), th, `表${ti} 行${ri}: colspan=${span} だが th=${th}`);
        return;
      }
      /* 承認段のセルを描き残すと値が 1 列ずれる（過去に発生） */
      assert.equal(td, th, `表${ti} 行${ri}: th=${th} に対して td=${td}`);
    });
  });
});

test('served bundle: 権限表のセルに内部グループ ID が出ていない', () => {
  const run = servedApp();
  const html = run('renderPermissions()');
  /* GROUP_MODEL が GROUPS を差し替えるので、TICKET_PERMS 側も読み替えていないと g1 等が漏れる */
  const leaked = (html.match(/>\s*g\d+\s*</g) || []).map((s) => s.trim());
  assert.deepEqual(leaked, [], `内部 ID がそのまま出ている: ${leaked.slice(0, 5).join(', ')}`);
});

test('served bundle: ステータス・詳細条件とも「未出力／出力未済」を出さない', () => {
  const run = servedApp();
  const html = run('state.filterOpen = true; renderFilters()');
  const sel = (html.match(/data-fs="status"[\s\S]*?<\/select>/) || [])[0] || '';
  assert.ok(sel, 'ステータスの絞り込みが見つからない');
  assert.doesNotMatch(sel, /notExported|未出力|出力未済/);
  assert.doesNotMatch(html, /data-fs="exportPending"|未出力|出力未済/);
});

test('served bundle: 自動アップロードは監視パスごとの処理後と Webhook URL 直接入力', () => {
  const run = servedApp();
  const html = run('renderWatch()');
  const heads = [...html.matchAll(/class="watch-sec-head">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(heads, ['監視パス', '帳票タイプ別ルール', '二重取込防止', '失敗時の再実行']);
  assert.equal((html.match(/data-wroot-after=/g) || []).length, run('WATCH.roots.length'));
  assert.doesNotMatch(html, /data-wroot-tenant=|data-wroot-done=|宛先メール|data-wf="notifyMail"/);
  assert.doesNotMatch(html, /通知方法|data-wf-check/);
  assert.doesNotMatch(html, /Webhook URL/);
  assert.doesNotMatch(html, /data-wf="notifyUrl"/);
});

test('served bundle: 絞り込みは既定 1 行（ファイル名・ステータス・帳票タイプ）＋詳細 2 行', () => {
  const run = servedApp();
  const collapsed = run('state.filterOpen = false; renderFilters()');
  assert.match(collapsed, /id="filtName"/);
  assert.match(collapsed, /data-fs="status"/);
  assert.match(collapsed, /data-fs="layout"/);
  assert.doesNotMatch(collapsed, /data-fs="biz"/);
  assert.doesNotMatch(collapsed, /id="filtRvq"/);
  assert.equal((collapsed.match(/class="result-filter-row/g) || []).length, 1);

  const open = run('state.filterOpen = true; renderFilters()');
  assert.equal((open.match(/data-fs="biz"/g) || []).length, 1);
  assert.equal((open.match(/data-fs="layout"/g) || []).length, 1);
  assert.match(open, /id="filtRvq"/);
  assert.match(open, /読取内容/);
  assert.equal((open.match(/class="result-filter-row/g) || []).length, 3);

  /* 読取内容（OCR 項目値・修正値）で絞り込める */
  run('state.filters = defaultFilters(); state.q = ""; state.tab = "all"; state.activeNode = { type: "all", id: "all" };');
  const fid = JSON.parse(run('JSON.stringify(visibleFiles()[0].id)'));
  run(`state.reviewDirty[${JSON.stringify(fid)}] = Object.assign({}, state.reviewDirty[${JSON.stringify(fid)}], { move_type: "ユニーク読取値" });`);
  run('state.filters.rvq = "ユニーク読取値"; state.resultPage = 1');
  assert.deepEqual(JSON.parse(run('JSON.stringify(visibleFiles().map((f) => f.id))')), [fid]);
});

test('served bundle: ホームに自動アップロードのダッシュボードタブ', () => {
  const run = servedApp();
  const home = run('renderHome()');
  assert.doesNotMatch(home, /data-hometab="dashboard"/);
  const html = run('state.noticesOpen = true; renderNotices()');
  assert.match(html, /お知らせ/);
  for (const label of ['発生日時','ファイル名','監視パス','失敗理由']) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /既読|未読|対応済み/);
});
