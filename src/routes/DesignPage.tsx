import { useState, type CSSProperties, type ReactNode } from 'react';
import { BookOpen, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { SUBJECT_COLORS, subjectColor } from '@/design/tokens';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  ProgressBar,
  ProgressRing,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@/components/ui';
import { PageBody, PageHeader } from '@/app/shell/PageHeader';
import { CardTile } from '@/features/cards/CardTile';
import type { Card, Subject } from '@/types/database';

/**
 * Living reference for the design system. Switch language and theme (Cmd/Ctrl+K)
 * to check every component in RTL/LTR and dark/light.
 */
export function DesignPage() {
  const t = useT();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');

  const now = new Date();
  const subject: Subject = {
    id: 's',
    user_id: 'u',
    name: 'Physics',
    color: '#6F7DED',
    icon: 'atom',
    position: 'a0',
    archived_at: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  };
  const card = (over: Partial<Card>): Card => ({
    id: Math.random().toString(),
    user_id: 'u',
    board_id: 'b',
    column_id: 'c',
    subject_id: 's',
    title: 'Worksheet: motion graphs',
    description: '',
    notes: '',
    due_at: new Date(now.getTime() + 26 * 3600_000).toISOString(),
    due_has_time: true,
    priority: 'med',
    labels: [],
    is_exam: false,
    estimate_min: 45,
    repeat_rule: null,
    position: 'a0',
    completed_at: null,
    is_sample: false,
    reminder_offsets: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...over,
  });

  return (
    <>
      <PageHeader title={t('design.title')} meta="tokens · components · states" />
      <PageBody>
        <div className="flex flex-col gap-14">
          <Block title="Surfaces">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['bg', 'surface-1', 'surface-2', 'surface-3'].map((s) => (
                <Swatch key={s} name={`--${s}`} style={{ background: `var(--${s})` }} />
              ))}
            </div>
          </Block>

          <Block title="Text & accent">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {['text', 'text-2', 'text-3', 'accent', 'danger', 'warning', 'success'].map((s) => (
                <Swatch key={s} name={`--${s}`} style={{ background: `var(--${s})` }} />
              ))}
            </div>
          </Block>

          <Block title="Subject palette">
            <div className="flex flex-wrap gap-3">
              {SUBJECT_COLORS.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-card border border-border bg-surface-2 py-2 ps-2 pe-3">
                  <span className="size-6 rounded-chip" style={{ background: subjectColor(c.hex) }} />
                  <span className="text-sm text-text-2">{t(`color.${c.id}`)}</span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Type scale">
            <div className="flex flex-col gap-3">
              {(
                [
                  ['text-4xl', 48],
                  ['text-3xl', 36],
                  ['text-2xl', 28],
                  ['text-xl', 22],
                  ['text-lg', 18],
                  ['text-md', 16],
                  ['text-base', 14],
                  ['text-sm', 13],
                  ['text-xs', 12],
                ] as const
              ).map(([cls, px]) => (
                <div key={cls} className="flex items-baseline gap-4">
                  <span className="w-10 shrink-0 font-mono text-xs text-text-3 tabular">{px}</span>
                  <span className={`${cls} truncate text-text`}>{t('auth.title')}</span>
                </div>
              ))}
              <div className="flex items-baseline gap-4">
                <span className="w-10 shrink-0 font-mono text-xs text-text-3">96</span>
                <span className="font-mono text-clock font-light text-text tabular" dir="ltr">
                  24:59
                </span>
              </div>
            </div>
          </Block>

          <Block title="Buttons">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" iconStart={<Plus size={16} />}>
                {t('c.add')}
              </Button>
              <Button>{t('c.edit')}</Button>
              <Button variant="ghost">{t('c.cancel')}</Button>
              <Button variant="danger" iconStart={<Trash2 size={16} />}>
                {t('c.delete')}
              </Button>
              <Button variant="primary" loading>
                {t('c.save')}
              </Button>
              <Button disabled>{t('c.save')}</Button>
              <IconButton label={t('c.edit')} icon={<Pencil size={16} />} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm">sm 32</Button>
              <Button size="md">md 40</Button>
              <Button size="lg">lg 48</Button>
            </div>
          </Block>

          <Block title="Inputs">
            <div className="grid max-w-[720px] gap-4 sm:grid-cols-2">
              <Field label={t('auth.email')} hint={t('auth.demoHint')}>
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="name@example.com" dir="ltr" />}
              </Field>
              <Field label={t('auth.password')} error={t('auth.err.weak')}>
                {({ id, describedBy, invalid }) => <Input id={id} type="password" aria-describedby={describedBy} aria-invalid={invalid} defaultValue="1234" />}
              </Field>
              <Field label={t('onb.exam.subject')}>
                {({ id }) => (
                  <Select id={id}>
                    <option>{t('subject.preset.math')}</option>
                    <option>{t('subject.preset.physics')}</option>
                  </Select>
                )}
              </Field>
              <Field label={t('onb.exam.date')}>{({ id }) => <Input id={id} type="date" />}</Field>
              <Field label={t('c.optional')} className="sm:col-span-2">
                {({ id }) => <Textarea id={id} placeholder={t('onb.exam.placeholder')} />}
              </Field>
            </div>
          </Block>

          <Block title="Controls">
            <div className="flex max-w-[480px] flex-col gap-5">
              <Checkbox checked={checked} onCheckedChange={setChecked} label={t('onb.sample')} />
              <Switch checked={on} onCheckedChange={setOn} label={t('settings.calendar.showSecondary')} description="24 Rabiʻ II" />
              <Segmented
                label="view"
                value={seg}
                onValueChange={setSeg}
                options={[
                  { value: 'day', label: 'Day' },
                  { value: 'week', label: 'Week' },
                  { value: 'month', label: 'Month' },
                ]}
              />
              <Tabs defaultValue="a">
                <TabsList label="tabs">
                  <TabsTrigger value="a">{t('nav.board')}</TabsTrigger>
                  <TabsTrigger value="b">{t('nav.calendar')}</TabsTrigger>
                  <TabsTrigger value="c">{t('nav.stats')}</TabsTrigger>
                </TabsList>
                <TabsContent value="a" className="pt-3 text-base text-text-2">
                  {t('board.empty.body')}
                </TabsContent>
                <TabsContent value="b" className="pt-3 text-base text-text-2">
                  {t('soon.calendar.body')}
                </TabsContent>
                <TabsContent value="c" className="pt-3 text-base text-text-2">
                  {t('soon.stats.body')}
                </TabsContent>
              </Tabs>
            </div>
          </Block>

          <Block title="Badges, keys, progress">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Draft</Badge>
              <Badge tone="accent">{t('soon.phase')}</Badge>
              <Badge tone="warning">{t('c.today')}</Badge>
              <Badge tone="danger">{t('board.exam')}</Badge>
              <span className="flex gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
              <ProgressRing value={0.66} label="66%" size={48}>
                <span className="text-xs text-text-2 tabular">66%</span>
              </ProgressRing>
              <div className="w-40">
                <ProgressBar value={0.4} label="2/5" />
              </div>
            </div>
          </Block>

          <Block title="Cards">
            <div className="grid max-w-[1000px] gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CardTile card={card({})} subject={subject} done={false} />
              <CardTile card={card({ title: 'Unit 3 test', is_exam: true, priority: 'high', estimate_min: null })} subject={{ ...subject, color: '#B83E0A', name: 'Mathematics' }} done={false} />
              <CardTile card={card({ title: 'Read chapter 2', due_at: new Date(now.getTime() - 3600_000).toISOString(), priority: 'high' })} subject={{ ...subject, color: '#C77806', name: 'Arabic' }} done={false} />
            </div>
          </Block>

          <Block title="Overlays">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setDialog(true)}>Dialog</Button>
              <Button onClick={() => setSheet(true)}>Sheet</Button>
              <Menu>
                <MenuTrigger asChild>
                  <Button iconEnd={<MoreHorizontal size={16} />}>Menu</Button>
                </MenuTrigger>
                <MenuContent align="start">
                  <MenuItem icon={<Pencil size={15} />} shortcut="E">
                    {t('c.edit')}
                  </MenuItem>
                  <MenuItem icon={<Copy size={15} />}>Duplicate</MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 size={15} />} danger>
                    {t('c.delete')}
                  </MenuItem>
                </MenuContent>
              </Menu>
              <Button onClick={() => toast(t('settings.saved'), { tone: 'success' })}>Toast</Button>
              <Button onClick={() => toast(t('board.samplesRemoved'), { action: { label: t('c.undo'), onClick: () => {} } })}>Toast + action</Button>
              <Button onClick={() => toast(t('auth.err.generic'), { tone: 'danger' })}>Error toast</Button>
            </div>
          </Block>

          <Block title="States">
            <div className="grid gap-10 lg:grid-cols-3">
              <EmptyState icon={<BookOpen size={20} />} title={t('board.empty.title')} body={t('board.empty.body')} action={<Button variant="primary">{t('c.add')}</Button>} />
              <ErrorState onRetry={() => {}} />
              <div className="flex flex-col gap-2" aria-busy="true">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-[72px]" />
                <Skeleton className="h-[72px]" />
              </div>
            </div>
          </Block>

          <Block title="Motion">
            <table className="w-full max-w-[560px] text-start text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ['--dur-fast', '120ms', 'hover, press'],
                  ['--dur-base', '180ms', 'popovers, toggles'],
                  ['--dur-slow', '240ms', 'dialogs, progress'],
                  ['--dur-sheet', '300ms', 'side panels, bottom sheets'],
                  ['--motion-standard', 'cubic-bezier(0.2, 0, 0, 1)', 'default'],
                  ['--motion-emphasized', 'cubic-bezier(0.05, 0.7, 0.1, 1)', 'entering layers'],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="py-2 pe-4 font-mono text-text">{a}</td>
                    <td className="py-2 pe-4 font-mono text-text-2" dir="ltr">
                      {b}
                    </td>
                    <td className="py-2 text-text-3">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>
        </div>
      </PageBody>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title={t('settings.delete.confirmTitle')}
        description={t('settings.delete.confirmBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              {t('c.cancel')}
            </Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              {t('c.delete')}
            </Button>
          </>
        }
      />
      <Sheet
        open={sheet}
        onOpenChange={setSheet}
        title="Worksheet: motion graphs"
        description={t('subject.preset.physics')}
        footer={
          <Button variant="primary" onClick={() => setSheet(false)}>
            {t('c.done')}
          </Button>
        }
      >
        <p className="text-base text-text-2">{t('board.empty.body')}</p>
      </Sheet>
    </>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 border-b border-border pb-2 text-sm font-medium text-text-3" dir="ltr">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ name, style }: { name: string; style: CSSProperties }) {
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <div className="h-14" style={style} />
      <div className="bg-surface-2 px-2.5 py-2 font-mono text-xs text-text-2" dir="ltr">
        {name}
      </div>
    </div>
  );
}
