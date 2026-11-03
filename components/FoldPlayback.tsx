import React, { useEffect, useRef, useState } from 'react';
import styles from './FoldPlayback.module.css';

interface Props {
  progress: number;
  onChange: (value: number) => void;
  book?: boolean;
  sequential?: boolean;
  onSequentialChange?: () => void;
}

/** One clock per preview. Scrubbing and endpoint actions always stop it. */
export function FoldPlayback({ progress, onChange, book = false, sequential, onSequentialChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const current = useRef(progress);
  const change = useRef(onChange);
  const direction = useRef(1);
  current.current = progress;
  change.current = onChange;
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | null = null;
    const tick = (time: number) => {
      // RAF timestamps describe frame start and can precede effect execution.
      // Start this clock on its first RAF, never with performance.now().
      if (previous === null) { previous = time; frame = requestAnimationFrame(tick); return; }
      const next = Math.max(0, Math.min(100, current.current + direction.current * Math.max(0, Math.min(time - previous, 100)) * .025 * speed));
      previous = time;
      current.current = next;
      change.current(next);
      if (next === 0 || next === 100) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const seek = (value: number) => { setPlaying(false); onChange(value); };
  return <section className={styles.playback} aria-label="Folding playback">
    <div className={styles.timeline}>
      <label htmlFor="fold-playback-progress">{book ? 'Book opening' : 'Fold progress'}</label>
      <output>{Math.round(progress)}%{book ? ` · ${Math.round(progress * 1.8)}°` : ''}</output>
      <input id="fold-playback-progress" aria-label="Fold progress" type="range" min="0" max="100" step="0.5" value={progress} onChange={e => seek(Number(e.target.value))} />
      <span>{book ? 'Closed' : 'Flat'}</span><span>{book ? 'Open' : 'Folded'}</span>
    </div>
    <div className={styles.actions}>
      <button type="button" data-action="unfold" onClick={() => seek(0)}>{book ? 'Close' : 'Unfold'}</button>
      <button type="button" data-action="play" aria-pressed={playing} onClick={() => { if (progress >= 100) direction.current = -1; else if (progress <= 0) direction.current = 1; setPlaying(v => !v); }}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" data-action="fold" onClick={() => seek(100)}>{book ? 'Open' : 'Fold'}</button>
      <button type="button" data-action="reset" title="Reset animation to the start (keeps your design)" onClick={() => seek(0)}>Reset</button>
      <label>Speed <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
      {onSequentialChange && <button type="button" aria-pressed={sequential} onClick={onSequentialChange}>Sequential</button>}
    </div>
  </section>;
}
