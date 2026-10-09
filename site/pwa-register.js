if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('./sw.js', document.baseURI)).catch(() => {}));
}
