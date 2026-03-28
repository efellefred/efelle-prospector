// efelle Prospector v4.0 — App Entry Point
// Imports all modules to initialize the application

// Core modules (order matters: state first, then api, then nav/storage)
import './core/state.js';
import './core/api.js';
import './core/nav.js';
import './core/storage.js';
import './core/utils.js';
import './core/debug.js';

// Engine modules
import './engines/wsr.js';
import './engines/cca.js';
import './engines/cap.js';
import './engines/prop.js';

import './core/reports.js';
import './library.js';

console.log('efelle Prospector v4.0 loaded');
