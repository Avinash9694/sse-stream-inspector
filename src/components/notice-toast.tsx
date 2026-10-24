import { useEffect } from 'react';
import { useInspector } from '@/app/store';
import { Button } from './ui/button';
import { CloseIcon } from './ui/icons';

export function NoticeToast() {
  const notice = useInspector((s) => s.notice);
  const dismiss = useInspector((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismiss, notice.tone === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [notice, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-3"
    >
      {notice && (
        <div
          className={`card pointer-events-auto flex max-w-md items-center gap-2 px-3 py-2 text-sm ${
            notice.tone === 'error'
              ? 'border-error/50'
              : notice.tone === 'success'
                ? 'border-ok/50'
                : ''
          }`}
        >
          <span
            className={
              notice.tone === 'error'
                ? 'text-error'
                : notice.tone === 'success'
                  ? 'text-ok'
                  : 'text-fg'
            }
          >
            {notice.text}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={dismiss}
            aria-label="Dismiss notification"
            className="h-8 w-8"
          >
            <CloseIcon size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
