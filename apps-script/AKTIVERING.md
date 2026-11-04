# Aktivér rettelserne i Apps Script

GitHub-, Monitor- og Kokken-koden er bagudkompatibel med den nuværende scriptversion. Gør nedenstående i rækkefølge, før du udgiver Apps Script.

1. Erstat hele Kode.gs med indholdet af Concordia_AppsScript.js og gem.
2. Vælg funktionen setupConcordiaPushSecurity i funktionslisten øverst og klik Kør. Godkend adgang hvis Google beder om det. Funktionen sender ingen beskeder og ændrer ikke tilmeldinger. Den opretter to scriptegenskaber og viser dem i udførelsesloggen.
3. Kopiér værdien efter PUSH_RELAY_TOKEN til:
   - AktiviteterV2 → Settings → Secrets and variables → Actions → New repository secret. Navn: PUSH_RELAY_TOKEN.
   - Cloudflare → Workers & Pages → concordia-monitor → Settings → Variables and Secrets → Add → Secret. Navn: PUSH_RELAY_TOKEN. Gem/udgiv indstillingen, hvis Cloudflare beder om det.
4. Gem den viste beskedkode til kokken. Kokkens app spørger efter den ved manuel afsendelse. Koden kan senere ændres i scriptegenskaben KITCHEN_PUSH_PIN; den skal aldrig ind i kildekoden.
5. Behold begge ONESIGNAL-nøgler og eventuel PUSH_TARGET_MODE.
6. Implementer → Administrer implementeringer → blyant ved eksisterende webapp → Ny version → Implementer. Behold samme /exec-adresse.
7. Genindlæs Monitor og Kokken. Giv besked om, at det er udgivet, så forbindelsen kan kontrolleres.

Funktionen setupConcordiaPushSecurity kan køres igen uden at udskifte allerede oprettede koder. Send ikke nøgler eller beskedkoder i chatten.

## Rettelser
- Gæsteantal gemmes i ny kolonne K; eksisterende kolonner A:J flyttes ikke.
- Gamle gæsteantal læses fra den eksisterende tekst som før.
- Monitor og køkkenarket tæller medbragte og eksterne gæster korrekt.
- Beskedafsendelse bruger en separat adgangsnøgle eller kokkens beskedkode.
- Beskeder holder ikke låsen for tilmeldinger.
- Samme besked-ID bevares ved genforsøg.
- Kalenderknapper bruger samme kalenderlink på begge adresser, også fra aktivitetsforsiden.
- Kalenderaftaler erstattes aldrig af andre aftaler fra offline-cache.
- Den gamle automatiske initiativkontrol er udfaset. Opslag notificeres ved godkendelse i Monitor.

Testene er kørt med simulerede svar. Ingen testbeskeder sendt til brødrene. Faktisk iPhone-import og telefonmodtagelse kræver fortsat praktisk test.
