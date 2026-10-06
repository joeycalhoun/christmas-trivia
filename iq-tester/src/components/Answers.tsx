import React, { useEffect, useRef } from 'react';
import type { AnswerSpec, Response } from '../engine/types';
import { GridView, VisualView } from './Figures';

export const LETTERS = 'ABCDEFGH';

export function emptyResponse(a: AnswerSpec): Response {
  switch (a.kind) {
    case 'choice':
      return { kind: 'choice', index: null };
    case 'text':
      return { kind: 'text', value: '' };
    case 'multi':
      return { kind: 'multi', indices: [] };
    case 'grid':
      return { kind: 'grid', cells: [] };
  }
}

export function hasAnswer(r: Response): boolean {
  switch (r.kind) {
    case 'choice':
      return r.index !== null;
    case 'text':
      return r.value.trim() !== '';
    case 'multi':
      return r.indices.length > 0;
    case 'grid':
      return r.cells.length > 0;
  }
}

interface Props {
  answer: AnswerSpec;
  value: Response;
  onChange: (r: Response) => void;
  onSubmit: () => void;
}

export function AnswerInput({ answer, value, onChange, onSubmit }: Props) {
  if (answer.kind === 'choice' && value.kind === 'choice') return <ChoiceInput answer={answer} value={value.index} onChange={(index) => onChange({ kind: 'choice', index })} onSubmit={onSubmit} />;
  if (answer.kind === 'text' && value.kind === 'text')
    return <TextInput placeholder={answer.placeholder} numeric={answer.mode === 'number'} value={value.value} onChange={(v) => onChange({ kind: 'text', value: v })} onSubmit={onSubmit} />;
  if (answer.kind === 'multi' && value.kind === 'multi') {
    const toggle = (i: number) =>
      onChange({ kind: 'multi', indices: value.indices.includes(i) ? value.indices.filter((x) => x !== i) : [...value.indices, i] });
    return (
      <div className="word-grid" role="group" aria-label="Words">
        {answer.options.map((w, i) => (
          <button key={w} type="button" className="word-chip" aria-pressed={value.indices.includes(i)} onClick={() => toggle(i)}>
            {w}
          </button>
        ))}
      </div>
    );
  }
  if (answer.kind === 'grid' && value.kind === 'grid') {
    const toggle = (i: number) => onChange({ kind: 'grid', cells: value.cells.includes(i) ? value.cells.filter((x) => x !== i) : [...value.cells, i] });
    return (
      <div className="grid-wrap">
        <GridView size={answer.size} lit={value.cells} onToggle={toggle} label="Answer grid" />
        <p className="hint">{value.cells.length} of {answer.cells.length} squares selected</p>
      </div>
    );
  }
  return null;
}

function ChoiceInput({ answer, value, onChange, onSubmit }: { answer: Extract<AnswerSpec, { kind: 'choice' }>; value: number | null; onChange: (i: number) => void; onSubmit: () => void }) {
  const visual = answer.options.some((o) => o.visual);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const byLetter = LETTERS.indexOf(k);
      const byDigit = /^[1-8]$/.test(k) ? Number(k) - 1 : -1;
      const i = byLetter >= 0 && k.length === 1 ? byLetter : byDigit;
      if (i >= 0 && i < answer.options.length) {
        e.preventDefault();
        onChange(i);
      } else if (e.key === 'Enter' && value !== null && !(e.target instanceof HTMLButtonElement && !e.target.classList.contains('choice'))) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer.options.length, onChange, onSubmit, value]);

  return (
    <div className={visual ? 'choices choices-visual' : 'choices'} role="radiogroup" aria-label="Answer options">
      {answer.options.map((o, i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} className="choice" onClick={() => onChange(i)}>
          <span className="bubble" aria-hidden="true">
            {LETTERS[i]}
          </span>
          {o.visual ? (
            <span className="choice-visual">
              <VisualView visual={o.visual} label={o.visual.kind === 'poly' ? `Shape ${LETTERS[i]}` : o.label} />
            </span>
          ) : (
            <span className="choice-label">{o.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function TextInput({ value, onChange, onSubmit, placeholder, numeric }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; numeric: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      id="answer-text"
      className="text-answer"
      type="text"
      inputMode={numeric ? 'decimal' : 'text'}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={placeholder ?? 'Your answer'}
      aria-label={placeholder ?? 'Your answer'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value.trim()) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}
