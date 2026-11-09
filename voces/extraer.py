"""
EFA · saca de la app las frases que se dicen en voz alta, con la misma llave
que usa la app (FNV-1a de clave(texto)), para grabarlas una vez con Kokoro.

Inglés: campos en, q, audio, frase, origen, bien, buena, a, b y los huecos
completos (antes + bien + despues). Español: es, pide, pista, porque, regla,
tip, ctx, y los say('…','es-MX') escritos tal cual.
Lo que la app arma al vuelo (con el nombre del alumno, etc.) no se puede
grabar antes: eso sigue con la voz de siempre.
"""
import json, re, sys, os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FUENTES = ['index.html', 'efa2-bienvenida.html', 'efa2-mundo.js', 'asistente2.js']

def clave(t): return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', str(t).lower()))
def fnv(t):
    h = 0x811c9dc5
    for ch in t:
        h ^= ord(ch); h = (h * 16777619) & 0xffffffff
    return '%08x' % h

NOM_F = set('sarah maria maría ana laura karen lucia lucía sofia sofía elena julia rosa carmen diana patricia claudia emily emma olivia sophia mia lisa mary jennifer linda susan jessica she her'.split())
def sexo(t):
    x = ' ' + re.sub(r'[^a-záéíóúñ ]', ' ', t.lower()) + ' '
    if re.search(r' (she|her|hers|ms|mrs|miss) ', x): return 'f'
    if re.search(r' (he|him|his|mr|sir) ', x): return 'm'
    for n in NOM_F:
        if ' ' + n + ' ' in x: return 'f'
    return 'f' if sum(map(ord, x)) % 2 == 0 else 'm'

def desescapa(s):
    return (s.replace("\\'", "'").replace('\\"', '"').replace('\\n', ' ')
             .replace('\\u2019', '’').replace('\\\\', '\\'))

ES = re.compile(r'[áéíóúñ¿¡]|\b(el|la|los|las|de|que|y|en|un|una|por|para|con|tu|te|se|es|lo|al|del|cómo|qué|dile|di|escucha|repite|toca)\b', re.I)
ES_DE_VERDAD = re.compile(r'[áéíóúñ¿¡ÁÉÍÓÚÑ]|\b(que|el|la|los|las|del|para|por|con|tu|tus|una|uno|muy|dile|escucha|repite|toca|frase|inglés|ingles|ahora|cuando|porque|pero|mas|más|aquí|aqui|esto|esta|este|eres|soy|estoy|hola|gracias|ella|tiene|tengo|mi|mis|su|sus|yo|hay|es|un|va|voy|quiero|puedo|necesito|trabajo|tiempo|bueno|buena|carro|casa|nosotros|ellos|usted|le|les|nos|se|si|ya|y|o|en|de|al|lo|qué|cómo|dónde|cuál|siete|dos|tres|cuatro|cinco|seis|ocho|nueve|diez)\b', re.I)
CAMPOS_EN = 'en|q|audio|frase|origen|bien|buena|a|b'
CAMPOS_ES = 'es|pide|pista|porque|tip|ctx'
DQ = r'"((?:\\.|[^"\\\n]){2,600})"'
SQ = r"'((?:\\.|[^'\\\n]){2,600})'"

def literales(s, campos):
    """(campo, texto) de  campo: 'texto'  o  campo: "texto", sin los que se arman con +."""
    for m in re.finditer(r'\b(' + campos + r')\s*:\s*(?:' + DQ + '|' + SQ + ')', s):
        fin = m.end()
        resto = s[fin:fin + 3].lstrip()
        if resto.startswith('+'): continue            # se arma al vuelo
        yield m.group(1), (m.group(2) if m.group(2) is not None else m.group(3)), m

out = {}
def mete(t, idioma, por):
    t = re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', ' ', desescapa(t))).strip()
    if len(t) < 2 or len(t) > 600 or not re.search(r'[A-Za-záéíóúñ]{2}', t): return
    if re.search(r'[{}<>=;]|\$\{|function|https?:|\.(js|html|mp3|png|json)\b', t): return
    # el campo dice el idioma esperado, pero desde A2 las instrucciones van en inglés:
    # se decide por el texto mismo
    if idioma == 'es' and not ES_DE_VERDAD.search(t): idioma = 'en'
    if idioma == 'en' and re.search(r'[áéíóúñ¿¡]', t): return
    if idioma == 'en' and not re.search(r'[A-Za-z]{2,}\s', t + ' '): return
    k = clave(t)
    if not k: return
    h = fnv(k)
    if h not in out:
        f = {'h': h, 't': t, 's': sexo(t), 'por': por}
        if idioma == 'es': f['es'] = 1
        out[h] = f

for nombre in FUENTES:
    p = os.path.join(RAIZ, nombre)
    if not os.path.exists(p): continue
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'<script id="efa-[a-z]+" type="text/plain">[^<]+</script>', '', s)
    for campo, t, m in literales(s, CAMPOS_EN):
        mete(t, 'en', nombre + ':' + campo)
    for campo, t, m in literales(s, CAMPOS_ES):
        mete(t, 'es', nombre + ':' + campo)
    # regla + porque (se dicen juntas) y huecos completos: se buscan dentro de cada objeto { … }
    for ob in re.finditer(r'\{[^{}]{0,1500}\}', s):
        o = ob.group(0)
        campos = {c: t for c, t, _ in literales(o, 'regla|porque|antes|despues|bien')}
        if 'regla' in campos and 'porque' in campos:
            mete(desescapa(campos['regla']) + ' ' + desescapa(campos['porque']), 'es', nombre + ':regla')
        if 'bien' in campos and ('antes' in campos or 'despues' in campos):
            a, d, b = desescapa(campos.get('antes', '')), desescapa(campos.get('despues', '')), desescapa(campos['bien'])
            mete(a + ' ' + b + ' ' + d, 'en', nombre + ':hueco'); mete(a + b + d, 'en', nombre + ':hueco2')
    # say('…','es-MX') escritos tal cual
    for m in re.finditer(r"say\(\s*'((?:\\.|[^'])+)'\s*,\s*'es-MX'", s):
        mete(m.group(1), 'es', nombre + ':say')
    for m in re.finditer(r"say\(\s*'((?:\\.|[^'])+)'\s*,\s*'en-US'", s):
        mete(m.group(1), 'en', nombre + ':say')

lista = list(out.values())
json.dump(lista, open(os.path.join(AQUI, 'frases.json'), 'w'), ensure_ascii=False)
es = [x for x in lista if x.get('es')]
print('frases:', len(lista), '| inglés:', len(lista) - len(es), '| español:', len(es),
      '| caracteres:', sum(len(x['t']) for x in lista))
