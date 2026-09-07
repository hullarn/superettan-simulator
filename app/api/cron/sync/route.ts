import { syncSuperettan } from '@/lib/sync-superettan';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ ok: false, error: 'CRON_SECRET saknas.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Obehörig.' }, { status: 401 });
  }

  const result = await syncSuperettan('automatic', false);
  return Response.json({ ok: result.status !== 'error', status: result.status, message: result.message }, {
    status: result.status === 'error' ? 502 : 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
