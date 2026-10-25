// Mi plan · datos de arranque. Genéricos: recetas mexicanas baratas, menús y lista del súper.
// Aquí NO va ningún dato personal: el nombre, el peso y las metas llegan con «Traer de Jarvis»
// o se escriben en el teléfono, y se quedan en el teléfono.
// Precios: promedios de Profeco (abr–may 2026) o estimados; cada quien los cambia en su teléfono.

export const VERSION = '1.1.0'

export const COMIDAS = ['desayuno', 'comida', 'tarde', 'cena']
export const NOMBRE_COMIDA = { desayuno: 'Desayuno', comida: 'Comida', tarde: 'Tarde', cena: 'Cena' }

export const GRUPOS = { prot: 'Proteína', tortilla: 'Tortillería y pan', fruta: 'Fruta y verdura', abarrotes: 'Abarrotes' }

// rinde = porciones por paquete (en la unidad que usan las recetas). base = va cada semana.
export const PRODUCTOS = {
  huevo: { n: 'Huevo', paq: '30 piezas', precio: 79, rinde: 30, g: 'prot', f: 'Profeco' },
  pechuga: { n: 'Pechuga para asar', paq: '4 milanesas', precio: 70, rinde: 4, g: 'prot', f: 'tienda' },
  sardina: { n: 'Sardina en tomate', paq: 'lata de 425 g', precio: 33, rinde: 3, g: 'prot', f: 'Profeco', lata: true },
  atun: { n: 'Atún en agua', paq: '1 lata', precio: 20, rinde: 1, g: 'prot', f: 'estimado', lata: true },
  quesillo: { n: 'Quesillo', paq: '1 bola chica', precio: 20, rinde: 3, g: 'prot', f: 'tienda' },
  jamon: { n: 'Jamón', paq: '250 g', precio: 30, rinde: 12, g: 'prot', f: 'tienda' },
  frijol: { n: 'Frijol negro', paq: '1 kg · rinde 2 semanas', precio: 24, rinde: 28, g: 'abarrotes', f: 'Profeco' },
  avena: { n: 'Avena', paq: 'bolsa de 400 g', precio: 22, rinde: 10, g: 'abarrotes', f: 'estimado' },
  tortilla: { n: 'Tortilla', paq: '1 kg', precio: 24, rinde: 33, g: 'tortilla', f: 'Profeco' },
  pan: { n: 'Pan integral', paq: '1 bolsa', precio: 45, rinde: 16, g: 'tortilla', f: 'estimado' },
  bolillo: { n: 'Bolillo', paq: '1 pieza', precio: 3.5, rinde: 1, g: 'tortilla', f: 'estimado' },
  platano: { n: 'Plátano', paq: '1 kg', precio: 22, rinde: 6, g: 'fruta', f: 'Profeco', base: true },
  fruta: { n: 'Fruta de temporada', paq: '2 kg (naranja, mandarina, guayaba)', precio: 30, g: 'fruta', f: 'estimado', base: true },
  aguacate: { n: 'Aguacate', paq: '1 pieza', precio: 20, rinde: 4, g: 'fruta', f: 'estimado' },
  jicama: { n: 'Jícama', paq: '1 kg', precio: 25, g: 'fruta', f: 'estimado', base: true },
  pepino: { n: 'Pepino', paq: '1 kg', precio: 20, g: 'fruta', f: 'estimado', base: true },
  zanahoria: { n: 'Zanahoria', paq: '½ kg', precio: 9, g: 'fruta', f: 'estimado', base: true },
  calabacita: { n: 'Calabacita', paq: '1 kg', precio: 25, g: 'fruta', f: 'estimado', base: true },
  jitomate: { n: 'Jitomate', paq: '1 kg', precio: 30, g: 'fruta', f: 'estimado', base: true },
  cebolla: { n: 'Cebolla', paq: '½ kg', precio: 12, g: 'fruta', f: 'estimado', base: true },
  limon: { n: 'Limón', paq: '½ kg', precio: 18, g: 'fruta', f: 'Profeco', base: true },
  chiles: { n: 'Chiles', paq: 'unos', precio: 10, g: 'fruta', f: 'estimado', base: true },
}

