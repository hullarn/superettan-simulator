import { isAdminRequest } from '@/lib/admin-auth';
import { syncSuperettan } from '@/lib/sync-superettan';

export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return new Response('Obehörig', { status: 401 });
  const result = await syncSuperettan('manual', true);
  return new Response(null, {
    status: 303,
    headers: { Location: `/admin?sync=${result.status}`, 'Cache-Control': 'no-store' },
  });
}
