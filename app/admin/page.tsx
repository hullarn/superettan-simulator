import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, Database, LogOut, RefreshCw } from 'lucide-react';
import { adminCookieName, isAdminConfigured, isAdminSessionValid } from '@/lib/admin-auth';
import { loadAnalyticsSummary } from '@/lib/analytics-store';
import { getCompetitionStore, loadCompetitionState } from '@/lib/competition-store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin · Slutspurten',
  robots: { index: false, follow: false },
};

const formatter = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'Europe/Stockholm',
});
const dayFormatter = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'medium',
  timeZone: 'Europe/Stockholm',
});
const numberFormatter = new Intl.NumberFormat('sv-SE');

function dateLabel(value: string | null) {
  return value ? formatter.format(new Date(value)) : 'Aldrig';
}

function dayLabel(value: string) {
  return dayFormatter.format(new Date(`${value}T12:00:00Z`));
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ login?: string; sync?: string }> }) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const configured = isAdminConfigured();
  const authenticated = configured && await isAdminSessionValid(cookieStore.get(adminCookieName())?.value);

  if (!authenticated) {
    return (
      <main className="admin-shell">
        <section className="admin-card admin-login-card">
          <Link href="/" className="admin-brand">Slutspurten</Link>
          <p className="admin-eyebrow">Privat administration</p>
          <h1>Logga in</h1>
          {!configured ? (
            <div className="admin-alert is-error">
              <CircleAlert />
              <span>Sätt <code>ADMIN_PASSWORD</code> i miljövariablerna för att aktivera adminsidan.</span>
            </div>
          ) : (
            <form action="/api/admin/login" method="post" className="admin-login-form">
              <label htmlFor="password">Adminlösenord</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
              {query.login === 'failed' && <p className="admin-form-error">Fel lösenord. Försök igen.</p>}
              <button type="submit">Logga in</button>
            </form>
          )}
          <Link href="/" className="admin-back-link">Tillbaka till simulatorn</Link>
        </section>
      </main>
    );
  }

  const [state, store, analytics] = await Promise.all([
    loadCompetitionState(),
    Promise.resolve(getCompetitionStore()),
    loadAnalyticsSummary(),
  ]);
  const success = state.sync.lastResult === 'success';

  return (
    <main className="admin-shell">
      <section className="admin-card">
        <header className="admin-header">
          <div>
            <Link href="/" className="admin-brand">Slutspurten</Link>
            <p className="admin-eyebrow">Privat administration</p>
          </div>
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="admin-logout">Logga ut <LogOut /></button>
          </form>
        </header>

        <div className="admin-title-row">
          <div>
            <h1>Datasynkning</h1>
            <p>Vanliga sidvisningar läser endast den sparade datakopian.</p>
          </div>
          <form action="/api/admin/sync" method="post">
            <button type="submit" className="admin-sync-button"><RefreshCw /> Uppdatera data nu</button>
          </form>
        </div>

        {query.sync && (
          <div className={`admin-alert ${query.sync === 'success' ? 'is-success' : query.sync === 'busy' ? '' : 'is-error'}`}>
            {query.sync === 'success' ? <CheckCircle2 /> : <CircleAlert />}
            <span>{query.sync === 'success' ? 'Datan uppdaterades.' : query.sync === 'busy' ? 'En annan synkning pågår redan.' : 'Synkningen misslyckades. Den tidigare datan används fortfarande.'}</span>
          </div>
        )}

        <div className="admin-status-grid">
          <article className="admin-status-card">
            <span>Senast uppdaterad data</span>
            <strong>{dateLabel(state.sync.lastSuccessAt)}</strong>
            <small>Datakopia från omgång {state.data.currentRound}</small>
          </article>
          <article className="admin-status-card">
            <span>Senaste API-anrop</span>
            <strong className={success ? 'status-success' : state.sync.lastResult === 'error' ? 'status-error' : ''}>
              {state.sync.lastResult === 'success' ? 'Lyckades' : state.sync.lastResult === 'error' ? 'Misslyckades' : 'Inte gjort'}
            </strong>
            <small>{dateLabel(state.sync.lastAttemptAt)}</small>
          </article>
          <article className="admin-status-card">
            <span>Lagring</span>
            <strong><Database /> {store.kind === 'redis' ? 'Redis' : store.kind === 'file' ? 'Lokal fil' : 'Ej konfigurerad'}</strong>
            <small>{store.configured ? 'Beständig datakopia aktiv' : 'Konfiguration krävs före publicering'}</small>
          </article>
        </div>

        <dl className="admin-details">
          <div><dt>Statusmeddelande</dt><dd>{state.sync.message}</dd></div>
          <div><dt>Senaste automatiska kontroll</dt><dd>{dateLabel(state.sync.lastAutomaticCheckAt)}</dd></div>
          <div><dt>Senaste utlösare</dt><dd>{state.sync.lastTrigger === 'manual' ? 'Manuell' : state.sync.lastTrigger === 'automatic' ? 'Automatisk' : 'Ingen'}</dd></div>
          <div><dt>API-anrop vid senaste försök</dt><dd>{state.sync.upstreamRequests}</dd></div>
          <div><dt>Datakällans tidsstämpel</dt><dd>{dateLabel(state.data.updatedAt)}</dd></div>
        </dl>

        <section className="admin-analytics">
          <div className="admin-section-heading">
            <h2>Besöksstatistik</h2>
            <p>Cookiefri förstapartsstatistik. Unika besökare summeras per dag.</p>
          </div>

          {!analytics.configured && (
            <div className="admin-alert">
              <CircleAlert />
              <span>Sätt <code>ANALYTICS_SECRET</code> och en beständig <code>ANALYTICS_FILE_PATH</code> för att aktivera statistiken.</span>
            </div>
          )}

          <div className="admin-analytics-periods">
            <article className="admin-status-card">
              <span>Idag</span>
              <strong>{numberFormatter.format(analytics.today.visits)} / {numberFormatter.format(analytics.today.unique)}</strong>
              <small>Besök / unika</small>
            </article>
            <article className="admin-status-card">
              <span>Senaste 7 dagar</span>
              <strong>{numberFormatter.format(analytics.last7Days.visits)} / {numberFormatter.format(analytics.last7Days.unique)}</strong>
              <small>Besök / unika dagsbesökare</small>
            </article>
            <article className="admin-status-card">
              <span>Senaste 30 dagar</span>
              <strong>{numberFormatter.format(analytics.last30Days.visits)} / {numberFormatter.format(analytics.last30Days.unique)}</strong>
              <small>Besök / unika dagsbesökare</small>
            </article>
          </div>

          <div className="admin-analytics-breakdown">
            <article>
              <h3>Enheter · senaste 30 dagar</h3>
              <dl>
                <div><dt>Mobil</dt><dd>{numberFormatter.format(analytics.devices.mobile)}</dd></div>
                <div><dt>Desktop</dt><dd>{numberFormatter.format(analytics.devices.desktop)}</dd></div>
              </dl>
            </article>
            <article>
              <h3>Trafikkällor · senaste 30 dagar</h3>
              {analytics.sources.length > 0 ? (
                <dl>
                  {analytics.sources.map(({ source, visits }) => (
                    <div key={source}><dt>{source}</dt><dd>{numberFormatter.format(visits)}</dd></div>
                  ))}
                </dl>
              ) : <p>Ingen trafik registrerad ännu.</p>}
            </article>
          </div>

          <details className="admin-analytics-days">
            <summary>Visa senaste 30 dagarna</summary>
            <div className="admin-analytics-table-scroll">
              <table>
                <thead><tr><th>Datum</th><th>Besök</th><th>Unika</th></tr></thead>
                <tbody>
                  {analytics.days.map((day) => (
                    <tr key={day.date}>
                      <td>{dayLabel(day.date)}</td>
                      <td>{numberFormatter.format(day.visits)}</td>
                      <td>{numberFormatter.format(day.unique)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      </section>
    </main>
  );
}
