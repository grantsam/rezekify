"""Rezekify Load Test & Resource Constraint Benchmark Runner.

Benchmarks Rezekify across 3 simulated VPS profiles (1GB, 2GB, 4GB RAM)
using `docker update` resource constraints and grafana/k6.
"""

from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Dict


PROFILES = [
    {
        "id": "1gb",
        "name": "Profile 1 (1GB VPS Equivalent)",
        "cost_est": "~$4 - $6 / mo (e.g. Hetzner CX22, DO 1GB)",
        "specs": {
            "backend": {"cpus": 0.5, "memory": "400m"},
            "db": {"cpus": 0.4, "memory": "384m"},
            "frontend": {"cpus": 0.1, "memory": "100m"},
        },
    },
    {
        "id": "2gb",
        "name": "Profile 2 (2GB VPS Equivalent)",
        "cost_est": "~$10 - $12 / mo (e.g. Hetzner CPX21, DO 2GB)",
        "specs": {
            "backend": {"cpus": 1.0, "memory": "900m"},
            "db": {"cpus": 0.8, "memory": "768m"},
            "frontend": {"cpus": 0.2, "memory": "150m"},
        },
    },
    {
        "id": "4gb",
        "name": "Profile 3 (4GB VPS Equivalent)",
        "cost_est": "~$20 - $24 / mo (e.g. Hetzner CPX31, DO 4GB)",
        "specs": {
            "backend": {"cpus": 2.0, "memory": "1800m"},
            "db": {"cpus": 1.5, "memory": "1536m"},
            "frontend": {"cpus": 0.5, "memory": "256m"},
        },
    },
]

CONTAINER_NAMES = {
    "backend": "rezekify_backend",
    "db": "rezekify_db",
    "frontend": "rezekify_frontend",
}


