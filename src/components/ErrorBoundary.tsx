import { Component, type ErrorInfo, type ReactNode } from 'react';
import { downloadJson, exportAll } from '../storage/backup';
import { GameButton, Panel } from './ui';

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen never blanks the app; offers a way out and a backup. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Navigating elsewhere clears the error.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="space-y-4 pt-6">
        <Panel tone="night" title="Oops, a misdeal">
          <p className="font-bold">Something went wrong on this screen. Your progress is saved on this device.</p>
          <p className="mt-2 rounded-lg bg-ink/60 px-2 py-1 font-mono text-[11px] text-gold-300">{this.state.error.message}</p>
        </Panel>
        <div className="grid grid-cols-2 gap-3">
          <GameButton color="gold" onClick={() => this.setState({ error: null })}>
            Try again
          </GameButton>
          <GameButton
            color="cream"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go home
          </GameButton>
        </div>
        <GameButton
          color="blue"
          size="sm"
          fullWidth
          onClick={async () => downloadJson(await exportAll(), `felt-academy-backup-${new Date().toISOString().slice(0, 10)}.json`)}
        >
          Download a backup of my data
        </GameButton>
      </div>
    );
  }
}
