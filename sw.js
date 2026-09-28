/* Ayudante de la app instalada.
   Regla: SIEMPRE se intenta traer la version nueva de internet. Solo si no
   hay senal se usa la guardada. Al reves seria un desastre: el alumno se
   quedaria con una version vieja para siempre y no veria las correcciones.

   Lo que se corrigio aqui (28 sep):

   1. Al activarse se borraba TODO cache que no fuera el propio. Pero Cache
      Storage es de todo el dominio, no de esta carpeta: este service worker
      estaba borrando el de la app del HCM, el del panel del maestro y el de
      las demas apps que viven en brianmartinezroz-alt.github.io — y ellas
      borraban el de esta. Ahora solo se toca lo que empieza con PREFIJO.

   2. Se guardaba cualquier respuesta 200, sin tope de tamano y sin atrapar el
      error de cuota. En un telefono con poco espacio eso truena en silencio.  */

var PREFIJO = 'efa-app-';
var CAJA    = PREFIJO + 'v1';
var VIEJAS  = ['efa-v2', 'efa-v1'];      // las de antes de que hubiera prefijo
var TOPE    = 1500000;                   // 1.5 MB
var NUNCA   = /\.pdf($|\?)/i;

function guardar(req, resp){
  if(!resp || resp.status !== 200 || resp.type !== 'basic') return;
  if(NUNCA.test(req.url)) return;
  var largo = parseInt(resp.headers.get('content-length') || '0', 10);
  if(largo > TOPE) return;
  var copia = resp.clone();
  caches.open(CAJA).then(function(c){ return c.put(req, copia); }).catch(function(){});
}

self.addEventListener('install', function(e){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){
      var mia = (k.indexOf(PREFIJO) === 0) || VIEJAS.indexOf(k) >= 0;
      return (mia && k !== CAJA) ? caches.delete(k) : null;
    }));
  }).then(function(){ return self.clients.claim(); }).catch(function(){}));
});

self.addEventListener('fetch', function(e){
  var r = e.request;
  if(r.method !== 'GET') return;                     // no tocar lo que se envia
  var ruta = '';
  try {
    var u = new URL(r.url);
    if(u.origin !== self.location.origin) return;    // los servidores, nunca
    ruta = u.pathname;
  } catch (err) { return; }

  var esPagina = r.mode === 'navigate' || r.destination === 'document' ||
                 /\/$|\.html$/.test(ruta);

  // El cascaron se pide SIEMPRE fresco de internet cuando hay senal, sin pasar
  // por el cache del navegador. Asi la app instalada en el celular se actualiza
  // sola: nunca hay que reinstalarla para ver la version nueva.
  var peticion = r;
  if(esPagina){
    try { peticion = new Request(r.url, { cache: 'reload', credentials: 'same-origin' }); }
    catch (err) { peticion = r; }
  }

  e.respondWith(
    fetch(peticion).then(function(resp){ guardar(r, resp); return resp; })
      .catch(function(){
        return caches.match(r).then(function(g){
          if(g) return g;
          // La pagina de la app solo se devuelve cuando lo que se pedia era una
          // pagina. Antes se devolvia para cualquier cosa, y un audio o un JSON
          // que no cargaba recibia HTML: el error resultaba imposible de leer.
          if(esPagina) return caches.match('./index.html').then(function(h){
            return h || new Response('Sin conexion', { status: 503 });
          });
          return new Response('', { status: 504, statusText: 'Sin conexion' });
        });
      })
  );
});
