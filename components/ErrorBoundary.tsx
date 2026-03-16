'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = error.message.toLowerCase();
    const isBenign = 
      msg.includes("aborted") || 
      msg.includes("abort") || 
      msg.includes("failed to fetch") ||
      msg.includes("error processing response text") ||
      msg.includes("fetch request failed");

    if (isBenign) {
      console.warn('[ErrorBoundary] Ignoring benign error:', error.message);
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">System Interruption</h1>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              The application encountered an unexpected error. This might be due to a transient network issue or a platform-level interruption.
            </p>
            <div className="bg-black/40 rounded-xl p-4 mb-8 text-left overflow-hidden">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Error Details</p>
              <p className="text-xs font-mono text-red-400 break-words line-clamp-3">
                {(() => {
                  try {
                    const parsed = JSON.parse(this.state.error?.message || '');
                    return parsed.displayMessage || parsed.error || 'Unknown error occurred';
                  } catch (e) {
                    return this.state.error?.message || 'Unknown error occurred';
                  }
                })()}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all"
            >
              <RefreshCw size={20} />
              RELOAD SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
