#!/usr/bin/env python3
"""Static production checks for The Prayer Project chapter portal."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
WARNINGS: list[str] = []


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []
        self.ids: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(str(values["id"]))
        if tag == "script" and values.get("src"):
            self.assets.append(str(values["src"]))
        if tag == "link" and values.get("href"):
            rel = str(values.get("rel") or "")
            if any(token in rel for token in ("stylesheet", "icon", "manifest")):
                self.assets.append(str(values["href"]))


def fail(message: str) -> None:
    ERRORS.append(message)


def warn(message: str) -> None:
    WARNINGS.append(message)


def check_required_files() -> None:
    required = [
        "index.html",
        "CNAME",
        ".firebaserc",
        "firebase.json",
        "firestore.rules",
        "firestore.indexes.json",
        "site.webmanifest",
        "assets/js/firebase.js",
        "assets/js/phase8.js",
        "assets/phase8.css",
        "SECURITY.md",
        "docs/PHASE-8-PRODUCTION-CHECKLIST.md",
    ]
    for relative in required:
        if not (ROOT / relative).is_file():
            fail(f"Required production file is missing: {relative}")


def check_index_assets() -> None:
    index = ROOT / "index.html"
    if not index.is_file():
        return
    parser = AssetParser()
    parser.feed(index.read_text(encoding="utf-8"))
    duplicate_ids = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
    if duplicate_ids:
        fail(f"Duplicate static HTML id values: {', '.join(duplicate_ids)}")
    for asset in parser.assets:
        if asset.startswith(("http://", "https://", "//", "data:")):
            continue
        clean = asset.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        if clean and not (ROOT / clean).is_file():
            fail(f"index.html references a missing asset: {asset}")


def check_json() -> None:
    for path in sorted(ROOT.rglob("*.json")):
        if ".git" in path.parts:
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(f"Invalid JSON in {path.relative_to(ROOT)}: {exc}")


def check_rules_balance() -> None:
    for relative in ("firestore.rules",):
        path = ROOT / relative
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if text.count("{") != text.count("}"):
            fail(f"Unbalanced braces in {relative}")
        if "match /{document=**}" not in text and relative == "firestore.rules":
            warn("Firestore Rules do not contain an explicit final deny-all match.")


def check_firebase_configuration() -> None:
    firebase_js = ROOT / "assets/js/firebase.js"
    if not firebase_js.is_file():
        return
    text = firebase_js.read_text(encoding="utf-8")
    expected = [
        'projectId: "tpp-chapters"',
        'authDomain: "tpp-chapters.firebaseapp.com"',
    ]
    for marker in expected:
        if marker not in text:
            fail(f"Firebase client configuration is missing expected marker: {marker}")


def check_secret_patterns() -> None:
    patterns = {
        "private key block": re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----"),
        "Google service-account private key": re.compile(r'"private_key"\s*:'),
        "Google service-account client email": re.compile(r'"client_email"\s*:\s*"[^\"]+\.gserviceaccount\.com"'),
        "GitHub personal access token": re.compile(r"gh[pousr]_[A-Za-z0-9_]{30,}"),
    }
    allowed_suffixes = {".js", ".json", ".md", ".html", ".css", ".rules", ".yml", ".yaml", ".txt"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts or path.suffix.lower() not in allowed_suffixes:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for label, pattern in patterns.items():
            if pattern.search(text):
                fail(f"Possible {label} found in {path.relative_to(ROOT)}")


def check_phase_loading() -> None:
    index = ROOT / "index.html"
    if not index.is_file():
        return
    text = index.read_text(encoding="utf-8")
    for phase in range(2, 9):
        if phase == 2:
            marker = "assets/phase2.css"
        elif phase == 7:
            marker = "assets/js/phase7.js"
        else:
            marker = f"phase{phase}"
        if marker not in text:
            fail(f"index.html does not appear to load Phase {phase} assets.")
    if "assets/js/phase8.js" not in text or "assets/phase8.css" not in text:
        fail("Phase 8 runtime is not loaded by index.html.")


def check_domain() -> None:
    cname = ROOT / "CNAME"
    if cname.is_file() and cname.read_text(encoding="utf-8").strip() != "chapter.ask4prayers.com":
        fail("CNAME must contain chapter.ask4prayers.com")


def main() -> int:
    check_required_files()
    check_index_assets()
    check_json()
    check_rules_balance()
    check_firebase_configuration()
    check_secret_patterns()
    check_phase_loading()
    check_domain()

    for message in WARNINGS:
        print(f"WARNING: {message}")
    for message in ERRORS:
        print(f"ERROR: {message}")

    if ERRORS:
        print(f"Validation failed with {len(ERRORS)} error(s) and {len(WARNINGS)} warning(s).")
        return 1
    print(f"Validation passed with {len(WARNINGS)} warning(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
