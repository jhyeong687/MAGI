import React from 'react';
import ReactDOM from 'react-dom/client';
import PublicApp from './PublicApp.tsx';
import '../styles.css';
import '../operations.css';
import './demo.css';
import './frame.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PublicApp />
  </React.StrictMode>,
);
