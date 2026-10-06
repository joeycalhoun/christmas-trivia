import React from 'react';
import { createRoot } from 'react-dom/client';
import { App, type AppState } from './App';
import './styles.css';

interface Hot {
  ready?: (start: (data: { state?: AppState }) => void) => void;
  data?: { state?: AppState };
}

const root = createRoot(document.getElementById('root')!);
const start = (data: { state?: AppState } = {}) => root.render(<App initial={data?.state} />);
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
