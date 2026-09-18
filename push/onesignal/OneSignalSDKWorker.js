/* El service worker de OneSignal.
   Va en /English-for-all/push/onesignal/ y NO en la raíz, por dos razones:
   1. GitHub Pages sirve el sitio en /English-for-all/, no en la raíz del
      dominio: un archivo en la raíz sería de OTRO sitio.
   2. Así no se pelea con el service worker de la app ni con el del panel.
      Cada uno tiene su propia carpeta y su propio alcance.

   OJO CON EL NOMBRE DEL ARCHIVO QUE SE IMPORTA:
   En la version 15 se llamaba OneSignalSDKWorker.js. En la 16 lo renombraron
   a OneSignalSDK.sw.js, y la direccion vieja contesta 404. Con un 404 aqui el
   service worker no se instala, y sin service worker no hay token de push:
   OneSignal crea al usuario, le pone sus etiquetas, y lo deja en
   "Never Subscribed" sin decir por que. Costo medio dia encontrarlo. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
