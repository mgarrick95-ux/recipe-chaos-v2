import Link from 'next/link';
import { PlanningEditor } from '@/components/domain/planning/planning-editor';
import { defaultWeekStart } from '@/domain/planning/weeks';
import { loadPlanningView } from '@/services/planning';

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const week = params.week ?? defaultWeekStart();
  const result = await loadPlanningView(week);
  if (!result.ok) return <div className="panel space-y-3" role="alert">
    <h1 className="section-title">Weekly plan unavailable</h1>
    <p className="muted">{result.error.message}</p>
    <Link className="text-link" href={result.error.code === 'unauthorized' ? '/sign-in' : '/plan'}>Try again →</Link>
  </div>;
  const date = new Date(`${week}T12:00:00Z`);
  const adjacent = (days: number) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return <div className="space-y-9">
    <div>
      <p className="eyebrow mb-4">Meals, your way</p>
      <h1 className="page-title">Weekly plan<span className="text-teal-300">.</span></h1>
      <p className="muted mt-4 max-w-xl">Pick how many meals you want, then choose recipes. No assigned weekdays.</p>
    </div>
    <div className="flex flex-wrap items-center gap-4">
      <Link className="btn" href={`/plan?week=${adjacent(-7)}`}>← Previous week</Link>
      <span className="font-medium">Week of {date.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}</span>
      <Link className="btn" href={`/plan?week=${adjacent(7)}`}>Next week →</Link>
    </div>
    <PlanningEditor key={week} view={result.data} />
  </div>;
}
