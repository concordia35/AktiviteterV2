#!/usr/bin/env python3
"""Send OneSignal push when new IDs are added to events.json."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import date, datetime
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

APP_ID = "6917c2bb-a55c-4899-81c3-6664760c12ed"
APP_URL = "https://concordia35.github.io/Aktiviteter/"
MONTHS_DA = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
]


def load_json_bytes(raw: bytes) -> list[dict]:
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, list):
        raise ValueError("events.json skal indeholde en liste")
    return [item for item in data if isinstance(item, dict)]


def load_current() -> list[dict]:
    with open("events.json", "rb") as handle:
        return load_json_bytes(handle.read())


def load_previous() -> list[dict] | None:
    before_sha = os.getenv("BEFORE_SHA", "").strip()
    if not before_sha or set(before_sha) == {"0"}:
        return None
    result = subprocess.run(
        ["git", "show", f"{before_sha}:events.json"],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        return None
    return load_json_bytes(result.stdout)


def parse_event_date(item: dict) -> date | None:
    try:
        return datetime.strptime(str(item.get("date", "")), "%Y-%m-%d").date()
    except ValueError:
        return None


def format_date_da(item: dict) -> str:
    parsed = parse_event_date(item)
    if not parsed:
        return ""
    return f"{parsed.day}. {MONTHS_DA[parsed.month - 1]} {parsed.year}"


def new_future_events(previous: list[dict], current: list[dict]) -> list[dict]:
    old_ids = {str(item.get("id", "")).strip() for item in previous}
    added = [item for item in current if str(item.get("id", "")).strip() not in old_ids]
    today = date.today()
    future = [item for item in added if (parse_event_date(item) or today) >= today]
    return sorted(future, key=lambda item: str(item.get("date", "9999-99-99")))


def make_payload(items: list[dict]) -> dict:
    if len(items) == 1:
        item = items[0]
        title = str(item.get("title", "Ny aktivitet")).strip()
        subtitle = str(item.get("subtitle", "")).strip()
        event_date = format_date_da(item)
        details = " – ".join(part for part in [subtitle, event_date] if part)
        body = details or "Der er lagt en ny aktivitet i appen."
        url = f"{APP_URL}?event={quote(str(item.get('id', '')).strip())}"
        heading = "Ny aktivitet i Concordia"
        name = f"Ny aktivitet: {title}"[:128]
    else:
        heading = "Nye aktiviteter i Concordia"
        body = f"Der er lagt {len(items)} nye aktiviteter i appen."
        url = APP_URL
        name = f"{len(items)} nye aktiviteter"[:128]

    return {
        "app_id": APP_ID,
        "target_channel": "push",
        "included_segments": ["Alle abonnenter"],
        "name": name,
        "headings": {"en": heading},
        "contents": {"en": body},
        "url": url,
    }


def send(payload: dict) -> None:
    api_key = os.getenv("ONESIGNAL_API_KEY", "").strip()
    if not api_key:
        print("ONESIGNAL_API_KEY mangler. Push blev sprunget over.")
        return

    if os.getenv("DRY_RUN") == "1":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    request = Request(
        "https://api.onesignal.com/notifications",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Key {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )

    try:
        with urlopen(request, timeout=30) as response:
            response_body = response.read().decode("utf-8")
            print(f"OneSignal svarede {response.status}: {response_body}")
            try:
                result = json.loads(response_body)
            except json.JSONDecodeError as error:
                print("OneSignal returnerede et ugyldigt JSON-svar.", file=sys.stderr)
                raise SystemExit(1) from error
            if result.get("errors") or not result.get("id"):
                print("OneSignal accepterede ikke beskeden til nogen modtagere.", file=sys.stderr)
                raise SystemExit(1)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"OneSignal-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except URLError as error:
        print(f"Netværksfejl mod OneSignal: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def main() -> None:
    previous = load_previous()
    if previous is None:
        print("Ingen tidligere events.json kunne læses. Push blev sprunget over for at undgå masseudsendelse.")
        return

    current = load_current()
    added = new_future_events(previous, current)
    if not added:
        print("Ingen nye kommende aktiviteter. Ingen push sendt.")
        return

    print("Nye aktiviteter:", ", ".join(str(item.get("id", "")) for item in added))
    send(make_payload(added))


if __name__ == "__main__":
    main()
