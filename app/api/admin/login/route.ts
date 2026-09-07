import { createAdminSessionCookie, verifyAdminPassword } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const formData = await request.formData();
  const passwordValue = formData.get('password');
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  if (!await verifyAdminPassword(password)) {
    return new Response(null, { status: 303, headers: { Location: '/admin?login=failed', 'Cache-Control': 'no-store' } });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': await createAdminSessionCookie(),
      'Cache-Control': 'no-store',
    },
  });
}