// Ingrediente: q = cantidad (se multiplica con las porciones), u = unidad, t = texto,
// p = producto del súper, pq = cuánto se gasta de ese producto por porción, $ = costo si no hay producto.
// prep: 'fresco' (se hace al momento), 'domingo' (se cocina el domingo), 'lata'.
// refri: días que aguanta cocinado en el refri. congela: si se puede congelar. lote: se cocina junto con otras.
export const RECETAS = [
  {
    id: 'huevo-mexicana', n: 'Huevo a la mexicana', e: '🍳', c: 'desayuno', min: 15, kcal: 445, prot: 19, prep: 'fresco',
    ing: [{ q: 2, t: 'huevos', p: 'huevo' }, { t: 'Jitomate, cebolla y chile picados', $: 5 },
      { q: 0.5, u: 'taza', t: 'de frijoles', p: 'frijol', pq: 1 }, { q: 2, t: 'tortillas', p: 'tortilla' },
      { q: 1, u: 'cucharadita', t: 'de aceite' }],
    pasos: ['Pica el jitomate, la cebolla y el chile.', 'Sofríe la verdura 2 minutos con la cucharadita de aceite.',
      'Agrega los huevos batidos con sal y mueve hasta que cuajen.', 'Sirve con los frijoles, las tortillas y una fruta.'],
  },
  {
    id: 'huevo-jamon', n: 'Huevo con jamón', e: '🍳', c: 'desayuno', min: 10, kcal: 350, prot: 19, prep: 'fresco',
    ing: [{ q: 2, t: 'huevos', p: 'huevo' }, { q: 1, u: 'rebanada', t: 'de jamón picada', p: 'jamon' },
      { t: 'Jitomate picado', $: 2 }, { q: 2, t: 'tortillas', p: 'tortilla' }, { t: 'Unas gotas de aceite' }],
    pasos: ['Pica el jamón y el jitomate.', 'En el sartén con unas gotas de aceite, sofríelos 1 minuto.',
      'Agrega los huevos batidos y mueve hasta que cuajen.', 'Sirve con las tortillas y una fruta.'],
    nota: 'El jamón es carne procesada: mejor de vez en cuando.',
  },
  {
    id: 'quesadillas', n: 'Quesadillas ligeras', e: '🫓', c: 'desayuno', min: 10, kcal: 365, prot: 17, prep: 'fresco',
    ing: [{ q: 2, t: 'tortillas', p: 'tortilla' }, { q: 1, u: 'tira', t: 'de quesillo', p: 'quesillo' },
      { t: 'Jitomate y calabacita picados', $: 3 }, { q: 0.5, u: 'taza', t: 'de frijoles, aparte', p: 'frijol', pq: 1 }],
    pasos: ['Calienta las tortillas en el comal, sin aceite.', 'Pon el quesillo, el jitomate y la calabacita; dobla y dora de los dos lados.',
      'Sirve con los frijoles aparte y una fruta.'],
  },
  {
    id: 'sandwich-ligero', n: 'Sándwich ligero', e: '🥪', c: 'desayuno', min: 10, kcal: 310, prot: 16, prep: 'fresco',
    ing: [{ q: 2, u: 'rebanadas', t: 'de pan integral', p: 'pan' }, { q: 1, u: 'rebanada', t: 'de jamón', p: 'jamon' },
      { q: 1, t: 'huevo', p: 'huevo' }, { t: 'Rodajas de jitomate', $: 1.5 }, { q: 0.25, t: 'de aguacate', p: 'aguacate', pq: 1 }],
    pasos: ['Cuece o estrella el huevo sin aceite, o con una gota.', 'Arma el sándwich con el jamón, el huevo, el jitomate y el aguacate.',
      'Acompáñalo con una fruta.'],
  },
  {
    id: 'avena-platano', n: 'Avena con plátano', e: '🥣', c: 'desayuno', min: 10, kcal: 360, prot: 11, prep: 'fresco',
    ing: [{ q: 0.5, u: 'taza', t: 'de avena', p: 'avena', pq: 1 }, { q: 1, u: 'taza', t: 'de agua' },
      { q: 1, t: 'plátano', p: 'platano' }, { t: 'Canela al gusto' }, { q: 1, t: 'huevo cocido', p: 'huevo' }],
    pasos: ['Hierve el agua y agrega la avena; mueve de 3 a 5 minutos.', 'Sirve con el plátano en rodajas y canela, sin azúcar.',
      'El huevo cocido va aparte.'],
  },
  {
    id: 'comida-domingo', descongela: 'la milanesa', n: 'Milanesa con arroz y frijoles', e: '🍲', c: 'comida', min: 25, kcal: 595, prot: 39,
    prep: 'domingo', lote: 'milanesas', refri: 3, congela: true,
    ing: [{ q: 1, t: 'milanesa de pechuga', p: 'pechuga' }, { q: 0.5, u: 'taza', t: 'de arroz cocido', $: 1.5 },
      { q: 0.5, u: 'taza', t: 'de frijoles', p: 'frijol', pq: 1 }, { t: 'Ensalada de pepino y jitomate', $: 5 },
      { q: 2, t: 'tortillas', p: 'tortilla' }],
    pasos: ['Calienta la milanesa. Si estaba congelada, pásala al refri la noche anterior.',
      'Sirve con el arroz, los frijoles, la ensalada y las tortillas.'],
    nota: 'El domingo no hay fonda: esta es tu comida.',
  },
  {
    id: 'huevo-fruta', n: 'Huevo cocido y fruta', e: '🍌', c: 'tarde', min: 0, kcal: 170, prot: 6,
    prep: 'domingo', lote: 'huevos', refri: 7, congela: false,
    ing: [{ q: 1, t: 'huevo cocido', p: 'huevo' }, { q: 1, t: 'fruta' }],
    pasos: ['Del refri: un huevo de los que coces el domingo y una fruta.', 'Si sales, llévalos contigo: así no compras lo del camino.'],
  },
  {
    id: 'botana-verdura', n: 'Jícama, pepino y zanahoria', e: '🥒', c: 'tarde', min: 5, kcal: 50, prot: 1,
    prep: 'domingo', lote: 'verdura', refri: 3, congela: false,
    ing: [{ t: 'Tiras de jícama, pepino y zanahoria', $: 4 }, { t: 'Limón y chile en polvo' }],
    pasos: ['Del traste que picaste el domingo.', 'Exprime limón y ponle chile.'],
  },
  {
    id: 'milanesa-asada', descongela: 'la milanesa', n: 'Milanesa asada', e: '🍗', c: 'cena', min: 20, kcal: 410, prot: 37,
    prep: 'domingo', lote: 'milanesas', refri: 3, congela: true,
    ing: [{ q: 1, t: 'milanesa de pechuga (unos 125 g)', p: 'pechuga' }, { q: 1, u: 'cucharadita', t: 'de aceite; sal, pimienta y limón' },
      { t: 'Ensalada de pepino y jitomate', $: 5 }, { q: 0.5, u: 'taza', t: 'de frijoles', p: 'frijol', pq: 1 },
      { q: 1, t: 'tortilla', p: 'tortilla' }],
    pasos: ['Sazona la pechuga con sal, pimienta y limón.', 'Sartén bien caliente con la cucharadita de aceite: 4 minutos por lado.',
      'Sirve con la ensalada, los frijoles y la tortilla.'],
    nota: 'Se asa el domingo: dura 3 días en el refri; las demás, al congelador.',
  },
  {
    id: 'tacos-atun', n: 'Tacos de atún a la mexicana', e: '🌮', c: 'cena', min: 10, kcal: 360, prot: 29,
    prep: 'lata', lata: 'atun', refri: 1, congela: false,
    ing: [{ q: 1, u: 'lata', t: 'de atún en agua', p: 'atun' }, { t: 'Jitomate, cebolla y chile picados', $: 4 },
      { t: 'Limón y sal' }, { q: 3, t: 'tortillas', p: 'tortilla' }],
    pasos: ['Escurre bien el atún.', 'Mézclalo con la verdura picada, limón y sal.', 'Calienta las tortillas y arma tres tacos.'],
  },
  {
    id: 'sardina-ensalada', n: 'Sardina con ensalada', e: '🐟', c: 'cena', min: 10, kcal: 390, prot: 27,
    prep: 'lata', lata: 'sardina', refri: 3, congela: false,
    ing: [{ q: 1 / 3, u: 'de', t: 'lata de sardina en tomate', p: 'sardina', pq: 1 }, { t: 'Cebolla picada, limón y chile', $: 2 },
      { t: 'Ensalada', $: 3 }, { q: 2, t: 'tortillas', p: 'tortilla' }],
    pasos: ['Saca ⅓ de la lata; lo demás, en un traste con tapa al refri (aguanta 3 días).', 'Ponle cebolla picada, limón y chile.',
      'Sirve con la ensalada y las tortillas.'],
    nota: 'Barata y con omega-3, que ayuda con los triglicéridos.',
  },
  {
    id: 'huevo-calabacita', n: 'Huevo con calabacita', e: '🥚', c: 'cena', min: 15, kcal: 385, prot: 21, prep: 'fresco',
    ing: [{ q: 2, t: 'huevos', p: 'huevo' }, { q: 1, t: 'calabacita picada', $: 3 },
      { q: 0.5, u: 'taza', t: 'de frijoles', p: 'frijol', pq: 1 }, { q: 1, t: 'tortilla', p: 'tortilla' },
      { q: 1, u: 'cucharadita', t: 'de aceite' }],
    pasos: ['Sofríe la calabacita picada 3 minutos con la cucharadita de aceite.', 'Agrega los huevos batidos con sal y mueve hasta que cuajen.',
      'Sirve con los frijoles y la tortilla.'],
  },
  {
    id: 'torta-ligera', n: 'Torta ligera', e: '🥖', c: 'cena', min: 10, kcal: 435, prot: 24,
    prep: 'lata', lata: 'atun', refri: 1, congela: false,
    ing: [{ q: 1, t: 'bolillo sin migajón', p: 'bolillo' }, { q: 2, u: 'cucharadas', t: 'de frijoles', p: 'frijol', pq: 0.5 },
      { q: 0.5, u: 'lata', t: 'de atún', p: 'atun' }, { t: 'Rodajas de jitomate', $: 1.5 }, { q: 0.25, t: 'de aguacate', p: 'aguacate', pq: 1 }],
    pasos: ['Abre el bolillo y quítale el migajón.', 'Unta los frijoles y pon el atún, el jitomate y el aguacate.', 'Sin mayonesa: ponle limón y chile si quieres.'],
    nota: 'Una vez por semana: casi la mitad de calorías que la torta de siempre.',
  },
]

