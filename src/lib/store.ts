import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SyntaxProblem } from './syntaxChecker';

export type Language = {
  id: number;
  name: string;
  label: string;
  defaultCode: string;
};

export const LANGUAGES: Language[] = [
  {
    id: 71,
    name: 'python',
    label: 'Python 3',
    defaultCode: '# Welcome to LabSync IDE\n# Write your Python code here\n\ndef main():\n    print("Hello, LabSync!")\n',
  },
  {
    id: 100,
    name: 'web',
    label: 'Web Dev (HTML/CSS/JS)',
    defaultCode: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LabSync Web Lab</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <h1>Hello, World!</h1>
    <p>Welcome to LabSync Web Lab.</p>
    <button id="counter-btn">Clicks: 0</button>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
  },
  {
    id: 62,
    name: 'java',
    label: 'Java',
    defaultCode: '// Welcome to LabSync IDE\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, LabSync!");\n    }\n}\n',
  },
  {
    id: 54,
    name: 'cpp',
    label: 'C++',
    defaultCode: '// Welcome to LabSync IDE\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, LabSync!" << endl;\n    return 0;\n}\n',
  },
  {
    id: 50,
    name: 'c',
    label: 'C',
    defaultCode: '// Welcome to LabSync IDE\n#include <stdio.h>\n\nint main() {\n    printf("Hello, LabSync!\\n");\n    return 0;\n}\n',
  },
  {
    id: 63,
    name: 'javascript',
    label: 'JavaScript (Node.js)',
    defaultCode: '// Welcome to LabSync IDE\n\nfunction main() {\n    console.log("Hello, LabSync!");\n}\n\nmain();\n',
  },
];

export type ProjectFile = {
  id: string;
  name: string;
  content: string;
  language: string;
  isEntrypoint?: boolean;
};

export function getFileLanguage(filename: string): string {
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'html';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.cpp') || filename.endsWith('.cc') || filename.endsWith('.cxx')) return 'cpp';
  if (filename.endsWith('.c') || filename.endsWith('.h')) return 'c';
  if (filename.endsWith('.java')) return 'java';
  if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.mjs')) return 'javascript';
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.md')) return 'markdown';
  return 'plaintext';
}

export function getDefaultFiles(lang: Language): ProjectFile[] {
  if (lang.name === 'web') {
    return [
      {
        id: 'file-html',
        name: 'index.html',
        content: lang.defaultCode,
        language: 'html',
        isEntrypoint: true,
      },
      {
        id: 'file-css',
        name: 'style.css',
        content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0d0d11;
  color: #e8e4de;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  background: #16161d;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 28px;
  text-align: center;
  max-width: 360px;
  width: 100%;
}

h1 {
  font-size: 20px;
  margin-bottom: 8px;
}

p {
  color: #8a847a;
  font-size: 13px;
  margin-bottom: 20px;
}

button {
  background: #d4943a;
  color: #080808;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

button:hover {
  background: #e8a838;
}
`,
        language: 'css',
      },
      {
        id: 'file-js',
        name: 'script.js',
        content: `let count = 0;
const btn = document.getElementById('counter-btn');

if (btn) {
  btn.addEventListener('click', () => {
    count++;
    btn.textContent = \`Clicks: \${count}\`;
    console.log(\`Button clicked: \${count}\`);
  });
}

console.log('Web preview ready!');
`,
        language: 'javascript',
      },
    ];
  }

  // Standard clean single-file for Python, C++, Java, C, Node (no extra utils)
  const extMap: Record<string, string> = {
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    javascript: 'js',
  };

  const ext = extMap[lang.name] || 'txt';
  const mainName = lang.name === 'java' ? 'Main.java' : `main.${ext}`;

  return [
    {
      id: 'file-main',
      name: mainName,
      content: lang.defaultCode,
      language: lang.name,
      isEntrypoint: true,
    },
  ];
}

export type ExecutionResult = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
  classification?: {
    tier: 'syntax' | 'logic' | 'conceptual' | 'none';
    category: string;
    confidence: number;
    message: string;
    suggestion: string;
    line?: number;
  };
};

export type OutputLine = {
  type: 'stdout' | 'stderr' | 'system' | 'success' | 'error' | 'stdin';
  content: string;
  timestamp: number;
};

export type OutputTab = 'terminal' | 'problems' | 'output';

export type HintMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type SessionMode = 'follow' | 'practice';

interface IDEStore {
  // Editor state
  code: string;
  language: Language;
  fontSize: number;
  
  // File Explorer & Workspace
  showExplorer: boolean;
  files: ProjectFile[];
  activeFileId: string;
  openFileIds: string[];

  // Live Web Preview
  showLivePreview: boolean;

  // Syntax errors & Live checking
  syntaxProblems: SyntaxProblem[];
  targetPosition: { line: number; column?: number } | null;

  // Execution & Terminal
  isRunning: boolean;
  output: OutputLine[];
  lastResult: ExecutionResult | null;
  isWaitingForInput: boolean;

  // Stdin & Interactive Terminal
  stdin: string;
  terminalInputValue: string;
  terminalHistory: string[];
  
  // Panels
  showOutput: boolean;
  showHintPanel: boolean;
  showReferencePane: boolean;
  activeOutputTab: OutputTab;
  
  // Session & Professor Broadcast
  sessionMode: SessionMode;
  referenceCode: string;
  broadcastEnabled: boolean;
  
  // AI Hints
  hintMessages: HintMessage[];
  isHintLoading: boolean;

  // Audio Feedback
  soundEnabled: boolean;

  // Vim Mode
  vimModeEnabled: boolean;

  // Actions
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  toggleVimMode: () => void;
  setVimModeEnabled: (enabled: boolean) => void;
  setCode: (code: string) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
  setSyntaxProblems: (problems: SyntaxProblem[]) => void;
  setTargetPosition: (pos: { line: number; column?: number } | null) => void;
  setIsRunning: (running: boolean) => void;
  addOutput: (line: OutputLine) => void;
  clearOutput: () => void;
  setLastResult: (result: ExecutionResult | null) => void;
  setIsWaitingForInput: (waiting: boolean) => void;
  setStdin: (stdin: string) => void;
  setTerminalInputValue: (val: string) => void;
  pushTerminalHistory: (cmd: string) => void;
  toggleOutput: () => void;
  toggleHintPanel: () => void;
  toggleReferencePane: () => void;
  setShowReferencePane: (show: boolean) => void;
  toggleExplorer: () => void;
  setShowExplorer: (show: boolean) => void;
  toggleLivePreview: () => void;
  setShowLivePreview: (show: boolean) => void;
  setActiveFile: (id: string) => void;
  openFileTab: (id: string) => void;
  closeFileTab: (id: string) => void;
  createFile: (name: string, content?: string) => string;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  setActiveOutputTab: (tab: OutputTab) => void;
  setSessionMode: (mode: SessionMode) => void;
  setReferenceCode: (code: string) => void;
  setBroadcastEnabled: (enabled: boolean) => void;
  addHintMessage: (msg: HintMessage) => void;
  clearHints: () => void;
  setIsHintLoading: (loading: boolean) => void;
  resetToTemplate: () => void;
}

const initialFiles = getDefaultFiles(LANGUAGES[0]);

const safeLocalStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(name, value);
    } catch {}
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(name);
    } catch {}
  },
};

