import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
  return <div className="mx-auto grid max-w-4xl items-center gap-10 py-5 md:grid-cols-2 md:gap-16 md:py-16">
    <div><p className="eyebrow mb-5">A little less chaos</p><h1 className="page-title">Good food.<br />One less thing<br />to remember<span className="text-teal-300">.</span></h1><p className="muted mt-6 max-w-sm text-lg leading-8">A home for the recipes you come back to. And the ones you haven’t tried yet.</p><div className="mt-8 h-1 w-12 rounded bg-purple-300/70" /></div>
    <section className="panel space-y-6"><div><h2 className="section-title">Welcome to your kitchen</h2><p className="muted mt-2 text-sm leading-6">Sign in with your existing account.</p></div><SignInForm /></section>
  </div>;
}
