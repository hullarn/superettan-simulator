# Driftsättning av Slutspurten

## Miljöer och ansvar

- **Oderland Standard är production.** Den publika domänen ska peka på Node.js-applikationen i Oderlands cPanel. Production läser och skriver en permanent fil på Oderland.
- **Vercel är preview/test.** Vercels URL:er och eventuell testdomän får inte vara den publika production-adressen. Vercel använder en separat Upstash Redis-databas och separata hemligheter.
- Miljöerna får aldrig dela datalager, `ADMIN_PASSWORD` eller `CRON_SECRET`.

Applikationen är en vanlig Next.js 16-applikation. Den använder inga Vercel-API:er vid körning. `vercel.json` beskriver bara Vercels testschemaläggning; Oderland ignorerar filen. `app.cjs` är startfilen för cPanel/Passenger. På en fristående Node-server kan den inbyggda Next-servern fortfarande startas med `pnpm start`.

## Runtime och kommandon

| Del | Krav |
| --- | --- |
| Node.js | Senaste 22.x LTS, lägst 22.13.0 (`.nvmrc` och `engines.node`) |
| Automatisk Oderland-build | Node 22.23.2 via NVM |
| Package manager | pnpm 11.19.0 via Corepack (`packageManager`) |
| Installation | `corepack pnpm install --frozen-lockfile` |
| Production-build | `corepack pnpm build` (`next build --webpack`) |
| Vanlig Node-start | `corepack pnpm start` (`next start`) |
| Oderland/cPanel-start | Passenger startar `app.cjs`; `PORT` tilldelas av Passenger |

Builden måste göras innan Passenger startas eller startas om. Kör aldrig `pnpm dev` i production.

## Git-brancher och deploymentflöde

- `main` är den enda branch som får driftsättas till Oderland-production.
- `develop` är den långlivade integrationsbranchen för Vercels stabila testmiljö.
- Kortlivade `feature/*`- och `fix/*`-brancher skapas från `develop`. Varje push/PR får en egen Vercel Preview Deployment.
- Efter godkänd preview mergas ändringen till `develop` för samlad test. När en release är godkänd mergas `develop` till `main`.
- Varje push eller merge till `main` startar GitHub Actions-workflowen **Deploy Oderland production**, som uppdaterar Oderland via SSH.
- Samma workflow kan startas manuellt med **Run workflow** (`workflow_dispatch`) från GitHubs Actions-flik.
- Pusha aldrig lokala `.env*`, `.data/`, buildartefakter eller den permanenta datafilen.

I Vercel ställs **Production Branch** till `develop`. Vercels benämning "Production" betyder då bara den stabila Vercel-testmiljön; verksamhetens production är fortfarande Oderland. Flytta bort den publika domänen från Vercel innan DNS växlas till Oderland.

## Environment variables

### Oderland production

Lägg in följande under cPanel-applikationens **Environment variables**:

```text
NODE_ENV=production
GOAL_API_KEY=<production-nyckel>
GOAL_API_LEAGUE_ID=cmr77dvit0057rx06s7xypict
GOAL_API_SEASON=2026
ADMIN_PASSWORD=<unikt-starkt-production-lösenord>
CRON_SECRET=<unik-slumpsträng-med-minst-32-tecken>
DATA_STORE=file
DATA_FILE_PATH=/home/CPANEL_USER/slutspurten-data/superettan-state.json
ANALYTICS_SECRET=<unik-slumpsträng-med-minst-32-tecken>
ANALYTICS_FILE_PATH=/home/CPANEL_USER/slutspurten-data/analytics.json
```