export const useIDEStore = create<IDEStore>()(
  persist(
    (set, get) => ({
  // Editor state
  code: LANGUAGES[0].defaultCode,
  language: LANGUAGES[0],
  fontSize: 14,

  // File Explorer & Workspace
  showExplorer: true,
  files: initialFiles,
  activeFileId: initialFiles[0].id,
  openFileIds: [initialFiles[0].id],

  // Live Web Preview
  showLivePreview: false,
  
  // Syntax errors
  syntaxProblems: [],
  targetPosition: null,

  // Execution
  isRunning: false,
  output: [],
  lastResult: null,
  isWaitingForInput: false,
  
  // Stdin & Interactive Terminal
  stdin: '',
  terminalInputValue: '',
  terminalHistory: [],
  
  // Panels
  showOutput: true,
  showHintPanel: false,
  showReferencePane: false,
  activeOutputTab: 'output',
  
  // Session & Professor Broadcast
  sessionMode: 'practice',
  referenceCode: '',
  broadcastEnabled: true,
  
  // AI Hints
  hintMessages: [],
  isHintLoading: false,

  // Audio Feedback
  soundEnabled: true,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  
  // Vim Mode
  vimModeEnabled: false,
  toggleVimMode: () => set((s) => ({ vimModeEnabled: !s.vimModeEnabled })),
  setVimModeEnabled: (vimModeEnabled) => set({ vimModeEnabled }),
  
  // Actions
  setCode: (code) =>
    set((state) => ({
      code,
      files: state.files.map((f) =>
        f.id === state.activeFileId ? { ...f, content: code } : f
      ),
    })),
  setLanguage: (language) => {
    const newFiles = getDefaultFiles(language);
    const isWeb = language.name === 'web';
    set({
      language,
      files: newFiles,
      activeFileId: newFiles[0].id,
      openFileIds: isWeb
        ? newFiles.map((f) => f.id)
        : [newFiles[0].id],
      code: newFiles[0].content,
      showLivePreview: false,
      activeOutputTab: 'output',
      syntaxProblems: [],
      targetPosition: null,
    });
  },
  setFontSize: (fontSize) => set({ fontSize }),
  setSyntaxProblems: (syntaxProblems) => set({ syntaxProblems }),
  setTargetPosition: (targetPosition) => set({ targetPosition }),
  setIsRunning: (isRunning) => set({ isRunning }),
  addOutput: (line) => set((s) => ({ output: [...s.output, line] })),
  clearOutput: () => set({ output: [], lastResult: null, stdin: '', isWaitingForInput: false }),
  setLastResult: (lastResult) => set({ lastResult }),
  setIsWaitingForInput: (isWaitingForInput) => set({ isWaitingForInput }),
  setStdin: (stdin) => set({ stdin }),
  setTerminalInputValue: (terminalInputValue) => set({ terminalInputValue }),
  pushTerminalHistory: (cmd) =>
    set((state) => {
      const trimmed = cmd.trim();
      if (!trimmed) return state;
      const history = state.terminalHistory.filter((c) => c !== trimmed);
      return { terminalHistory: [...history, trimmed] };
    }),
  toggleOutput: () => set((s) => ({ showOutput: !s.showOutput })),
  toggleHintPanel: () => set((s) => ({ showHintPanel: !s.showHintPanel })),
  toggleReferencePane: () => set((s) => ({ showReferencePane: !s.showReferencePane })),
  setShowReferencePane: (showReferencePane) => set({ showReferencePane }),
  toggleExplorer: () => set((s) => ({ showExplorer: !s.showExplorer })),
  setShowExplorer: (showExplorer) => set({ showExplorer }),
  toggleLivePreview: () => set((s) => ({ showLivePreview: !s.showLivePreview })),
  setShowLivePreview: (showLivePreview) => set({ showLivePreview }),
  setActiveFile: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id);
      if (!file) return state;
      const openFileIds = state.openFileIds.includes(id)
        ? state.openFileIds
        : [...state.openFileIds, id];
      return {
        activeFileId: id,
        openFileIds,
        code: file.content,
      };
    }),
  openFileTab: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id);
      if (!file) return state;
      return {
        activeFileId: id,
        openFileIds: state.openFileIds.includes(id)
          ? state.openFileIds
          : [...state.openFileIds, id],
        code: file.content,
      };
    }),
  closeFileTab: (id) =>
    set((state) => {
      if (state.openFileIds.length <= 1) return state;
      const newOpenIds = state.openFileIds.filter((tabId) => tabId !== id);
      let newActiveId = state.activeFileId;
      let newCode = state.code;
      if (state.activeFileId === id) {
        newActiveId = newOpenIds[newOpenIds.length - 1];
        const nextFile = state.files.find((f) => f.id === newActiveId);
        if (nextFile) newCode = nextFile.content;
      }
      return {
        openFileIds: newOpenIds,
        activeFileId: newActiveId,
        code: newCode,
      };
    }),
  createFile: (name, content = '') => {
    const cleanName = name.trim();
    if (!cleanName) return '';
    const newId = `file-${Date.now()}`;
    const fileLang = getFileLanguage(cleanName);
    const newFile: ProjectFile = {
      id: newId,
      name: cleanName,
      content,
      language: fileLang,
    };
    set((state) => ({
      files: [...state.files, newFile],
      openFileIds: [...state.openFileIds, newId],
      activeFileId: newId,
      code: content,
    }));
    return newId;
  },
  deleteFile: (id) =>
    set((state) => {
      if (state.files.length <= 1) return state;
      const newFiles = state.files.filter((f) => f.id !== id);
      const newOpenIds = state.openFileIds.filter((tabId) => tabId !== id);
      let newActiveId = state.activeFileId;
      let newCode = state.code;
      if (state.activeFileId === id) {
        const nextFile = newFiles[0];
        newActiveId = nextFile.id;
        newCode = nextFile.content;
        if (!newOpenIds.includes(nextFile.id)) {
          newOpenIds.push(nextFile.id);
        }
      }
      return {
        files: newFiles,
        openFileIds: newOpenIds.length > 0 ? newOpenIds : [newActiveId],
        activeFileId: newActiveId,
        code: newCode,
      };
    }),
  renameFile: (id, newName) =>
    set((state) => {
      const cleanName = newName.trim();
      if (!cleanName) return state;
      return {
        files: state.files.map((f) =>
          f.id === id
            ? { ...f, name: cleanName, language: getFileLanguage(cleanName) }
            : f
        ),
      };
    }),
  setActiveOutputTab: (activeOutputTab) => set({ activeOutputTab }),
  setSessionMode: (sessionMode) => set({ sessionMode }),
  setReferenceCode: (referenceCode) => set({ referenceCode }),
  setBroadcastEnabled: (broadcastEnabled) => set({ broadcastEnabled }),
  addHintMessage: (msg) => set((s) => ({ hintMessages: [...s.hintMessages, msg] })),
  clearHints: () => set({ hintMessages: [] }),
  setIsHintLoading: (isHintLoading) => set({ isHintLoading }),
  resetToTemplate: () => {
    const lang = get().language;
    const defaultFiles = getDefaultFiles(lang);
    const isWeb = lang.name === 'web';
    set({
      files: defaultFiles,
      activeFileId: defaultFiles[0].id,
      openFileIds: isWeb ? defaultFiles.map((f) => f.id) : [defaultFiles[0].id],
      code: defaultFiles[0].content,
    });
  },
}),
    {
      name: 'labsync_ide_workspace',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        code: state.code,
        language: state.language,
        fontSize: state.fontSize,
        files: state.files,
        activeFileId: state.activeFileId,
        openFileIds: state.openFileIds,
        soundEnabled: state.soundEnabled,
        vimModeEnabled: state.vimModeEnabled,
        sessionMode: state.sessionMode,
      }),
    }
  )
);
