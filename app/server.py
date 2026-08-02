#!/usr/bin/env python3
"""Localhost dashboard for the kiro-cli benchmark run.

Serves a JSON API (data from app/collectors.py) and, once the frontend has
been built (cd app/web && npm run build), the React app from app/web/dist/.

    python3 app/server.py [--port 8080] [--run-id full-20260729]

Stdlib only; AWS access via the aws CLI (default profile).
"""

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from collectors import Snapshot

APP_DIR = Path(__file__).resolve().parent
DIST_DIR = APP_DIR / "web" / "dist"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
}


class Config:
    def __init__(self, args):
        self.port = args.port
        self.run_id = args.run_id
        self.bucket = args.bucket
        self.queue_url = args.queue_url
        self.dlq_url = args.dlq_url
        self.tasks_file = args.tasks_file
        self.keys_secret_id = args.keys_secret_id
        self.pat_file = args.pat_file


def make_handler(snapshot, cfg):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # quiet

        def _json(self, obj, status=200):
            body = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _static(self, path):
            if not path.is_file() or DIST_DIR not in path.resolve().parents:
                self._json({"error": "not found"}, 404)
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type",
                             CONTENT_TYPES.get(path.suffix, "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            url = urlparse(self.path)
            route = url.path
            view = snapshot.view()
            try:
                if route == "/api/overview":
                    q = view["queue"]["data"] or {}
                    w = view["workers"]["data"] or {}
                    rec = (view["records"]["data"] or {}).get("records", {})
                    expected = (view["records"]["data"] or {}).get("expected")
                    self._json({
                        "run_id": cfg.run_id, "ts": time.time(),
                        "queue": q,
                        "workers": {k: w.get(k) for k in
                                    ("running", "total", "ssm_online")},
                        "records": {**rec, "expected": expected},
                        "stale": {n: bool(v["error"]) for n, v in view.items()},
                        "updated_at": {n: v["updated_at"] for n, v in view.items()},
                    })
                elif route == "/api/workers":
                    self._json({"workers": (view["workers"]["data"] or {})
                                .get("instances", []),
                                "error": view["workers"]["error"]})
                elif route == "/api/keys":
                    self._json({**(view["keys"]["data"] or {"keys": []}),
                                "error": view["keys"]["error"]})
                elif route == "/api/benchmarks":
                    data = view["records"]["data"] or {}
                    from collectors import MODELS
                    self._json({"benchmarks": data.get("benchmarks", {}),
                                "models": MODELS,
                                "error": view["records"]["error"]})
                elif route == "/api/tasks":
                    bm = parse_qs(url.query).get("benchmark", [""])[0]
                    data = view["records"]["data"]
                    if data is None:
                        self._json({"error": "records not loaded yet, "
                                    "still syncing from S3"}, 503)
                    else:
                        tasks = (data.get("tasks") or {}).get(bm)
                        if tasks is None:
                            self._json({"error": f"unknown benchmark {bm!r}"}, 400)
                        else:
                            self._json({"benchmark": bm, "tasks": tasks,
                                        "error": view["records"]["error"]})
                elif route == "/api/health":
                    self._json({"ok": True})
                elif route in ("/", "/index.html", "/leaderboard"):
                    index = DIST_DIR / "index.html"
                    if index.is_file():
                        self._static(index)
                    else:
                        self._json({
                            "message": "frontend not built yet; run "
                                       "`cd app/web && npm install && npm run build`, "
                                       "or use `npm run dev` (Vite proxies /api here).",
                            "endpoints": ["/api/overview", "/api/workers",
                                          "/api/keys", "/api/benchmarks",
                                          "/api/tasks?benchmark=terminal-bench-2"],
                        })
                elif route.startswith("/assets/"):
                    self._static(DIST_DIR / route.lstrip("/"))
                elif route.startswith("/data/"):
                    self._static(DIST_DIR / route.lstrip("/"))
                else:
                    self._json({"error": "not found"}, 404)
            except BrokenPipeError:
                pass
            except Exception as exc:
                self._json({"error": str(exc)}, 500)

    return Handler


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--run-id", default="full-20260729")
    p.add_argument("--bucket", default="kiro-bench-results-178770047227")
    p.add_argument("--queue-url",
                   default="https://sqs.us-east-1.amazonaws.com/178770047227/kiro-bench-jobs")
    p.add_argument("--dlq-url",
                   default="https://sqs.us-east-1.amazonaws.com/178770047227/kiro-bench-jobs-dlq")
    p.add_argument("--tasks-file", default="scripts/full_tasks.json")
    p.add_argument("--keys-secret-id", default="kiro-bench/kiro-api-keys")
    p.add_argument("--pat-file", default="kiro-pats.txt")
    args = p.parse_args()

    cfg = Config(args)
    snapshot = Snapshot(cfg)
    print(f"loading initial trial records for run {cfg.run_id} ...", flush=True)
    snapshot.start()
    server = ThreadingHTTPServer(("127.0.0.1", cfg.port),
                                 make_handler(snapshot, cfg))
    print(f"dashboard: http://127.0.0.1:{cfg.port}  (Ctrl-C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        snapshot.stop()
        server.server_close()


if __name__ == "__main__":
    main()
