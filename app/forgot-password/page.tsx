import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return <div className="mx-auto max-w-lg py-8 sm:py-16">
    <section className="panel space-y-6">
      <div><p className="eyebrow mb-4">Password help</p><h1 className="section-title">Reset your password</h1><p className="muted mt-2 text-sm leading-6">Enter the email for your Recipe Chaos account and we’ll send you a secure reset link.</p></div>
      <ForgotPasswordForm />
    </section>
  </div>;
}
