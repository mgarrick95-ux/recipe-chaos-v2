import Link from 'next/link';
export default function NotFound() { return <div className="panel space-y-4"><h1 className="section-title">Recipe not found</h1><p className="muted">It may have been removed, or this link may be out of date.</p><Link href="/recipes" className="btn">Back to recipes</Link></div>; }
