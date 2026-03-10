document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');

  // Confirm JS loaded
  statusEl.textContent = 'JS loaded. Registering Service Worker…';

  // Register the service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./service-worker.js', { scope: './' })
      .then(() => { statusEl.textContent = 'Service Worker registered. PWA base is ready.'; })
      .catch((err) => { statusEl.textContent = 'SW registration failed: ' + err; });
  } else {
    statusEl.textContent = 'Service Worker not supported in this browser.';
  }
});
