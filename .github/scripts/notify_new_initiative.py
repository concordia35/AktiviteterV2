#!/usr/bin/env python3
"""Poll approved initiatives and send a OneSignal push for newly approved IDs."""

from __future__ import annotations

import json
import os
import re
import sys
import time
import unicodedata
from datetime import date, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

APP_ID = "6917c2bb-a55c-4899-81c3-6664760c12ed"
APP_URL = "https://concordia35.github.io/AktiviteterV2/"
APPS_SCRIPT_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbzivUCgohSlZRNIFGGsa9goS12lTksr7DMmShgC_bAlJODfmOlogCjj2X6eSeBsP8lY/exec"
)
STATE_PATH = Path(".github/state/seen_initiatives.json")
MONTHS_DA = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
]


def first_value(row: dict, keys: list[str]) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def rows_to_objects(value: object) -> list[dict]:
    if not isinstance(value, list):
        return []
    if not value:
        return []
    if all(isinstance(item, dict) for item in value):
        return [item for item in value if isinstance(item, dict)]
    if all(isinstance(item, list) for item in value):
        headers = [str(item).strip() for item in value[0]]
        result: list[dict] = []
        for row in value[1:]:
            result.append({headers[index]: cell for index, cell in enumerate(row) if index < len(headers)})
        return result
    return []


def extract_rows(payload: object) -> list[dict]:
    direct = rows_to_objects(payload)
    if direct:
        return direct
    if not isinstance(payload, dict):
        return []

    for key in ("initiatives", "initiativer", "Initiativer", "items", "data", "rows"):
        if key not in payload:
            continue
        rows = rows_to_objects(payload[key])
        if rows:
            return rows
        nested = extract_rows(payload[key])
        if nested:
            return nested
    return []


