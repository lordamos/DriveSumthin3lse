import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Drive Home - Rent-to-Own',
  description: 'High-integrity vehicle ownership platform',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // 1. Immediate suppression of the specific fetch error
            const suppressFetchError = function(err) {
              if (!err || !err.message) return false;
              const msg = err.message.toLowerCase();
              
              const isBenignFetchError = 
                msg.includes("cannot set property fetch") || 
                msg.includes("setting getter-only property \"fetch\"") ||
                msg.includes("readonly property 'fetch'") ||
                msg.includes("failed to fetch") ||
                msg.includes("aborted") ||
                msg.includes("abort") ||
                msg.includes("user aborted") ||
                msg.includes("error processing response text") ||
                msg.includes("fetch request failed");

              if (isBenignFetchError) {
                console.warn('[Defensive] Suppressed benign fetch/abort error:', err.message);
                return true;
              }
              return false;
            };

            window.addEventListener('error', function(e) {
              if (suppressFetchError(e.error)) {
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);

            window.addEventListener('unhandledrejection', function(e) {
              if (suppressFetchError(e.reason)) {
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);

            // 2. Redefine fetch with a safe setter
            const originalFetch = window.fetch;
            try {
              Object.defineProperty(window, 'fetch', {
                get: function() { return originalFetch; },
                set: function(v) { console.warn('[Defensive] Blocked fetch overwrite attempt.'); },
                configurable: true,
                enumerable: true
              });
            } catch (e) {
              console.warn('[Defensive] Could not redefine fetch, relying on error suppression.');
            }
          })();
        ` }} />
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
