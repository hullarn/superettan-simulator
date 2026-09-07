# Superettan Slutspurten

En funktionell prototyp för att simulera de sista omgångarna i Superettan. Tabellen uppdateras direkt när ett 1/X/2-utfall eller ett exakt resultat anges.

## Kör lokalt

1. Installera Node.js 22 eller senare.
2. Kör `pnpm install`.
3. Kör `pnpm dev` och öppna adressen som visas.

Utan en sparad synkning används den inbyggda datakopian efter omgång 20, 2026. Kopiera `.env.example` till `.env.local` och lägg in serverhemligheterna för att testa `/admin` och GOAL API lokalt. Nyckeln stannar på servern och skickas aldrig till webbläsaren.

## Datasynkning

Vanliga sidvisningar läser bara den gemensamma, sparade datakopian. GOAL API anropas enbart av den skyddade manuella synkningen på `/admin` eller av det dagliga Vercel-cronjobbet när en sparad matchtid visar att en match rimligen hunnit bli färdig. Det statiska spelschemat är basen: API-data matchas på omgång samt hemma- och bortalag och får uppdatera status, slutresultat och avspark, men aldrig ta bort en befintlig match.

Vid synk dedupliceras de färdigspelade matcherna och grundtabellen räknas fram från resultaten innan hela datakopian sparas. GOAL API:s `/standings` används bara för diagnostisk jämförelse. Administrativa resultatändringar som saknas i API:t ligger samlade i `lib/administrative-result-overrides.ts`.

Lagringen ligger bakom ett litet internt gränssnitt. Lokalt används `.data/superettan-state.json`. På Vercel används Upstash Redis när `UPSTASH_REDIS_REST_URL` och `UPSTASH_REDIS_REST_TOKEN` finns. På en vanlig Node-server, exempelvis Oderland, kan den filbaserade adaptern aktiveras med `DATA_STORE=file`, eller ersättas med en annan adapter utan att synklogiken ändras.

## GitHub och Vercel

Projektet är ett vanligt Next.js-projekt. När GitHub-repot finns kan det importeras direkt i Vercel. Vercel skapar automatiskt en preview för varje ny branch eller pull request och publicerar produktionen från `main`.

Koppla en Upstash Redis-databas via Vercel Marketplace och lägg in `GOAL_API_KEY`, `ADMIN_PASSWORD` och `CRON_SECRET` under **Project Settings → Environment Variables**. GOAL API använder som standard Superettan 2026-id:t i `.env.example`; liga-id och säsong kan ändras med miljövariablerna där.
