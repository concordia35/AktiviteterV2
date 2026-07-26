#!/usr/bin/env python3
"""Send OneSignal-push, når godkendte billeder bliver synlige i galleriet."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

APP_ID = "6917c2bb-a55c-4899-81c3-6664760c12ed"
APP_URL = "https://concordia35.github.io/AktiviteterV2/"
APPS_SCRIPT_URL = (
    "https://script.google.com/macros/s/"
    "AKfycby1ff1Xe_HeCUa1174Par5LamuqPn1s4As5nXCfg08QRyeGuyfXiWdkQ__3fqKLUDe6/exec"
)
STATE_PATH = Path(os.getenv("GALLERY_STATE_FILE", ".github/state/seen_gallery_images.json"))


def text_value(row: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def extract_images(payload: object) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    if payload.get("ok") is False:
        raise ValueError(str(payload.get("error") or "Galleri-endpointet returnerede en fejl"))
    for key in ("images", "billeder", "gallery", "items", "data", "rows"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = extract_images(value)
            if nested:
                return nested
    return []


def drive_id_from_url(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    for pattern in (
        r"/d/([A-Za-z0-9_-]{10,})",
        r"/file/d/([A-Za-z0-9_-]{10,})",
        r"/thumbnail\?id=([A-Za-z0-9_-]{10,})",
    ):
        match = re.search(pattern, raw)
        if match:
            return match.group(1)
    try:
        parsed = urlparse(raw)
        query = parse_qs(parsed.query)
        for key in ("id", "fileId", "file_id"):
            if query.get(key):
                return str(query[key][0])
    except ValueError:
        pass
    return ""


def stable_image_id(row: dict) -> str:
    existing = text_value(row, ("id", "ID", "fileId", "file_id", "driveId", "imageId"))
    if existing:
        return existing

    url = text_value(row, ("url", "imageUrl", "image_url", "downloadUrl", "fullUrl"))
    thumb = text_value(row, ("thumbnailUrl", "thumbnail", "thumbUrl", "thumb"))
    drive_id = drive_id_from_url(url) or drive_id_from_url(thumb)
    if drive_id:
        return drive_id

    fingerprint = "|".join(
        [
            url,
            thumb,
            text_value(row, ("event", "album", "folder", "activity", "aktivitet")),
            text_value(row, ("date", "createdAt", "created_at", "timestamp")),
            text_value(row, ("uploader", "name", "uploadedBy")),
            text_value(row, ("caption", "title", "filename", "name")),
        ]
    )
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:32]


def normalize_images(payload: object) -> list[dict]:
    normalized: list[dict] = []
    seen: set[str] = set()
    for row in extract_images(payload):
        image_id = stable_image_id(row)
        album = text_value(row, ("event", "album", "folder", "activity", "aktivitet")) or "Andet"
        if not image_id or image_id in seen:
            continue
        seen.add(image_id)
        normalized.append(
            {
                "id": image_id,
                "album": album,
                "date": text_value(row, ("date", "createdAt", "created_at", "timestamp")),
            }
        )
    return normalized


def fetch_payload() -> object:
    test_file = os.getenv("GALLERY_JSON_FILE", "").strip()
    if test_file:
        return json.loads(Path(test_file).read_text(encoding="utf-8"))

    query = urlencode({"action": "listGallery", "_": str(int(time.time() * 1000))})
    request = Request(
        f"{APPS_SCRIPT_URL}?{query}",
        headers={"User-Agent": "Concordia-GitHub-Action/1.0", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"Apps Script-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except (URLError, json.JSONDecodeError) as error:
        print(f"Kunne ikke hente galleriet: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"initialized": False, "seen_image_ids": [], "albums": {}}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("state er ikke et objekt")
        albums_raw = data.get("albums", {})
        albums: dict[str, list[str]] = {}
        if isinstance(albums_raw, dict):
            for name, ids in albums_raw.items():
                if isinstance(ids, list):
                    albums[str(name)] = [str(value) for value in ids if str(value).strip()]
        return {
            "initialized": bool(data.get("initialized")),
            "seen_image_ids": [str(value) for value in data.get("seen_image_ids", []) if str(value).strip()],
            "albums": albums,
        }
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Kunne ikke læse galleri-state: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def save_state(seen_ids: set[str], albums: dict[str, set[str]]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps(
            {
                "initialized": True,
                "seen_image_ids": sorted(seen_ids),
                "albums": {name: sorted(ids) for name, ids in sorted(albums.items())},
                "updated_at": datetime.now(ZoneInfo("Europe/Copenhagen")).isoformat(timespec="seconds"),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def album_changes(images: list[dict], state: dict) -> list[dict]:
    seen_ids = set(state["seen_image_ids"])
    known_albums = set(state["albums"])
    grouped: dict[str, list[dict]] = {}
    for image in images:
        if image["id"] in seen_ids:
            continue
        grouped.setdefault(image["album"], []).append(image)

    return [
        {
            "album": album,
            "images": items,
            "is_new_album": album not in known_albums,
        }
        for album, items in sorted(grouped.items(), key=lambda item: item[0].casefold())
    ]


def make_payload(change: dict) -> dict:
    album = change["album"]
    count = len(change["images"])
    encoded_album = quote(album, safe="")
    if change["is_new_album"]:
        heading = "Nyt fotoalbum i Concordia"
        body = f'“{album}” er nu klar med {count} {"billede" if count == 1 else "billeder"}.'
        name = f"Nyt fotoalbum: {album}"[:128]
    else:
        heading = "Nye billeder i Concordia"
        body = f'Der er kommet {count} {"nyt billede" if count == 1 else "nye billeder"} i “{album}”.'
        name = f"Nye billeder: {album}"[:128]

    return {
        "app_id": APP_ID,
        "target_channel": "push",
        "included_segments": ["Alle abonnenter"],
        "name": name,
        "headings": {"en": heading},
        "contents": {"en": body},
        "url": f"{APP_URL}?gallery={encoded_album}",
    }


def send(payload: dict) -> None:
    if os.getenv("DRY_RUN") == "1":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    api_key = os.getenv("ONESIGNAL_API_KEY", "").strip()
    if not api_key:
        print("ONESIGNAL_API_KEY mangler. Galleri-state opdateres ikke.", file=sys.stderr)
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
            result = json.loads(body)
            if result.get("errors") or not result.get("id"):
                print("OneSignal accepterede ikke galleri-beskeden.", file=sys.stderr)
                raise SystemExit(1)
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"OneSignal-fejl {error.code}: {body}", file=sys.stderr)
        raise SystemExit(1) from error
    except (URLError, json.JSONDecodeError) as error:
        print(f"Fejl ved afsendelse af galleri-besked: {error}", file=sys.stderr)
        raise SystemExit(1) from error


def state_sets(state: dict) -> tuple[set[str], dict[str, set[str]]]:
    seen_ids = set(state["seen_image_ids"])
    albums = {name: set(ids) for name, ids in state["albums"].items()}
    return seen_ids, albums


def add_images_to_state(images: list[dict], seen_ids: set[str], albums: dict[str, set[str]]) -> None:
    for image in images:
        seen_ids.add(image["id"])
        albums.setdefault(image["album"], set()).add(image["id"])


def main() -> None:
    try:
        images = normalize_images(fetch_payload())
    except ValueError as error:
        print(f"Ugyldigt svar fra galleriet: {error}", file=sys.stderr)
        raise SystemExit(1) from error

    state = load_state()
    seen_ids, albums = state_sets(state)

    if not state["initialized"]:
        add_images_to_state(images, seen_ids, albums)
        save_state(seen_ids, albums)
        print(f"Første kørsel: gemte {len(images)} eksisterende godkendte billeder uden push.")
        return

    changes = album_changes(images, state)
    if not changes:
        print("Ingen nye godkendte billeder. Ingen push sendt.")
        return

    for change in changes:
        album = change["album"]
        count = len(change["images"])
        change_type = "nyt album" if change["is_new_album"] else "tilføjelse"
        print(f"Sender push for {change_type}: {album} ({count} billeder)")
        send(make_payload(change))
        add_images_to_state(change["images"], seen_ids, albums)
        # Gem efter hver succesfuld besked. Workflowet committer også delvis state,
        # hvis en senere OneSignal-afsendelse skulle fejle.
        save_state(seen_ids, albums)


if __name__ == "__main__":
    main()
