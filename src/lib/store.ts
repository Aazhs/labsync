import { create } from 'zustand';

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
    defaultCode: '# Welcome to LabSync IDE\n# Write your Python code here\n\ndef main():\n    print("Hello, LabSync!")\n\nif __name__ == "__main__":\n    main()\n',
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
    label: 'JavaScript',
    defaultCode: '// Welcome to LabSync IDE\n\nfunction main() {\n    console.log("Hello, LabSync!");\n}\n\nmain();\n',
  },
];

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
  type: 'stdout' | 'stderr' | 'system' | 'success' | 'error';
  content: string;
  timestamp: number;
};

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
  
  // Execution
  isRunning: boolean;
  output: OutputLine[];
  lastResult: ExecutionResult | null;
  
  // Panels
  showOutput: boolean;
  showHintPanel: boolean;
  showReferencePane: boolean;
  activeOutputTab: 'output' | 'problems';
  
  // Session
  sessionMode: SessionMode;
  referenceCode: string;
  
  // AI Hints
  hintMessages: HintMessage[];
  isHintLoading: boolean;
  
  // Actions
  setCode: (code: string) => void;
  setLanguage: (lang: Language) => void;
  setFontSize: (size: number) => void;
  setIsRunning: (running: boolean) => void;
  addOutput: (line: OutputLine) => void;
  clearOutput: () => void;
  setLastResult: (result: ExecutionResult | null) => void;
  toggleOutput: () => void;
  toggleHintPanel: () => void;
  toggleReferencePane: () => void;
  setActiveOutputTab: (tab: 'output' | 'problems') => void;
  setSessionMode: (mode: SessionMode) => void;
  setReferenceCode: (code: string) => void;
  addHintMessage: (msg: HintMessage) => void;
  clearHints: () => void;
  setIsHintLoading: (loading: boolean) => void;
}

export const useIDEStore = create<IDEStore>((set) => ({
  // Editor state
  code: LANGUAGES[0].defaultCode,
  language: LANGUAGES[0],
  fontSize: 14,
  
  // Execution
  isRunning: false,
  output: [],
  lastResult: null,
  
  // Panels
  showOutput: true,
  showHintPanel: false,
  showReferencePane: false,
  activeOutputTab: 'output',
  
  // Session
  sessionMode: 'practice',
  referenceCode: '',
  
  // AI Hints
  hintMessages: [],
  isHintLoading: false,
  
  // Actions
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language, code: language.defaultCode }),
  setFontSize: (fontSize) => set({ fontSize }),
  setIsRunning: (isRunning) => set({ isRunning }),
  addOutput: (line) => set((s) => ({ output: [...s.output, line] })),
  clearOutput: () => set({ output: [] }),
  setLastResult: (lastResult) => set({ lastResult }),
  toggleOutput: () => set((s) => ({ showOutput: !s.showOutput })),
  toggleHintPanel: () => set((s) => ({ showHintPanel: !s.showHintPanel })),
  toggleReferencePane: () => set((s) => ({ showReferencePane: !s.showReferencePane })),
  setActiveOutputTab: (activeOutputTab) => set({ activeOutputTab }),
  setSessionMode: (sessionMode) => set({ sessionMode }),
  setReferenceCode: (referenceCode) => set({ referenceCode }),
  addHintMessage: (msg) => set((s) => ({ hintMessages: [...s.hintMessages, msg] })),
  clearHints: () => set({ hintMessages: [] }),
  setIsHintLoading: (isHintLoading) => set({ isHintLoading }),
}));
