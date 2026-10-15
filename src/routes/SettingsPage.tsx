import { useState, type ReactNode } from 'react';
import { Check, ChevronRight, Download, LogOut, Moon, Monitor, Plus, Sun, Trash2, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { setPrefs, usePrefs, type Accent } from '@/lib/prefs';
import { playUi } from '@/lib/uiSound';
import { cn } from '@/lib/cn';
import { useI18n, useT } from '@/lib/i18n';
import { useAuth, signOut, deleteAccount } from '@/lib/auth';
import { useSubjects } from '@/lib/db/hooks';
import { formatDateLong, formatDayMonth, weekdayName } from '@/lib/dates';
import type { Subject } from '@/types/database';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { exportAllData } from '@/features/settings/exportData';
import { SubjectEditor } from '@/features/subjects/SubjectEditor';
import { SubjectIcon } from '@/features/subjects/icons';
import { NotificationSettings } from '@/features/reminders/NotificationSettings';
import { subjectColor } from '@/design/tokens';
import { Button, Dialog, Field, Input, Segmented, Select, Switch, toast } from '@/components/ui';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';

export function SettingsPage() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const settings = useSettings();
  const subjects = useSubjects();
  const { mode, email } = useAuth();
  const [editing, setEditing] = useState<Subject | null | 'new'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const today = new Date();
  const prefs = usePrefs();
  const sections = [
    ['appearance', t('settings.appearance')],
    ['region', t('settings.region')],
    ['feel', t('settings.feel')],
    ['calendar', t('settings.calendar')],
    ['notifications', t('notif.title')],
    ['subjects', t('settings.subjects')],
    ['account', t('settings.account')],
  ] as const;

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <PageBody>
        <div className="flex gap-10">
        <nav aria-label={t('settings.jump')} className="sticky top-[92px] hidden h-fit w-48 shrink-0 flex-col gap-0.5 lg:flex">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-control px-3 py-2 text-base text-text-2 transition-colors hover:bg-surface-1 hover:text-text">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-6">
          <Section id="appearance" title={t('settings.appearance')} hint={t('settings.appearance.hint')}>
            <Row label={t('settings.theme')}>
              <ThemeTiles value={settings.theme} onChange={(v) => void updateSettings({ theme: v })} />
            </Row>
            <Row label={t('settings.accent')} hint={t('settings.deviceOnly')}>
              <AccentPicker />
            </Row>
            <Row label={t('settings.textSize')}>
              <Segmented
                label={t('settings.textSize')}
                value={prefs.textSize}
                onValueChange={(v) => setPrefs({ textSize: v })}
                options={[
                  { value: 'sm', label: t('settings.textSize.sm') },
                  { value: 'md', label: t('settings.textSize.md') },
                  { value: 'lg', label: t('settings.textSize.lg') },
                ]}
              />
            </Row>
            <Row label={t('settings.motion')} hint={t('settings.motion.hint')}>
              <Segmented
                label={t('settings.motion')}
                value={prefs.motion}
                onValueChange={(v) => setPrefs({ motion: v })}
                options={[
                  { value: 'system', label: t('settings.motion.system') },
                  { value: 'full', label: t('settings.motion.full') },
                  { value: 'reduce', label: t('settings.motion.reduce') },
                ]}
              />
            </Row>
          </Section>

          <Section id="region" title={t('settings.region')}>
            <Row label={t('settings.language')}>
              <Segmented
                label={t('settings.language')}
                value={lang}
                onValueChange={(v) => void updateSettings({ language: v })}
                options={[
                  { value: 'ar', label: 'العربية' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </Row>
            <Row label={t('settings.weekStart')}>
              <div className="w-full sm:w-48">
                <Select
                  aria-label={t('settings.weekStart')}
                  value={settings.week_start}
                  onChange={(e) => void updateSettings({ week_start: Number(e.target.value) as 0 | 1 | 6 })}
                >
                  {[6, 0, 1].map((d) => (
                    <option key={d} value={d}>
                      {weekdayName(d, lang)}
                    </option>
                  ))}
                </Select>
              </div>
            </Row>
          </Section>

          <Section id="feel" title={t('settings.feel')} hint={t('settings.feel.hint')}>
            <div className="py-4">
              <Switch
                checked={prefs.sounds}
                onCheckedChange={(v) => {
                  setPrefs({ sounds: v });
                  if (v) playUi('toggle');
                }}
                label={t('settings.sounds')}
              />
            </div>
            {prefs.sounds && (
              <Row label={t('settings.sounds.volume')}>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={prefs.soundVolume}
                    onChange={(e) => setPrefs({ soundVolume: Number(e.target.value) })}
                    onPointerUp={() => playUi('complete')}
                    aria-label={t('settings.sounds.volume')}
                    className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--accent)] sm:w-40 sm:flex-none"
                  />
                  <Button size="sm" variant="secondary" iconStart={<Volume2 size={14} />} onClick={() => playUi('complete')}>
                    {t('settings.sounds.test')}
                  </Button>
                </div>
              </Row>
            )}
            <div className="py-4">
              <Switch
                checked={prefs.haptics}
                onCheckedChange={(v) => setPrefs({ haptics: v })}
                label={t('settings.haptics')}
                description={t('settings.haptics.hint')}
              />
            </div>
          </Section>

          <Section id="calendar" title={t('settings.calendar')}>
            <Row label={t('settings.calendar.primary')} hint={formatDateLong(today, lang, settings.calendar_primary)}>
              <Segmented
                label={t('settings.calendar.primary')}
                value={settings.calendar_primary}
                onValueChange={(v) => void updateSettings({ calendar_primary: v })}
                options={[
                  { value: 'gregorian', label: t('settings.calendar.gregorian') },
                  { value: 'hijri', label: t('settings.calendar.hijri') },
                ]}
              />
            </Row>
            <div className="py-3">
              <Switch
                checked={settings.calendar_show_secondary}
                onCheckedChange={(v) => void updateSettings({ calendar_show_secondary: v })}
                label={t('settings.calendar.showSecondary')}
                description={formatDayMonth(today, lang, settings.calendar_primary === 'gregorian' ? 'hijri' : 'gregorian')}
              />
            </div>
          </Section>

          <Section id="notifications" title={t('notif.title')}>
            <NotificationSettings />
          </Section>

          <Section
            id="subjects"
            title={t('settings.subjects')}
            action={
              <Button size="sm" variant="ghost" iconStart={<Plus size={14} />} onClick={() => setEditing('new')}>
                {t('settings.subjects.add')}
              </Button>
            }
          >
            {subjects && subjects.length === 0 && <p className="py-3 text-base text-text-3">{t('settings.subjects.empty')}</p>}
            <ul className="-mx-2">
              {subjects?.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="press flex h-12 w-full items-center gap-3 rounded-control px-2 text-start hover:bg-surface-2"
                  >
                    <span
                      className="inline-flex size-7 items-center justify-center rounded-control"
                      style={{ background: `color-mix(in oklab, ${subjectColor(s.color)} 16%, transparent)`, color: subjectColor(s.color) }}
                    >
                      <SubjectIcon name={s.icon} size={15} />
                    </span>
                    <span className="flex-1 truncate text-base text-text">{s.name}</span>
                    <ChevronRight size={16} className="flip-rtl text-text-3" />
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="account" title={t('settings.account')}>
            <p className="py-3 text-base text-text-2">
              {mode === 'cloud' ? t('settings.account.signedIn', { email: email ?? '' }) : t('settings.account.demo')}
            </p>
            <Row label={t('settings.export')} hint={t('settings.export.hint')}>
              <Button
                iconStart={<Download size={16} />}
                onClick={async () => {
                  await exportAllData();
                  toast(t('settings.export.done'), { tone: 'success' });
                }}
              >
                {t('settings.export')}
              </Button>
            </Row>
            <Row label={t('auth.signOut')}>
              <Button variant="ghost" iconStart={<LogOut size={16} className="flip-rtl" />} onClick={() => void signOut()}>
                {t('auth.signOut')}
              </Button>
            </Row>
            <Row label={t('settings.delete')} hint={t('settings.delete.hint')}>
              <Button variant="danger" iconStart={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                {t('c.delete')}
              </Button>
            </Row>
          </Section>
        </div>
        </div>
      </PageBody>

      <SubjectEditor
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
        subject={editing === 'new' ? null : editing}
        lastPosition={subjects?.at(-1)?.position ?? null}
      />

      <Dialog
        open={confirmDelete}
        onOpenChange={(v) => {
          setConfirmDelete(v);
          setTyped('');
        }}
        title={t('settings.delete.confirmTitle')}
        description={t('settings.delete.confirmBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('c.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={typed !== 'DELETE'}
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                const ok = await deleteAccount();
                setDeleting(false);
                toast(ok ? t('settings.delete.done') : t('auth.err.generic'), { tone: ok ? 'neutral' : 'danger' });
              }}
            >
              {t('c.delete')}
            </Button>
          </>
        }
      >
        <Field label={t('settings.delete.confirmType')}>
          {({ id }) => <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} dir="ltr" autoComplete="off" />}
        </Field>
      </Dialog>
    </>
  );
}

