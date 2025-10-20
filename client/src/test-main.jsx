import React from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <div style={{ padding: '20px', fontFamily: 'Arial' }}>
    <h1>Test Page - React is Working!</h1>
    <p>If you see this, React is rendering correctly.</p>
  </div>
);
