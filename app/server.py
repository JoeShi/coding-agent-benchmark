#!/usr/bin/env python3
"""JSON API for the kiro-cli benchmark Task Monitor.

Data comes from app/collectors.py. The UI is the Next.js site in app/site,
which proxies /api/* here (see app/site/next.config.ts), so this process
serves no HTML or assets of its own.

    python3 app/server.py [--port 8081] [--run-id full-20260729]

Stdlib only; AWS access via the aws CLI (default profile).
"""

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from collectors import Snapshot


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
                elif route == "/":
                    self._json({
                        "message": "API only; the UI lives in app/site "
                                   "(cd app/site && npm run dev, then open "
                                   "http://localhost:3000/monitor).",
                        "endpoints": ["/api/overview", "/api/workers",
                                      "/api/keys", "/api/benchmarks",
                                      "/api/tasks?benchmark=terminal-bench-2"],
                    })
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
    # 8081 is what app/site/next.config.ts proxies to by default.
    p.add_argument("--port", type=int, default=8081)
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
    print(f"monitor API: http://127.0.0.1:{cfg.port}/api  (Ctrl-C to stop)",
          flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        snapshot.stop()
        server.server_close()


if __name__ == "__main__":
    main()