def apply_resource_constraints(specs: Dict[str, Dict[str, Any]]) -> None:
    """Applies CPU and memory limits to running Docker containers."""
    for service, limits in specs.items():
        container = CONTAINER_NAMES[service]
        cpus = limits["cpus"]
        memory = limits["memory"]
        cmd = [
            "docker",
            "update",
            f"--cpus={cpus}",
            f"--memory={memory}",
            f"--memory-swap={memory}",
            container,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            # Fallback if memory-swap is rejected
            cmd_alt = [
                "docker",
                "update",
                f"--cpus={cpus}",
                f"--memory={memory}",
                container,
            ]
            subprocess.run(cmd_alt, check=True)


def restore_unconstrained() -> None:
    """Restores all containers to default unconstrained resources."""
    print("\n[Teardown] Restoring containers to unconstrained resource limits...")
    cmd = [
        "docker",
        "update",
        "--cpus",
        "0",
        "--memory",
        "0",
        CONTAINER_NAMES["backend"],
        CONTAINER_NAMES["db"],
        CONTAINER_NAMES["frontend"],
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print("[Teardown] Containers successfully restored to unconstrained limits.")
    else:
        print(f"[Teardown Warning] Reset command returned {res.returncode}: {res.stderr.strip()}")


def run_k6_benchmark(profile_id: str, script_dir: Path) -> Path:
    """Runs k6 inside Docker and exports summary JSON."""
    summary_filename = f"summary_{profile_id}.json"
    summary_path = script_dir / summary_filename
    if summary_path.exists():
        summary_path.unlink()

    # Mount script_dir into /scripts inside the k6 container
    cmd = [
        "docker",
        "run",
        "--rm",
        "-v",
        f"{script_dir}:/scripts",
        "--network",
        "rezekify_net",
        "grafana/k6",
        "run",
        "--summary-export",
        f"/scripts/{summary_filename}",
        "/scripts/k6_benchmark_suite.js",
    ]

    print(f"\n[k6 Execution] Running load test for profile '{profile_id}'...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[k6 Warning] k6 exited with code {res.returncode}")
        print(f"[k6 Output Snippet]\n{res.stdout[-600:]}")
    else:
        print(f"[k6 Complete] Benchmark completed for '{profile_id}'.")

    return summary_path


def parse_summary(summary_path: Path) -> Dict[str, Any]:
    """Parses exported k6 JSON summary report."""
    with open(summary_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    metrics = data.get("metrics", {})

    # Extract http_reqs
    reqs_data = metrics.get("http_reqs", {})
    req_vals = reqs_data.get("values", reqs_data)
    total_reqs = int(req_vals.get("count", 0))
    rps = float(req_vals.get("rate", 0.0))

    # Extract http_req_duration
    dur_data = metrics.get("http_req_duration", {})
    dur_vals = dur_data.get("values", dur_data)
    dur_avg = float(dur_vals.get("avg", 0.0))
    dur_min = float(dur_vals.get("min", 0.0))
    dur_med = float(dur_vals.get("med", 0.0))
    dur_p90 = float(dur_vals.get("p(90)", 0.0))
    dur_p95 = float(dur_vals.get("p(95)", 0.0))
    dur_max = float(dur_vals.get("max", 0.0))

    # Extract http_req_failed
    fail_data = metrics.get("http_req_failed", {})
    fail_vals = fail_data.get("values", fail_data)
    fail_rate_raw = float(fail_vals.get("value", fail_vals.get("rate", 0.0)))
    fail_pct = fail_rate_raw * 100.0 if fail_rate_raw <= 1.0 else fail_rate_raw

    # Extract checks
    checks_data = metrics.get("checks", {})
    checks_vals = checks_data.get("values", checks_data)
    checks_pass = int(checks_vals.get("passes", 0))
    checks_fail = int(checks_vals.get("fails", 0))

    return {
        "total_reqs": total_reqs,
        "rps": rps,
        "dur_avg": dur_avg,
        "dur_min": dur_min,
        "dur_med": dur_med,
        "dur_p90": dur_p90,
        "dur_p95": dur_p95,
        "dur_max": dur_max,
        "fail_pct": fail_pct,
        "checks_pass": checks_pass,
        "checks_fail": checks_fail,
    }


def main() -> None:
    script_dir = Path(__file__).parent.resolve()
    results = []

    print("================================================================================")
    print(" Rezekify VPS Hardware Profile Benchmark Suite")
    print(f" Target Directory: {script_dir}")
    print("================================================================================")

    try:
        for profile in PROFILES:
            p_id = profile["id"]
            p_name = profile["name"]
            print(f"\n>>> Applying Resource Constraints for {p_name}...")
            apply_resource_constraints(profile["specs"])
            # Brief cooldown to allow OS/Docker cgroups to stabilize
            time.sleep(2)

            summary_file = run_k6_benchmark(p_id, script_dir)
            if not summary_file.exists():
                print(f"[Error] Summary file {summary_file} not found!")
                continue

            parsed = parse_summary(summary_file)
            results.append({"profile": profile, "metrics": parsed})

    finally:
        restore_unconstrained()

    # Format Markdown Table Output
    print("\n" + "=" * 80)
    print(" BENCHMARK RESULTS SUMMARY")
    print("=" * 80 + "\n")

    table_lines = [
        "| Profile | Specs (Backend / DB / Frontend) | Reqs | RPS | Avg (ms) | Med (ms) | p90 (ms) | p95 (ms) | Max (ms) | Fail Rate |",
        "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for r in results:
        p = r["profile"]
        m = r["metrics"]
        s = p["specs"]
        spec_str = f"{s['backend']['cpus']}c/{s['backend']['memory']} | {s['db']['cpus']}c/{s['db']['memory']} | {s['frontend']['cpus']}c/{s['frontend']['memory']}"
        table_lines.append(
            f"| **{p['name']}** | {spec_str} | {m['total_reqs']:,} | {m['rps']:.1f} | "
            f"{m['dur_avg']:.1f} | {m['dur_med']:.1f} | {m['dur_p90']:.1f} | {m['dur_p95']:.1f} | "
            f"{m['dur_max']:.1f} | {m['fail_pct']:.2f}% |"
        )

    markdown_table = "\n".join(table_lines)
    print(markdown_table)

    # Budget Recommendation Engine
    print("\n### Hardware Sizing & Budget Recommendation")
    if results:
        p1 = results[0]["metrics"] if len(results) > 0 else None
        p2 = results[1]["metrics"] if len(results) > 1 else None
        p3 = results[2]["metrics"] if len(results) > 2 else None

        print("\n**Key Observations:**")
        for r in results:
            p = r["profile"]
            m = r["metrics"]
            status = "HEALTHY (0% error)" if m["fail_pct"] == 0 else f"DEGRADED ({m['fail_pct']:.2f}% error)"
            print(f"- **{p['name']}**: {m['rps']:.1f} req/s, median {m['dur_med']:.1f}ms, p95 {m['dur_p95']:.1f}ms. Status: {status}.")

        print("\n**Recommendation:**")
        if p1 and p1["fail_pct"] == 0 and p1["dur_p95"] < 100:
            print("- **Best Budget Option:** **Profile 1 (1GB VPS Equivalent ~ $4-6/mo)**.")
            print("  Rezekify's deterministic engine and lightweight PostgreSQL schema comfortably support 40 concurrent VUs with sub-100ms p95 latency on a 1GB host.")
            print("- **Recommended Production Sizing:** **Profile 2 (2GB VPS Equivalent ~ $10-12/mo)**.")
            print("  Provides 2x CPU and memory headroom to handle background LLM/Gemini calls, receipt vision OCR processing, and unexpected traffic spikes without memory pressure or OOM risk.")
        elif p2 and p2["fail_pct"] == 0:
            print("- **Minimum Viable Host:** **Profile 2 (2GB VPS Equivalent ~ $10-12/mo)**.")
            print("  Ensures zero dropped requests and stable sub-second p95 latencies under concurrent ACID transactions.")
        else:
            print("- **Recommended Host:** **Profile 3 (4GB VPS Equivalent ~ $20-24/mo)** for production workloads.")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
