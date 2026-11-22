// Remna: drobne rzeczy zależne od platformy (Android przez Capacitor albo zwykła przeglądarka).
(function (root) {
  'use strict';
  const cap = root.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const cache = {};
  const plugin = (name) => {
    if (!cap) return null;
    if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
    if (!cache[name] && cap.registerPlugin) cache[name] = cap.registerPlugin(name);
    return cache[name] || null;
  };

  /** Otwiera stronę sklepu: w aplikacji w karcie przeglądarki systemowej, w sieci w nowej karcie. */
  async function openExternal(url) {
    const Browser = plugin('Browser');
    if (isNative && Browser) {
      try { await Browser.open({ url }); return; } catch (e) { /* zapasowo niżej */ }
    }
    root.open(url, '_blank', 'noopener');
  }

  /** Przycisk „wstecz” na Androidzie: najpierw zamyka okna, potem wraca do wyszukiwania, na końcu wychodzi. */
  function onBack(handler) {
    const App = plugin('App');
    if (isNative && App && App.addListener) {
      App.addListener('backButton', () => {
        if (!handler()) App.exitApp();
      });
    }
  }

  /** Powrót do aplikacji z tła (do odświeżenia licznika alertów). */
  function onResume(handler) {
    const App = plugin('App');
    if (isNative && App && App.addListener) {
      App.addListener('appStateChange', (s) => { if (s && s.isActive) handler(); });
    } else {
      root.document.addEventListener('visibilitychange', () => { if (!root.document.hidden) handler(); });
    }
  }

  root.RemnaNative = { isNative, openExternal, onBack, onResume };
})(window);