def normalize_date(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    match = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$", raw)
    if match:
        year, month, day = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    match = re.match(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+.*)?$", raw)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    return ""


def normalize_time(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    match = re.search(r"(?:^|\s)(\d{1,2})[.:](\d{1,2})(?:[.:]\d{1,2})?(?:\s|$)", raw)
    if not match:
        match = re.search(r"T(\d{1,2}):(\d{1,2})", raw)
    if match:
        return f"{int(match.group(1)):02d}:{int(match.group(2)):02d}"
    return raw


def is_approved(value: str) -> bool:
    return str(value or "").strip().lower() in {"godkendt", "ja", "approved", "true", "1", "ok"}


def make_id(row: dict, index: int) -> str:
    existing = first_value(row, ["id", "ID", "Initiativ ID", "Aktivitet ID", "activityId"])
    if existing:
        return existing

    title = first_value(row, ["title", "Titel", "Titel på aktiviteten", "Initiativ", "Aktivitet"])
    event_date = normalize_date(first_value(row, ["date", "Dato", "Dato for aktiviteten", "Hvornår?", "Dato/tid"]))
    event_time = normalize_time(first_value(row, ["time", "Tid", "Tidspunkt", "Tidspunkt for aktivitet", "Klokkeslæt"]))
    base = f"{title}-{event_date}-{event_time}".strip().lower().replace("–", "-").replace("—", "-")
    base = re.sub(r"\s+", " ", base)
    base = "".join(character for character in base if character.isalnum() or character in "æøå -")
    base = re.sub(r"\s+", "-", base)
    return base or f"sheet-{index}"


def normalize_initiatives(payload: object) -> list[dict]:
    normalized: list[dict] = []
    for index, row in enumerate(extract_rows(payload)):
        status = first_value(row, ["status", "Status", "Godkendt", "godkendt", "Approved"])
        event_date = normalize_date(first_value(row, ["date", "Dato", "Dato for aktiviteten", "Hvornår?", "Dato/tid"]))
        title = first_value(row, ["title", "Titel", "Titel på aktiviteten", "Initiativ", "Aktivitet"])
        if not is_approved(status) or not title or not event_date:
            continue
        normalized.append({
            "id": make_id(row, index),
            "title": title,
            "date": event_date,
            "time": normalize_time(first_value(row, ["time", "Tid", "Tidspunkt", "Tidspunkt for aktivitet", "Klokkeslæt"])),
            "place": first_value(row, ["place", "Sted", "Lokation"]),
            "host": first_value(row, ["host", "Kontaktperson", "Navn på kontaktperson", "Navn", "Oprettet af"]),
        })
    return normalized


def fetch_payload() -> object:
    test_file = os.getenv("INITIATIVES_JSON_FILE", "").strip()
    if test_file:
        return json.loads(Path(test_file).read_text(encoding="utf-8"))

    query = urlencode({"action": "getInitiatives", "_": str(int(time.time() * 1000))})
    request = Request(
        f"{APPS_SCRIPT_URL}?{query}",
        headers={"User-Agent": "Concordia-GitHub-Action/1.0", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"Apps Script-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except (URLError, json.JSONDecodeError) as error:
        print(f"Kunne ikke hente initiativer: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"initialized": False, "seen_ids": []}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("state er ikke et objekt")
        return {
            "initialized": bool(data.get("initialized")),
            "seen_ids": [str(value) for value in data.get("seen_ids", []) if str(value).strip()],
        }
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Kunne ikke læse state: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def save_state(seen_ids: set[str]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(
            {
                "initialized": True,
                "seen_ids": sorted(seen_ids),
                "updated_at": datetime.now(ZoneInfo("Europe/Copenhagen")).isoformat(timespec="seconds"),
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def parse_date(value: str) -> date | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def future_initiatives(items: list[dict]) -> list[dict]:
    today = datetime.now(ZoneInfo("Europe/Copenhagen")).date()
    return sorted(
        [item for item in items if (parse_date(item["date"]) or today) >= today],
        key=lambda item: (item.get("date", "9999-99-99"), item.get("time", ""), item.get("title", "")),
    )


def format_date_da(value: str) -> str:
    parsed = parse_date(value)
    if not parsed:
        return ""
    return f"{parsed.day}. {MONTHS_DA[parsed.month - 1]} {parsed.year}"


def make_payload(items: list[dict]) -> dict:
    if len(items) == 1:
        item = items[0]
        details = [format_date_da(item.get("date", ""))]
        if item.get("time"):
            details.append(f"kl. {item['time']}")
        if item.get("place"):
            details.append(item["place"])
        body = " · ".join(part for part in details if part) or "Et nyt initiativ er blevet godkendt."
        heading = f"Nyt initiativ: {item['title']}"
        url = f"{APP_URL}?initiative={quote(item['id'])}"
        name = f"Nyt initiativ: {item['title']}"[:128]
    else:
        heading = "Nye initiativer i Concordia"
        body = f"{len(items)} nye initiativer er godkendt og klar i appen."
        url = f"{APP_URL}?initiative={quote(items[0]['id'])}"
        name = f"{len(items)} nye broderinitiativer"[:128]

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
    if os.getenv("DRY_RUN") == "1":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    api_key = os.getenv("ONESIGNAL_API_KEY", "").strip()
    if not api_key:
        print("ONESIGNAL_API_KEY mangler. State opdateres ikke, så beskeden kan prøves igen.", file=sys.stderr)
        raise SystemExit(1)

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
            body = response.read().decode("utf-8")
            print(f"OneSignal svarede {response.status}: {body}")
            try:
                result = json.loads(body)
            except json.JSONDecodeError as error:
                print("OneSignal returnerede et ugyldigt JSON-svar. State opdateres ikke.", file=sys.stderr)
                raise SystemExit(1) from error
            if result.get("errors") or not result.get("id"):
                print("OneSignal accepterede ikke beskeden til nogen modtagere. State opdateres ikke.", file=sys.stderr)
                raise SystemExit(1)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"OneSignal-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except URLError as error:
        print(f"Netværksfejl mod OneSignal: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def main() -> None:
    initiatives = future_initiatives(normalize_initiatives(fetch_payload()))
    state = load_state()
    seen_ids = set(state["seen_ids"])
    current_ids = {item["id"] for item in initiatives}

    if not state["initialized"]:
        save_state(seen_ids | current_ids)
        print(f"Første kørsel: gemte {len(current_ids)} eksisterende initiativer uden at sende push.")
        return

    new_items = [item for item in initiatives if item["id"] not in seen_ids]
    if not new_items:
        print("Ingen nye godkendte kommende initiativer. Ingen push sendt.")
        return

    print("Nye initiativer:", ", ".join(item["id"] for item in new_items))
    send(make_payload(new_items))
    save_state(seen_ids | {item["id"] for item in new_items})


if __name__ == "__main__":
    main()
