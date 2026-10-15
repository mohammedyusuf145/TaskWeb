import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react';
import { useI18n, useT, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { SUBJECT_COLORS, subjectColor } from '@/design/tokens';
import { SUBJECT_PRESETS } from '@/features/subjects/presets';
import { SubjectIcon } from '@/features/subjects/icons';
import { seedWorkspace } from '@/features/onboarding/seed';
import { Button, Checkbox, Field, Input, Select, toast } from '@/components/ui';
import { LogoMark } from '@/app/shell/Logo';
import { addDays, fromDateInputValue, toDateInputValue } from '@/lib/dates';

interface DraftSubject {
  key: string;
  name: string;
  color: string;
  icon: string;
  selected: boolean;
}

const TOTAL = 3;

/** Three short steps, under a minute: language → subjects → (optional) exam. */
export function OnboardingPage() {
  const t = useT();
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();
  const [step, setStep] = useState(1);
  const [custom, setCustom] = useState('');
  const [subjects, setSubjects] = useState<DraftSubject[]>(() =>
    SUBJECT_PRESETS.map((p) => ({ key: p.key, name: '', color: p.color, icon: p.icon, selected: p.core })),
  );
  const [exam, setExam] = useState({ subjectKey: 'math', title: '', date: toDateInputValue(addDays(new Date(), 7)) });
  const [samples, setSamples] = useState(true);
  const [busy, setBusy] = useState(false);

  // Preset names follow the current language until the user finishes.
  const resolved = useMemo(
    () =>
      subjects.map((s) => {
        const preset = SUBJECT_PRESETS.find((p) => p.key === s.key);
        return { ...s, name: preset ? t(preset.nameKey) : s.name };
      }),
    [subjects, t],
  );
  const chosen = resolved.filter((s) => s.selected);

  function addCustom() {
    const name = custom.trim();
    if (!name) return;
    const used = new Set(subjects.map((s) => s.color));
    const color = SUBJECT_COLORS.find((c) => !used.has(c.hex))?.hex ?? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length]!.hex;
    setSubjects([...subjects, { key: `custom-${Date.now()}`, name, color, icon: 'book-open', selected: true }]);
    setCustom('');
  }

  async function finish(withExam: boolean) {
    setBusy(true);
    try {
      const examIndex = chosen.findIndex((s) => s.key === exam.subjectKey);
      const date = fromDateInputValue(exam.date);
      await seedWorkspace({
        lang,
        t,
        subjects: chosen.map(({ name, color, icon }) => ({ name, color, icon })),
        exam: withExam && date && exam.title.trim() ? { subjectIndex: Math.max(0, examIndex), title: exam.title.trim(), date } : null,
        includeSamples: samples,
      });
      navigate('/board', { replace: true });
    } catch {
      toast(t('auth.err.generic'), { tone: 'danger' });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[640px] flex-col px-4 py-6 md:px-8 md:py-10">
      <header className="flex items-center justify-between">
        <LogoMark size={28} />
        <p className="text-sm text-text-3 tabular" aria-live="polite">
          {t('onb.step', { n: step, total: TOTAL })}
        </p>
      </header>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={cn('h-0.5 flex-1 rounded-full transition-colors duration-[var(--dur-slow)]', i < step ? 'bg-accent' : 'bg-border-strong')}
          />
        ))}
      </div>

      <main className="flex-1 py-10">
        {step === 1 && (
          <section>
            <h1 className="text-2xl font-semibold text-text">{t('onb.lang.title')}</h1>
            <p className="mt-2 text-base text-text-2">{t('onb.lang.hint')}</p>
            <div role="radiogroup" aria-label={t('settings.language')} className="mt-8 flex flex-col gap-2">
              {(
                [
                  ['ar', 'العربية', 'ابدأ يومك بخطة واضحة.'],
                  ['en', 'English', 'Start your day with a clear plan.'],
                ] as [Lang, string, string][]
              ).map(([value, name, sample]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={lang === value}
                  lang={value}
                  dir={value === 'ar' ? 'rtl' : 'ltr'}
                  onClick={() => setLang(value)}
                  className={cn(
                    'flex items-center gap-4 rounded-card border px-4 py-4 text-start transition-colors duration-[var(--dur-fast)]',
                    lang === value ? 'border-accent bg-accent-soft' : 'border-border bg-surface-2 hover:border-border-strong',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-md font-medium text-text">{name}</span>
                    <span className="block text-sm text-text-3">{sample}</span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-full border',
                      lang === value ? 'border-accent bg-accent text-accent-ink' : 'border-border-strong',
                    )}
                  >
                    {lang === value && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-2xl font-semibold text-text">{t('onb.subjects.title')}</h1>
            <p className="mt-2 text-base text-text-2">{t('onb.subjects.hint')}</p>
            <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {resolved.map((s, i) => (
                <li key={s.key}>
                  <button
                    type="button"
                    aria-pressed={s.selected}
                    onClick={() => setSubjects(subjects.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)))}
                    className={cn(
                      'flex h-12 w-full items-center gap-3 rounded-card border px-3 text-start transition-colors duration-[var(--dur-fast)]',
                      s.selected ? 'border-border-strong bg-surface-2 raised' : 'border-border bg-transparent text-text-3 hover:bg-surface-1',
                    )}
                  >
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-control transition-opacity"
                      style={{
                        background: `color-mix(in oklab, ${subjectColor(s.color)} 16%, transparent)`,
                        color: subjectColor(s.color),
                        opacity: s.selected ? 1 : 0.5,
                      }}
                    >
                      <SubjectIcon name={s.icon} size={15} />
                    </span>
                    <span className={cn('flex-1 truncate text-base', s.selected ? 'text-text' : 'text-text-3')}>{s.name}</span>
                    <span
                      className={cn(
                        'inline-flex size-5 items-center justify-center rounded-chip border transition-colors',
                        s.selected ? 'border-accent bg-accent text-accent-ink' : 'border-border-strong',
                      )}
                    >
                      {s.selected && <Check size={12} strokeWidth={3} />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('onb.subjects.custom')} aria-label={t('onb.subjects.custom')} maxLength={40} />
              <Button type="submit" iconStart={<Plus size={16} />} disabled={!custom.trim()}>
                {t('c.add')}
              </Button>
            </form>
            <p className={cn('mt-4 text-sm', chosen.length ? 'text-text-3' : 'text-warning')} aria-live="polite">
              {chosen.length ? t('onb.subjects.count', { n: chosen.length }) : t('onb.subjects.none')}
            </p>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-2xl font-semibold text-text">{t('onb.exam.title')}</h1>
            <p className="mt-2 text-base text-text-2">{t('onb.exam.hint')}</p>
            <div className="mt-8 flex flex-col gap-4">
              <Field label={t('onb.exam.titleField')}>
                {({ id }) => (
                  <Input id={id} value={exam.title} placeholder={t('onb.exam.placeholder')} onChange={(e) => setExam({ ...exam, title: e.target.value })} maxLength={120} />
                )}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('onb.exam.subject')}>
                  {({ id }) => (
                    <Select id={id} value={exam.subjectKey} onChange={(e) => setExam({ ...exam, subjectKey: e.target.value })}>
                      {chosen.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={t('onb.exam.date')}>
                  {({ id }) => (
                    <Input
                      id={id}
                      type="date"
                      min={toDateInputValue(new Date())}
                      value={exam.date}
                      onChange={(e) => setExam({ ...exam, date: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <div className="mt-4 border-t border-border pt-6">
                <Checkbox checked={samples} onCheckedChange={setSamples} label={t('onb.sample')} />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="safe-bottom flex items-center justify-between gap-3 border-t border-border pt-4">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} iconStart={<ArrowLeft size={16} className="flip-rtl" />}>
            {t('c.back')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {step === 3 && (
            <Button variant="ghost" onClick={() => finish(false)} disabled={busy}>
              {t('c.skip')}
            </Button>
          )}
          {step < 3 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && chosen.length === 0}
              iconEnd={<ArrowRight size={16} className="flip-rtl" />}
            >
              {t('c.continue')}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => finish(true)} loading={busy} disabled={!exam.title.trim()}>
              {t('onb.finish')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
