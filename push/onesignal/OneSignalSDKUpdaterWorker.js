/* El worker "updater" de OneSignal.
   El SDK nuevo (v16) ya no lo usa: le basta con OneSignalSDKWorker.js. Pero el
   panel de OneSignal sigue pidiendo el nombre del archivo, y si algún día lo
   busca y no está, la suscripción falla sin decir por qué.
   Cuesta una línea tenerlo. Es un seguro, no una pieza necesaria. */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");
