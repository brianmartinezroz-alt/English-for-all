/**
 * HCM — ACCESO AL PANEL
 * =====================
 * Va en el mismo proyecto que Codigo.gs de HCM-Datos.
 *
 * QUE ARREGLA
 * panelMaestro pedia la clave en cada peticion. Eso obliga al panel a cargar
 * la clave dentro de su JavaScript, y ahi la lee cualquiera que abra "ver
 * codigo fuente". Es el mismo agujero que tenia el panel de English For All.
 *
 * COMO QUEDA
 * El panel manda la clave UNA vez, el servidor la revisa y devuelve un pase
 * firmado que dura 12 horas. De ahi en adelante el panel manda el pase.
 * La clave nunca vuelve a viajar y nunca vive en el HTML.
 *
 * NO HAY QUE CONFIGURAR NADA
 *   - La clave la toma de la propiedad CLAVE_MAESTRO, que ya existe.
 *   - El secreto para firmar se genera SOLO la primera vez y se guarda.
 *     Nadie lo escribe ni lo ve nunca. Si se borra, se hace otro y todos
 *     los pases se caen: hay que volver a entrar con la clave, nada mas.
 *
 * Version 1 — 17 de septiembre de 2026
 */

var HORAS_DE_PASE_HCM = 12;
var TOPE_INTENTOS_HCM = 10;


// ---------- secreto y clave ----------

// Se hace solo la primera vez. Asi no hay que teclear un secreto en ningun lado.
function secretoPanel_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SECRETO_PANEL');
  if (!s) {
    s = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
        String(Math.random()) + Date.now() + ScriptApp.getScriptId())
    ).replace(/=+$/, '');
    props.setProperty('SECRETO_PANEL', s);
  }
  return s;
}

// La clave sale SOLO de Propiedades del script. Si alguien borra la propiedad,
// no se cae de vuelta a la que esta escrita en el codigo: se cierra. Esa que
// esta en el codigo hay que borrarla.
function clavePanelHCM_() {
  return PropertiesService.getScriptProperties().getProperty('CLAVE_MAESTRO') || '';
}

function accesoListoHCM_() {
  return clavePanelHCM_().length > 0;
}


// ---------- firma ----------

function firmarHCM_(texto) {
  var b = Utilities.computeHmacSha256Signature(String(texto), secretoPanel_());
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '');
}

// Comparar con === se tarda distinto segun cuantas letras coincidan, y eso se
// puede medir desde afuera para adivinar la clave letra por letra.
function igualesSeguroHCM_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return d === 0;
}


// ---------- pases ----------

function nuevoPaseHCM_() {
  var vence = Date.now() + HORAS_DE_PASE_HCM * 3600 * 1000;
  return vence + '.' + firmarHCM_(vence);
}

function paseValidoHCM_(pase) {
  if (!accesoListoHCM_() || !pase) return false;
  var p = String(pase).split('.');
  if (p.length !== 2) return false;
  var vence = parseInt(p[0], 10);
  if (!vence || Date.now() > vence) return false;
  return igualesSeguroHCM_(p[1], firmarHCM_(p[0]));
}


// ---------- freno a la fuerza bruta ----------

function horaHCM_() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyyMMddHH');
}
function fallosHCM_() {
  var v = PropertiesService.getScriptProperties().getProperty('fallos_' + horaHCM_());
  return v ? parseInt(v, 10) : 0;
}
function apuntarFalloHCM_() {
  PropertiesService.getScriptProperties()
    .setProperty('fallos_' + horaHCM_(), String(fallosHCM_() + 1));
}


// ---------- la puerta ----------

function entrarAlPanelHCM_(clave) {
  if (!accesoListoHCM_()) {
    return { ok: false, error: 'sin_configurar',
             mensaje: 'Falta la propiedad CLAVE_MAESTRO en Propiedades del script.' };
  }
  if (fallosHCM_() >= TOPE_INTENTOS_HCM) {
    return { ok: false, error: 'muchos_intentos',
             mensaje: 'Demasiados intentos fallidos. Espera una hora.' };
  }
  if (!clave || !igualesSeguroHCM_(String(clave), clavePanelHCM_())) {
    apuntarFalloHCM_();
    return { ok: false, error: 'clave_mala', mensaje: 'Esa no es la clave.' };
  }
  return { ok: true, pase: nuevoPaseHCM_(), horas: HORAS_DE_PASE_HCM };
}

function puedeVerElPanelHCM_(pase) {
  return paseValidoHCM_(pase);
}


// ---------- para probar ----------

// Dice como esta todo SIN enseñar la clave.
function revisarAccesoHCM() {
  var c = clavePanelHCM_();
  Logger.log('CLAVE_MAESTRO: ' + (c ? 'puesta (' + c.length + ' caracteres)' : 'FALTA'));
  Logger.log('SECRETO_PANEL: ' + (secretoPanel_() ? 'listo (se genero solo)' : 'no se pudo'));
  Logger.log('Listo para usarse: ' + (accesoListoHCM_() ? 'SI' : 'NO'));
  if (accesoListoHCM_()) {
    var p = nuevoPaseHCM_();
    Logger.log('Pase recien hecho vale: ' + paseValidoHCM_(p));
    Logger.log('Pase inventado rechazado: ' + (paseValidoHCM_('9999999999999.xxxx') === false));
    var estirado = (Date.now() + 999 * 86400000) + '.' + p.split('.')[1];
    Logger.log('Pase estirado rechazado: ' + (paseValidoHCM_(estirado) === false));
  }
  Logger.log('Intentos fallidos esta hora: ' + fallosHCM_());
}
