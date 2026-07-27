#!/usr/bin/env python3
"""Environment self-check: verify required CLI tools are installed.

Usage:
    python3 scripts/check_env.py

Checks that git, terraform, jq, and kiro (Kiro CLI) are on PATH, printing
each tool's version. Exits 0 if all tools are present, or 1 (with a summary
of what's missing) if any are not. Standard library only, no dependencies.
"""

import shutil
import subprocess
import sys

# Tool name -> command used to print its version.
TOOLS = {
    "git": ["git", "--version"],
    "terraform": ["terraform", "--version"],
    "jq": ["jq", "--version"],
    "kiro": ["kiro", "--version"],
}


def check_tool(name, version_cmd):
    """Return (found, version_or_error) for a single tool."""
    path = shutil.which(name)
    if path is None:
        return False, "not found on PATH"

    try:
        result = subprocess.run(
            version_cmd,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"found at {path} but failed to run: {exc}"

    if result.returncode != 0:
        stderr = result.stderr.strip() or "(no error output)"
        return False, f"found at {path} but exited with code {result.returncode}: {stderr}"

    output = (result.stdout or result.stderr).strip()
    version = output.splitlines()[0] if output else "(no version output)"
    return True, version


def main():
    missing = []

    for name, version_cmd in TOOLS.items():
        found, info = check_tool(name, version_cmd)
        if found:
            print(f"[OK]   {name}: {info}")
        else:
            print(f"[MISS] {name}: {info}")
            missing.append(name)

    if missing:
        print(
            f"\nMissing required tool(s): {', '.join(missing)}. "
            "Please install them before continuing."
        )
        return 1

    print("\nAll required tools are installed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
