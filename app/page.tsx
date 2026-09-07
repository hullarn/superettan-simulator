import { Simulator } from '@/components/simulator';
import { loadCompetitionData } from '@/lib/competition-store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  return <Simulator initialData={await loadCompetitionData()} />;
}
