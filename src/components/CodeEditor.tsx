'use client';

import { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useIDEStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { checkSyntax, parseCompilerErrors, SyntaxProblem } from '@/lib/syntaxChecker';

interface CodeEditorProps {
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export default function CodeEditor({ readOnly = false, value, onChange }: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const vimStatusRef = useRef<HTMLDivElement>(null);
  
  const {
    code,
    language,
    fontSize,
    lastResult,
    targetPosition,
    files,
    activeFileId,
    vimModeEnabled,
    setCode,
    setSyntaxProblems,
    setTargetPosition,
  } = useIDEStore();

  const activeFile = files.find((f) => f.id === activeFileId);
  const activeLanguageName = activeFile?.language || language.name;

  const { theme } = useTheme();

  const displayValue = value ?? code;

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Enable diagnostic options for JavaScript
    if (monaco.languages?.typescript?.javascriptDefaults) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }

    // Handle gutter click: jump to error and open problems tab
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) {
          editor.setPosition({ lineNumber: line, column: 1 });
          useIDEStore.getState().setActiveOutputTab('problems');
          if (!useIDEStore.getState().showOutput) {
            useIDEStore.getState().toggleOutput();
          }
        }
      }
    });

    // Keybinding: Cmd+Enter / Ctrl+Enter to execute code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      window.dispatchEvent(new CustomEvent('labsync:run'));
    });

    // Keybinding: Cmd+B / Ctrl+B to toggle File Explorer
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      useIDEStore.getState().toggleExplorer();
    });

    // Keybinding: Cmd+J / Ctrl+J to toggle Terminal Panel
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      useIDEStore.getState().toggleOutput();
    });

    // Keybinding: Cmd+M / Ctrl+M to toggle Audio Feedback
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyM, () => {
      useIDEStore.getState().toggleSound();
    });

    // Keybinding: Cmd+S / Ctrl+S to save / quick run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      window.dispatchEvent(new CustomEvent('labsync:save'));
    });

    editor.focus();
  }, []);

  const handleChange = useCallback((val: string | undefined) => {
    const newVal = val || '';
    if (onChange) {
      onChange(newVal);
    } else {
      setCode(newVal);
    }
  }, [onChange, setCode]);

  // Handle external jump-to-position requests (e.g. from Problems tab)
  useEffect(() => {
    if (targetPosition && editorRef.current) {
      const line = targetPosition.line;
      const col = targetPosition.column || 1;
      
      editorRef.current.revealPositionInCenter({ lineNumber: line, column: col });
      editorRef.current.setPosition({ lineNumber: line, column: col });
      editorRef.current.focus();
      
      setTargetPosition(null);
    }
  }, [targetPosition, setTargetPosition]);

  // Vim Mode Integration
  useEffect(() => {
    let isCancelled = false;

    if (!vimModeEnabled) {
      if (vimModeRef.current) {
        try {
          vimModeRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing vim mode:', e);
        }
        vimModeRef.current = null;
      }
      return;
    }

    const initVim = async () => {
      if (!editorRef.current || !vimStatusRef.current) return;
      try {
        const { initVimMode } = await import('monaco-vim');
        if (isCancelled) return;
        if (vimModeRef.current) {
          vimModeRef.current.dispose();
        }
        vimModeRef.current = initVimMode(editorRef.current, vimStatusRef.current);
      } catch (err) {
        console.error('Failed to initialize Vim mode:', err);
      }
    };

    const timer = setTimeout(() => {
      initVim();
    }, 50);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (vimModeRef.current) {
        try {
          vimModeRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing vim mode on unmount:', e);
        }
        vimModeRef.current = null;
      }
    };
  }, [vimModeEnabled]);

  // Live Syntax Checking Engine & Gutter Warnings
  useEffect(() => {
    if (readOnly) return;

    const timer = setTimeout(() => {
      if (!editorRef.current || !monacoRef.current) return;
      const model = editorRef.current.getModel();
      if (!model) return;

      // 1. Run real-time client-side syntax checking
      const liveProblems = checkSyntax(displayValue, activeLanguageName);

      // 2. Parse any compiler errors from the last execution
      let compilerProblems: SyntaxProblem[] = [];
      if (lastResult?.compile_output || lastResult?.stderr) {
        compilerProblems = parseCompilerErrors(
          lastResult.stderr,
          lastResult.compile_output,
          activeLanguageName
        );
      }

      // 3. Combine problems, deduplicating matching lines
      const combinedMap = new Map<string, SyntaxProblem>();
      for (const p of liveProblems) {
        combinedMap.set(`${p.line}:${p.column}:${p.category}`, p);
      }
      for (const p of compilerProblems) {
        const key = `${p.line}:${p.column}:${p.category}`;
        if (!combinedMap.has(key)) {
          combinedMap.set(key, p);
        }
      }
      const allProblems = Array.from(combinedMap.values()).sort((a, b) => a.line - b.line);

      // Update Zustand Store for Problems Panel & Status Bar
      setSyntaxProblems(allProblems);

      // 4. Set Monaco Markers (Red Squiggly Underlines)
      const lineCount = model.getLineCount();
      const markers: MonacoEditor.IMarkerData[] = allProblems.map((p) => {
        const validLine = Math.max(1, Math.min(p.line, lineCount));
        const maxCol = model.getLineMaxColumn(validLine);
        const startCol = Math.max(1, Math.min(p.column, maxCol));
        const endLine = Math.max(1, Math.min(p.endLine || p.line, lineCount));
        const endCol = Math.max(startCol + 1, Math.min(p.endColumn || maxCol, maxCol));

        return {
          severity:
            p.severity === 'warning'
              ? monacoRef.current!.MarkerSeverity.Warning
              : monacoRef.current!.MarkerSeverity.Error,
          message: `${p.message}${p.suggestion ? `\n\n💡 Fix: ${p.suggestion}` : ''}`,
          startLineNumber: validLine,
          startColumn: startCol,
          endLineNumber: endLine,
          endColumn: endCol,
        };
      });

      monacoRef.current.editor.setModelMarkers(model, 'labsync-syntax', markers);

      // 5. Set Gutter Glyph Decorations & Line Highlights
      const decorations = allProblems.map((p) => {
        const validLine = Math.max(1, Math.min(p.line, lineCount));
        const isWarn = p.severity === 'warning';

        return {
          range: new monacoRef.current!.Range(validLine, 1, validLine, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: isWarn
              ? 'monaco-gutter-syntax-warning'
              : 'monaco-gutter-syntax-error',
            glyphMarginHoverMessage: {
              value: `**${isWarn ? '⚠️ Warning' : '❌ Syntax Error'}** (${p.category}):\n\n${p.message}${p.suggestion ? `\n\n💡 *Fix:* ${p.suggestion}` : ''}`,
            },
            className: isWarn ? 'monaco-line-syntax-warning' : 'monaco-line-syntax-error',
            overviewRuler: {
              color: isWarn ? 'rgba(212, 148, 58, 0.8)' : 'rgba(224, 74, 59, 0.8)',
              position: monacoRef.current!.editor.OverviewRulerLane.Right,
            },
          },
        };
      });

      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        decorations
      );
    }, 200);

    return () => clearTimeout(timer);
  }, [displayValue, activeLanguageName, lastResult, readOnly, setSyntaxProblems]);

  // Clean up decorations on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && decorationsRef.current.length > 0) {
        editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, []);

  // Map language names to Monaco language IDs
  const monacoLangMap: Record<string, string> = {
    python: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    javascript: 'javascript',
    typescript: 'typescript',
    json: 'json',
    markdown: 'markdown',
    html: 'html',
    css: 'css',
    plaintext: 'plaintext',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height="100%"
          language={monacoLangMap[activeLanguageName] || 'plaintext'}
          value={displayValue}
          onChange={handleChange}
          onMount={handleMount}
          theme={theme === 'light' ? 'vs' : 'vs-dark'}
          options={{
            readOnly,
            fontSize,
            fontFamily: "'Geist Mono', 'Fira Code', 'JetBrains Mono', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            glyphMargin: true,
            lineDecorationsWidth: 10,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            bracketPairColorization: { enabled: true },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            guides: {
              indentation: true,
              bracketPairs: true,
            },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: false,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
              useShadows: false,
            },
          }}
        />
      </div>
      {vimModeEnabled && (
        <div
          ref={vimStatusRef}
          id="monaco-vim-status-node"
          className="monaco-vim-status-bar"
        />
      )}
    </div>
  );
}
