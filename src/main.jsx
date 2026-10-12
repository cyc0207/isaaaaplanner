import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { initTodayOverride } from './lib/date.js';
import { installEffects } from './effects.js';
import { installErrorLogging } from './lib/errlog.js';
import './styles.css';

initTodayOverride();
installEffects();
installErrorLogging();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
