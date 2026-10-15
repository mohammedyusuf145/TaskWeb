/**
 * Row types shared by the local database (IndexedDB) and Postgres.
 * Column names are snake_case so rows round-trip without mapping.
 * Keep in sync with supabase/migrations.
 */

export type ISODate = string;
export type UUID = string;

/** Columns every synced row carries. */
export interface BaseRow {
  id: UUID;
  user_id: UUID;
  created_at: ISODate;
  /** Time of the user's edit; decides last-write-wins. */
  updated_at: ISODate;
  /** Soft delete: tombstones sync like any other change. */
  deleted_at: ISODate | null;
}

export type Priority = 'low' | 'med' | 'high';
export type ThemePref = 'dark' | 'light' | 'system';

export interface Profile extends BaseRow {
  display_name: string;
  onboarded_at: ISODate | null;
}

export interface Settings extends BaseRow {
  language: 'ar' | 'en';
  theme: ThemePref;
  week_start: 0 | 1 | 6;
  calendar_primary: 'gregorian' | 'hijri';
  calendar_show_secondary: boolean;
  notifications: { push: boolean; in_app: boolean; offsets_min: number[] };
  /** IANA zone, so the server can place date-only reminders at 08:00 local. */
  timezone: string;
  timer_defaults: Record<string, unknown>;
}

export interface Subject extends BaseRow {
  name: string;
  color: string;
  icon: string;
  position: string;
  archived_at: ISODate | null;
}

export interface Board extends BaseRow {
  name: string;
  position: string;
  archived_at: ISODate | null;
}

export type ColumnKind = 'todo' | 'doing' | 'done' | null;

export interface Column extends BaseRow {
  board_id: UUID;
  name: string;
  color: string | null;
  kind: ColumnKind;
  position: string;
}

export interface RepeatRule {
  freq: 'daily' | 'weekly' | 'custom';
  interval: number;
  weekdays?: number[];
  until?: ISODate | null;
}

export interface Card extends BaseRow {
  board_id: UUID;
  column_id: UUID;
  subject_id: UUID | null;
  title: string;
  description: string;
  notes: string;
  due_at: ISODate | null;
  due_has_time: boolean;
  priority: Priority;
  labels: string[];
  is_exam: boolean;
  estimate_min: number | null;
  repeat_rule: RepeatRule | null;
  position: string;
  completed_at: ISODate | null;
  is_sample: boolean;
  /** Minutes before due. null = use the defaults in settings, [] = no reminders. */
  reminder_offsets: number[] | null;
}

export interface ChecklistItem extends BaseRow {
  card_id: UUID;
  text: string;
  done: boolean;
  position: string;
}

export interface Attachment extends BaseRow {
  card_id: UUID;
  storage_path: string;
  name: string;
  mime: string;
  size_bytes: number;
}

export interface FocusSession extends BaseRow {
  subject_id: UUID | null;
  card_id: UUID | null;
  kind: 'focus' | 'short_break' | 'long_break' | 'open';
  started_at: ISODate;
  ended_at: ISODate;
  planned_sec: number | null;
  focused_sec: number;
  completed: boolean;
}

export interface TimerStateRow extends BaseRow {
  state: Record<string, unknown>;
}

export interface ChatThread extends BaseRow {
  subject_id: UUID | null;
  title: string;
  last_message_at: ISODate | null;
}

export interface ChatMessage extends BaseRow {
  thread_id: UUID;
  role: 'user' | 'assistant';
  content: unknown;
}

export interface Flashcard extends BaseRow {
  subject_id: UUID | null;
  front: string;
  back: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: ISODate;
}

/** Per-subject accuracy on a topic: the tutor's quizzes feed this to find weak spots. */
export interface StudyTopic extends BaseRow {
  subject_id: UUID | null;
  topic: string;
  attempts: number;
  correct: number;
  last_seen_at: ISODate | null;
}

export interface TableMap {
  profiles: Profile;
  settings: Settings;
  subjects: Subject;
  boards: Board;
  columns: Column;
  cards: Card;
  checklist_items: ChecklistItem;
  attachments: Attachment;
  focus_sessions: FocusSession;
  timer_state: TimerStateRow;
  chat_threads: ChatThread;
  chat_messages: ChatMessage;
  flashcards: Flashcard;
  study_topics: StudyTopic;
}

export type TableName = keyof TableMap;

export const SYNCED_TABLES: TableName[] = [
  'profiles',
  'settings',
  'subjects',
  'boards',
  'columns',
  'cards',
  'checklist_items',
  'attachments',
  'focus_sessions',
  'timer_state',
  'chat_threads',
  'chat_messages',
  'flashcards',
  'study_topics',
];