function Section({ id, title, hint, action, children }: { id: string; title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-[20px] border border-border bg-surface-1 px-5 pt-5 pb-1 md:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="font-display text-lg font-semibold text-text">
            {title}
          </h2>
          {hint && <p className="mt-0.5 text-sm text-text-3">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-2 divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base text-text">{label}</p>
        {hint && <p className="mt-0.5 text-sm text-text-3">{hint}</p>}
      </div>
      <div className="min-w-0 shrink-0">{children}</div>
    </div>
  );
}

/** Theme choice as small previews of each look, so the choice is visual, not verbal. */
function ThemeTiles({ value, onChange }: { value: 'dark' | 'light' | 'system'; onChange: (v: 'dark' | 'light' | 'system') => void }) {
  const t = useT();
  const opts = [
    { v: 'dark' as const, label: t('settings.theme.dark'), icon: <Moon size={13} />, frame: '#08101f', canvas: '#16233d', line: '#2a3a5c' },
    { v: 'light' as const, label: t('settings.theme.light'), icon: <Sun size={13} />, frame: '#e4e9f2', canvas: '#ffffff', line: '#d5dce8' },
    { v: 'system' as const, label: t('settings.theme.system'), icon: <Monitor size={13} />, frame: 'linear-gradient(135deg,#08101f 50%,#e4e9f2 50%)', canvas: 'linear-gradient(135deg,#16233d 50%,#fff 50%)', line: '#8794ae' },
  ];
  return (
    <div role="radiogroup" aria-label={t('settings.theme')} className="grid grid-cols-3 gap-2 sm:w-[360px]">
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            className={cn('press group flex flex-col gap-2 rounded-[14px] border p-1.5 text-start transition-colors', on ? 'border-accent' : 'border-border hover:border-border-strong')}
          >
            <span className="relative block h-14 overflow-hidden rounded-[10px]" style={{ background: o.frame }}>
              <span className="absolute inset-y-2 end-0 start-5 rounded-s-[7px]" style={{ background: o.canvas }}>
                <span className="absolute start-2 top-2 h-1.5 w-8 rounded-full" style={{ background: o.line }} />
                <span className="absolute start-2 top-5 h-1.5 w-5 rounded-full bg-accent" />
              </span>
            </span>
            <span className="flex items-center gap-1.5 px-1 pb-0.5 text-sm text-text-2">
              {o.icon}
              <span className="truncate">{o.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const ACCENTS: { v: Accent; dark: string; light: string }[] = [
  { v: 'gold', dark: '#f0b54a', light: '#e3a21a' },
  { v: 'pearl', dark: '#5fd0c5', light: '#0b7a72' },
  { v: 'coral', dark: '#ff9473', light: '#b4431f' },
  { v: 'iris', dark: '#a7b0ff', light: '#4652c9' },
];

function AccentPicker() {
  const t = useT();
  const accent = usePrefs((s) => s.accent);
  const theme = typeof document !== 'undefined' ? document.documentElement.dataset.theme : 'dark';
  return (
    <div role="radiogroup" aria-label={t('settings.accent')} className="flex gap-2">
      {ACCENTS.map((a) => {
        const on = accent === a.v;
        const label = t(`settings.accent.${a.v}`);
        return (
          <button
            key={a.v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => {
              setPrefs({ accent: a.v });
              playUi('tap');
            }}
            className="press relative inline-flex size-10 items-center justify-center rounded-full"
          >
            {on && <motion.span layoutId="accent-ring" className="absolute inset-0 rounded-full border-2" style={{ borderColor: theme === 'light' ? a.light : a.dark }} />}
            <span className="inline-flex size-7 items-center justify-center rounded-full" style={{ background: theme === 'light' ? a.light : a.dark }}>
              {on && <Check size={14} strokeWidth={3} className={theme === 'light' && a.v !== 'gold' ? 'text-white' : 'text-[#0e182b]'} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