export const MENUS = [
  { id: 'pollo', n: 'Pollo', e: '🍗', desayuno: 'huevo-mexicana', cena: 'milanesa-asada' },
  { id: 'sardina', n: 'Sardina', e: '🐟', desayuno: 'quesadillas', cena: 'sardina-ensalada' },
  { id: 'huevo', n: 'Huevo', e: '🥚', desayuno: 'huevo-jamon', cena: 'huevo-calabacita' },
  { id: 'atun', n: 'Atún', e: '🌮', desayuno: 'avena-platano', cena: 'tacos-atun' },
  { id: 'torta', n: 'Torta', e: '🥖', desayuno: 'sandwich-ligero', cena: 'torta-ligera' },
  { id: 'domingo', n: 'Domingo', e: '🍲', desayuno: 'huevo-mexicana', comida: 'comida-domingo', cena: 'huevo-calabacita' },
]

// Semana tipo (lunes a domingo): las 4 milanesas caen lunes, martes, sábado y domingo;
// lunes y martes del refri, sábado y domingo del congelador. Una lata de sardina para miércoles y viernes.
export const SEMANA_TIPO = ['pollo', 'pollo', 'sardina', 'huevo', 'sardina', 'pollo', 'domingo']
export const TARDE = 'huevo-fruta'
export const DIAS_FONDA = [1, 2, 3, 4, 5, 6] // lunes a sábado (0 = domingo)
export const TOPE = 450

export const FONDA = {
  kcal: 805,
  verde: ['Pollo', 'Pechuga asada', 'Tinga', 'Bistec a la mexicana'],
  amarillo: ['Chuleta'],
  rojo: ['Pechuga empanizada', 'Pollo a la crema', 'Enchiladas verdes'],
  pedir: '«Me da el pollo con doble ensalada, por favor, y agua natural.»',
  reglas: ['Arroz y frijoles en la ración chica.', 'Tres tortillas, no cuatro.', 'Si solo hay empanizado, quítale la mitad del empanizado.'],
}
export const FRUTA_KCAL = 100   // la fruta del desayuno
export const BOTANA_KCAL = 50   // jícama, pepino o zanahoria
export const VASOS_AGUA = 8     // vasos de 250 ml ≈ 2 litros

export const EMOJIS = ['🍳', '🥚', '🍗', '🐟', '🌮', '🥖', '🥪', '🫓', '🥣', '🍲', '🥗', '🍌', '🥒', '🌯', '🥘', '🍛', '🍜', '🫘', '🍠', '⭐']
