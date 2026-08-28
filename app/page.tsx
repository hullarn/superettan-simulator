import { Simulator } from '@/components/simulator';
import { SNAPSHOT } from '@/lib/superettan';

export default function Home() {
  return <Simulator initialData={SNAPSHOT} />;
}
