#!/usr/bin/env python3
"""Send en OneSignal-påmindelse søndag aften om onsdagens tilmeldingsfrist."""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

APP_ID = "6917c2bb-a55c-4899-81c3-6664760c12ed"
APP_URL = "https://concordia35.github.io/AktiviteterV2/"
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw5kZ4Yjgge_sKnxhSjjVLkb8cI-hG0E_qcScyxP7820a7lzfCr42HhZDp3lW2kmNsy/exec"
STATE_PATH = Path(".github/state/sent_signup_deadline_reminders.json")
TIME_ZONE = ZoneInfo("Europe/Copenhagen")

MONTHS_DA = [
    "januar", "februar", "marts", "april", "maj", "juni",
    "juli", "august", "september", "oktober", "november", "december",
]


def normalize_key(value: object) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("æ", "ae")
        .replace("ø", "oe")
        .replace("å", "aa")
        .replace("–", "-")
        .replace("—", "-")
    )


def normalize_date(value: object) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if match:
        return "-".join(match.groups())

    match = re.search(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})", raw)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    return raw


def parse_date(value: object) -> date | None:
    normalized = normalize_date(value)
    try:
        return datetime.strptime(normalized, "%Y-%m-%d").date()
    except ValueError:
        return None


def rows_to_objects(value: object) -> list[dict]:
    if not isinstance(value, list) or not value:
        return []

    if all(isinstance(item, dict) for item in value):
        return [item for item in value if isinstance(item, dict)]

    if isinstance(value[0], list):
        headers = [str(header or "").strip() for header in value[0]]
        rows: list[dict] = []
        for raw_row in value[1:]:
            if not isinstance(raw_row, list):
                continue
            row = {header: raw_row[index] if index < len(raw_row) else "" for index, header in enumerate(headers)}
            rows.append(row)
        return rows

    return []


def extract_events(payload: object) -> list[dict]:
    if isinstance(payload, list):
        return rows_to_objects(payload)

    if not isinstance(payload, dict):
        return []

    aliases = {"events", "event", "aftener", "logeaftener", "arrangementer"}
    for key, value in payload.items():
        if normalize_key(key) in aliases:
            rows = rows_to_objects(value)
            if rows:
                return rows

    for key in ("data", "result", "payload"):
        nested = payload.get(key)
        rows = extract_events(nested)
        if rows:
            return rows

    return []


def first_value(row: dict, aliases: list[str]) -> object:
    normalized = {normalize_key(key): value for key, value in row.items()}
    for alias in aliases:
        value = normalized.get(normalize_key(alias))
        if value is not None and str(value).strip() != "":
            return value
    return ""


def normalize_events(payload: object) -> list[dict]:
    events: list[dict] = []
    for row in extract_events(payload):
        event_date = normalize_date(first_value(row, ["date", "dato", "eventDate", "eventdato"]))
        if not event_date:
            event_date = normalize_date(first_value(row, ["id", "eventId"]))

        parsed_date = parse_date(event_date)
        if not parsed_date:
            continue

        raw_id = first_value(row, ["id", "eventId", "event id"])
        event_id = normalize_date(raw_id) if raw_id else event_date
        title = str(first_value(row, ["title", "titel", "navn", "arrangement"]) or "Logeaften").strip()

        events.append({
            "id": event_id,
            "date": event_date,
            "title": title or "Logeaften",
        })

    return events


def fetch_payload() -> object:
    test_file = os.getenv("SIGNUP_JSON_FILE", "").strip()
    if test_file:
        return json.loads(Path(test_file).read_text(encoding="utf-8"))

    query = urlencode({"action": "list", "t": str(int(time.time() * 1000))})
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
        print(f"Kunne ikke hente tilmeldingsdata: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def load_state() -> set[str]:
    if not STATE_PATH.exists():
        return set()
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return {str(value) for value in data.get("sent_keys", []) if str(value).strip()}
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Kunne ikke læse påmindelsesstatus: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def save_state(sent_keys: set[str]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(
            {
                "sent_keys": sorted(sent_keys)[-500:],
                "updated_at": datetime.now(TIME_ZONE).isoformat(timespec="seconds"),
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )


def format_date_da(value: str) -> str:
    parsed = parse_date(value)
    if not parsed:
        return value
    return f"{parsed.day}. {MONTHS_DA[parsed.month - 1]} {parsed.year}"


def make_payload(event: dict) -> dict:
    event_date = format_date_da(event["date"])
    title = event.get("title") or "logeaften"
    body = f"Tilmeldingen til {title} onsdag den {event_date} lukker i aften kl. 24.00."
    url = f"{APP_URL}?tilmelding={quote(str(event['id']))}"

    return {
        "app_id": APP_ID,
        "target_channel": "push",
        "included_segments": ["Alle abonnenter"],
        "name": f"Tilmeldingsfrist: {title}"[:128],
        "headings": {"en": "Sidste chance for tilmelding"},
        "contents": {"en": body},
        "url": url,
    }


def send(payload: dict) -> None:
    if os.getenv("DRY_RUN") == "1":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    api_key = os.getenv("ONESIGNAL_API_KEY", "").strip()
    if not api_key:
        print("ONESIGNAL_API_KEY mangler. Påmindelsen blev ikke markeret som sendt.", file=sys.stderr)
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
                print("OneSignal returnerede et ugyldigt JSON-svar.", file=sys.stderr)
                raise SystemExit(1) from error
            if result.get("errors") or not result.get("id"):
                print("OneSignal sendte ikke påmindelsen til nogen modtagere.", file=sys.stderr)
                raise SystemExit(1)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"OneSignal-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except URLError as error:
        print(f"Netværksfejl mod OneSignal: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def forced_run() -> bool:
    return os.getenv("FORCE_RUN", "").strip().lower() in {"1", "true", "yes", "ja"}


def main() -> None:
    now = datetime.now(TIME_ZONE)
    force = forced_run()

    if not force and (now.weekday() != 6 or now.hour not in {18, 19}):
        print(f"Ingen kørsel: lokal tid er {now:%A %H:%M}. Påmindelser sendes søndag omkring kl. 18.")
        return

    target_date = now.date() + timedelta(days=3)
    if target_date.weekday() != 2:
        print(f"Ingen kørsel: tre dage fra i dag er {target_date}, som ikke er en onsdag.")
        return

    events = [event for event in normalize_events(fetch_payload()) if parse_date(event["date"]) == target_date]
    if not events:
        print(f"Ingen logeaften fundet onsdag den {target_date}. Ingen push sendt.")
        return

    sent_keys = load_state()
    pending = [event for event in events if f"{event['id']}::{now.date().isoformat()}" not in sent_keys]
    if not pending:
        print("Påmindelsen for onsdagens logeaften er allerede sendt.")
        return

    for event in pending:
        key = f"{event['id']}::{now.date().isoformat()}"
        print(f"Sender tilmeldingspåmindelse for {event['id']} – {event['title']}")
        send(make_payload(event))
        sent_keys.add(key)
        save_state(sent_keys)


if __name__ == "__main__":
    main()
