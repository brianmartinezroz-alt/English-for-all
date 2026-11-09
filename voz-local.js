/* ═══════════ VOCES GRABADAS (Kokoro) ═══════════
   Las frases fijas de la app ya están grabadas en voz/<llave>-g.mp3 con
   Kokoro (modelo abierto y gratis). Este archivo se pone ANTES que la app y
   atiende las peticiones al servidor de voz: si la frase está grabada, la
   contesta él mismo con el archivo, al instante y sin gastar nada. Si no,
   la petición sigue a su camino de siempre. La app no se entera del cambio.

   · Inglés con acento de EE. UU. (el que trae la app por defecto). Si el
     alumno escogió otro acento (Inglaterra, Australia, India), sigue el
     servidor, porque la grabación es de EE. UU.
   · Español: las instrucciones fijas, con voz de maestro.               */
(function () {
  var SERVIDOR = /script\.google\.com\/macros\/s\/AKfycbxJgynQ/;   // el servidor de voz
  var BASE = (function () {
    try { var s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^\/]*$/, ''); } catch (e) {}
    return '';
  })();
  var LISTA = null;           // {llave: 1}
  function clave(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function fnv(t) { var h = 0x811c9dc5; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }

  try {
    fetch(BASE + 'voz/lista.json?d=' + new Date().toISOString().slice(0, 10), { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.g) { LISTA = {}; d.g.forEach(function (h) { LISTA[h] = 1; }); } })
      .catch(function () {});
  } catch (e) {}

  function aBase64(buf) {
    var b = new Uint8Array(buf), s = '', paso = 0x8000;
    for (var i = 0; i < b.length; i += paso) s += String.fromCharCode.apply(null, b.subarray(i, i + paso));
    return btoa(s);
  }

  var original = window.fetch && window.fetch.bind(window);
  if (!original) return;
  window.fetch = function (url, opts) {
    try {
      var u = typeof url === 'string' ? url : (url && url.url) || '';
      if (LISTA && SERVIDOR.test(u) && opts && typeof opts.body === 'string') {
        var d = JSON.parse(opts.body);
        var texto = String(d.texto || '').trim();
        var es = d.idioma === 'es';
        var acentoUS = !d.paquete || d.paquete === 'audio-us';
        var h = texto ? fnv(clave(texto)) : '';
        if (h && LISTA[h] && (es || acentoUS)) {
          return original(BASE + 'voz/' + h + '-g.mp3').then(function (r) {
            if (!r.ok) throw new Error('sin archivo');
            return r.arrayBuffer();
          }).then(function (buf) {
            return new Response(JSON.stringify({ ok: true, audio: aBase64(buf), local: true }),
                                { status: 200, headers: { 'Content-Type': 'application/json' } });
          }).catch(function () { return original(url, opts); });   // si falla, el camino de siempre
        }
      }
    } catch (e) {}
    return original(url, opts);
  };
  window.__efaVozLocal = { lista: function () { return LISTA ? Object.keys(LISTA).length : 0; },
                           tiene: function (t) { return !!(LISTA && LISTA[fnv(clave(t))]); } };
})();
