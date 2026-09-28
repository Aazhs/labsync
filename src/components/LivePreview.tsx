'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useIDEStore } from '@/lib/store';
import {
  RotateCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  X,
} from 'lucide-react';

interface LivePreviewProps {
  onClose?: () => void;
  isTabMode?: boolean;
}

export default function LivePreview({ onClose, isTabMode = false }: LivePreviewProps) {
  const { files, addOutput } = useIDEStore();
  const [key, setKey] = useState(0); // For manual reload
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Bundle HTML, CSS, and JS into single sandboxed document
  const previewDoc = useMemo(() => {
    const htmlFile =
      files.find((f) => f.name.endsWith('.html') || f.name.endsWith('.htm')) ||
      files.find((f) => f.isEntrypoint);

    const cssFiles = files.filter((f) => f.name.endsWith('.css'));
    const jsFiles = files.filter((f) => f.name.endsWith('.js') && !f.name.endsWith('.json'));

    let html = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><body><h1>No HTML file found</h1></body></html>';

    // Console logging hook to pipe logs back to IDE Output panel early
    const consoleHook = `
<script id="labsync-console-hook">
(function() {
  function forward(type, args) {
    try {
      var str = Array.prototype.slice.call(args).map(function(item) {
        if (typeof item === 'object') {
          try { return JSON.stringify(item); } catch(e) { return String(item); }
        }
        return String(item);
      }).join(' ');
      window.parent.postMessage({ source: 'labsync-preview', type: type, message: str }, '*');
    } catch(e) {}
  }
  var _log = console.log, _warn = console.warn, _error = console.error, _info = console.info;
  console.log = function() { _log.apply(console, arguments); forward('stdout', arguments); };
  console.info = function() { _info.apply(console, arguments); forward('stdout', arguments); };
  console.warn = function() { _warn.apply(console, arguments); forward('stderr', arguments); };
  console.error = function() { _error.apply(console, arguments); forward('stderr', arguments); };
  window.onerror = function(msg, url, line) {
    forward('stderr', ['Uncaught Error: ' + msg + (line ? ' (line ' + line + ')' : '')]);
  };
})();
</script>
`;

    // Inject console hook in <head> or at beginning so all script executions are captured
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n${consoleHook}`);
    } else {
      html = `${consoleHook}\n${html}`;
    }

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Replace linked stylesheet tags with inline style tags
    const handledCssIds = new Set<string>();
    for (const cssFile of cssFiles) {
      const linkRegex = new RegExp(
        `<link\\s+[^>]*href=["'](?:\\.\\/)?${escapeRegExp(cssFile.name)}["'][^>]*>`,
        'gi'
      );
      if (linkRegex.test(html)) {
        html = html.replace(linkRegex, `<style data-file="${cssFile.name}">\n${cssFile.content}\n</style>`);
        handledCssIds.add(cssFile.id);
      }
    }

    // Any remaining unlinked CSS gets injected into <head>
    const unlinkedCss = cssFiles.filter((f) => !handledCssIds.has(f.id));
    if (unlinkedCss.length > 0) {
      const combinedCss = unlinkedCss.map((f) => f.content).join('\n\n');
      const styleTag = `<style id="labsync-extra-styles">\n${combinedCss}\n</style>`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${styleTag}\n</head>`);
      } else {
        html = `${styleTag}\n${html}`;
      }
    }

    // Replace linked script tags with inline script tags
    const handledJsIds = new Set<string>();
    for (const jsFile of jsFiles) {
      const scriptRegex = new RegExp(
        `<script\\s+[^>]*src=["'](?:\\.\\/)?${escapeRegExp(jsFile.name)}["'][^>]*>\\s*<\\/script>`,
        'gi'
      );
      if (scriptRegex.test(html)) {
        html = html.replace(scriptRegex, `<script data-file="${jsFile.name}">\n${jsFile.content}\n</script>`);
        handledJsIds.add(jsFile.id);
      }
    }

    // Any remaining unlinked JS gets injected before </body> or at bottom
    const unlinkedJs = jsFiles.filter((f) => !handledJsIds.has(f.id));
    if (unlinkedJs.length > 0) {
      const combinedJs = unlinkedJs.map((f) => f.content).join('\n\n');
      const scriptTag = `<script id="labsync-extra-scripts">\n${combinedJs}\n</script>`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${scriptTag}\n</body>`);
      } else {
        html = `${html}\n${scriptTag}`;
      }
    }

    return html;
  }, [files]);

  // Listen for iframe console messages and pipe into output panel
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.source === 'labsync-preview') {
        addOutput({
          type: e.data.type === 'stderr' ? 'stderr' : 'stdout',
          content: `[Console] ${e.data.message}`,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addOutput]);

  const handleRefresh = () => {
    setKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    const blob = new Blob([previewDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const getViewportWidth = () => {
    if (viewport === 'mobile') return '375px';
    if (viewport === 'tablet') return '768px';
    return '100%';
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header Toolbar */}
      <div
        className="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px 0 14px',
          height: 36,
          minHeight: 36,
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent-success)',
              boxShadow: '0 0 6px var(--accent-success)',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Live Preview
          </span>
          <span
            className="badge badge-success"
            style={{ fontSize: 9, padding: '1px 5px', height: 16 }}
          >
            LIVE
          </span>
        </div>

        {/* Viewport & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Viewport switchers */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: 2,
              border: '1px solid var(--border)',
              marginRight: 4,
            }}
          >
            <button
              onClick={() => setViewport('desktop')}
              className={`btn-icon ${viewport === 'desktop' ? 'active' : ''}`}
              title="Desktop (100%)"
              style={{ width: 22, height: 22 }}
            >
              <Monitor size={12} />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              className={`btn-icon ${viewport === 'tablet' ? 'active' : ''}`}
              title="Tablet (768px)"
              style={{ width: 22, height: 22 }}
            >
              <Tablet size={12} />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              className={`btn-icon ${viewport === 'mobile' ? 'active' : ''}`}
              title="Mobile (375px)"
              style={{ width: 22, height: 22 }}
            >
              <Smartphone size={12} />
            </button>
          </div>

          <button
            className="btn-icon"
            onClick={handleRefresh}
            title="Refresh Preview"
            style={{ width: 26, height: 26 }}
          >
            <RotateCw size={13} />
          </button>

          <button
            className="btn-icon"
            onClick={handleOpenExternal}
            title="Open in new window"
            style={{ width: 26, height: 26 }}
          >
            <ExternalLink size={13} />
          </button>

          {onClose && !isTabMode && (
            <button
              className="btn-icon"
              onClick={onClose}
              title="Close Preview"
              style={{ width: 26, height: 26 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Frame Container */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: viewport !== 'desktop' ? '#070709' : 'transparent',
          padding: viewport !== 'desktop' ? '16px' : 0,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            width: getViewportWidth(),
            height: '100%',
            maxWidth: '100%',
            transition: 'width 0.2s ease',
            boxShadow:
              viewport !== 'desktop'
                ? '0 20px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                : 'none',
            borderRadius: viewport !== 'desktop' ? '8px' : 0,
            overflow: 'hidden',
            background: 'white',
          }}
        >
          <iframe
            ref={iframeRef}
            key={key}
            srcDoc={previewDoc}
            title="Live Web Preview"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#ffffff',
            }}
          />
        </div>
      </div>
    </div>
  );
}
