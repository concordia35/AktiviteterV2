Concordia samlet app
Version 1.3.0

Nyt i version 1.3.0:
- Ny Galleri-fane i bundmenuen.
- Godkendte billeder hentes fra Google Drive via et separat Apps Script.
- Upload-knap direkte i Galleri-fanen.
- Brugerne kan kun vælge eksisterende billedfiler; appen aktiverer ikke kameraet.
- Billeder komprimeres på enheden før upload.
- Uploads gemmes privat i mappen "Concordia billeder/Indbakke".
- Billeder vises først i appen, når Status i Google Sheet ændres til "Galleri".

Opsætning:
Se GALLERI-OPSÆTNING.txt og mappen google-apps-script-gallery.

Eksisterende funktioner er bevaret:
- Aktiviteter
- Tilmelding
- Broderinitiativer
- Om-side med QR-kode

Concordia samlet app
Version 1.1.3

Indhold:
- Aktiviteter
- Tilmelding direkte integreret i appens design
- Broderinitiativer
- Om-side med QR-kode

Bemærk:
- Den gamle iframe/undermappe til TilmeldingV3 er fjernet.
- Køkkenoverblik er ikke inkluderet.
- Data til tilmelding hentes fortsat fra Google Sheet via Apps Script.


Version 1.1.3: Rettet initiativ-klik og Jeg deltager-dialog, så tilmelding åbner stabilt i PWA/mobilbrowser.


VERSION 1.3.0
=============
- Ingen kunstig grænse på antal billeder pr. upload.
- Separat gallerimappe for hver aktivitet i appen og Google Drive.
- Automatisk status-dropdown i Google Sheet.
- Aktivitet vælges fra appens arrangementsoversigt ved upload.
