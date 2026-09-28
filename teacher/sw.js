/* Service worker del panel del maestro.
   Vive en /teacher/ y por eso NO pelea con el de la app del alumno, que vive
   en la raiz. Dos service workers en la misma carpeta se pisan: el ultimo que
   se registra gana y el otro deja de mandar. Por eso el panel va aparte.

   Que hace: guarda el cascaron para que el panel abra aunque no haya senal.
   Los DATOS nunca se guardan aqui: siempre se piden frescos al servidor, si no
   Brian veria el avance de ayer creyendo que es el de hoy.

   Lo que se corrigio aqui (28 sep):

   1. Estar en /teacher/ evita el pleito de registro, pero NO el del cache:
      Cache Storage es de todo el dominio. Al activarse, este service worker
      borraba el cache de la app del alumno, el de la app del HCM y el de las
      demas apps del dominio — y ellas borraban el de aqui. Ahora solo se toca
      lo que empieza con PREFIJO.

   2. Cuando algo fallaba se devolvia la pagina del panel como respuesta a
      CUALQUIER peticion. Un JSON que no cargaba recibia HTML y el error salia
      ilegible. Ahora la pagina solo se devuelve si se pedia una pagina.

   3. Se guardaba cualquier respuesta ok, sin tope de tamano y sin atrapar el
      error de cuota.                                                          */

var PREFIJO  = 'efa-teacher-';
var CACHE    = PREFIJO + 'v3';
var CASCARON = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
var TOPE     = 1500000;
var NUNCA    = /\.pdf($|\?)/i;

function guardar(req, res){
  if(!res || !res.ok) return;
  if(req.url.indexOf(self.registration.scope) !== 0) return;   // solo lo de /teacher/
  if(NUNCA.test(req.url)) return;
  var largo = parseInt(res.headers.get('content-length') || '0', 10);
  if(largo > TOPE) return;
  var copia = res.clone();
  caches.open(CACHE).then(function(c){ return c.put(req, copia); }).catch(function(){});
}

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CASCARON.map(function(u){
      return c.add(u).catch(function(){});   // si uno falla, no se cae la instalacion
    }));
  }).catch(function(){}));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){
      return (k.indexOf(PREFIJO) === 0 && k !== CACHE) ? caches.delete(k) : null;
    }));
  }).then(function(){ return self.clients.claim(); }).catch(function(){}));
});

self.addEventListener('fetch', function(e){
  var r = e.request;
  if(r.method !== 'GET') return;                       // los POST al servidor, derechito
  var ruta = '';
  try {
    var u = new URL(r.url);
    if(u.origin !== self.location.origin) return;      // los datos, siempre frescos
    ruta = u.pathname;
  } catch (err) { return; }

  var esPagina = r.mode === 'navigate' || r.destination === 'document' ||
                 /\/$|\.html$/.test(ruta);

  // El cascaron se pide SIEMPRE fresco de internet cuando hay senal, sin pasar
  // por el cache del navegador. Asi el panel instalado en el celular se
  // actualiza solo: nunca hay que reinstalarlo para ver la version nueva.
  var peticion = r;
  if(esPagina){
    try { peticion = new Request(r.url, { cache: 'reload', credentials: 'same-origin' }); }
    catch (err) { peticion = r; }
  }

  e.respondWith(
    fetch(peticion).then(function(res){ guardar(r, res); return res; })
      .catch(function(){
        return caches.match(r).then(function(c){
          if(c) return c;
          if(esPagina) return caches.match('./index.html').then(function(h){
            return h || new Response('Sin conexion', { status: 503 });
          });
          return new Response('', { status: 504, statusText: 'Sin conexion' });
        });
      })
  );
});
