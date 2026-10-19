/**
 * デモの権限モード。
 *
 * 既定は「ログインユーザーの権限どおり」。ヘッダー直下の切替バーでユーザーを変えると、
 * メニュー到達・帳票一覧・操作ボタンがそのユーザーの権限で描き直される。
 *   - システム管理者（ロール R1 の u1）は isTenantAdmin() が true なので全権限
 *   - それ以外はグループ／帳票権限表のとおりに制限される
 *
 * 制限を外して全機能を見たいときだけ URL に ?full=1 を付ける。
 *
 *   http://127.0.0.1:8788/index.html           ← 権限どおり（既定）
 *   http://127.0.0.1:8788/index.html?full=1    ← 全権限
 *
 * ※ app.js より前に読み込むこと（index.html の script 順）。
 */
(function () {
  var src = location.search + location.hash;
  /* ?full=1 / #full=1 / &full=1 のいずれでも「全権限」に切替。 */
  var full = /(?:^|[?&#])full=1(?:&|#|$)/.test(src);
  window.DEMO_FULL_ADMIN = full;
  try {
    console.info(full
      ? '[demo] 権限モード：全システム・全メニュー権限（?full=1）'
      : '[demo] 権限モード：ログインユーザーの権限どおり');
  } catch (e) { /* noop */ }
})();
