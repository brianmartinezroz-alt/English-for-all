/**
 * English For All — AVISOS (notificaciones al celular)
 * ====================================================
 * Este archivo va DENTRO del mismo proyecto que Datos.gs.
 * En Apps Script: + (Archivo) → Secuencia de comandos → nómbralo "Avisos".
 *
 * Qué hace:
 *   · Cuando un alumno termina una sesión, te llega un aviso a ti.
 *   · Cuando un alumno empieza una lección, te llega un aviso a ti.
 *   · Todos los días, a la hora que tú digas, a cada alumno que no practicó
 *     le llega un empujón con una frase distinta.
 *
 * LAS LLAVES NO VAN AQUÍ. Van en Configuración del proyecto → Propiedades
 * del script, igual que la llave de YouTube. Así, cuando actualicemos este
 * archivo, las llaves no se borran.
 *     ONESIGNAL_APP_ID    → el App ID (ese es público, no pasa nada)
 *     ONESIGNAL_REST_KEY  → la llave de la API (ESA ES SECRETA: con ella
 *                           cualquiera podría mandarle notificaciones a
 *                           todos tus alumnos. Nunca la pegues en la app
 *                           ni me la pases por chat.)
 *
 * Versión 1 — 17 de septiembre de 2026
 */

// ---------- AJUSTES ----------

// A qué hora sale el empujón diario (hora de la Ciudad de México, 0–23).
// 20 = ocho de la noche, cuando ya salieron de trabajar.
var HORA_DEL_EMPUJON = 20;

// Cuántos días sin practicar antes de picarlos. 1 = si hoy no entraron.
var DIAS_PARA_PICAR = 1;

// Después de tantos días sin aparecer, ya no se le insiste más. No sirve de
// nada y se siente acoso. Si vuelve, el contador se reinicia solo.
var DIAS_PARA_RENDIRSE = 21;

// Tu identificador dentro de OneSignal. El panel del maestro se registra
// con este mismo nombre, y por eso los avisos de alumnos te llegan a ti.
var YO = 'maestro';


// ---------- FRASES DEL EMPUJÓN ----------
// Ni culpa ni regaño: al que no entró no se le echa en cara. Se le recuerda
// que son diez minutos y que ya sabe hacerlo. Rotan por día para que no se
// vuelva ruido que se ignora.

var FRASES_UN_DIA = [
  { t: 'Diez minutos y ya', c: 'Nada más una parada. Es menos de lo que tardas en el súper.' },
  { t: 'Ahí sigue tu lugar', c: 'Donde te quedaste está guardado. Ábrela y sigue.' },
  { t: '¿Le damos?', c: 'Una sesión corta hoy vale más que una hora el domingo.' },
  { t: 'Tu inglés te espera', c: 'Diez minutos hablando. No hay tarea ni examen.' },
  { t: 'Una parada, nada más', c: 'Empieza aunque sea con una frase. Casi siempre siguen las demás.' }
];

var FRASES_VARIOS_DIAS = [
  { t: 'Te extrañamos', c: 'Llevas {d} días fuera. No pasa nada: se retoma donde lo dejaste.' },
  { t: 'Volver es lo difícil', c: '{d} días sin practicar. El primer día de regreso es el único que cuesta.' },
  { t: 'Sigue siendo tuyo', c: 'Tu avance no se borró. Te esperan diez minutos, no {d} días de tarea.' },
  { t: 'Sin prisa pero sin pausa', c: 'Han pasado {d} días. Una sesión chiquita hoy y vas de vuelta.' }
];

// El que SÍ va bien también merece que le digan algo.
var FRASES_RACHA = [
  { t: 'Vas parejo', c: 'Llevas {r} días seguidos. Así se aprende de verdad.' },
  { t: '{r} días seguidos', c: 'Eso es constancia. Sigue en tu parada de hoy.' }
];


// ---------- MANDAR ----------

function llave_(cual) {
  var v = PropertiesService.getScriptProperties().getProperty(cual);
  if (!v) throw new Error('Falta ' + cual + ' en Propiedades del script.');
  return v;
}

/**
 * Manda una notificación. "aQuien" puede ser:
 *   { a: 'juan perez' }            → a ese alumno
 *   { etiqueta: {clave:'rol', valor:'maestro'} }  → a quien tenga esa etiqueta
 * Devuelve true si OneSignal la aceptó.
 */
