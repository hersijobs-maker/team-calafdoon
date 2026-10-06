import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches any render crash so the app shows a retry screen instead of
// staying a blank white screen inside the Android APK.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('App crashed:', error);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || 'Khalad aan la filayn';
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.5h.01M10.29 3.4 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.4a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-1">Khalad ayaa dhacay</h1>
        <p className="text-sm text-slate-500 mb-2">Codsiga wuu joojiyay shaqadiisa.</p>
        <p className="text-xs text-slate-400 mb-6 break-words max-w-sm">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={this.reload}
            className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Dib u soo gal
          </button>
          <button
            onClick={this.reset}
            className="bg-slate-100 text-slate-700 font-semibold px-6 py-3 rounded-xl active:scale-95 transition-transform"
          >
            Isku day mar kale
          </button>
        </div>
      </div>
    );
  }
}
