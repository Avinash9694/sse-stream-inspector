import { GitHubIcon, LinkedInIcon } from './ui/icons';

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-muted">
      <span>
        Built by{' '}
        <a
          href="https://avinash9694.github.io"
          className="text-fg underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Avinash Sahu
        </a>
      </span>
      <span className="flex items-center gap-1">
        <a
          href="https://github.com/Avinash9694"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-panel-2 hover:text-fg"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub profile"
        >
          <GitHubIcon size={16} />
        </a>
        <a
          href="https://www.linkedin.com/in/A-v-i-n-a-s-h/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-panel-2 hover:text-fg"
          target="_blank"
          rel="noreferrer"
          aria-label="LinkedIn profile"
        >
          <LinkedInIcon size={16} />
        </a>
        <a
          href="https://github.com/Avinash9694/sse-stream-inspector"
          className="ml-1 hidden text-muted hover:text-fg sm:inline"
          target="_blank"
          rel="noreferrer"
        >
          Source
        </a>
      </span>
    </footer>
  );
}