function mandarAviso_(aQuien, titulo, cuerpo, liga) {
  var cuerpoPeticion = {
    app_id: llave_('ONESIGNAL_APP_ID'),
    headings: { en: titulo, es: titulo },
    contents: { en: cuerpo, es: cuerpo }
  };
  if (liga) cuerpoPeticion.url = liga;

  // OJO: OneSignal NO deja mezclar las dos formas de apuntar en un mismo
  // mensaje. O va por alias, o va por etiqueta.
  if (aQuien.a) {
    cuerpoPeticion.include_aliases = { external_id: [String(aQuien.a)] };
    cuerpoPeticion.target_channel = 'push';
  } else if (aQuien.etiqueta) {
    cuerpoPeticion.filters = [{
      field: 'tag', key: aQuien.etiqueta.clave,
      relation: '=', value: String(aQuien.etiqueta.valor)
    }];
  } else {
    return false;
  }

  try {
    var r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Key ' + llave_('ONESIGNAL_REST_KEY') },
      payload: JSON.stringify(cuerpoPeticion),
      muteHttpExceptions: true
    });
    var codigo = r.getResponseCode();
    var texto = r.getContentText();
    if (codigo !== 200 && codigo !== 201) {
      Logger.log('OneSignal contestó ' + codigo + ': ' + texto.slice(0, 300));
      return false;
    }
    // Si nadie tenía los avisos prendidos, OneSignal contesta 200 pero avisa
    // que no había a quién mandarle. Eso NO es un error del código.
    var d = {}; try { d = JSON.parse(texto); } catch (e) {}
    if (d.errors && !d.id) {
      Logger.log('Sin destinatarios: ' + texto.slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    Logger.log('No se pudo mandar el aviso: ' + e.message);
    return false;
  }
}

// El mismo nombre tiene que salir igual en la app y aquí, si no el aviso
// se manda a un alumno que no existe.
function idDe_(nombre) {
  return String(nombre || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}


// ---------- AVISOS PARA TI ----------

// Alguien acabó una sesión.
function avisarMaestro_(r) {
  try {
    var att = r.intentos || [];
    var frases = att.filter(function (a) { return a.oido && a.tipo !== 'pista'; }).length;
    var pct = r.promedio_repeticion ? ' · ' + r.promedio_repeticion + '%' : '';
    var dudas = (r.dudas || []).length;
    mandarAviso_(
      { a: YO },
      (r.nombre || 'Un alumno') + ' terminó la sesión ' + (r.s != null ? r.s + 1 : ''),
      frases + ' frases' + pct + (dudas ? ' · dejó ' + dudas + ' duda' + (dudas > 1 ? 's' : '') : ''),
      'https://brianmartinezroz-alt.github.io/English-for-all/teacher/'
    );
  } catch (e) {}
}

// Alguien acaba de abrir una lección. Esto llega ANTES de que termine, y es
// lo que de verdad contesta "quién entró".
function avisarMaestroEntro_(nombre, nivel, parada) {
  try {
    mandarAviso_(
      { a: YO },
      (nombre || 'Un alumno') + ' está practicando',
      'Acaba de abrir la parada ' + (parada || '?') + (nivel ? ' · ' + nivel : ''),
      'https://brianmartinezroz-alt.github.io/English-for-all/teacher/'
    );
  } catch (e) {}
}


// ---------- EL EMPUJÓN DIARIO ----------

function hoyTexto_() {
  return Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd');
}

// Lee la hoja y saca, por alumno, cuándo practicó por última vez y cuántos
// días seguidos lleva.
function comoVanLosAlumnos_() {
  var libro = SpreadsheetApp.openById(HOJA_ID);
  var h = libro.getSheetByName(PESTANA);
  if (!h || h.getLastRow() < 2) return [];
  var d = h.getDataRange().getValues();
  var c = {}; d[0].forEach(function (x, i) { c[x] = i; });

  var por = {};
  for (var i = 1; i < d.length; i++) {
    var nom = String(d[i][c['alumno']] || '').trim();
    if (!nom) continue;
    var f = d[i][c['fecha']];
    if (!f) continue;
    var dia = (f instanceof Date)
      ? Utilities.formatDate(f, 'America/Mexico_City', 'yyyy-MM-dd')
      : String(f).slice(0, 10);
    var A = por[nom] || (por[nom] = { nombre: nom, nivel: '', dias: {} });
    A.dias[dia] = 1;
    A.nivel = String(d[i][c['nivel']] || A.nivel);
  }

  var hoy = hoyTexto_();
  var salida = [];
  Object.keys(por).forEach(function (n) {
    var A = por[n];
    var lista = Object.keys(A.dias).sort();
    var ultimo = lista[lista.length - 1];
    A.sinPracticar = diasEntre_(ultimo, hoy);
    A.racha = rachaHastaHoy_(A.dias, hoy);
    A.ultimo = ultimo;
    delete A.dias;
    salida.push(A);
  });
  return salida;
}

function diasEntre_(a, b) {
  var x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00');
  return Math.round((y - x) / 86400000);
}

function rachaHastaHoy_(dias, hoy) {
  var n = 0, d = hoy;
  // si hoy todavía no practica, la racha se cuenta desde ayer
  if (!dias[d]) d = restarDia_(d);
  while (dias[d]) { n++; d = restarDia_(d); }
  return n;
}

function restarDia_(s) {
  var f = new Date(s + 'T12:00:00');
  f.setDate(f.getDate() - 1);
  return Utilities.formatDate(f, 'America/Mexico_City', 'yyyy-MM-dd');
}

// Para no mandarle dos veces el mismo día, aunque el disparador se repita.
function yaLeAvise_(nombre) {
  var k = 'aviso_' + idDe_(nombre);
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty(k) === hoyTexto_()) return true;
  p.setProperty(k, hoyTexto_());
  return false;
}

