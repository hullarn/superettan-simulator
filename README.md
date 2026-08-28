# Superettan Slutspurten

En funktionell prototyp för att simulera de sista omgångarna i Superettan. Tabellen uppdateras direkt när ett 1/X/2-utfall eller ett exakt resultat anges.

## Kör lokalt

1. Installera Node.js 22 eller senare.
2. Kör `pnpm install`.
3. Kör `pnpm dev` och öppna adressen som visas.

Utan API-nyckel används den inbyggda datakopian efter omgång 20, 2026. För automatisk uppdatering, kopiera `.env.example` till `.env` och lägg in en API-nyckel från APIfootball. Nyckeln stannar på servern och skickas aldrig till webbläsaren.

## GitHub och Vercel

Projektet är ett vanligt Next.js-projekt. När GitHub-repot finns kan det importeras direkt i Vercel. Vercel skapar automatiskt en preview för varje ny branch eller pull request och publicerar produktionen från `main`.

Lägg `APIFOOTBALL_API_KEY` under **Project Settings → Environment Variables** i Vercel för att använda live-data i både previews och produktion.
