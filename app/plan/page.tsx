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
  return <div className="enchanted-page enchanted-plan space-y-8 sm:space-y-9">
    <header className="enchanted-hero"><div className="enchanted-hero-copy">
      <p className="eyebrow mb-4">Meals, your way</p>
      <h1 className="page-title">Weekly plan<span aria-hidden="true" className="enchanted-title-mark">✦</span></h1>
      <p className="muted mt-4 max-w-xl">Pick how many meals you want, then choose recipes. No assigned weekdays.</p>
    </div></header>
    <div className="enchanted-week-strip">
      <Link className="btn" href={`/plan?week=${adjacent(-7)}`}>← Previous week</Link>
      <span className="enchanted-week-label">Week of {date.toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}</span>
      <Link className="btn" href={`/plan?week=${adjacent(7)}`}>Next week →</Link>
    </div>
    <PlanningEditor key={week} view={result.data} />
  </div>;
}
