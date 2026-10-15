import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Local text state that saves after a pause and on blur/unmount.
 * Remote changes are adopted only while the field isn't being edited.
 */
export function useAutosave(remote: string, save: (v: string) => void | Promise<unknown>, delay = 500) {
  const [value, setValue] = useState(remote);
  const editing = useRef(false);
  const latest = useRef(remote);
  const saved = useRef(remote);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!editing.current && remote !== latest.current) {
      latest.current = remote;
      saved.current = remote;
      setValue(remote);
    }
  }, [remote]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (latest.current !== saved.current) {
      saved.current = latest.current;
      void saveRef.current(latest.current);
    }
  }, []);

  useEffect(() => flush, [flush]);

  const onChange = useCallback(
    (v: string) => {
      editing.current = true;
      latest.current = v;
      setValue(v);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  const onBlur = useCallback(() => {
    editing.current = false;
    flush();
  }, [flush]);

  return { value, onChange, onBlur, flush };
}
