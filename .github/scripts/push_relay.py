"""All OneSignal delivery is owned by Apps Script."""
import hashlib
import json
import os
from urllib.request import Request, urlopen

PUSH_RELAY_URL = "https://script.google.com/macros/s/AKfycbw5kZ4Yjgge_sKnxhSjjVLkb8cI-hG0E_qcScyxP7820a7lzfCr42HhZDp3lW2kmNsy/exec"

def send_via_apps_script(payload):
    # Keep request IDs stable across network retries and partial deliveries.
    identity = {k:v for k,v in payload.items() if k not in ("app_id", "included_segments", "target_channel", "idempotency_key")}
    request_id = "auto:" + hashlib.sha256(json.dumps(identity, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    body = {"action":"sendAutomatedPush", "requestId":request_id, "payload":identity}
    if os.getenv("DRY_RUN") == "1":
        print(json.dumps(body, ensure_ascii=False, indent=2))
        return
    request = Request(PUSH_RELAY_URL, data=json.dumps(body, ensure_ascii=False).encode("utf-8"), method="POST", headers={"Content-Type":"text/plain; charset=utf-8"})
    try:
        with urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        raise RuntimeError("Apps Script-kvitteringen kunne ikke bekræftes; state opdateres ikke.") from error
    if not isinstance(result, dict) or result.get("ok") is not True or result.get("success") is not True:
        raise RuntimeError("Apps Script afviste beskeden: " + str(result.get("error","ukendt svar") if isinstance(result,dict) else "ugyldigt svar"))
    print("Apps Script accepterede beskeden for alle aktive versioner.")
