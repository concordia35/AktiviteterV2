Det sker i Concordia
Version 1.4.4

Indhold
- Aktiviteter fra events.json
- Tilmelding via Google Apps Script
- Broderinitiativer via Google Apps Script
- Galleri og privat billedupload via gallery-config.js
- OneSignal-notifikationer og automatiske GitHub Actions
- Installerbar PWA med automatisk versionsopdatering

Vigtige filer
- events.json: aktiviteter og plakater
- app.js: appens funktioner
- style.css: design
- gallery-config.js: URL og indstillinger til galleri
- manifest.webmanifest og sw.js: installation, cache og opdatering
- .github/workflows: automatiske notifikationer

Oprydning i version 1.4.4
- Fjernet dobbelt og overskrevet JavaScript til initiativer.
- Fjernet gammel logeaften-visning, som var erstattet af Tilmelding.
- Fjernet skjult gammel initiativformular og ubrugt Google Forms-kode.
- Fjernet ubrugte fallback-filer, ikoner og tomme placeholder-filer.
- Ensrettet versionsnumre i HTML, manifest, JavaScript og service worker.

Ved næste ændring
Hæv APP_VERSION i app.js og CACHE_VERSION i sw.js til samme nummer. Opdater også versionsparameteren i index.html og manifest.webmanifest.
