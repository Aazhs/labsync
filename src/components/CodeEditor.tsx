'use client';

import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useIDEStore } from '@/lib/store';

interface CodeEditorProps {
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export default function CodeEditor({ readOnly = false, value, onChange }: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const { code, language, fontSize, setCode } = useIDEStore();

  const displayValue = value ?? code;

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
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

  // Map language names to Monaco language IDs
  const monacoLangMap: Record<string, string> = {
    python: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    javascript: 'javascript',
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Editor
        height="100%"
        language={monacoLangMap[language.name] || 'plaintext'}
        value={displayValue}
        onChange={handleChange}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          readOnly,
          fontSize,
          fontFamily: "'Geist Mono', 'Fira Code', 'JetBrains Mono', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
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
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },
        }}
      />
    </div>
  );
}
