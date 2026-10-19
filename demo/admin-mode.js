/**
 * デモの権限モード。
 *
 * 既定は「全システム・全メニュー権限」＝制限なし。
 * app.js の isTenantAdmin() と review-focus-fix.js の adminMode() が
 * window.DEMO_FULL_ADMIN を見て、以下をまとめて素通りさせる：
 *   - メニュー到達（menuLeavesForUser → null ＝全メニュー表示）
 *   - 帳票権限表（閲覧／確認／承認／再承認）
 *   - アップロード権限表
 *   - 操作権限（userHasOp）
 *   - 一覧の閲覧フィルタ（visibleLayouts → null ＝全件）
 *
 * 権限どおりの挙動（グループ単位の帳票権限・メニュー権限）を確認したいときは、
 * URL に ?perm=1 を付けて開く。そのときは今までどおり制限がかかる。
 *
 *   http://127.0.0.1:8905/index.html          ← 全権限（既定）
 *   http://127.0.0.1:8905/index.html?perm=1   ← 権限設定どおりに制限
 *
 * ※ app.js より前に読み込むこと（index.html の script 順）。
 */
(function () {
  var src = location.search + location.hash;
  /* ?perm=1 / #perm=1 / &perm=1 のいずれでも「制限あり」に切替。
     search と hash を連結して判定するため、perm=1 の直後が # になる形も許可する。 */
  var restricted = /(?:^|[?&#])perm=1(?:&|#|$)/.test(src);
  window.DEMO_FULL_ADMIN = !restricted;
  /* ヘッダーの「デモ」バッジは review-fix 側が DOM から外すため、
     いまどちらのモードなのかはコンソールに出す。 */
  try {
    console.info(restricted
      ? '[demo] 権限モード：設定どおりに制限（?perm=1）'
      : '[demo] 権限モード：全システム・全メニュー権限（制限なし）。絞るには URL に ?perm=1');
  } catch (e) { /* noop */ }
})();
