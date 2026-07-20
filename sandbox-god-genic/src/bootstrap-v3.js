import'./upgrade-v3.js?v=3';
await import('./main.js?v=3');
window.dispatchEvent(new Event('godgenic:booted'));
