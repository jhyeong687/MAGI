import React from 'react';
import ReactDOM from 'react-dom/client';
import DemoApp from './DemoApp.tsx';
import '../styles.css';
import '../operations.css';
import './demo.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoApp />
  </React.StrictMode>,
);
