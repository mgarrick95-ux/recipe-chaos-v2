import { SignUpForm } from '@/components/auth/sign-up-form';

export default function SignUpPage() {
  return <div className="mx-auto grid max-w-4xl items-center gap-10 py-5 md:grid-cols-2 md:gap-16 md:py-16">
    <div><p className="eyebrow mb-5">Your kitchen, remembered</p><h1 className="page-title">Start with what<br />you already know<span className="text-teal-300">.</span></h1><p className="muted mt-6 max-w-sm text-lg leading-8">Create your Recipe Chaos account. Your recipes, pantry, plans, and shopping stay tied to your household.</p><div className="mt-8 h-1 w-12 rounded bg-purple-300/70" /></div>
    <section className="panel space-y-6"><div><h2 className="section-title">Create your account</h2><p className="muted mt-2 text-sm leading-6">You can start with recipes and FrostPantry right away.</p></div><SignUpForm /></section>
  </div>;
}
