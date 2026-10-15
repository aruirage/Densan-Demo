#!/usr/bin/env python3
"""検証用の最小静的サーバ。Cache-Control: no-store を必ず付けるので、
   ブラウザが古い app.js を掴んだままになる事故を防げる。
   Usage: python3 serve-nocache.py [port]
   ※ 本番のプレビューは serve.py を使う。こちらは検証専用。"""
import sys, http.server, functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8905


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as httpd:
    print(f'serving on http://127.0.0.1:{PORT}/', flush=True)
    httpd.serve_forever()
