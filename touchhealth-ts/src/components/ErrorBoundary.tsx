// ════════════════════════════════════════════════════════════
// REMOTECARE · src/components/ErrorBoundary.tsx
// Top-level crash guard.
//
// On a clinic tablet, an unhandled render error must NOT leave a
// blank white screen — staff have no devtools to diagnose it. This
// boundary catches render-time errors, reports them through the
// logger (which can forward to Sentry once wired), and shows a
// recovery screen with a Reload button.
// ════════════════════════════════════════════════════════════

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Uncaught render error', error, info.componentStack);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#132b31', padding: 24,
      }}>
        <div style={{
          maxWidth: 420, textAlign: 'center',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#fff',
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 4 }}>
            The app hit an unexpected error. Your saved data is safe on this device.
          </div>
          <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 20, wordBreak: 'break-word' }}>
            {this.state.message}
          </div>
          <button
            onClick={this.handleReload}
            style={{
              background: '#10b981', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
