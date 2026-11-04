# Fælles beskedafsendelse via Apps Script

## Aktivering
1. Åbn det eksisterende Apps Script til tilmeldinger/køkkenet (Sheet-ID starter med 1gO9jUqy).
2. Erstat indholdet af den nuværende kodefil med hele Concordia_AppsScript.js. Opret ikke en ekstra kopi med dublerede funktioner.
3. Behold Script Property ONESIGNAL_API_KEY. Tilføj ONESIGNAL_CLOUDFLARE_API_KEY med nøglen fra den nye OneSignal-app.
4. PUSH_TARGET_MODE kan udelades (begge versioner), eller sættes til both.
5. Gem. Vælg Implementer → Administrer implementeringer → blyanten ved den eksisterende webapp → Ny version → Implementer.
6. Behold samme /exec-adresse, udførelsesidentitet og adgangsindstillinger. Godkend eventuelle nødvendige UrlFetch-tilladelser.
7. Fortæl mig, at det er udgivet. Jeg kontrollerer pushStatus og aktiverer de forberedte GitHub- og Monitor-ændringer.

Der er ikke sendt testbeskeder til brødrene. Kontrolkaldet action=pushStatus sender ingen besked og viser ingen nøgler.

## Efter overgangen
Sæt PUSH_TARGET_MODE til cloudflare i Script Properties. Indstillingen virker uden at udgive en ny kodeversion.
Fjern først gamle nøgler, når skiftet er verificeret. GitHub-secrets og Monitors OneSignal-secret kan fjernes efter aktivering af begge ændringer.

## Ansvar
GitHub opdager fortsat nye aktiviteter, billeder og initiativer samt tilmeldingsfrister.
Monitor bevarer Cloudflare Access og godkendelseskravet for manuelle beskeder.
Kokkens nuværende genvej åbner fortsat Monitors beskedfunktion.
Alle OneSignal-kald og nøgler samles i Apps Script.
Eksisterende manuelle action=sendPush-kald understøttes fortsat.
Retries af automatiske beskeder bruger stabilt besked-ID per modtager-app.

## Begrænsninger
Den uploadede Apps Script-kodes eksisterende adgangsmodel er bevaret.
Levering fra OneSignal er ikke en bekræftelse på modtagelse på alle telefoner.
iPhone-kalenderen skal fortsat afprøves på en fysisk iPhone.
