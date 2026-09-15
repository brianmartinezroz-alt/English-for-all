/* Ayudante de la app instalada.
   Regla: SIEMPRE se intenta traer la version nueva de internet. Solo si no
   hay senal se usa la guardada. Al reves seria un desastre: el alumno se
   quedaria con una version vieja para siempre y no veria las correcciones. */
var CAJA = 'efa-v1';

self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.map(function(k){ if(k!==CAJA) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var r = e.request;
  if(r.method !== 'GET') return;                     // no tocar lo que se envia
  if(r.url.indexOf('script.google.com') >= 0) return; // los servidores, nunca
  e.respondWith(
    fetch(r).then(function(resp){
      if(resp && resp.status === 200 && resp.type === 'basic'){
        var copia = resp.clone();
        caches.open(CAJA).then(function(c){ c.put(r, copia); });
      }
      return resp;
    }).catch(function(){
      return caches.match(r).then(function(g){
        return g || new Response('Sin conexión', {status:503});
      });
    })
  );
});
