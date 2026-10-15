import { useState } from 'react';
import { Send } from 'lucide-react';
import { useT, useI18n } from '@/lib/i18n';
import { canUsePush, deviceSupport, disableDeviceNotifications, enableDeviceNotifications, showLocalNotification } from '@/lib/push';
import { Button, Switch, toast } from '@/components/ui';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { OffsetChips } from './OffsetChips';

export function NotificationSettings() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const settings = useSettings();
  const n = settings.notifications;
  const [busy, setBusy] = useState(false);
  const support = deviceSupport();
  // Tracked in state: the permission changes after the prompt without a re-render.
  const [permission, setPermission] = useState<NotificationPermission>(() => (support === 'supported' ? Notification.permission : 'default'));
  const denied = support === 'supported' && permission === 'denied';
  const set = (patch: Partial<typeof n>) => updateSettings({ notifications: { ...n, ...patch } });

  async function toggleDevice(on: boolean) {
    setBusy(true);
    try {
      if (!on) {
        await disableDeviceNotifications();
        await set({ push: false });
        return;
      }
      const res = await enableDeviceNotifications();
      if (res === 'denied') setPermission('denied');
      if (res === 'push' || res === 'local') {
        setPermission('granted');
        await set({ push: true });
        toast(t('notif.enabled'), { tone: 'success' });
      } else toast(res === 'denied' ? t('notif.denied') : t('notif.error'), { tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="py-4">
        <Switch checked={n.in_app} onCheckedChange={(v) => set({ in_app: v })} label={t('notif.inApp')} description={t('notif.inAppHint')} />
      </div>
      <div className="flex flex-col gap-3 py-4">
        <Switch
          checked={n.push && support === 'supported' && !denied}
          onCheckedChange={(v) => !busy && toggleDevice(v)}
          label={t('notif.device')}
          description={
            support === 'needs-install'
              ? t('notif.iosInstall')
              : support === 'unsupported'
                ? t('notif.unsupported')
                : denied
                  ? t('notif.denied')
                  : canUsePush()
                    ? t('notif.deviceHintPush')
                    : t('notif.deviceHintLocal')
          }
        />
        {n.push && support === 'supported' && !denied && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            iconStart={<Send size={14} className="flip-rtl" />}
            onClick={() => showLocalNotification(t('notif.testTitle'), { body: t('notif.testBody'), tag: 'mizan-test', lang, dir: lang === 'ar' ? 'rtl' : 'ltr' })}
          >
            {t('notif.test')}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3 py-4">
        <div>
          <p className="text-base text-text">{t('notif.defaults')}</p>
          <p className="mt-0.5 text-sm text-text-3">{t('notif.defaultsHint')}</p>
        </div>
        <OffsetChips value={n.offsets_min} onChange={(offsets_min) => set({ offsets_min })} label={t('notif.defaults')} />
      </div>
    </div>
  );
}
