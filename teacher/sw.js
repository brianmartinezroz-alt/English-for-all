/* Service worker del panel del maestro.
   Vive en /teacher/ y por eso NO pelea con el de la app del alumno, que vive
   en la raiz. Dos service workers en la misma carpeta se pisan: el ultimo que
   se registra gana y el otro deja de mandar. Por eso el panel va aparte.

   Que hace: guarda el cascaron para que el panel abra aunque no haya senal.
   Los DATOS nunca se guardan aqui: siempre se piden frescos al servidor, si no
   Brian vería el avance de ayer creyendo que es el de hoy. */

var CACHE='efa-teacher-v1';
var CASCARON=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];

self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(CASCARON.map(function(u){
      return c.add(u).catch(function(){});   // si uno falla, no se cae la instalacion
    }));
  }));
});

self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch',function(e){
  var r=e.request;
  if(r.method!=='GET') return;                       // los POST al servidor, derechito
  if(r.url.indexOf('script.google.com')>=0) return;  // los datos, siempre frescos
  e.respondWith(
    fetch(r).then(function(res){
      if(res && res.ok && r.url.indexOf(self.registration.scope)===0){
        var copia=res.clone();
        caches.open(CACHE).then(function(c){ c.put(r,copia); });
      }
      return res;
    }).catch(function(){
      return caches.match(r).then(function(c){ return c || caches.match('./index.html'); });
    })
  );
});
