import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  return <div className="mx-auto max-w-lg py-8 sm:py-16">
    <section className="panel space-y-6">
      <div><p className="eyebrow mb-4">Choose a new password</p><h1 className="section-title">Almost back in</h1><p className="muted mt-2 text-sm leading-6">Set a new password for your Recipe Chaos account.</p></div>
      <ResetPasswordForm />
    </section>
  </div>;
}
