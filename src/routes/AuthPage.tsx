import { useState, type FormEvent } from 'react';
import { ArrowRight, HardDrive } from 'lucide-react';
import { useI18n, useT } from '@/lib/i18n';
import { hasBackend } from '@/lib/supabase';
import { signInWithEmail, signInWithGoogle, signUpWithEmail, startDemo, type AuthError } from '@/lib/auth';
import { Button, Field, Input, Segmented } from '@/components/ui';
import { LogoMark } from '@/app/shell/Logo';
import { WelcomePreview } from './WelcomePreview';
import { BalanceMark } from '@/app/shell/BalanceMark';

export function AuthPage() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('email');
    if (password.length < 8 && mode === 'signUp') return setError('weak');
    setBusy('email');
    if (mode === 'signIn') {
      setError(await signInWithEmail(email, password));
    } else {
      const res = await signUpWithEmail(email, password);
      setError(res.error);
      if (!res.error && res.needsConfirmation) setNotice(t('auth.checkEmail'));
    }
    setBusy(null);
  }

  async function google() {
    setBusy('google');
    const err = await signInWithGoogle();
    if (err) {
      setError(err);
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-dvh bg-frame lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="flex flex-col px-6 py-6 md:px-12 md:py-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="text-md font-semibold text-text">{t('app.name')}</span>
          </div>
          <Segmented
            label={t('settings.language')}
            value={lang}
            onValueChange={setLang}
            options={[
              { value: 'ar', label: 'عربي' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="w-full max-w-[400px]">
            <span className="mb-6 block lg:hidden">
              <BalanceMark size={96} />
            </span>
            <h1 className="font-display text-4xl font-semibold text-text text-balance md:text-[52px] md:leading-[56px]">{t('auth.title')}</h1>
            <p className="mt-3 text-md text-text-2">{t('auth.subtitle')}</p>

            {hasBackend ? (
              <>
                <form onSubmit={submit} noValidate className="mt-10 flex flex-col gap-4">
                  <Field label={t('auth.email')} error={error === 'email' ? t('auth.err.email') : undefined}>
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    )}
                  </Field>
                  <Field
                    label={t('auth.password')}
                    error={error === 'weak' ? t('auth.err.weak') : error === 'invalid' ? t('auth.err.invalid') : undefined}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        type="password"
                        autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                      />
                    )}
                  </Field>
                  {error === 'generic' && (
                    <p role="alert" className="text-sm text-danger">
                      {t('auth.err.generic')}
                    </p>
                  )}
                  {notice && (
                    <p role="status" className="rounded-control border border-border bg-accent-soft px-3 py-2 text-base text-text">
                      {notice}
                    </p>
                  )}
                  <Button type="submit" variant="primary" size="lg" block loading={busy === 'email'}>
                    {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-text-3">
                  <span className="h-px flex-1 bg-border" />
                  {t('auth.or')}
                  <span className="h-px flex-1 bg-border" />
                </div>

                <Button size="lg" block onClick={google} loading={busy === 'google'} iconStart={<GoogleGlyph />}>
                  {t('auth.google')}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                    setError(null);
                    setNotice(null);
                  }}
                  className="mt-6 text-base text-text-2 underline-offset-4 hover:text-text hover:underline"
                >
                  {mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}
                </button>

                <div className="mt-10 border-t border-border pt-6">
                  <button
                    type="button"
                    onClick={startDemo}
                    className="group flex items-center gap-2 text-base font-medium text-text-2 hover:text-text"
                  >
                    {t('auth.demo')}
                    <ArrowRight size={16} className="flip-rtl transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </button>
                  <p className="mt-1 text-sm text-text-3">{t('auth.demoHint')}</p>
                </div>
              </>
            ) : (
              <div className="mt-10 flex flex-col items-start gap-4">
                <p className="flex gap-3 rounded-control border border-border bg-surface-1 p-3 text-base text-text-2">
                  <HardDrive size={18} className="mt-0.5 shrink-0 text-text-3" />
                  {t('auth.noBackend')}
                </p>
                <Button variant="primary" size="lg" onClick={startDemo} iconEnd={<ArrowRight size={18} className="flip-rtl" />}>
                  {t('c.continue')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <WelcomePreview />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
