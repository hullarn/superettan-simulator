import { loadCompetitionData } from '@/lib/competition-store';

export async function GET() {
  const data = await loadCompetitionData();
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
