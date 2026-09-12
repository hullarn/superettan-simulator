export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      status: 'ok',
      release: process.env.APP_RELEASE_SHA ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