Ersätt `CPANEL_USER` med kontots riktiga cPanel-användarnamn. På det nuvarande kontot är statistikens fullständiga sökväg `/home/psdnahem/slutspurten-data/analytics.json`. `ANALYTICS_SECRET` ska vara en egen hemlighet och får aldrig läggas i koden eller Git. `GOAL_API_LEAGUE_ID` och `GOAL_API_SEASON` har fungerande standardvärden i koden men ska anges explicit i production. Sätt inte `PORT`; Passenger tilldelar den. Sätt inte `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `KV_REST_API_URL` eller `KV_REST_API_TOKEN` på Oderland.

### Vercel preview/test

Lägg in följande med separata värden i Vercels **Preview**-scope och **Production**-scope. Eftersom Vercels Production Branch ska vara `develop` hör Production-scopen här till den stabila testmiljön, inte till Oderland-production:

```text
GOAL_API_KEY=<test-nyckel>
GOAL_API_LEAGUE_ID=cmr77dvit0057rx06s7xypict
GOAL_API_SEASON=2026
ADMIN_PASSWORD=<unikt-testlösenord>
CRON_SECRET=<unik-testhemlighet>
UPSTASH_REDIS_REST_URL=<test-redis-url>
UPSTASH_REDIS_REST_TOKEN=<test-redis-token>
```

Vercel kan i stället tillhandahålla motsvarande `KV_REST_API_URL` och `KV_REST_API_TOKEN`; använd ett komplett par, inte blandade värden. Lämna `DATA_STORE` och `DATA_FILE_PATH` tomma på Vercel. Upstash-databasen ska vara en testdatabas och får inte användas av Oderland-production.

Lämna även `ANALYTICS_SECRET` och `ANALYTICS_FILE_PATH` tomma på Vercel. Den filbaserade besöksstatistiken är avsiktligt avstängd där eftersom Vercels filsystem inte är beständigt.

### Lokal utveckling

Kopiera `.env.example` till `.env.local`. Utan Redis-variabler använder utvecklingsläget automatiskt `.data/superettan-state.json`. Sätt `ANALYTICS_SECRET` till ett lokalt testvärde för att aktivera statistik i `.data/analytics.json`; `ANALYTICS_FILE_PATH` behöver då inte anges. Sätt lokala/testvärden för API, admin och cron; återanvänd inte production-hemligheter.

## Beständig datalagring

Production-filen ska ligga utanför application root och Git-repot:

```text
/home/CPANEL_USER/slutspurten-data/superettan-state.json
/home/CPANEL_USER/slutspurten-data/analytics.json
```

Skapa katalogen med rättigheter endast för cPanel-användaren:

```bash
mkdir -p /home/CPANEL_USER/slutspurten-data
chmod 700 /home/CPANEL_USER/slutspurten-data
```

Skapa inte tomma JSON-filer; adaptrarna skapar giltiga filer atomiskt vid första synkningen respektive första sidvisningen. Statistikfilen innehåller dagsräknare, enhetskategori och hänvisande domän eller `Direkt`. Endast den pågående dagens dagsbundna HMAC-värden sparas för unikräkning. När nästa dag börjar raderas dessa individuella hashvärden automatiskt och endast dagens aggregerade antal unika behålls. IP-adress, fullständig referrer och user-agent sparas inte. Högst 35 kalenderdagar med aggregerad statistik behålls och äldre dagsdata rensas automatiskt vid nästa sidvisning.

Hela läs–ändra–skriv-operationen för `analytics.json` skyddas med ett exklusivt fillås. Den nya filen skrivs först färdigt till en temporär fil i samma katalog och ersätter därefter den tidigare filen atomiskt. Lägg katalogen i Oderlands backup och kontrollera efter första synkningen och sidvisningen att båda filerna finns. Git-pull, ny build och Passenger-omstart påverkar då inte production-datan.

## Cron och synkning

### Oderland production

Skapa ett cronjobb i cPanel under **Avancerat → Cron-hantering**. Kör det dagligen klockan 00:15 i webbhotellserverns lokala tid. Kontrollera serverns tidszon med `date`; om den inte är `Europe/Stockholm`, justera cronfältet så att körningen sker 00:15 svensk tid.

Cronuttryck:

```text
15 0 * * *
```

Kommando:

```bash
/usr/bin/flock -n /home/CPANEL_USER/slutspurten-data/cron.lock /usr/bin/wget --quiet --output-document=/dev/null --header="Authorization: Bearer CRON_SECRET_VALUE" "https://PRODUCTION_DOMAIN/api/cron/sync"
```

Ersätt användarnamn, domän och hemlighet med verkliga värden. Headerns värde måste vara exakt samma som cPanel-variabeln `CRON_SECRET`. `flock` förhindrar överlappande HTTP-anrop; synklogiken har dessutom ett eget lagringslås. Under första driftsättningen kan `--quiet` och `--output-document=/dev/null` tillfälligt tas bort för felsökning.

### Vercel preview/test

`vercel.json` behåller schemat `15 22 * * *` (22:15 UTC). Vercel Cron anropar bara Vercels branch som är inställd som dess Production Branch, alltså `develop`, och skickar automatiskt `Authorization: Bearer <CRON_SECRET>`. Vanliga PR-previewdeploymenter får inget automatiskt cronanrop. Cronen arbetar endast mot Vercels test-Redis.

### Manuell synk

`/admin` och `POST /api/admin/sync` fungerar likadant i båda miljöerna. Adminsessionen skyddas av respektive miljös `ADMIN_PASSWORD`. `GET /api/cron/sync` kräver alltid bearer-headern med respektive miljös `CRON_SECRET`.

## Första installationen på Oderland

### 1. Lägg koden på kontot

Logga in via cPanel **Terminal** eller SSH och kör, med cPanel-användarnamnet i sökvägarna:

```bash
mkdir -p /home/CPANEL_USER/apps
cd /home/CPANEL_USER/apps
git clone https://github.com/hullarn/superettan-simulator.git slutspurten
cd /home/CPANEL_USER/apps/slutspurten
git checkout main
git pull --ff-only origin main
mkdir -p /home/CPANEL_USER/slutspurten-data
chmod 700 /home/CPANEL_USER/slutspurten-data
```

### 2. Registrera Node-applikationen i cPanel

Öppna **Software → Setup Node.js App → Create application** och ange:

| cPanel-fält | Värde |
| --- | --- |
| Node.js version | Senaste tillgängliga Node 22.x; verifiera att den är minst 22.13.0 |
| Application mode | `Production` |
| Application root | `apps/slutspurten` |
| Application URL | Välj production-domänen och lämna URI-fältet tomt |
| Application startup file | `app.cjs` |
| Passenger log file | `/home/CPANEL_USER/logs/slutspurten-passenger.log` |

Application root får inte vara domänens document root. Lägg därefter in environment variables enligt Oderland-avsnittet ovan. Kopiera cPanels kommando **Enter to the virtual environment**; det säkerställer att installation och build använder samma valda Node 22-runtime som Passenger.

### 3. Installera och bygg

Kör först det kopierade virtualenv-kommandot och därefter:

```bash
cd /home/CPANEL_USER/apps/slutspurten
node --version
corepack --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm build
mkdir -p tmp
touch tmp/restart.txt
```

De tre versionskommandona ska visa Node `v22.13.0` eller senare och pnpm `11.19.0`. Om Oderlands Node 22-runtime saknar Corepack, använd den här likvärdiga reservvägen för installations- och buildkommandona:

```bash
npx --yes pnpm@11.19.0 install --frozen-lockfile
npx --yes pnpm@11.19.0 build
```

Starta eller starta om appen med cPanels **Start app/Restart**. `touch tmp/restart.txt` är motsvarande Passenger-omstart via SSH.

### 4. Verifiera före DNS-byte

Verifiera via den tillfälliga URL/domän som är kopplad till appen:

```bash
curl --fail --silent --show-error https://PRODUCTION_DOMAIN/ > /dev/null
curl --fail --silent --show-error https://PRODUCTION_DOMAIN/api/superettan > /dev/null
curl --fail --silent --show-error https://PRODUCTION_DOMAIN/admin > /dev/null
curl --fail --silent --show-error --header "Authorization: Bearer CRON_SECRET_VALUE" https://PRODUCTION_DOMAIN/api/cron/sync
```

Logga sedan in på `/admin`, kör en manuell synk och kontrollera:

```bash
test -s /home/CPANEL_USER/slutspurten-data/superettan-state.json
test -s /home/CPANEL_USER/slutspurten-data/analytics.json
chmod 600 /home/CPANEL_USER/slutspurten-data/superettan-state.json
chmod 600 /home/CPANEL_USER/slutspurten-data/analytics.json
tail -n 100 /home/CPANEL_USER/logs/slutspurten-passenger.log
```

Byt inte DNS och ta inte bort Vercel-domänen förrän alla kontroller är godkända.

## Automatiska production-deployments

Workflowen `.github/workflows/deploy-oderland.yml` körs vid varje push till `main` och kan även startas manuellt. Följande måste finnas under GitHub-repots **Settings → Secrets and variables → Actions**:

| Typ | Namn | Innehåll |
| --- | --- | --- |
| Secret | `ODERLAND_SSH_KEY` | Privat SSH-nyckel som får logga in på Oderland |
| Variable | `ODERLAND_HOST` | Oderlands SSH-värdnamn |
| Variable | `ODERLAND_USER` | Oderlands SSH-användare (`psdnahem`) |

Workflowen ansluter till `/home/psdnahem/apps/slutspurten`, laddar `$HOME/.nvm/nvm.sh`, använder exakt Node 22.23.2 och verifierar att serverns checkout är `main` utan ändrade spårade filer. Därefter körs:

```bash
cd /home/psdnahem/apps/slutspurten
source "$HOME/.nvm/nvm.sh"
nvm use 22.23.2
git pull --ff-only origin main
corepack pnpm install --frozen-lockfile
corepack pnpm build
mkdir -p tmp
touch tmp/restart.txt
```

Alla kommandon körs med strikt felhantering och deploymenten avbryts om SSH, versionskontroll, Git-pull, installation eller build misslyckas. Passenger startas bara om efter en godkänd build genom att `tmp/restart.txt` uppdateras. Workflowen verifierar dessutom att serverns `HEAD` motsvarar committen som utlöste körningen och serialiserar production-deployments så att två byggen inte kör samtidigt.

Den persistenta katalogen `/home/psdnahem/slutspurten-data/` ligger utanför application root och refereras inte av workflowen. Git-pull, dependency-installation, build och Passenger-omstart påverkar därför inte datafilen.

Vid behov kan samma workflow startas manuellt från **Actions → Deploy Oderland production → Run workflow**. De manuella SSH-kommandona ovan ska endast användas för felsökning om Actions inte kan köras.

## Providerspecifika skillnader

| Område | Oderland production | Vercel preview/test |
| --- | --- | --- |
| Process | Långlivad Node 22-process via cPanel/Passenger och `app.cjs` | Vercel Functions/Next-runtime |
| Build | GitHub Actions kör `pnpm build` via SSH vid push till `main` | Automatisk per Git-push |
| Data | Permanenta, separata JSON-filer för tävlingsdata och statistik utanför Git | Separat Upstash/KV Redis; filstatistik avstängd |
| Cron | cPanel Cron + `wget` + bearer-header | `vercel.json`; Vercel skickar bearer-header |
| Production-källa | `main` | `develop` är endast stabil testbranch |
| Omstart | cPanel Restart eller `touch tmp/restart.txt` | Ny deployment |

Filadaptern förutsätter en enda aktiv production-instans på Oderland. Starta inte flera Passenger-instanser som skriver samma datafil. Den befintliga fillåsningen skyddar samtidiga synkförsök i samma filsystem, men är inte avsedd som distribuerad lagring.
