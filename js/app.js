/* ---------- Boot ---------- */
bindGlobalEvents();
render();

if (!storageWorks()) {
  showModal({
    title: 'Storage is disabled',
    body: 'This browser isn\'t letting the app save anything to local storage. The most common cause is Private/Incognito mode. Open this URL in a regular browser tab and add it to your home screen from there.',
    confirmText: 'OK',
    hideCancel: true,
    onConfirm: closeModal
  });
}

if ('serviceWorker' in navigator) {
  // Reload exactly once when a new service worker takes over so the
  // next request stream comes from the fresh deploy. Without this the
  // page sticks on whatever the old SW handed it until the user
  // manually refreshes (or closes every tab).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

