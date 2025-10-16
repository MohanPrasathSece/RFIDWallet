import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import { AuthProvider } from './shared/AuthContext.jsx';
import { ThemeProvider } from './shared/ThemeContext.jsx';

// Function to update favicon based on theme
const updateFavicon = (isDark) => {
  const favicon = document.querySelector('link[rel="icon"]');
  const shortcutIcon = document.querySelector('link[rel="shortcut icon"]');
  const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');

  const logoSrc = isDark ? '/black_bg.png' : '/white_bg.png';

  if (favicon) favicon.href = logoSrc;
  if (shortcutIcon) shortcutIcon.href = logoSrc;
  if (appleTouchIcon) appleTouchIcon.href = logoSrc;
};

// Initialize favicon on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check initial theme preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;

  updateFavicon(isDark);
});

// Listen for theme changes to update favicon
window.addEventListener('theme:changed', (e) => {
  updateFavicon(e.detail.isDark);
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<App />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
