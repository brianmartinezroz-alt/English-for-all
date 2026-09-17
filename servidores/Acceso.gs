/**
 * English For All — ACCESO AL PANEL
 * =================================
 * Va en el mismo proyecto que Codigo.gs y Avisos.gs.
 *
 * EL PROBLEMA QUE ARREGLA
 * El panel tenia su clave escrita dentro del HTML. Dos agujeros:
 *   1. Cualquiera que abriera "ver codigo fuente" la leia.
 *   2. Peor: la clave no protegia nada. Quien supiera la direccion del
 *      servidor podia pedirle la lista completa de alumnos sin pasar por
 *      el panel. La clave solo escondia la puerta, no la cerraba.
 *
 * COMO QUEDA
 * La clave ya no viaja en el HTML: vive aqui, en Propiedades del script.
 * El panel la manda una vez, el servidor la revisa y devuelve un pase
 * firmado que vale 12 horas. De ahi en adelante el panel manda el pase.
 * Sin pase valido, el servidor no suelta ni un nombre.
 *
 * LO QUE HAY QUE PONER EN PROPIEDADES DEL SCRIPT
 *   CLAVE_PANEL    -> la clave que vas a escribir para entrar
 *   SECRETO_PANEL  -> una cadena larga al azar, la que sea, entre mas fea mejor.
 *                     No la escribes nunca; solo sirve para firmar los pases.
 *                     Si la cambias, todos los pases se caen y hay que entrar otra vez.
 *
 * MIENTRAS NO ESTEN PUESTAS, EL PANEL NO DEJA ENTRAR A NADIE. Es a proposito:
 * mas vale cerrado de mas que abierto de mas.
 *
 * Version 1 — 17 de septiembre de 2026
 */

var HORAS_DE_PASE = 12;      // cuanto dura sin volver a pedir la clave
var TOPE_INTENTOS = 10;      // intentos fallidos por hora antes de cerrar


// ---------- firma ----------

function secreto_() {
  return PropertiesService.getScriptProperties().getProperty('SECRETO_PANEL') || '';
}
function claveGuardada_() {
  return PropertiesService.getScriptProperties().getProperty('CLAVE_PANEL') || '';
}

// Sin las dos propiedades puestas, no se entra. Ni con la clave correcta.
function accesoConfigurado_() {
  return claveGuardada_().length > 0 && secreto_().length >= 8;
}

function firmar_(texto) {
  var b = Utilities.computeHmacSha256Signature(String(texto), secreto_());
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '');
}

// Compara sin delatar en cuanto empieza a fallar. Comparar con === se tarda
// distinto segun cuantas letras coincidan, y eso se puede medir.
function igualesSeguro_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return d === 0;
}


// ---------- pases ----------

function nuevoPase_() {
  var vence = Date.now() + HORAS_DE_PASE * 3600 * 1000;
  return vence + '.' + firmar_(vence);
}

function paseValido_(pase) {
  if (!accesoConfigurado_() || !pase) return false;
  var p = String(pase).split('.');
  if (p.length !== 2) return false;
  var vence = parseInt(p[0], 10);
  if (!vence || Date.now() > vence) return false;
  return igualesSeguro_(p[1], firmar_(p[0]));
}


// ---------- freno a la fuerza bruta ----------

function horaActual_() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyyMMddHH');
}
function intentosFallidos_() {
  var v = PropertiesService.getScriptProperties().getProperty('fallos_' + horaActual_());
  return v ? parseInt(v, 10) : 0;
}
function apuntarFallo_() {
  PropertiesService.getScriptProperties()
    .setProperty('fallos_' + horaActual_(), String(intentosFallidos_() + 1));
}


// ---------- la puerta ----------

/** El panel manda la clave una vez. Si es la buena, se lleva un pase. */
function entrarAlPanel_(clave) {
  if (!accesoConfigurado_()) {
    return { ok: false, error: 'sin_configurar',
             mensaje: 'Falta poner CLAVE_PANEL y SECRETO_PANEL en Propiedades del script.' };
  }
  if (intentosFallidos_() >= TOPE_INTENTOS) {
    return { ok: false, error: 'muchos_intentos',
             mensaje: 'Demasiados intentos fallidos. Espera una hora.' };
  }
  if (!clave || !igualesSeguro_(String(clave), claveGuardada_())) {
    apuntarFallo_();
    return { ok: false, error: 'clave_mala', mensaje: 'Esa no es la clave.' };
  }
  return { ok: true, pase: nuevoPase_(), horas: HORAS_DE_PASE };
}

/** Para que Codigo.gs pregunte antes de soltar datos. */
function puedeVerElPanel_(pase) {
  return paseValido_(pase);
}


// ---------- para probar ----------

// Dice si ya quedaron las propiedades, SIN enseñar la clave.
function revisarAcceso() {
  var c = claveGuardada_(), s = secreto_();
  Logger.log('CLAVE_PANEL: ' + (c ? 'puesta (' + c.length + ' caracteres)' : 'FALTA'));
  Logger.log('SECRETO_PANEL: ' + (s ? 'puesto (' + s.length + ' caracteres)' : 'FALTA'));
  Logger.log('Listo para usarse: ' + (accesoConfigurado_() ? 'SI' : 'NO'));
  if (accesoConfigurado_()) {
    var p = nuevoPase_();
    Logger.log('Pase de prueba valido: ' + paseValido_(p));
    Logger.log('Pase inventado rechazado: ' + (paseValido_('9999999999999.xxxx') === false));
  }
  Logger.log('Intentos fallidos esta hora: ' + intentosFallidos_());
}

// Genera un SECRETO_PANEL para que no tengas que inventarlo tu.
// Correla, copia lo que salga en el registro, y pegalo en Propiedades.
function generarSecreto() {
  var s = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      String(Math.random()) + Date.now() + Session.getTemporaryActiveUserKey())
  ).replace(/=+$/, '');
  Logger.log('Pega esto en SECRETO_PANEL:');
  Logger.log(s);
}
