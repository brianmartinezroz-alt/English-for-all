/* El service worker de OneSignal.
   Va en /English-for-all/push/onesignal/ y NO en la raíz, por dos razones:
   1. GitHub Pages sirve el sitio en /English-for-all/, no en la raíz del
      dominio: un archivo en la raíz sería de OTRO sitio.
   2. Así no se pelea con el service worker de la app ni con el del panel.
      Cada uno tiene su propia carpeta y su propio alcance. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");
