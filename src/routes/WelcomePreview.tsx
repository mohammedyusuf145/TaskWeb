import { motion } from 'motion/react';
import { Flag } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { subjectColor } from '@/design/tokens';
import { LogoMark } from '@/app/shell/Logo';
import { BalanceMark } from '@/app/shell/BalanceMark';
import { useReducedMotion } from '@/lib/prefs';

/**
 * Desktop glimpse of the product beside sign-in: the balance moment, then an exam card,
 * a focus session on that subject and the tutor that knows about the exam, arriving in order.
 * It shows the one idea that matters: the three tools are connected.
 */
export function WelcomePreview() {
  const t = useT();
  const reduced = useReducedMotion();
  const math = '#B83E0A';
  const physics = '#6F7DED';
  const arabic = '#C77806';
  const rise = (i: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 1.5 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } };
  return (
    <div aria-hidden className="relative hidden overflow-hidden bg-bg lg:m-2 lg:block lg:rounded-[var(--radius-canvas)] lg:border lg:border-border">
      <div className="relative flex h-full flex-col items-center justify-center gap-10 px-12 py-10">
        <BalanceMark size={200} />
        <div className="grid w-full max-w-[600px] grid-cols-[minmax(0,1fr)_190px] gap-4">
          <div className="flex flex-col gap-2">
            <motion.p {...rise(0)} className="mb-1 text-sm font-medium text-text-3">
              {t('welcome.week')}
            </motion.p>
            <motion.div {...rise(1)}>
              <PreviewCard color={math} subject={t('welcome.subject.math')} title={t('welcome.exam')} meta={t('welcome.thu')} exam />
            </motion.div>
            <motion.div {...rise(2)}>
              <PreviewCard color={physics} subject={t('welcome.subject.physics')} title={t('welcome.card1')} meta={t('welcome.today')} />
            </motion.div>
            <motion.div {...rise(3)}>
              <PreviewCard color={arabic} subject={t('welcome.subject.arabic')} title={t('welcome.card2')} meta={t('welcome.tomorrow')} />
            </motion.div>
          </div>
          <motion.div {...rise(2)} className="flex flex-col items-center justify-center gap-3 rounded-[18px] border border-border bg-surface-1 p-5">
            <div className="relative size-[112px]">
              <svg viewBox="0 0 112 112" className="size-full -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="var(--surface-3)" strokeWidth="6" fill="none" />
                <motion.circle
                  cx="56"
                  cy="56"
                  r="50"
                  stroke={subjectColor(physics)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  pathLength={1}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 0.62 }}
                  transition={{ delay: 1.9, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-medium text-text tabular" dir="ltr">
                18:42
              </span>
            </div>
            <span className="text-xs text-text-2">{t('welcome.focusing')}</span>
          </motion.div>
          <motion.div {...rise(5)} className="col-span-2 flex gap-3 rounded-[18px] border border-border bg-surface-1 p-4">
            <LogoMark size={30} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-3">{t('welcome.tutorName')}</p>
              <p className="mt-0.5 text-base text-text">{t('welcome.tutor')}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ color, subject, title, meta, exam }: { color: string; subject: string; title: string; meta: string; exam?: boolean }) {
  const c = subjectColor(color);
  return (
    <div className="rounded-card border border-border bg-surface-2 px-3.5 py-3 shadow-card">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-medium" style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color: c }}>
          <span className="size-1.5 rounded-full" style={{ background: c }} />
          {subject}
        </span>
        {exam && (
          <span className="inline-flex h-[22px] items-center gap-1 rounded-full border px-2 text-[11px] font-semibold" style={{ color: c, borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}>
            <Flag size={11} />
          </span>
        )}
      </div>
      <p className="text-[15px] font-medium text-text">{title}</p>
      <p className="mt-1 text-xs text-text-3">{meta}</p>
    </div>
  );
}
