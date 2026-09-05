'use client';
export default function ErrorPage({ retry }: { retry: () => void }) { return <div className="panel space-y-4"><h1 className="section-title">We couldn’t load your recipes</h1><p className="muted">Please try again in a moment.</p><button className="btn" onClick={retry}>Try again</button></div>; }