/**
 * ESTA es la que corre sola todos los días.
 * No la ejecutes a mano si no quieres mandar avisos de verdad:
 * usa probarEmpujon() para ver a quién le tocaría, sin mandar nada.
 */
function empujonDiario_() {
  var gente = comoVanLosAlumnos_();
  var mandados = 0;

  gente.forEach(function (A) {
    // practicó hoy: se le reconoce la racha, no se le pica
    if (A.sinPracticar === 0) {
      if (A.racha >= 3 && !yaLeAvise_(A.nombre)) {
        var fr = FRASES_RACHA[new Date().getDate() % FRASES_RACHA.length];
        if (mandarAviso_({ a: idDe_(A.nombre) }, fr.t.replace('{r}', A.racha),
                         fr.c.replace('{r}', A.racha),
                         'https://brianmartinezroz-alt.github.io/English-for-all/')) mandados++;
      }
      return;
    }
    if (A.sinPracticar < DIAS_PARA_PICAR) return;
    if (A.sinPracticar > DIAS_PARA_RENDIRSE) return;   // ya no se le insiste
    if (yaLeAvise_(A.nombre)) return;

    var banco = (A.sinPracticar === 1) ? FRASES_UN_DIA : FRASES_VARIOS_DIAS;
    var f = banco[(new Date().getDate() + A.nombre.length) % banco.length];
    var titulo = f.t.replace('{d}', A.sinPracticar);
    var cuerpo = f.c.replace('{d}', A.sinPracticar);
    if (mandarAviso_({ a: idDe_(A.nombre) }, titulo, cuerpo,
                     'https://brianmartinezroz-alt.github.io/English-for-all/')) mandados++;
  });

  // y a ti, el resumen de quién anda perdido
  var perdidos = gente.filter(function (A) {
    return A.sinPracticar >= 3 && A.sinPracticar <= DIAS_PARA_RENDIRSE;
  });
  var hoyEntraron = gente.filter(function (A) { return A.sinPracticar === 0; }).length;
  if (gente.length) {
    mandarAviso_({ a: YO }, 'Cómo va el grupo',
      hoyEntraron + ' de ' + gente.length + ' practicaron hoy' +
      (perdidos.length ? ' · ' + perdidos.length + ' llevan 3 días o más sin entrar' : ''),
      'https://brianmartinezroz-alt.github.io/English-for-all/teacher/');
  }
  Logger.log('Empujones mandados: ' + mandados);
}


// ---------- PONERLO A CORRER ----------

// Córrela UNA vez desde el editor. Deja el disparador diario armado.
// Si la corres otra vez, primero borra el anterior para no duplicar.
function instalarDisparadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'empujonDiario_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('empujonDiario_')
    .timeBased().atHour(HORA_DEL_EMPUJON).everyDays(1)
    .inTimezone('America/Mexico_City').create();
  Logger.log('Listo: el empujón sale todos los días cerca de las ' + HORA_DEL_EMPUJON + ':00.');
}


// ---------- PARA PROBAR ----------

// Ve a quién le tocaría el empujón HOY, sin mandar nada.
function probarEmpujon() {
  var gente = comoVanLosAlumnos_();
  if (!gente.length) { Logger.log('Todavía no hay sesiones en la hoja.'); return; }
  gente.forEach(function (A) {
    Logger.log(A.nombre + ' (' + idDe_(A.nombre) + ') · última: ' + A.ultimo +
      ' · ' + A.sinPracticar + ' días sin practicar · racha ' + A.racha +
      ' → ' + (A.sinPracticar === 0
        ? (A.racha >= 3 ? 'FELICITACIÓN' : 'nada, practicó hoy')
        : A.sinPracticar > DIAS_PARA_RENDIRSE ? 'nada, ya lleva demasiado'
        : A.sinPracticar < DIAS_PARA_PICAR ? 'nada todavía' : 'EMPUJÓN'));
  });
}

// Mándate un aviso a ti mismo para comprobar que las llaves están bien.
function probarAvisoAMi() {
  var ok = mandarAviso_({ a: YO }, 'Prueba desde el servidor',
    'Si ves esto en tu celular, las notificaciones ya jalan.',
    'https://brianmartinezroz-alt.github.io/English-for-all/teacher/');
  Logger.log(ok ? 'Mandado.' : 'No salió. Revisa el registro de arriba.');
}
