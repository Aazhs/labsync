'use client';

import { useState, useRef, useEffect } from 'react';
import { useIDEStore } from '@/lib/store';
import { Sparkles, Send, Trash2, Lightbulb } from 'lucide-react';

export default function AIHintPanel() {
  const {
    hintMessages,
    isHintLoading,
    code,
    language,
    lastResult,
    addHintMessage,
    clearHints,
    setIsHintLoading,
  } = useIDEStore();
  
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [hintMessages, isHintLoading]);

  const requestHint = async (customMessage?: string) => {
    const errorText = lastResult?.stderr || lastResult?.compile_output || lastResult?.status?.description || '';
    
    const userMsg = customMessage || `I'm stuck. Here's my error: ${errorText}`;
    
    addHintMessage({
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
    });
    
    setIsHintLoading(true);
    
    try {
      const res = await fetch('/api/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          error: errorText,
          language: language.label,
          history: hintMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      
      const data = await res.json();
      
      addHintMessage({
        role: 'assistant',
        content: data.hint || data.error || 'Could not generate a hint.',
        timestamp: Date.now(),
      });
    } catch {
      addHintMessage({
        role: 'assistant',
        content: 'Failed to connect to the hint service. Try checking the error message yourself — the first line usually tells you what went wrong.',
        timestamp: Date.now(),
      });
    } finally {
      setIsHintLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isHintLoading) return;
    requestHint(inputValue.trim());
    setInputValue('');
  };

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={13} style={{ color: 'var(--accent-primary-light)' }} />
          <span>AI Lab Assistant</span>
        </div>
        <button className="btn-icon" onClick={clearHints} title="Clear chat">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {hintMessages.length === 0 && !isHintLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-tertiary)',
            fontSize: 13,
            gap: 12,
            textAlign: 'center',
            padding: '0 16px',
          }}>
            <Lightbulb size={28} style={{ color: 'var(--accent-primary-light)', opacity: 0.5 }} />
            <span>I&apos;m your debugging companion.</span>
            <span style={{ fontSize: 11 }}>
              I won&apos;t give you the answer — I&apos;ll ask questions to help you find it yourself.
            </span>
            <button
              className="btn btn-primary"
              onClick={() => requestHint()}
              style={{ marginTop: 8 }}
              disabled={isHintLoading}
            >
              <Sparkles size={14} />
              Get a hint
            </button>
          </div>
        )}

        {hintMessages.map((msg, i) => (
          <div
            key={i}
            className="animate-fade-in"
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
            }}
          >
            {msg.role === 'assistant' ? (
              <div className="hint-message">{msg.content}</div>
            ) : (
              <div style={{
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {isHintLoading && (
          <div className="hint-message animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="loading-spinner" />
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        gap: 6,
        padding: '8px 12px',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-tertiary)',
      }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe what you're stuck on..."
          disabled={isHintLoading}
          style={{
            flex: 1,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isHintLoading || !inputValue.trim()}
          style={{ padding: '6px 10px' }}
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
