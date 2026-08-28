import { fetchCompetitionData } from '@/lib/superettan';

export async function GET() {
  const data = await fetchCompetitionData();
  return Response.json(data, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
}
