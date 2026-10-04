/* DELFINADA PWA — rejestracja service workera + instalacja + komunikat o nowej wersji.
 * Dołączany na końcu <body> każdej strony aplikacji. */
(function () {
  if (!('serviceWorker' in navigator)) return;

  // --- mały pomocnik: toast / banner na dole ekranu ---
  function banner(html) {
    const b = document.createElement('div');
    b.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;' +
      'background:#0b6270;color:#fff;padding:12px 16px;border-radius:18px;' +
      'box-shadow:0 18px 40px -14px rgba(11,98,112,.6);font-family:Nunito,system-ui,sans-serif;' +
      'font-weight:800;display:flex;gap:10px;align-items:center;max-width:92vw;';
    b.innerHTML = html;
    document.body.appendChild(b);
    return b;
  }

  // --- rejestracja ---
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });

      // Wykryj nową wersję i zaproponuj odświeżenie
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const b = banner(
              '🐬 Dostępna nowa wersja ' +
              '<button id="pwaReload" style="background:#ff8826;color:#fff;border:0;border-radius:12px;padding:6px 12px;font-weight:800;cursor:pointer">Odśwież</button>'
            );
            b.querySelector('#pwaReload').onclick = () => {
              nw.postMessage('SKIP_WAITING');
            };
          }
        });
      });

      // Gdy nowy SW przejmie kontrolę — przeładuj raz, by pokazać świeżą wersję
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (e) {
      /* cicho — PWA to dodatek, strona działa też bez SW */
    }
  });

  // --- przycisk „Zainstaluj aplikację" (Android/desktop) ---
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const b = banner(
      '📲 Zainstaluj DELFINADA na telefonie ' +
      '<button id="pwaInstall" style="background:#ff8826;color:#fff;border:0;border-radius:12px;padding:6px 12px;font-weight:800;cursor:pointer">Zainstaluj</button>' +
      '<button id="pwaClose" aria-label="zamknij" style="background:transparent;color:#bdeef0;border:0;font-size:18px;cursor:pointer;padding:0 4px">×</button>'
    );
    b.querySelector('#pwaInstall').onclick = async () => {
      b.remove();
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    };
    b.querySelector('#pwaClose').onclick = () => b.remove();
  });

  window.addEventListener('appinstalled', () => { deferredPrompt = null; });
})();
