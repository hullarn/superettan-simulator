import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, Database, LogOut, RefreshCw } from 'lucide-react';
import { adminCookieName, isAdminConfigured, isAdminSessionValid } from '@/lib/admin-auth';
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
function dateLabel(value: string | null) {
  return value ? formatter.format(new Date(value)) : 'Aldrig';
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

  const [state, store] = await Promise.all([
    loadCompetitionState(),
    Promise.resolve(getCompetitionStore()),
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

      </section>
    </main>
  );
}
