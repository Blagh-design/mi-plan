// Mi plan · la app. Sin librerías: cada pantalla es una función que regresa HTML.
// Los datos viven en el teléfono (almacen.js) y viajan a Claude solo con «Mandar a Jarvis».
import {
  VERSION, COMIDAS, NOMBRE_COMIDA, GRUPOS, PRODUCTOS, RECETAS, MENUS, SEMANA_TIPO, TARDE, DIAS_FONDA, TOPE,
  FONDA, FRUTA_KCAL, BOTANA_KCAL, VASOS_AGUA, EMOJIS,
} from './datos.js'
import * as F from './fechas.js'
import * as A from './almacen.js'

// ---------------------------------------------------------------- utilidades
const $ = (s, r = document) => r.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const ms = (n, f) => `<span class="ms${f ? ' f' : ''}" aria-hidden="true">${n}</span>`
const emo = (e) => `<span class="emo">${esc(e)}</span>`
const plata = (x) => '$' + Math.round(x || 0).toLocaleString('es-MX')
const plata2 = (x) => '$' + (Math.round((x || 0) * 100) / 100).toFixed(2)
const kg = (x) => (Math.round(x * 10) / 10).toFixed(1)
const miles = (x) => Math.round(x || 0).toLocaleString('es-MX')
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const clona = (o) => JSON.parse(JSON.stringify(o))
const numero = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }
const difKg = (x) => (x < 0 ? '−' : '+') + kg(Math.abs(x)) + ' kg'
const FRACC = [[1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']]
function cantidad(q) {
  if (q == null || q === '') return ''
  const e = Math.floor(q + 1e-6), r = q - e
  if (r < 0.02) return String(e)
  const f = FRACC.find(([v]) => Math.abs(r - v) < 0.03)
  if (!f) return String(Math.round(q * 10) / 10)
  return (e ? e + ' ' : '') + f[1]
}
const FR_TXT = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 }
function parseIng(l) {
  const m = l.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔])?\s+(.+)$/)
  if (!m || (!m[1] && !m[2])) return { t: l }
  return { q: (m[1] ? numero(m[1]) : 0) + (m[2] ? FR_TXT[m[2]] : 0), t: m[3] }
}
// Plural sencillo para cuando se multiplican las porciones: «2 tortillas», «2 huevos cocidos».
function plural(w) {
  if (!w || /s$/i.test(w)) return w
  if (/[aeiouáéó]$/i.test(w)) return w + 's'
  if (/z$/i.test(w)) return w.slice(0, -1) + 'ces'
  return w.replace(/ón$/, 'on').replace(/án$/, 'an') + 'es'
}
function textoIng(i, x = 1) {
  if (i.q == null) return x !== 1 ? `${i.t} (×${x})` : i.t
  const qq = i.q * x
  let u = i.u || '', t = i.t || ''
  if (x !== 1) {
    if (!u && /^de /.test(t) && qq >= 1 && Math.abs(qq - Math.round(qq)) < 0.02) t = t.slice(3)
    if (qq > 1 + 1e-6 && u !== 'de') {
      if (u) u = u.replace(/^(\S+)/, (w) => plural(w))
      else t = t.replace(/^(\S+)(\s+\S+(?:ado|ada|ido|ida))?/, (_, w, adj) => plural(w) + (adj ? adj.replace(/(\S+)$/, (a) => plural(a)) : ''))
    }
  }
  return [cantidad(qq), u, t].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------- estado
const E = {
  kv: {}, dias: {}, pesos: {}, recetas: {}, menus: {}, semanas: {}, super: {}, R: {}, M: {},
  ui: { semana: null, yo: 'peso', filtro: 'todas', busca: '', porciones: 1, tachados: {} },
  instalar: null, wake: null, cocina: false, tic: null, sonado: {}, h: null,
}
const kv = (k, def) => (E.kv[k] ? E.kv[k].v : def)
const perfil = () => kv('perfil', null)
const aj = () => kv('ajustes', {})

async function escribe(store, obj) {
  try { await A.pon(store, obj); marca() } catch (e) { aviso('No se pudo guardar en el teléfono: ' + (e?.message || e), 'mal') }
}
// La pestaña de Chrome y la app instalada comparten los datos. Si una guarda algo, la otra lo recarga al volver.
function marca() { try { E.marca = Date.now() + '-' + Math.random().toString(36).slice(2, 6); localStorage.setItem('miplan-marca', E.marca) } catch (e) { /* sin localStorage */ } }
async function recargaSiCambio() {
  let m = null
  try { m = localStorage.getItem('miplan-marca') } catch (e) { return }
  if (!m || m === E.marca || E.hojaAbierta) return
  const d = await A.cargar()
  for (const s of Object.keys(A.CLAVE)) E[s] = d[s] || {}
  E.marca = m; recalcula(); aplicaTema(); pinta()
}
async function guardaKV(k, v, t) { const o = { k, v, actualizado: t || Date.now() }; E.kv[k] = o; await escribe('kv', o) }
async function ajusta(cambios) { await guardaKV('ajustes', { ...aj(), ...cambios }) }
async function guarda(store, obj) {
  obj.actualizado = Date.now()
  E[store][obj[A.CLAVE[store]]] = obj
  if (store === 'recetas' || store === 'menus') recalcula()
  await escribe(store, obj)
}
const diaVacio = (f) => ({ fecha: f, comidas: {}, otra: {}, agua: 0, refresco: 0, caminar: 0, espalda: false, sueno: null, nota: '' })
const dia = (f) => E.dias[f] || diaVacio(f)
async function cambiaDia(f, fn) { const d = clona(dia(f)); d.comidas ||= {}; d.otra ||= {}; fn(d); await guarda('dias', d) }

// ---------------------------------------------------------------- recetas, menús y precios
function recalcula() {
  const R = {}
  for (const r of RECETAS) R[r.id] = { ...r, base: true }
  for (const r of Object.values(E.recetas)) {
    if (r.borrada || r.oculta) { delete R[r.id]; continue }
    if (r.restaurada) continue
    const base = RECETAS.some((b) => b.id === r.id)
    R[r.id] = { ...r, base, editada: base }
  }
  E.R = R
  const M = {}
  for (const m of MENUS) M[m.id] = { ...m, base: true }
  for (const m of Object.values(E.menus)) {
    if (m.borrado) { delete M[m.id]; continue }
    if (m.restaurado) continue
    M[m.id] = { ...m, base: MENUS.some((b) => b.id === m.id) }
  }
  E.M = M
}
const prod = (id) => { const P = PRODUCTOS[id]; if (!P) return null; const o = kv('precios', {})[id]; return o != null ? { ...P, precio: +o } : P }
function costo(r, x = 1) {
  if (!r) return 0
  if (r.costo != null && r.costo !== '') return +r.costo * x
  let s = 0
  for (const i of r.ing || []) {
    const P = i.p && prod(i.p)
    if (P) s += (i.pq ?? i.q ?? 1) * P.precio / (P.rinde || 1)
    else if (i.$) s += +i.$
  }
  return s * x
}

// ---------------------------------------------------------------- la semana
const diasFonda = () => aj().diasFonda || DIAS_FONDA
const semanaTipo = (L) => ({ lunes: L, dias: SEMANA_TIPO.map((menu) => ({ menu })) })
const semana = (L) => E.semanas[L] || semanaTipo(L)
function semanaVista() {
  if (!E.ui.semana) { const h = F.hoyISO(); E.ui.semana = F.dow(h) === 0 ? F.suma(h, 1) : F.lunesDe(h) }
  return E.ui.semana
}
function diaPlan(f, dOtro) {
  const L = F.lunesDe(f), i = F.dif(L, f)
  const d = dOtro || semana(L).dias[i] || { menu: SEMANA_TIPO[i] }
  const M = E.M[d.menu] || E.M[SEMANA_TIPO[i]] || Object.values(E.M)[0] || {}
  const fonda = diasFonda().includes(F.dow(f))
  const r = (id) => (id && E.R[id]) || null
  return {
    fecha: f, i, lunes: L, menu: M, d,
    desayuno: r(d.desayuno || M.desayuno),
    comida: fonda ? 'fonda' : r(d.comida || M.comida || 'comida-domingo'),
    tarde: r(d.tarde || TARDE),
    cena: r(d.cena || M.cena),
  }
}
function kcalDia(p) {
  let k = FRUTA_KCAL + BOTANA_KCAL
  for (const c of COMIDAS) { const r = p[c]; k += r === 'fonda' ? FONDA.kcal : (r?.kcal || 0) }
  return k
}
const costoDia = (p) => COMIDAS.reduce((s, c) => s + (p[c] && p[c] !== 'fonda' ? costo(p[c]) : 0), 0)
const cambiado = (p) => ['desayuno', 'comida', 'tarde', 'cena'].some((c) => p.d[c])

// De dónde sale cada comida: del domingo (refri), congelada, lata nueva o abierta, o fresca.
function fuentes(L) {
  const out = [], latas = {}, nuevas = {}
  for (let i = 0; i < 7; i++) {
    const p = diaPlan(F.suma(L, i)), o = {}
    for (const c of COMIDAS) {
      const r = p[c]
      if (r === 'fonda') { o[c] = { t: 'fonda' }; continue }
      if (!r) { o[c] = null; continue }
      if (r.prep === 'domingo') {
        const dur = r.refri ?? 3
        o[c] = i + 1 <= dur ? { t: 'refri', hasta: F.suma(L, dur - 1) } : r.congela ? { t: 'congelada' } : { t: 'pasado' }
      } else if (r.prep === 'lata' && r.lata && PRODUCTOS[r.lata]) {
        const ing = (r.ing || []).find((x) => x.p === r.lata), uso = ing ? (ing.pq ?? ing.q ?? 1) : 1
        const rinde = PRODUCTOS[r.lata].rinde || 1, l = latas[r.lata]
        if (l && l.quedan >= uso - 1e-6 && i - l.dia <= 2) { l.quedan -= uso; o[c] = { t: 'lata-abierta', dia: F.suma(L, l.dia) } }
        else { latas[r.lata] = { dia: i, quedan: rinde - uso }; nuevas[r.lata] = (nuevas[r.lata] || 0) + 1; o[c] = { t: 'lata' } }
      } else o[c] = { t: 'fresco' }
    }
    out.push(o)
  }
  out.nuevas = nuevas
  return out
}
function etiquetaFuente(f) {
  if (!f) return ''
  switch (f.t) {
    case 'refri': return `<span class="tag verde">${ms('kitchen')}Del domingo</span>`
    case 'congelada': return `<span class="tag hielo">${ms('ac_unit')}Congelada</span>`
    case 'pasado': return `<span class="tag rojo">${ms('warning')}Ya no aguanta</span>`
    case 'lata': return `<span class="tag ambar">${ms('inventory_2')}Lata nueva</span>`
    case 'lata-abierta': return `<span class="tag ambar">${ms('inventory_2')}Lata del ${F.diaC(f.dia).toLowerCase()}</span>`
    case 'fresco': return `<span class="tag azul">${ms('eco')}Fresco</span>`
    default: return ''
  }
}
function frijolToca(L) {
  const P = perfil(), base = P?.inicio ? F.lunesDe(P.inicio) : '2026-01-05'
  return Math.abs(Math.round(F.dif(base, L) / 7)) % 2 === 0
}
function usos(L) {
  const u = {}
  for (let i = 0; i < 7; i++) {
    const p = diaPlan(F.suma(L, i))
    for (const c of COMIDAS) {
      const r = p[c]; if (!r || r === 'fonda') continue
      for (const x of r.ing || []) if (x.p) { (u[x.p] ||= { n: 0, recetas: {} }); u[x.p].n += x.pq ?? x.q ?? 1; u[x.p].recetas[r.n] = (u[x.p].recetas[r.n] || 0) + 1 }
    }
  }
  return u
}
function listaSuper(L) {
  const u = usos(L), fz = fuentes(L), s = E.super[L] || {}, items = []
  for (const id of Object.keys(PRODUCTOS)) {
    const P = prod(id), need = u[id]?.n || 0
    let n = 0
    if (P.lata) n = Math.max(fz.nuevas[id] || 0, Math.ceil(need / (P.rinde || 1) - 1e-9))
    else if (id === 'frijol') n = need ? (frijolToca(L) ? 1 : 0) : 0
    else if (P.base) n = Math.max(1, Math.ceil(need / (P.rinde || 1e9) - 1e-9))
    else if (need) n = Math.ceil(need / (P.rinde || 1) - 1e-9)
    if (!n) continue
    items.push({ id, n: P.n, paq: (n > 1 ? n + ' × ' : '') + P.paq, precio: P.precio * n, g: P.g, f: P.f, recetas: u[id]?.recetas || {} })
  }
  for (const x of s.extras || []) items.push({ id: x.id, n: x.n, paq: x.paq || '', precio: +x.precio || 0, g: 'extra', extra: true, recetas: {} })
  return items
}
const totalSuper = (L, items) => { const t = (E.super[L] || {}).tengo || {}; return items.filter((x) => !t[x.id]).reduce((a, x) => a + x.precio, 0) }
const topeSuper = () => aj().tope || perfil()?.tope_super || TOPE

function preparar(L) {
  const fz = fuentes(L), lotes = {}
  for (let i = 0; i < 7; i++) {
    const p = diaPlan(F.suma(L, i))
    for (const c of COMIDAS) {
      const r = p[c]; if (!r || r === 'fonda' || r.prep !== 'domingo') continue
      const k = r.lote || r.id, f = fz[i][c], l = (lotes[k] ||= { refri: [], cong: [], pasado: [], recetas: [] })
      if (!l.recetas.includes(r)) l.recetas.push(r)
      ;(f.t === 'refri' ? l.refri : f.t === 'congelada' ? l.cong : l.pasado).push(i)
    }
  }
  const diasTxt = (arr) => arr.map((i) => F.DIAS_C[(i + 1) % 7].toLowerCase()).join(', ')
  const hasta = (n) => F.DIAS[F.dow(F.suma(L, n - 1))]
  const pasos = [], guardado = []
  if (usos(L).frijol) {
    if (frijolToca(L)) {
      pasos.push({ id: 'frijol', t: 'Pon la olla de frijoles (1 kg)', k: '1 h 30 min en olla normal, unos 40 min en olla exprés. Mientras, haz lo demás. Lo de lunes a miércoles va al refri; lo demás, en porciones al congelador: rinde 2 semanas.', seg: 90 * 60 })
      guardado.push(['verde', 'kitchen', 'Frijoles · hasta el miércoles'], ['hielo', 'ac_unit', 'Frijoles en porciones'])
    } else {
      pasos.push({ id: 'frijol', t: 'Pasa frijoles del congelador al refri', k: 'Los que guardaste la semana pasada: lo de lunes a miércoles.' })
      guardado.push(['verde', 'kitchen', 'Frijoles · del congelador'])
    }
  }
  for (const [k, l] of Object.entries(lotes)) {
    const n = l.refri.length + l.cong.length + l.pasado.length
    const rep = (arr, dest) => (arr.length ? `${arr.length} ${dest} (${diasTxt(arr)})` : '')
    const reparto = [rep(l.refri, 'al refri'), rep(l.cong, 'al congelador')].filter(Boolean).join(' y ')
    if (k === 'milanesas') {
      pasos.push({ id: k, t: `Asa ${n} milanesa${n > 1 ? 's' : ''}`, k: `4 minutos por lado, con muy poquito aceite. ${reparto}.`, seg: 8 * 60 })
      if (l.refri.length) guardado.push(['verde', 'kitchen', `Milanesas ×${l.refri.length} · hasta el ${hasta(3)}`])
      if (l.cong.length) guardado.push(['hielo', 'ac_unit', `Milanesas ×${l.cong.length} · congelador`])
    } else if (k === 'huevos') {
      pasos.push({ id: k, t: `Cuece ${n} huevo${n > 1 ? 's' : ''}`, k: 'Cuando hierva el agua, 12 minutos; luego a agua fría. Aguantan 7 días en el refri, con todo y cáscara.', seg: 12 * 60 })
      guardado.push(['verde', 'egg', `Huevos ×${n} · hasta el ${hasta(7)}`])
    } else if (k === 'verdura') {
      continue
    } else {
      const r = l.recetas[0]
      pasos.push({ id: k, t: `Prepara ${n} porci${n > 1 ? 'ones' : 'ón'} de ${r.n.toLowerCase()}`, k: reparto ? reparto + '.' : '' })
      if (l.refri.length) guardado.push(['verde', 'kitchen', `${r.n} ×${l.refri.length} · hasta el ${hasta(r.refri ?? 3)}`])
      if (l.cong.length) guardado.push(['hielo', 'ac_unit', `${r.n} ×${l.cong.length} · congelador`])
    }
    for (const i of l.pasado) pasos.push({ id: k + '-' + i, aviso: true, t: `${l.recetas[0].n} del ${F.DIAS[(i + 1) % 7]} ya no aguanta`, k: 'No se congela y pasa de sus días en el refri: cámbiala en tu semana o cocínala ese día.' })
  }
  pasos.push({ id: 'verdura', t: 'Pica jícama, pepino y zanahoria', k: 'En tiras, en un traste con tapa y con limón. Aguantan hasta el miércoles; ese día pica más.' })
  guardado.push(['verde', 'nutrition', 'Verdura picada · hasta el miércoles'])
  pasos.push({ id: 'agua', t: 'Llena tus botellas de agua', k: 'Una para el taller y otra para la casa.' })
  return { domingo: F.suma(L, -1), pasos, guardado }
}

// Lo que hay que hacer en la noche para mañana (descongelar, frijoles, picar).
function recordatorios(f) {
  const out = [], m = F.suma(f, 1), pm = diaPlan(m), fm = fuentes(pm.lunes)[pm.i]
  const cong = [...new Set(COMIDAS.filter((c) => fm[c]?.t === 'congelada').map((c) => pm[c].descongela || pm[c].n.toLowerCase()))]
  if (cong.length) out.push(['hielo', 'ac_unit', `Esta noche pasa al refri: ${cong.join(' y ')}`, 'Es para mañana. Así se descongela despacio y sin riesgo.'])
  if (F.dow(f) === 3 && usos(F.lunesDe(f)).frijol) out.push(['hielo', 'ac_unit', 'Esta noche pasa al refri los frijoles del congelador', 'Para jueves a domingo. Y pica más jícama, pepino y zanahoria.'])
  if (F.dow(f) === 6) out.push(['ter', 'shopping_cart', 'Mañana: súper y preparar la semana', 'Revisa tu lista antes de salir.', '#super'])
  if (F.dow(f) === 0) out.push(['tono', 'skillet', 'Hoy toca preparar tu semana', 'Unos 90 minutos, casi todo es esperar los frijoles.', '#preparar'])
  if (F.dow(f) === 1 && !E.pesos[f]?.kg) out.push(['ter', 'monitor_weight', 'Hoy es lunes: pésate en ayunas', 'Después del baño, con la misma báscula.', 'peso'])
  return out
}

// ---------------------------------------------------------------- conteos
const enPlan = (st) => st === 'si' || st === 'verde' || st === 'amarillo'
const cuentaPlan = (d) => COMIDAS.filter((c) => enPlan(d.comidas?.[c])).length
function numSemana(f) {
  const P = perfil(); if (!P?.inicio) return 0
  const n = Math.floor(F.dif(F.lunesDe(P.inicio), F.lunesDe(f)) / 7) + 1
  return n >= 1 && f >= P.inicio ? n : 0
}
function diasSinRefresco() {
  const h = F.hoyISO()
  if (E.dias[h]?.refresco) return 0
  const fechas = Object.values(E.dias).filter((d) => d.refresco > 0 && d.fecha < h).map((d) => d.fecha).sort()
  if (fechas.length) return F.dif(fechas[fechas.length - 1], h)
  const base = perfil()?.inicio
  return base && base <= h ? F.dif(base, h) + 1 : 0
}
function resumenSemana(L) {
  const h = F.hoyISO(), fechas = [...Array(7)].map((_, i) => F.suma(L, i)).filter((f) => f <= h)
  const pk = fechas.map((f) => E.pesos[f]?.kg).filter((x) => x != null)
  const ci = fechas.map((f) => E.pesos[f]?.cintura).filter((x) => x != null)
  let plan = 0, conDato = 0, sinRef = 0, caminar = 0
  const sueno = []
  for (const f of fechas) {
    const d = E.dias[f]; if (!d) continue
    conDato++
    if (cuentaPlan(d) >= 3) plan++
    if (!d.refresco) sinRef++
    caminar += d.caminar || 0
    if (d.sueno) sueno.push(d.sueno)
  }
  const lun = E.pesos[L]?.kg
  return {
    L, dias: fechas.length, conDato, plan, sinRef, caminar,
    peso: lun ?? (pk.length ? pk.reduce((a, b) => a + b, 0) / pk.length : null),
    cintura: ci.length ? ci[ci.length - 1] : null,
    sueno: sueno.length ? sueno.reduce((a, b) => a + b, 0) / sueno.length : null,
  }
}
const pesosOrden = () => Object.values(E.pesos).filter((x) => x.kg != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))

// ---------------------------------------------------------------- tema
function temaOscuro() {
  const t = aj().tema || 'auto'
  if (t === 'noche') return true
  if (t === 'menta') return false
  if (t === 'hora') { const h = new Date().getHours(); return h >= 19 || h < 7 }
  return matchMedia('(prefers-color-scheme: dark)').matches
}
function aplicaTema() {
  const t = aj().tema || 'auto', root = document.documentElement
  if (t === 'auto') root.removeAttribute('data-tema')
  else root.setAttribute('data-tema', t === 'hora' ? (temaOscuro() ? 'noche' : 'menta') : t)
  $('meta[name=theme-color]')?.setAttribute('content', temaOscuro() ? '#0E1415' : '#F5FBF6')
  try { localStorage.setItem('miplan-tema', t) } catch (e) { /* sin localStorage no pasa nada */ }
}

// ---------------------------------------------------------------- piezas de pantalla
const NAV = [['hoy', 'today', 'Hoy'], ['semana', 'calendar_month', 'Semana'], ['recetas', 'menu_book', 'Recetas'], ['super', 'shopping_cart', 'Súper'], ['yo', 'person', 'Yo']]
const nav = (on) => `<nav class="nb" aria-label="Secciones"><div class="in">${NAV.map(([r, i, t]) =>
  `<a href="#${r}" class="${r === on ? 'on' : ''}"${r === on ? ' aria-current="page"' : ''}><span class="pi">${ms(i, r === on)}</span>${t}</a>`).join('')}</div></nav>`
const barra = (t1, t2, der = '') => `<div class="tt"><div class="h1">${t1}</div>${t2 ? `<div class="h2">${t2}</div>` : ''}</div>${der}`
const atras = (href, titulo, sub = '', der = '') =>
  `<a class="ib" href="${href}" aria-label="Regresar">${ms('arrow_back')}</a><div class="tt"><div class="h1" style="font-size:19px">${titulo}</div>${sub ? `<div class="h2">${sub}</div>` : ''}</div>${der}`
const inicial = () => esc((perfil()?.nombre || '🙂').trim().charAt(0).toUpperCase())
function ultimoEnvio() { const a = aj(); return Math.max(a.ultimoCopiado || 0, a.ultimoRecibido || 0) }
function pendientes() {
  const t = ultimoEnvio(), n = {}
  for (const s of ['pesos', 'dias', 'recetas', 'menus', 'semanas', 'super']) n[s] = Object.values(E[s]).filter((r) => (r.actualizado || 0) > t).length
  n.perfil = (E.kv.perfil?.actualizado || 0) > t ? 1 : 0
  n.total = Object.values(n).reduce((a, b) => a + b, 0)
  return n
}
function iconoNube() {
  const nunca = !ultimoEnvio(), pend = pendientes().total > 0
  return `<a class="ib" href="#jarvis" aria-label="Mandar a Jarvis">${ms(nunca ? 'cloud_off' : pend ? 'cloud_upload' : 'cloud_done')}${pend ? '<span class="punto"></span>' : ''}</a>`
}
function anillo(n, de = 4) {
  const r = 26, c = 2 * Math.PI * r
  return `<svg width="76" height="76" viewBox="0 0 64 64" role="img" aria-label="${n} de ${de} comidas en el plan"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--card)" stroke-width="8"/>`
    + `<circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pri)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(c * n / de).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>`
    + `<text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">${n}/${de}</text></svg>`
}
const tarjetaAviso = ([cls, icono, t, sub, destino]) => {
  const dentro = `${ms(icono, true)}<span style="flex:1"><b>${t}</b>${sub ? `<div class="s">${sub}</div>` : ''}</span>${destino ? ms('chevron_right') : ''}`
  if (!destino) return `<div class="card ${cls} toca">${dentro}</div>`
  return destino.startsWith('#') ? `<a class="card ${cls} toca" href="${destino}">${dentro}</a>` : `<button class="card ${cls} toca" data-a="${destino}">${dentro}</button>`
}

// ---------------------------------------------------------------- pantallas
function vHoy() {
  const f = F.hoyISO(), d = dia(f), p = diaPlan(f), fz = fuentes(p.lunes)[p.i]
  const P = perfil(), n = cuentaPlan(d), sinRef = diasSinRefresco(), sem = numSemana(f)
  const tarjetas = [tarjetaInstalar()].filter(Boolean)
  const m = kv('mensaje', null)
  if (m?.texto && !m.visto) {
    tarjetas.push(`<div class="card ter"><div class="fila entre"><b>${ms('smart_toy', true)} Jarvis te dejó un mensaje</b><button class="ib" data-a="mensaje-visto" aria-label="Ya lo leí">${ms('close')}</button></div><p>${esc(m.texto)}</p>${m.fecha ? `<div class="s">${esc(F.cuando(Date.parse(m.fecha)))}</div>` : ''}</div>`)
  }
  for (const r of recordatorios(f)) tarjetas.push(tarjetaAviso(r))
  const filas = COMIDAS.map((c) => filaComida(c, p, d, fz)).join('')
  const gotas = [...Array(VASOS_AGUA)].map((_, i) => `<button class="${i < (d.agua || 0) ? 'si' : ''}" data-a="agua" data-n="${i + 1}" aria-label="${i + 1} vasos">${ms('water_drop', i < (d.agua || 0))}</button>`).join('')
  const cuerpo = `
    <div class="card tono hero">${anillo(n)}<div><div class="k">Tu día</div><div class="v">${n} de 4 comidas en el plan</div>
      ${sinRef ? `<span class="pill">${emo('🔥')} ${sinRef} día${sinRef === 1 ? '' : 's'} sin refresco</span>` : ''}</div></div>
    ${tarjetas.join('')}
    <div class="sec-t">Tus comidas · unas ${miles(kcalDia(p))} kcal</div>
    <div class="card lista">${filas}</div>
    <div class="card"><div class="fila entre"><b>Agua</b><span class="s">${d.agua || 0} de ${VASOS_AGUA} vasos</span></div><div class="gotas">${gotas}</div></div>
    <div class="chips">
      <button class="chip${d.caminar ? ' sel' : ''}" data-a="caminar">${ms('directions_walk')} ${d.caminar ? d.caminar + ' min' : 'Caminé'}</button>
      <button class="chip${d.espalda ? ' sel' : ''}" data-a="espalda">${ms(d.espalda ? 'check' : 'fitness_center')} Espalda</button>
      <button class="chip${d.refresco ? ' sel' : ''}" data-a="refresco">${ms('local_drink')} Refresco: ${d.refresco || 0}</button>
      <button class="chip${d.sueno ? ' sel' : ''}" data-a="sueno">${ms('bedtime')} ${d.sueno ? 'Dormí ' + String(d.sueno).replace('.', ',') + ' h' : 'Dormí'}</button>
    </div>
    ${d.nota ? `<div class="card"><div class="k s">Tu nota de hoy</div><p>${esc(d.nota)}</p></div>` : ''}`
  const der = `${iconoNube()}<a class="av" href="#yo" aria-label="Tu progreso">${inicial()}</a>`
  return { barra: barra(`Hola${P?.nombre ? ', ' + esc(P.nombre) : ''}`, `${F.larga(f)}${sem ? ' · semana ' + sem : ''}`, der), cuerpo, nav: 'hoy', fab: { a: 'anotar', i: 'add', t: 'Anotar' } }
}
const FONDA_TXT = { verde: 'Verde: dentro del plan', amarillo: 'Amarillo: de vez en cuando', rojo: 'Rojo: otro día pide verde', no: 'Comí en otro lado' }
function filaComida(c, p, d, fz) {
  const r = p[c], st = d.comidas?.[c] || null
  let e, k, v
  if (r === 'fonda') { e = '🍽️'; k = 'Comida · fonda'; v = st ? FONDA_TXT[st] || 'Dentro del plan' : 'Pide verde, doble ensalada y agua' }
  else if (!r) { e = '❔'; k = NOMBRE_COMIDA[c]; v = 'Escoge qué comer' }
  else {
    e = r.e; k = NOMBRE_COMIDA[c] + (c === 'desayuno' ? ' · con una fruta' : c === 'tarde' ? ' · o jícama con limón' : '')
    v = esc(r.n) + (c === 'cena' || c === 'comida' ? ' ' + etiquetaFuente(fz[c]) : '')
  }
  if (st === 'no' && d.otra?.[c]) v = 'Comí: ' + esc(d.otra[c])
  const cls = { si: 'si', verde: 'verde', amarillo: 'amarillo', rojo: 'rojo', no: 'no' }[st] || ''
  return `<div class="li"><button class="ph" data-a="comida" data-c="${c}" aria-label="Opciones de ${NOMBRE_COMIDA[c]}">${emo(e)}</button>`
    + `<button data-a="comida" data-c="${c}" style="min-width:0"><div class="k">${k}</div><div class="v">${v}</div></button>`
    + `<button class="ok ${cls}" data-a="palomea" data-c="${c}" aria-label="${NOMBRE_COMIDA[c]}: ${st ? 'anotado' : 'sin anotar'}">${ms(st === 'no' || st === 'rojo' ? 'close' : 'check')}</button></div>`
}

function vSemana() {
  const L = semanaVista(), h = F.hoyISO(), fz = fuentes(L), items = listaSuper(L), total = totalSuper(L, items), tope = topeSuper()
  const filas = [...Array(7)].map((_, i) => {
    const f = F.suma(L, i), p = diaPlan(f)
    const prin = p.comida !== 'fonda' && p.comida?.prep === 'domingo' ? 'comida' : 'cena'
    const sub = [p.desayuno?.n, p.comida !== 'fonda' ? p.comida?.n : null, p.cena?.n].filter(Boolean).join(' · ')
    return `<button class="dia${f === h ? ' hoy' : ''}" data-a="dia" data-f="${f}"><div class="dc">${F.diaC(f)}<small>${F.deISO(f).getDate()}</small></div>`
      + `<div style="min-width:0"><div class="v">${emo(p.menu.e || '🍽️')} ${esc(p.menu.n || 'Menú')}${cambiado(p) ? ' <span class="tag gris">cambiado</span>' : ''}</div><div class="k">${esc(sub)}</div></div>`
      + `<div class="der">${etiquetaFuente(fz[i][prin])}<span class="kc">${miles(kcalDia(p))} kcal</span></div></button>`
  }).join('')
  const der = `<button class="ib" data-a="semana-mueve" data-n="-7" aria-label="Semana anterior">${ms('chevron_left')}</button><button class="ib" data-a="semana-mueve" data-n="7" aria-label="Semana siguiente">${ms('chevron_right')}</button>`
  const sem = numSemana(L)
  const cuerpo = `
    <a class="card toca" href="#super">${ms('shopping_cart')}<span style="flex:1"><b>Súper: ${plata(total)}</b> <span class="s">de ${plata(tope)}</span>
      <div class="prog${total > tope ? ' pasa' : ''}" style="margin-top:8px"><div style="width:${Math.min(100, 100 * total / tope).toFixed(0)}%"></div></div></span>${ms('chevron_right')}</a>
    <a class="card toca tono" href="#preparar">${ms('skillet', true)}<span style="flex:1"><b>Preparar el ${F.larga(F.suma(L, -1)).toLowerCase()}</b><div class="s">Qué cocinar y qué va al refri o al congelador</div></span>${ms('chevron_right')}</a>
    <div class="card lista">${filas}</div>
    <div class="btns"><button class="btn ton" data-a="menus">${ms('restaurant_menu')} Mis menús</button><button class="btn out" data-a="semana-tipo">${ms('restart_alt')} Semana tipo</button></div>
    <p class="s">Toca un día para cambiar su menú o una comida. El súper y lo que preparas el domingo se ajustan solos.</p>`
  return { barra: barra('Tu semana', `${F.rango(L)}${sem ? ' · semana ' + sem : ''}`, der), cuerpo, nav: 'semana' }
}

function vPreparar() {
  const L = semanaVista(), pr = preparar(L), hechos = kv('preparado', {})[L] || {}, timers = kv('timers', {})
  const pasos = pr.pasos.map((s, n) => {
    if (s.aviso) return `<div class="tl"><span class="nu" style="background:var(--err-cont);color:var(--on-err-cont)">${ms('warning')}</span><div><div class="v">${esc(s.t)}</div><div class="k">${esc(s.k)}</div></div></div>`
    const fin = timers[s.id], hecho = !!hechos[s.id]
    const reloj = s.seg ? `<button class="reloj${fin ? (fin > Date.now() ? ' corre' : ' listo') : ''}" data-a="reloj" data-id="${s.id}" data-seg="${s.seg}" data-reloj="${s.id}">${ms(fin ? 'timer' : 'play_arrow', true)} <b>${fin ? mmss(Math.max(0, Math.round((fin - Date.now()) / 1000))) || '¡Listo!' : mmss(s.seg)}</b></button>` : ''
    return `<div class="tl${hecho ? ' hecho' : ''}"><button class="nu" data-a="paso" data-id="${s.id}" aria-label="Paso ${n + 1}: ${hecho ? 'hecho' : 'pendiente'}">${hecho ? ms('check') : n + 1}</button><div><button data-a="paso" data-id="${s.id}" style="text-align:left"><div class="v">${esc(s.t)}</div><div class="k">${esc(s.k)}</div></button>${reloj}</div></div>`
  }).join('')
  const cuerpo = `
    <button class="card ter toca" data-a="cocina">${ms('light_mode', true)}<span style="flex:1"><b>Modo cocina</b><div class="s">${E.cocina ? 'La pantalla se queda prendida' : 'Para que la pantalla no se apague'}</div></span><span class="sw${E.cocina ? ' on' : ''}"></span></button>
    <div class="card lista">${pasos}</div>
    <div class="sec-t">Así queda tu refri</div>
    <div class="fila">${pr.guardado.map(([c, i, t]) => `<span class="tag ${c}">${ms(i)}${esc(t)}</span>`).join('')}</div>
    <p class="s">Comida cocinada: 3 a 4 días en el refri; huevo cocido, una semana (USDA). Lo congelado pásalo al refri la noche anterior.</p>`
  return { barra: atras('#semana', 'Preparar', `${F.larga(pr.domingo)} · semana del ${F.rango(L)}`), cuerpo, nav: 'semana' }
}
function mmss(s) {
  if (s <= 0) return ''
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}

const FILTROS = [['todas', 'Todas'], ['desayuno', 'Desayuno'], ['comida', 'Comida'], ['tarde', 'Tarde'], ['cena', 'Cena'], ['domingo', 'Se cocina el domingo'], ['barato', 'Barato'], ['mias', 'Mías']]
const ORDEN_C = { desayuno: 0, comida: 1, tarde: 2, cena: 3 }
function recetasFiltradas() {
  const q = E.ui.busca.trim().toLowerCase(), fil = E.ui.filtro
  return Object.values(E.R).filter((r) => {
    const ok = fil === 'todas' || (fil === 'mias' ? (!r.base || r.editada) : fil === 'domingo' ? r.prep === 'domingo' : fil === 'barato' ? costo(r) < 15 : r.c === fil)
    return ok && (!q || (r.n + ' ' + (r.ing || []).map((i) => i.t).join(' ')).toLowerCase().includes(q))
  }).sort((a, b) => (ORDEN_C[a.c] ?? 9) - (ORDEN_C[b.c] ?? 9) || a.n.localeCompare(b.n, 'es'))
}
const tarjetasRecetas = () => {
  const l = recetasFiltradas()
  if (!l.length) return '<p class="s" style="grid-column:1/-1">No encontré recetas así. Prueba con otra palabra o crea una nueva.</p>'
  return l.map((r) => `<a class="rc" href="#receta/${encodeURIComponent(r.id)}"><div class="im">${emo(r.e)}${!r.base ? '<span class="tag verde">Tuya</span>' : r.editada ? '<span class="tag gris">Editada</span>' : ''}</div><div class="tx"><div class="n">${esc(r.n)}</div><div class="m">${NOMBRE_COMIDA[r.c] || ''} · ${r.min ? r.min + ' min · ' : ''}${plata(costo(r))}${r.kcal ? ' · ' + r.kcal + ' kcal' : ''}</div></div></a>`).join('')
}
function vRecetas() {
  const n = Object.keys(E.R).length, mias = Object.values(E.R).filter((r) => !r.base).length
  const cuerpo = `
    <div class="busca">${ms('search')}<input id="busca" type="search" placeholder="Buscar: pollo, huevo, frijol…" value="${esc(E.ui.busca)}" aria-label="Buscar receta" autocomplete="off"></div>
    <div class="chips">${FILTROS.map(([k, t]) => `<button class="chip${E.ui.filtro === k ? ' sel' : ''}" data-a="filtro" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="rejilla" id="rejilla">${tarjetasRecetas()}</div>`
  return { barra: barra('Recetas', `${n} recetas${mias ? ' · ' + mias + ' tuyas' : ''}`), cuerpo, nav: 'recetas', fab: { a: 'receta-nueva', i: 'add', t: 'Nueva' } }
}
function vReceta(id) {
  const r = E.R[id]
  if (!r) return { barra: atras('#recetas', 'Receta'), cuerpo: '<div class="card">Esta receta ya no existe.</div>', nav: 'recetas' }
  const x = E.ui.porciones || 1, tach = E.ui.tachados[id] || {}
  const tags = []
  if (r.prep === 'domingo') tags.push(`<span class="tag verde">${ms('kitchen')}Se cocina el domingo · ${r.refri ?? 3} días en el refri</span>`)
  else if (r.prep === 'lata') tags.push(`<span class="tag ambar">${ms('inventory_2')}De lata${r.refri ? ' · abierta, ' + r.refri + ' día' + (r.refri > 1 ? 's' : '') + ' en el refri' : ''}</span>`)
  else tags.push(`<span class="tag azul">${ms('eco')}Se hace al momento</span>`)
  tags.push(r.congela ? `<span class="tag hielo">${ms('ac_unit')}Se congela</span>` : `<span class="tag gris">${ms('block')}No se congela</span>`)
  const parecidas = r.c === 'cena' ? Object.values(E.R).filter((o) => o.c === 'cena' && o.id !== r.id).sort((a, b) => costo(a) - costo(b)).slice(0, 3) : []
  const cuerpo = `
    <div class="heroimg">${emo(r.e)}</div>
    <div class="fila"><span class="chip">${ms('schedule')} ${r.min || 0} min</span><span class="chip">${ms('payments')} ${plata2(costo(r, x))}${x > 1 ? ' · ' + x + ' porciones' : ''}</span>${r.kcal ? `<span class="chip">${ms('local_fire_department')} ${r.kcal} kcal</span>` : ''}${r.prot ? `<span class="chip">${ms('egg')} ${r.prot} g proteína</span>` : ''}</div>
    <div class="fila">${tags.join('')}</div>
    ${r.nota ? `<div class="card tono">${esc(r.nota)}</div>` : ''}
    <div class="fila entre"><div class="sec-t" style="margin:0">Ingredientes</div><div class="chips" style="padding:0">${[1, 2, 4].map((n) => `<button class="chip${x === n ? ' sel' : ''}" data-a="porciones" data-n="${n}">×${n}</button>`).join('')}</div></div>
    <div class="card" style="padding:4px 14px">${(r.ing || []).map((i, n) => `<button class="ing${tach[n] ? ' hecho' : ''}" data-a="tacha" data-id="${esc(r.id)}" data-n="${n}">${ms(tach[n] ? 'check_circle' : 'radio_button_unchecked', tach[n])}<span>${esc(textoIng(i, x))}</span></button>`).join('') || '<p class="s">Sin ingredientes todavía.</p>'}</div>
    <div class="sec-t">Pasos</div>
    <div class="card">${(r.pasos || []).map((p, n) => `<div class="paso"><b>${n + 1}</b><span>${esc(p)}</span></div>`).join('') || '<p class="s">Sin pasos todavía.</p>'}</div>
    ${parecidas.length ? `<div class="sec-t">Piezas que se cambian por esta</div><div class="card lista">${parecidas.map((o) => `<a class="li" href="#receta/${encodeURIComponent(o.id)}"><span class="ph">${emo(o.e)}</span><span><div class="v">${esc(o.n)}</div><div class="k">${o.prot ? '≈' + o.prot + ' g de proteína · ' : ''}${plata(costo(o))}</div></span>${ms('chevron_right')}</a>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn" data-a="a-semana" data-id="${esc(r.id)}">${ms('calendar_add_on')} A mi semana</button><a class="btn out" href="#editar/${encodeURIComponent(r.id)}">${ms('edit')} Editar</a><a class="btn out" href="#editar/${encodeURIComponent('copia:' + r.id)}">${ms('content_copy')} Copiar</a></div>`
  return { barra: atras('#recetas', esc(r.n), NOMBRE_COMIDA[r.c] || ''), cuerpo, nav: 'recetas' }
}
function vEditar(id) {
  let r
  if (id === 'nueva') r = { id: 'r-' + uid(), n: '', e: '⭐', c: 'cena', min: 15, kcal: '', prot: '', prep: 'fresco', refri: 3, congela: false, ing: [], pasos: [], nueva: true }
  else if (id?.startsWith('copia:')) {
    const o = E.R[id.slice(6)]
    if (o) r = { ...clona(o), id: 'r-' + uid(), n: 'Mi ' + o.n.charAt(0).toLowerCase() + o.n.slice(1), nueva: true, base: false, editada: false }
  } else if (E.R[id]) r = clona(E.R[id])
  if (!r) return { barra: atras('#recetas', 'Receta'), cuerpo: '<div class="card">No encontré esa receta.</div>', nav: 'recetas' }
  delete r.lote
  if (E.R[id]?.lote) r.lote = E.R[id].lote
  E.ui.edit = r
  const chip = (a, k, v, sel, t) => `<button class="chip${sel ? ' sel' : ''}" data-a="${a}" data-${k}="${v}">${t}</button>`
  const cuerpo = `
    <label class="campo">Nombre<input id="e-n" value="${esc(r.n)}" placeholder="Ej. Pollo con verduras" maxlength="60" autocomplete="off"></label>
    <div class="campo"><span class="campo">Dibujo</span><div class="emos">${EMOJIS.map((e) => `<button class="${e === r.e ? 'sel' : ''}" data-a="e-emo" data-e="${e}" aria-label="Dibujo ${e}">${emo(e)}</button>`).join('')}</div></div>
    <div class="campo"><span class="campo">¿Para cuándo?</span><div class="chips">${COMIDAS.map((c) => chip('e-c', 'c', c, r.c === c, NOMBRE_COMIDA[c])).join('')}</div></div>
    <div class="fila" style="flex-wrap:nowrap"><label class="campo" style="flex:1">Minutos<input id="e-min" type="number" inputmode="numeric" min="0" value="${r.min ?? ''}"></label><label class="campo" style="flex:1">Calorías<input id="e-kcal" type="number" inputmode="numeric" min="0" value="${r.kcal ?? ''}" placeholder="aprox."></label><label class="campo" style="flex:1">Proteína g<input id="e-prot" type="number" inputmode="numeric" min="0" value="${r.prot ?? ''}" placeholder="aprox."></label></div>
    <label class="campo">Ingredientes · uno por renglón, para 1 porción<textarea id="e-ing" rows="6" placeholder="2 huevos&#10;½ taza de frijoles&#10;2 tortillas">${esc((r.ing || []).map((i) => textoIng(i)).join('\n'))}</textarea></label>
    <label class="campo">Pasos · uno por renglón<textarea id="e-pasos" rows="5" placeholder="Pica la verdura.&#10;Sofríe 2 minutos.">${esc((r.pasos || []).join('\n'))}</textarea></label>
    <div class="campo"><span class="campo">¿Cómo se guarda?</span><div class="chips">${chip('e-prep', 'p', 'fresco', r.prep !== 'domingo' && r.prep !== 'lata', 'Se hace al momento')}${chip('e-prep', 'p', 'domingo', r.prep === 'domingo', 'Se cocina el domingo')}${chip('e-prep', 'p', 'lata', r.prep === 'lata', 'De lata')}</div></div>
    <div class="fila" style="flex-wrap:nowrap;align-items:flex-end"><label class="campo" style="flex:1">Días que aguanta en el refri<select id="e-refri">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}"${n === (r.refri ?? 3) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${chip('e-congela', 'x', '1', !!r.congela, ms('ac_unit') + ' Se congela')}</div>
    <label class="campo">Costo por porción (si lo sabes)<input id="e-costo" type="number" inputmode="decimal" min="0" step="0.5" placeholder="Calculado: ${plata2(costo({ ...r, costo: null }))}" value="${r.costo ?? ''}"></label>
    <label class="campo">Nota (si quieres)<input id="e-nota" value="${esc(r.nota || '')}" maxlength="140"></label>
    <button class="btn ancho" data-a="e-guarda">${ms('save')} Guardar</button>
    ${r.nueva ? '' : r.base ? `${r.editada ? `<button class="btn ancho out" data-a="e-restaura">${ms('restart_alt')} Regresar a la original</button>` : ''}<button class="btn ancho texto" data-a="e-quita">${ms('visibility_off')} Quitar de mis recetas</button>` : `<button class="btn ancho peligro" data-a="e-borra">${ms('delete')} Borrar receta</button>`}`
  return { barra: atras(r.nueva ? '#recetas' : '#receta/' + encodeURIComponent(r.id), r.nueva ? 'Nueva receta' : 'Editar receta'), cuerpo, nav: 'recetas' }
}

function vSuper() {
  const L = semanaVista(), items = listaSuper(L), s = E.super[L] || {}, tope = topeSuper(), total = totalSuper(L, items)
  const comprado = s.comprado || {}, tengo = s.tengo || {}
  const orden = ['prot', 'tortilla', 'fruta', 'abarrotes', 'extra']
  const grupos = orden.map((g) => {
    const xs = items.filter((x) => x.g === g); if (!xs.length) return ''
    return `<div class="grupo">${g === 'extra' ? 'Lo que agregaste' : GRUPOS[g]}</div>` + xs.map((x) => {
      const c = !!comprado[x.id], t = !!tengo[x.id]
      return `<div class="ck${c ? ' hecho' : ''}${t ? ' tengo' : ''}"><button data-a="compra" data-id="${esc(x.id)}" aria-label="${esc(x.n)}: ${c ? 'comprado' : 'por comprar'}"><i class="${c ? 'si' : ''}">${c ? ms('check') : ''}</i></button>`
        + `<button class="t" data-a="compra" data-id="${esc(x.id)}">${esc(x.n)}<small>${esc(x.paq)}${t ? ' · ya lo tienes' : ''}</small></button>`
        + `<button class="p" data-a="item" data-id="${esc(x.id)}" aria-label="Precio y opciones de ${esc(x.n)}">${plata(x.precio)} ${ms('more_vert')}</button></div>`
    }).join('')
  }).join('')
  const hechos = items.filter((x) => comprado[x.id] && !tengo[x.id]).length, faltan = items.filter((x) => !tengo[x.id]).length
  const h = F.hoyISO()
  const otra = F.dow(h) === 6 && L === F.lunesDe(h) ? `<button class="card ter toca" data-a="semana-mueve" data-n="7">${ms('event', true)}<span style="flex:1"><b>¿Vas al súper para la otra semana?</b><div class="s">Ver la lista de la semana que viene</div></span>${ms('chevron_right')}</button>` : ''
  const cuerpo = `
    ${otra}
    <div class="card tono"><div class="fila entre"><b style="font-size:20px">${plata(total)} de ${plata(tope)}</b><span class="s">${total <= tope ? 'Te sobran ' + plata(tope - total) : 'Te pasas por ' + plata(total - tope)}</span></div>
      <div class="prog${total > tope ? ' pasa' : ''}" style="margin-top:10px"><div style="width:${Math.min(100, 100 * total / tope).toFixed(0)}%"></div></div>
      <div class="s" style="margin-top:8px">${hechos} de ${faltan} en el carrito</div></div>
    ${total > tope && E.R['milanesa-asada'] && E.R['huevo-calabacita'] ? `<div class="card ambar">Para bajar: cambia una cena de pollo por huevo con calabacita en tu semana (ahorras unos ${plata(costo(E.R['milanesa-asada']) - costo(E.R['huevo-calabacita']))} cada vez), o marca lo que ya tienes.</div>` : ''}
    <div class="card lista">${grupos}</div>
    <div class="btns"><button class="btn ton" data-a="extra">${ms('add')} Agregar algo</button><button class="btn out" data-a="comparte">${ms('share')} Compartir</button></div>
    <p class="s">Ya tienes en casa: aceite, sal, canela y especias. Precios de Profeco o estimados: toca el precio para cambiarlo.</p>`
  const der = `<button class="ib" data-a="semana-mueve" data-n="-7" aria-label="Semana anterior">${ms('chevron_left')}</button><button class="ib" data-a="semana-mueve" data-n="7" aria-label="Semana siguiente">${ms('chevron_right')}</button>`
  return { barra: barra('Súper', 'Semana del ' + F.rango(L), der), cuerpo, nav: 'super' }
}

function grafica() {
  const P = perfil(); if (!P?.peso_inicio) return ''
  const base = P.fecha_peso_inicio || P.inicio || F.hoyISO(), k0 = P.peso_inicio
  const sem = (f) => F.dif(base, f) / 7
  const porSemana = {}
  for (const x of pesosOrden()) { if (x.fecha < base) continue; const L = F.lunesDe(x.fecha); (porSemana[L] ||= []).push(x) }
  const pts = [[0, k0]]
  for (const [L, arr] of Object.entries(porSemana)) {
    const lun = arr.find((x) => x.fecha === L)
    if (lun) pts.push([sem(L), lun.kg])
    else pts.push([sem(arr[arr.length - 1].fecha), arr.reduce((a, x) => a + x.kg, 0) / arr.length])
  }
  pts.sort((a, b) => a[0] - b[0])
  const L0 = F.lunesDe(base)
  const wHoy = Math.max(0, Math.ceil(sem(F.hoyISO()))), N = Math.max(12, wHoy + 4)
  const metas = (P.metas || []).map((m) => m.kg).filter((v) => v > 0)
  const ys = pts.map((p) => p[1])
  const yMin = Math.floor(Math.min(...metas, ...ys) - 2), yMax = Math.ceil(Math.max(k0, ...ys) + 1)
  const W = 320, H = 176, x0 = 30, x1 = W - 8, y0 = 8, y1 = H - 22
  const X = (w) => x0 + (w * (x1 - x0)) / N, Y = (v) => y0 + ((yMax - v) * (y1 - y0)) / (yMax - yMin)
  const banda = `${X(0)},${Y(k0)} ${X(N)},${Y(k0 - 0.5 * N)} ${X(N)},${Y(k0 - 1.0 * N)}`
  const lineas = (P.metas || []).map((m) => `<line x1="${x0}" x2="${x1}" y1="${Y(m.kg)}" y2="${Y(m.kg)}" stroke="var(--ter)" stroke-dasharray="4 3"/><text x="${x1}" y="${Y(m.kg) - 4}" text-anchor="end" font-size="10" fill="var(--ter)">${esc(m.t)} · ${kg(m.kg)}</text>`).join('')
  const ejeY = [yMax, Math.round((yMax + yMin) / 2), yMin].map((v) => `<text x="${x0 - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="var(--on-var)">${v}</text>`).join('')
  const serie = pts.length > 1 ? `<polyline fill="none" stroke="var(--pri)" stroke-width="2.5" stroke-linejoin="round" points="${pts.map(([w, v]) => `${X(w).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>` : ''
  const puntos = pts.map(([w, v], i) => `<circle cx="${X(w).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="${i === pts.length - 1 ? 'var(--on)' : 'var(--pri)'}"/>`).join('')
  const mesFin = F.MESES_C[F.deISO(F.suma(L0, N * 7)).getMonth()]
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Tu peso semana por semana"><defs><clipPath id="area"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath></defs>`
    + `<polygon points="${banda}" fill="var(--pri-cont)" opacity=".6" clip-path="url(#area)"/>${lineas}${ejeY}${serie}${puntos}`
    + `<text x="${x0}" y="${H - 6}" font-size="10" fill="var(--on-var)">${F.MESES_C[F.deISO(L0).getMonth()]}</text><text x="${x1}" y="${H - 6}" text-anchor="end" font-size="10" fill="var(--on-var)">${mesFin}</text></svg>`
}
function llegada(falta) {
  const [lento, rapido] = (perfil()?.ritmo || [0.5, 1]).slice().sort((a, b) => a - b), h = F.hoyISO()
  const a = F.mes(F.suma(h, Math.round((falta / rapido) * 7))), b = F.mes(F.suma(h, Math.round((falta / lento) * 7)))
  return a === b ? `en ${a}` : `entre ${a} y ${b}`
}
function vYo() {
  const P = perfil(), seg = E.ui.yo
  let cuerpo = `<div class="seg" role="tablist">${[['peso', 'Peso'], ['cintura', 'Cintura'], ['registro', 'Registro']].map(([k, t]) => `<button role="tab" aria-selected="${seg === k}" class="${seg === k ? 'on' : ''}" data-a="yo-seg" data-k="${k}">${t}</button>`).join('')}</div>`
  if (seg === 'peso') {
    const l = pesosOrden(), ult = l[l.length - 1], ini = P?.peso_inicio, act = ult?.kg ?? ini
    const L = F.lunesDe(F.hoyISO()), estaSem = l.filter((x) => x.fecha >= L)
    cuerpo += `<div class="card"><div class="grande">${act != null ? kg(act) : '—'} <small>kg</small></div><div class="s">${ult ? F.larga(ult.fecha) : 'Tu punto de partida'}${ini != null && ult ? ' · ' + difKg(ult.kg - ini) + ' desde el inicio' : ''}${estaSem.length > 1 ? ' · promedio de esta semana ' + kg(estaSem.reduce((a, x) => a + x.kg, 0) / estaSem.length) : ''}</div>${grafica()}<div class="s">Verde: tu ritmo sano, de ½ a 1 kg por semana. Cuenta el lunes; si te pesas más días, el promedio.</div></div>`
    if (P?.metas?.length && act != null) {
      cuerpo += `<div class="card lista">${P.metas.map((m) => { const f = act - m.kg; return `<div class="meta"><span class="emo" style="font-size:22px">${f <= 0 ? '🏆' : '🎯'}</span><span><b>${esc(m.t)} · ${kg(m.kg)} kg</b>${m.d ? ` <span class="s">${esc(m.d)}</span>` : ''}</span><span class="p">${f <= 0 ? '¡Lo lograste!' : `faltan ${kg(f)} kg<br>${llegada(f)}`}</span></div>` }).join('')}</div>`
    }
    cuerpo += `<button class="btn ancho" data-a="peso">${ms('add')} Anotar peso</button>`
  } else if (seg === 'cintura') {
    const l = Object.values(E.pesos).filter((x) => x.cintura != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), ult = l[l.length - 1], ini = P?.cintura_inicio
    cuerpo += `<div class="card"><div class="grande">${ult ? kg(ult.cintura) : ini != null ? kg(ini) : '—'} <small>cm</small></div><div class="s">${ult ? F.larga(ult.fecha) + (ini != null ? ' · ' + difKg(ult.cintura - ini).replace('kg', 'cm') + ' desde el inicio' : '') : 'Tu punto de partida'}</div>
      ${P?.cintura_meta ? `<p>Meta: <b>menos de ${kg(P.cintura_meta)} cm</b>${P.cintura_sana ? `; sana, menos de ${kg(P.cintura_sana)} cm` : ''}.</p>` : ''}<div class="s">Mídela cada 2 semanas, a la altura del ombligo, sin apretar y sin meter la panza.</div></div>
      ${l.length ? `<div class="card lista">${l.slice(-6).reverse().map((x) => `<div class="meta"><span>${ms('straighten')}</span><span>${F.larga(x.fecha)}</span><span class="p"><b>${kg(x.cintura)} cm</b></span></div>`).join('')}</div>` : ''}
      <button class="btn ancho" data-a="cintura">${ms('add')} Anotar cintura</button>`
  } else {
    const L0 = F.lunesDe(P?.inicio || F.hoyISO()), Lh = F.lunesDe(F.hoyISO()), ws = []
    for (let L = L0; L <= Lh && ws.length < 60; L = F.suma(L, 7)) ws.push(L)
    const cols = ws.slice(-5).map(resumenSemana), guion = '—'
    const fila = (t, ini, fn) => `<tr><td>${t}</td><td>${ini ?? guion}</td>${cols.map((c) => `<td>${fn(c) ?? guion}</td>`).join('')}</tr>`
    cuerpo += `<div class="card" style="padding:6px 6px"><div class="tabla-scroll"><table class="tabla"><tr><th></th><th>Inicio</th>${cols.map((c) => `<th>Sem ${Math.floor(F.dif(L0, c.L) / 7) + 1}</th>`).join('')}</tr>
      ${fila('Peso', P?.peso_inicio != null ? kg(P.peso_inicio) : null, (c) => (c.peso != null ? kg(c.peso) : null))}
      ${fila('Cintura', P?.cintura_inicio != null ? kg(P.cintura_inicio) : null, (c) => (c.cintura != null ? kg(c.cintura) : null))}
      ${fila('Días en el plan', null, (c) => (c.conDato ? `${c.plan} de ${c.dias}` : null))}
      ${fila('Sin refresco', null, (c) => (c.conDato ? `${c.sinRef} de ${c.conDato}` : null))}
      ${fila('Caminar', null, (c) => (c.caminar ? c.caminar + ' min' : null))}
      ${fila('Dormir', null, (c) => (c.sueno ? kg(c.sueno) + ' h' : null))}</table></div></div>
      <p class="s">«Días en el plan»: días con 3 o más comidas palomeadas. Se llena solo con lo que anotas.</p>`
  }
  const pend = pendientes().total
  cuerpo += `<div class="card lista"><a class="li" href="#jarvis"><span class="ph">${ms('cloud_upload')}</span><span><div class="v">Mandar a Jarvis</div><div class="k">${pend ? pend + ' cambios sin mandar' : 'Todo mandado · ' + F.cuando(ultimoEnvio())}</div></span>${ms('chevron_right')}</a>`
    + `<a class="li" href="#ajustes"><span class="ph">${ms('settings')}</span><span><div class="v">Ajustes</div><div class="k">Nombre, colores, súper y copia de seguridad</div></span>${ms('chevron_right')}</a></div>`
  return { barra: barra('Tu progreso', P?.nombre ? esc(P.nombre) : ''), cuerpo, nav: 'yo' }
}

function vAjustes() {
  const a = aj(), P = perfil(), tema = a.tema || 'auto', fd = diasFonda()
  const temas = [['auto', 'Como tu teléfono', 'Menta de día y Noche cuando el teléfono está en modo oscuro'], ['hora', 'Por la hora', 'Noche de 7 de la noche a 7 de la mañana'], ['menta', 'Siempre Menta', 'Claro'], ['noche', 'Siempre Noche', 'Oscuro']]
  const cuerpo = `
    <div class="sec-t">Colores</div>
    <div class="card lista">${temas.map(([k, t, s]) => `<button class="opcion${tema === k ? ' sel' : ''}" data-a="tema" data-t="${k}" style="grid-template-columns:28px 1fr"><span class="r"></span><span><div class="n">${t}</div><div class="d">${s}</div></span></button>`).join('')}</div>
    <div class="sec-t">Tú</div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px"><label class="campo">Tu nombre<input id="aj-nombre" value="${esc(P?.nombre || '')}" maxlength="30"></label>
      <label class="campo">Tope del súper a la semana<input id="aj-tope" type="number" inputmode="numeric" min="0" value="${topeSuper()}"></label>
      <div class="campo"><span class="campo">Días de fonda</span><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="chip${fd.includes(d) ? ' sel' : ''}" data-a="fonda-dia" data-d="${d}">${F.DIAS_C[d]}</button>`).join('')}</div></div>
      <button class="btn" data-a="aj-guarda">${ms('save')} Guardar</button></div>
    <div class="sec-t">Tus datos</div>
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <p class="s" id="persistente">Revisando si Android guarda tus datos para siempre…</p>
      <div class="btns"><button class="btn ton" data-a="respaldo">${ms('download')} Guardar copia</button><button class="btn out" data-a="restaura">${ms('upload')} Restaurar copia</button></div>
      <input type="file" id="archivo" accept="application/json,.json" hidden>
      <p class="s">La copia es un archivo en tu carpeta de Descargas${a.ultimoRespaldo ? ' · la última: ' + F.cuando(a.ultimoRespaldo) : ''}. Además, tu copia de todos los días está en Claude.</p></div>
    ${E.instalar ? `<button class="btn ancho ton" data-a="instalar">${ms('install_mobile')} Instalar Mi plan en tu teléfono</button>` : ''}
    <div class="sec-t">Acerca de</div>
    <div class="card"><p>Mi plan ${VERSION}. Funciona sin internet. Tus datos se guardan en este teléfono y solo salen cuando tú los mandas a tu Claude.</p>
      <button class="btn texto" data-a="borra-todo" style="color:var(--err)">${ms('delete_forever')} Borrar todo de este teléfono</button></div>`
  setTimeout(revisaPersistente, 0)
  return { barra: atras('#yo', 'Ajustes'), cuerpo, nav: 'yo' }
}
async function revisaPersistente() {
  const el = $('#persistente'); if (!el || !navigator.storage?.persisted) { if (el) el.textContent = 'Este navegador no dice si guarda tus datos para siempre.'; return }
  const si = await navigator.storage.persisted()
  el.innerHTML = si ? `${ms('verified', true)} Android guarda tus datos para siempre en este teléfono.` : `${ms('info')} Android todavía puede borrar tus datos si se llena el teléfono. Instala Mi plan y úsala seguido; y manda a Jarvis cada noche.`
}

function vJarvis() {
  const a = aj(), n = pendientes(), url = a.urlClaude || perfil()?.urlClaude
  const fila = (i, t, k) => `<div class="ck" style="cursor:default"><i class="${k ? '' : 'si'}">${k ? '' : ms('check')}</i><span class="t">${t}</span><span class="p">${k ? k + ' sin mandar' : 'al día'}</span></div>`
  const cuerpo = `
    <div style="text-align:center;padding:8px 0">${ms('cloud_sync', true).replace('class="ms f"', 'class="ms f" style="font-size:64px;width:auto;height:auto;color:var(--pri)"')}
      <div class="h1" style="font-size:20px;margin-top:6px">${n.total ? 'Tienes cambios sin mandar' : ultimoEnvio() ? 'Todo copiado' : 'Todavía no mandas nada'}</div>
      <div class="s">Lo último que copiaste: ${F.cuando(a.ultimoCopiado)}${a.ultimoRecibido ? ' · Claude lo tiene desde ' + F.cuando(a.ultimoRecibido) : ''}</div></div>
    <div class="card lista">${fila('', 'Pesos y cintura', n.pesos)}${fila('', 'Días anotados', n.dias)}${fila('', 'Recetas y menús', n.recetas + n.menus)}${fila('', 'Tu semana y tu súper', n.semanas + n.super)}</div>
    <button class="btn ancho" data-a="mandar">${ms('cloud_upload')} Mandar a Jarvis</button>
    <p class="s" style="text-align:center">Se copia tu paquete y se abre Mi plan en Claude: ahí lo pegas y tocas «Guardar en Claude».</p>
    <button class="btn ancho ton" data-a="traer">${ms('cloud_download')} Traer de Jarvis</button>
    <p class="s" style="text-align:center">Lo más fácil: en Mi plan en Claude toca «Abrir Mi plan con mis datos» y llegan solos.</p>
    ${url ? `<a class="btn ancho out" href="${esc(url)}" target="_blank" rel="noopener">${ms('open_in_new')} Abrir Mi plan en Claude</a>` : `<div class="card ambar">Todavía no tengo el enlace de tu página de Claude. Llega solo la primera vez que traes algo de Jarvis.</div>`}
    <p class="s" style="text-align:center">${ms('lock')} Tus datos solo salen de este teléfono cuando tú los mandas.</p>`
  return { barra: atras('#yo', 'Jarvis'), cuerpo, nav: 'yo' }
}

// ¿Corre como app instalada o en una pestaña? ¿En un teléfono o en una computadora?
const comoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
// Se mide una vez al abrir: un teléfono no deja de ser táctil a media sesión.
const EN_COMPU = !matchMedia('(pointer: coarse)').matches
const enCompu = () => EN_COMPU
function tarjetaInstalar() {
  if (comoApp() || E.ui.sinInstala) return ''
  if (enCompu()) {
    return `<div class="card ter" id="instala"><b>${ms('install_mobile', true)} Mi plan es para tu teléfono</b>
      <p style="margin-top:6px">Para pasarla con tus datos, abre <b>Mi plan en Claude</b> en esta computadora y apunta la cámara de tu teléfono al código que aparece.</p></div>`
  }
  if (aj().instalada) {
    return `<div class="card ter" id="instala"><div class="fila entre"><b>${ms('check_circle', true)} Ya tienes Mi plan instalada</b><button class="ib" data-a="instala-cierra" aria-label="Cerrar">${ms('close')}</button></div>
      <p style="margin-top:6px">Búscala en tu pantalla como «Mi plan» y ábrela desde ahí. Esta pestaña ya la puedes cerrar.</p>
      <button class="btn texto" data-a="no-la-encuentro" style="padding:0">No la encuentro</button></div>`
  }
  return `<div class="card tono" id="instala"><b>${ms('install_mobile', true)} Ponla como app en tu teléfono</b>
    <p style="margin:6px 0 12px">Así la abres desde su icono, sin el navegador y sin internet.</p>
    ${E.instalar ? `<button class="btn ancho" data-a="instalar">${ms('download')} Instalar Mi plan</button>`
      : `<ol class="pasos-n"><li>Toca los tres puntos ${ms('more_vert')} de Chrome, arriba a la derecha.</li><li>Toca <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li><li>Toca <b>Instalar</b>.</li></ol>`}
    <button class="btn texto" data-a="instalada" style="padding:0;margin-top:6px">Ya la instalé</button></div>`
}

function vBienvenida() {
  return `<div class="bienvenida">
    <div class="logo">${emo('🥗')}</div>
    <div><div class="h1" style="font-size:30px">Mi plan</div><div class="s" style="font-size:16px">Tu comida, tu súper y tu peso. Funciona sin internet.</div></div>
    ${tarjetaInstalar()}
    ${enCompu() ? '' : `<div class="card"><h3>Para traer tus datos</h3><ol class="pasos-n"><li>En tu computadora abre <b>Mi plan en Claude</b>, el enlace que te mandó Jarvis.</li><li>Apunta la cámara de este teléfono al código que aparece y toca el enlace.</li></ol>
      <p class="s" style="margin-top:10px">Si abriste Mi plan en Claude en este teléfono, toca ahí <b>Abrir Mi plan con mis datos</b>.</p></div>`}
    <button class="btn ancho ton" data-a="traer">${ms('content_paste')} Traer de Jarvis</button>
    <button class="btn ancho texto" data-a="sin-jarvis">Empezar sin Jarvis</button>
    <p class="s">${ms('lock')} Tus datos se guardan en este teléfono. Solo salen cuando tú los mandas a tu Claude.</p></div>`
}

// ---------------------------------------------------------------- dibujar
const VISTAS = { hoy: vHoy, semana: vSemana, preparar: vPreparar, recetas: vRecetas, receta: vReceta, editar: vEditar, super: vSuper, yo: vYo, ajustes: vAjustes, jarvis: vJarvis }
function ruta() { const h = decodeURIComponent(location.hash.slice(1) || 'hoy'); const [r, ...x] = h.split('/'); return { r, x: [x.join('/')] } }
function pinta(nueva) {
  const app = $('#app')
  if (!perfil()) { app.innerHTML = vBienvenida(); return }
  const { r, x } = ruta(), V = VISTAS[r] || vHoy, v = V(...x), y = nueva ? 0 : window.scrollY
  app.innerHTML = `<header class="barra">${v.barra}</header><main id="cuerpo">${v.cuerpo}</main>`
    + (v.fab ? `<button class="fab" data-a="${v.fab.a}">${ms(v.fab.i)} ${v.fab.t}</button>` : '') + nav(v.nav)
  window.scrollTo(0, y)
  if (r === 'preparar') arrancaRelojes(); else clearInterval(E.tic)
}
function ir(destino) {
  if (E.hojaAbierta) { E.hojaAbierta = false; quitaCapa(); history.replaceState(null, '', destino); pinta(true) }
  else if (location.hash === destino) pinta(true)
  else location.hash = destino
}

// ---------------------------------------------------------------- hojas que suben
function abreHoja(html) {
  const capa = $('#capa')
  const yaAbierta = E.hojaAbierta
  capa.innerHTML = `<div class="velo${yaAbierta ? ' abierta' : ''}" data-a="cierra-hoja"></div><div class="hoja${yaAbierta ? ' abierta' : ''}" role="dialog" aria-modal="true"><div class="ag"></div>${html}</div>`
  if (!yaAbierta) {
    history.pushState({ hoja: true }, '')
    E.hojaAbierta = true
    requestAnimationFrame(() => requestAnimationFrame(() => { capa.querySelector('.velo')?.classList.add('abierta'); capa.querySelector('.hoja')?.classList.add('abierta') }))
  }
}
function quitaCapa() { $('#capa').innerHTML = ''; E.h = null }
function cierraHoja() {
  if (!E.hojaAbierta) return
  E.hojaAbierta = false
  const capa = $('#capa'), h = capa.querySelector('.hoja'), v = capa.querySelector('.velo')
  h?.classList.remove('abierta'); v?.classList.remove('abierta')
  setTimeout(() => { if (!E.hojaAbierta) quitaCapa() }, 220)
  if (history.state?.hoja) history.back()
}
window.addEventListener('popstate', () => { if (E.hojaAbierta) { E.hojaAbierta = false; quitaCapa() } })

function aviso(texto, tipo = '', accion) {
  const c = $('#avisos'); if (!c) return
  const el = document.createElement('div')
  el.className = 'aviso' + (tipo === 'mal' ? ' mal' : '')
  el.innerHTML = `<span>${esc(texto)}</span>${accion ? `<button>${esc(accion.t)}</button>` : ''}`
  if (accion) el.querySelector('button').onclick = () => { el.remove(); accion.fn() }
  c.appendChild(el)
  setTimeout(() => el.remove(), accion ? 8000 : tipo === 'mal' ? 6000 : 3200)
}

function hNumero({ titulo, sub = '', valor, chico, grande, min, max, dec, unidad, fecha = false, guarda: g }) {
  E.h = { min, max, dec, g }
  const h = F.hoyISO()
  abreHoja(`<div class="ht">${titulo}</div>${sub ? `<div class="s">${sub}</div>` : ''}
    <div class="stepper"><button data-a="num" data-d="${-grande}" aria-label="Menos ${grande}">−${String(grande).replace('.', ',')}</button><button data-a="num" data-d="${-chico}" aria-label="Menos ${chico}">−${String(chico).replace('.', ',')}</button>
      <input id="num" type="number" inputmode="decimal" step="${chico}" min="${min}" max="${max}" value="${(+valor).toFixed(dec)}" aria-label="${esc(titulo)}">
      <button data-a="num" data-d="${chico}" aria-label="Más ${chico}">+${String(chico).replace('.', ',')}</button><button data-a="num" data-d="${grande}" aria-label="Más ${grande}">+${String(grande).replace('.', ',')}</button></div>
    <div class="s" style="text-align:center;margin-top:-4px">${unidad}</div>
    ${fecha ? `<label class="campo">Fecha<input id="num-fecha" type="date" value="${h}" max="${h}"></label>` : ''}
    <button class="btn ancho" data-a="num-guarda">${ms('save')} Guardar</button>`)
}
function hAnotar() {
  const items = [['peso', 'monitor_weight', 'Peso'], ['cintura', 'straighten', 'Cintura'], ['agua-mas', 'water_drop', 'Un vaso de agua'], ['caminar', 'directions_walk', 'Caminé'],
    ['refresco', 'local_drink', 'Refresco'], ['sueno', 'bedtime', 'Dormí'], ['espalda', 'fitness_center', 'Espalda'], ['nota', 'edit_note', 'Nota']]
  abreHoja(`<div class="ht">¿Qué anotas?</div><div class="rejilla4">${items.map(([a, i, t]) => `<button data-a="${a}"><span class="ci">${ms(i, a === 'peso')}</span>${t}</button>`).join('')}</div>
    <div class="s" style="text-align:center">Sin internet también: se guarda en tu teléfono y en la noche se lo mandas a Jarvis.</div>`)
}
function hComida(c) {
  const f = F.hoyISO(), p = diaPlan(f), r = p[c], d = dia(f), st = d.comidas?.[c]
  if (r === 'fonda') return hFonda()
  abreHoja(`<div class="ht">${emo(r?.e || '❔')} ${NOMBRE_COMIDA[c]}</div>
    ${r ? `<div style="font-size:18px;font-weight:500">${esc(r.n)}</div><div class="fila"><span class="tag gris">${ms('schedule')}${r.min || 0} min</span>${r.kcal ? `<span class="tag gris">${ms('local_fire_department')}${r.kcal} kcal</span>` : ''}<span class="tag gris">${ms('payments')}${plata(costo(r))}</span></div>` : '<div class="s">No hay receta para hoy.</div>'}
    <div class="btns"><button class="btn${st === 'si' ? '' : ' ton'}" data-a="comida-si" data-c="${c}">${ms('check')} Lo comí así</button><button class="btn ${st === 'no' ? 'peligro' : 'ton'}" data-a="comida-no" data-c="${c}">${ms('close')} Comí otra cosa</button></div>
    <div id="otra"${st === 'no' ? '' : ' hidden'}><label class="campo">¿Qué comiste? (si quieres)<input id="otra-t" value="${esc(d.otra?.[c] || '')}" placeholder="Ej. tacos de pastor" maxlength="80"></label><button class="btn ancho" style="margin-top:10px" data-a="comida-no-guarda" data-c="${c}">Guardar</button></div>
    <div class="btns">${r ? `<button class="btn out" data-a="ir" data-r="#receta/${encodeURIComponent(r.id)}">${ms('menu_book')} Ver receta</button>` : ''}<button class="btn out" data-a="elige" data-f="${f}" data-c="${c}">${ms('swap_horiz')} Cambiar</button></div>
    ${st ? `<button class="btn texto ancho" data-a="comida-borra" data-c="${c}">Quitar lo que anoté</button>` : ''}`)
}
function hFonda() {
  const f = F.hoyISO(), st = dia(f).comidas?.comida
  const op = (k, t, lista) => `<button class="${k}${st === k ? ' sel' : ''}" data-a="fonda" data-k="${k}"><span class="luz"></span><span><b>${t}</b><small>${lista}</small></span></button>`
  abreHoja(`<div class="ht">${emo('🍽️')} ¿Qué pediste en la fonda?</div>
    <div class="semaforo">${op('verde', 'Verde · diario', FONDA.verde.join(', '))}${op('amarillo', 'Amarillo · 1 o 2 veces por semana', FONDA.amarillo.join(', '))}${op('rojo', 'Rojo · 1 vez por semana, máximo', FONDA.rojo.join(', '))}</div>
    <div class="card tono"><b>Cómo pedir</b><p>${FONDA.pedir}</p><div class="s">${FONDA.reglas.join(' ')}</div></div>
    <div class="btns"><button class="btn texto" data-a="fonda" data-k="no">No fui a la fonda</button>${st ? '<button class="btn texto" data-a="fonda" data-k="">Quitar lo que anoté</button>' : ''}</div>`)
}
function hDia(f) {
  const p = diaPlan(f)
  const ops = Object.values(E.M).map((m) => {
    const pp = diaPlan(f, { menu: m.id })
    return `<button class="opcion${m.id === p.d.menu ? ' sel' : ''}" data-a="dia-menu" data-f="${f}" data-m="${esc(m.id)}"><span class="r"></span><span class="e emo">${esc(m.e)}</span><span style="min-width:0"><div class="n">${esc(m.n)}</div><div class="d">${esc([pp.desayuno?.n, pp.cena?.n].filter(Boolean).join(' · '))}</div></span><span class="p">${miles(kcalDia(pp))} kcal<br>${plata(costoDia(pp))}</span></button>`
  }).join('')
  const cs = ['desayuno', ...(p.comida !== 'fonda' ? ['comida'] : []), 'cena']
  const filas = cs.map((c) => `<div class="li sin-icono"><div style="min-width:0"><div class="k">${NOMBRE_COMIDA[c]}${p.d[c] ? ' · cambiada' : ''}</div><div class="v">${p[c] ? emo(p[c].e) + ' ' + esc(p[c].n) : 'Sin receta'}</div></div><button class="btn texto" data-a="elige" data-f="${f}" data-c="${c}" data-vuelve="dia">${ms('swap_horiz')} Cambiar</button></div>`).join('')
  abreHoja(`<div class="ht">${F.larga(f)}</div><div class="sec-t" style="margin-top:0">Menú</div><div>${ops}</div>
    <div class="sec-t">Comidas de este día</div><div class="card lista" style="background:var(--bg)">${filas}</div>
    <button class="btn ancho" data-a="cierra-hoja">Listo</button>`)
}
function hElige(f, c, vuelve) {
  const p = diaPlan(f), actual = p[c] === 'fonda' ? null : p[c]
  const tipos = c === 'comida' ? ['comida', 'cena'] : [c]
  const l = Object.values(E.R).filter((r) => tipos.includes(r.c)).sort((a, b) => costo(a) - costo(b))
  const barato = l.find((r) => r.id !== actual?.id && (!actual || costo(r) < costo(actual) - 0.5))
  E.h = { vuelve }
  abreHoja(`<div class="ht">${NOMBRE_COMIDA[c]} · ${F.larga(f).toLowerCase()}</div>
    <div class="s">${c === 'cena' || c === 'comida' ? 'Opciones con proteína parecida. Lo que cambies se ajusta solo en el súper y en lo que preparas el domingo.' : 'Escoge qué desayunas ese día.'}</div>
    <div>${l.map((r) => `<button class="opcion${r.id === actual?.id ? ' sel' : ''}" data-a="elige-ok" data-f="${f}" data-c="${c}" data-id="${esc(r.id)}"><span class="r"></span><span class="e emo">${esc(r.e)}</span><span style="min-width:0"><div class="n">${esc(r.n)}${r.id === actual?.id ? ' <span class="tag verde">Ahora</span>' : r === barato ? ' <span class="tag ambar">Más barato</span>' : ''}</div><div class="d">${r.prot ? '≈' + r.prot + ' g de proteína · ' : ''}${r.kcal ? r.kcal + ' kcal' : ''}</div></span><span class="p"><b>${plata(costo(r))}</b></span></button>`).join('')}</div>
    ${p.d[c] ? `<button class="btn texto ancho" data-a="elige-ok" data-f="${f}" data-c="${c}" data-id="">Regresar a la del menú</button>` : ''}`)
}
function hMenus() {
  const L = semanaVista()
  abreHoja(`<div class="ht">Mis menús</div><div class="s">Un menú es un desayuno y una cena que van juntos. Tócalo para cambiarlo o escoger sus días.</div>
    <div class="card lista" style="background:var(--bg)">${Object.values(E.M).map((m) => { const n = semana(L).dias.filter((d) => d.menu === m.id).length; return `<button class="li" data-a="menu" data-id="${esc(m.id)}"><span class="ph">${emo(m.e)}</span><span style="min-width:0"><div class="v">${esc(m.n)}</div><div class="k">${esc([E.R[m.desayuno]?.n, E.R[m.comida]?.n, E.R[m.cena]?.n].filter(Boolean).join(' · '))}</div></span><span class="der">${n ? `<span class="tag verde">${n} día${n > 1 ? 's' : ''}</span>` : ''}${ms('chevron_right')}</span></button>` }).join('')}</div>
    <button class="btn ancho ton" data-a="menu-nuevo">${ms('add')} Nuevo menú</button>`)
}
function hMenu(id) {
  const m = E.M[id]; if (!m) return hMenus()
  const L = semanaVista(), s = semana(L), cena = E.R[m.cena]
  const pp = { ...diaPlan(L, { menu: id }) }
  const fila = (c) => `<div class="li sin-icono"><div style="min-width:0"><div class="k">${NOMBRE_COMIDA[c]}</div><div class="v">${E.R[m[c]] ? emo(E.R[m[c]].e) + ' ' + esc(E.R[m[c]].n) : 'Sin receta'}</div></div><button class="btn texto" data-a="menu-elige" data-id="${esc(id)}" data-c="${c}">${ms('swap_horiz')} Cambiar</button></div>`
  abreHoja(`<div class="fila" style="flex-wrap:nowrap"><span class="emo" style="font-size:30px">${esc(m.e)}</span><input id="m-n" value="${esc(m.n)}" maxlength="30" aria-label="Nombre del menú" style="font-size:18px;font-weight:500"></div>
    <div class="fila">${cena?.prep === 'domingo' ? `<span class="tag verde">${ms('kitchen')}${cena.refri ?? 3} días en el refri</span>` : ''}${cena?.congela ? `<span class="tag hielo">${ms('ac_unit')}Se congela</span>` : ''}<span class="tag gris">${miles(kcalDia(pp))} kcal con la fonda</span></div>
    <div class="card lista" style="background:var(--bg)">${fila('desayuno')}${m.comida ? fila('comida') : ''}${fila('cena')}</div>
    <div class="sec-t">¿Qué días lo quieres? · semana del ${F.rango(L)}</div>
    <div class="chips" style="flex-wrap:wrap">${s.dias.map((d, i) => `<button class="chip${d.menu === id ? ' sel' : ''}" data-a="menu-dia" data-id="${esc(id)}" data-i="${i}">${d.menu === id ? ms('check') : ''}${F.DIAS_C[(i + 1) % 7]}</button>`).join('')}</div>
    <div class="s">Toca un día para ponerle este menú. ${cena?.prep === 'domingo' ? `Del lunes al ${F.DIAS[F.dow(F.suma(L, (cena.refri ?? 3) - 1))]} sale del refri; después, del congelador.` : ''}</div>
    <button class="btn ancho" data-a="menu-listo" data-id="${esc(id)}">Listo</button>
    ${m.base ? (E.menus[id] && !E.menus[id].restaurado ? `<button class="btn texto ancho" data-a="menu-restaura" data-id="${esc(id)}">Regresar al original</button>` : '') : `<button class="btn texto ancho" style="color:var(--err)" data-a="menu-borra" data-id="${esc(id)}">Borrar este menú</button>`}`)
}
function hMenuElige(id, c) {
  const m = E.M[id], tipos = c === 'comida' ? ['comida', 'cena'] : [c]
  const l = Object.values(E.R).filter((r) => tipos.includes(r.c)).sort((a, b) => costo(a) - costo(b))
  abreHoja(`<div class="ht">${NOMBRE_COMIDA[c]} del menú ${esc(m.n)}</div>
    <div>${l.map((r) => `<button class="opcion${r.id === m[c] ? ' sel' : ''}" data-a="menu-elige-ok" data-id="${esc(id)}" data-c="${c}" data-r="${esc(r.id)}"><span class="r"></span><span class="e emo">${esc(r.e)}</span><span style="min-width:0"><div class="n">${esc(r.n)}</div><div class="d">${r.prot ? '≈' + r.prot + ' g de proteína · ' : ''}${r.kcal ? r.kcal + ' kcal' : ''}</div></span><span class="p"><b>${plata(costo(r))}</b></span></button>`).join('')}</div>`)
}
function hASemana(id) {
  const r = E.R[id]; if (!r) return
  const L = semanaVista(), c = r.c === 'tarde' ? 'tarde' : r.c
  const dias = [...Array(14)].map((_, i) => F.suma(L, i)).filter((f) => c !== 'comida' || !diasFonda().includes(F.dow(f)))
  abreHoja(`<div class="ht">${emo(r.e)} ${esc(r.n)}</div><div class="s">¿Qué día la quieres de ${NOMBRE_COMIDA[c].toLowerCase()}?</div>
    <div class="chips" style="flex-wrap:wrap">${dias.map((f) => `<button class="chip${diaPlan(f)[c]?.id === id ? ' sel' : ''}" data-a="a-semana-ok" data-id="${esc(id)}" data-f="${f}">${F.diaC(f)} ${F.deISO(f).getDate()}</button>`).join('')}</div>`)
}
function hItem(id) {
  const L = semanaVista(), x = listaSuper(L).find((i) => i.id === id); if (!x) return
  const s = E.super[L] || {}, P = prod(id)
  const usos = Object.entries(x.recetas).map(([n, k]) => `${n} ×${k}`).join(' · ')
  abreHoja(`<div class="ht">${esc(x.n)}</div><div class="s">${esc(x.paq)}${P ? ' · precio ' + (kv('precios', {})[id] != null ? 'tuyo' : P.f === 'Profeco' ? 'de Profeco' : P.f === 'tienda' ? 'de tienda' : 'estimado') : ''}</div>
    ${usos ? `<div class="card tono"><b>Lo usan esta semana</b><p>${esc(usos)}</p></div>` : P?.base ? '<div class="card tono">Va cada semana: es tu fruta y verdura de base.</div>' : ''}
    ${P ? `<label class="campo">Precio del paquete (${esc(P.paq)})<input id="it-precio" type="number" inputmode="decimal" min="0" step="0.5" value="${P.precio}"></label><button class="btn ancho" data-a="item-precio" data-id="${esc(id)}">${ms('save')} Guardar precio</button>` : ''}
    <button class="btn ancho ton" data-a="item-tengo" data-id="${esc(id)}">${ms((s.tengo || {})[id] ? 'shopping_cart' : 'inventory')} ${(s.tengo || {})[id] ? 'Ya no lo tengo: compraré' : 'Ya lo tengo en casa'}</button>
    ${x.extra ? `<button class="btn texto ancho" style="color:var(--err)" data-a="item-quita" data-id="${esc(id)}">Quitar de la lista</button>` : ''}`)
}
function hPegar(tipo) {
  const url = aj().urlClaude || perfil()?.urlClaude
  abreHoja(`<div class="ht">${ms('content_paste')} Pega aquí</div>
    <div class="s">${tipo === 'traer' ? 'Lo más fácil: en Mi plan en Claude toca «Abrir Mi plan con mis datos» y llegan solos. Si no se abre, toca allá «Copiar para mi teléfono», regresa aquí, deja el dedo en el cuadro y toca «Pegar».' : 'Deja el dedo en el cuadro y toca «Pegar».'}</div>
    ${tipo === 'traer' && url ? `<a class="btn ancho out" href="${esc(url)}" target="_blank" rel="noopener" data-a="cierra-tras">${ms('open_in_new')} Abrir Mi plan en Claude</a>` : ''}
    <textarea id="pega" class="area" placeholder="Deja el dedo aquí y toca Pegar"></textarea>
    <button class="btn ancho" data-a="pega-ok">${ms('cloud_download')} Traer</button>`)
}
function hTextoManual(txt) {
  abreHoja(`<div class="ht">Copia tu paquete</div><div class="s">Tu teléfono no dejó copiar solo. Toca «Seleccionar todo» y «Copiar», y pégalo en Mi plan en Claude.</div>
    <textarea id="manual" class="area" readonly>${esc(txt)}</textarea>
    <button class="btn ancho" data-a="manual-sel">${ms('select_all')} Seleccionar todo</button>`)
  setTimeout(() => { const t = $('#manual'); t?.focus(); t?.select() }, 300)
}
function hCopiado() {
  const url = aj().urlClaude || perfil()?.urlClaude
  abreHoja(`<div class="ht">${ms('check_circle', true)} Copiado</div>
    <ol class="pasos-n"><li>Abre <b>Mi plan en Claude</b>.</li><li>Deja el dedo en el cuadro grande y toca <b>Pegar</b>.</li><li>Toca <b>Guardar en Claude</b>.</li></ol>
    ${url ? `<a class="btn ancho" href="${esc(url)}" target="_blank" rel="noopener" data-a="cierra-tras">${ms('open_in_new')} Abrir Mi plan en Claude</a>` : '<div class="card ambar">Abre el enlace de Mi plan en Claude que te mandó Jarvis.</div>'}
    <button class="btn texto ancho" data-a="cierra-hoja">Luego</button>`)
}
function hNota() {
  const f = F.hoyISO()
  abreHoja(`<div class="ht">${ms('edit_note')} Nota de hoy</div><div class="s">Cómo te sentiste, un antojo, lo que quieras que Jarvis sepa.</div>
    <textarea id="nota" maxlength="600">${esc(dia(f).nota || '')}</textarea><button class="btn ancho" data-a="nota-ok">${ms('save')} Guardar</button>`)
}
function hExtra() {
  abreHoja(`<div class="ht">Agregar al súper</div><label class="campo">¿Qué?<input id="ex-n" maxlength="50" placeholder="Ej. Papel de baño"></label>
    <label class="campo">Precio (si lo sabes)<input id="ex-p" type="number" inputmode="decimal" min="0" step="0.5"></label><button class="btn ancho" data-a="extra-ok">${ms('add')} Agregar</button>`)
}
function hSinJarvis() {
  abreHoja(`<div class="ht">Empezar sin Jarvis</div><div class="s">Después puedes traer tus datos de Jarvis y se juntan.</div>
    <label class="campo">¿Cómo te llamas?<input id="sj-n" maxlength="30" autocomplete="given-name"></label>
    <label class="campo">Tu peso de hoy (kg)<input id="sj-kg" type="number" inputmode="decimal" step="0.1" min="30" max="300"></label>
    <label class="campo">Tu estatura (cm, si quieres)<input id="sj-cm" type="number" inputmode="numeric" min="100" max="230"></label>
    <button class="btn ancho" data-a="sj-ok">Empezar</button>`)
}
function hConfirma(texto, accion, boton = 'Sí, borrar') {
  E.h = { accion }
  abreHoja(`<div class="ht">${ms('warning')} ¿Seguro?</div><p>${texto}</p><div class="btns"><button class="btn out" data-a="cierra-hoja">Cancelar</button><button class="btn peligro" data-a="confirma-ok">${boton}</button></div>`)
}

// ---------------------------------------------------------------- semana: cambios
async function cambiaSemana(L, fn) { const s = clona(semana(L)); fn(s); await guarda('semanas', s) }
async function cambiaSuper(L, fn) { const s = clona(E.super[L] || { lunes: L, comprado: {}, tengo: {}, extras: [] }); s.comprado ||= {}; s.tengo ||= {}; s.extras ||= []; fn(s); await guarda('super', s) }
function rebota(c) { const b = $(`[data-a="palomea"][data-c="${c}"]`); b?.classList.add('rebota') }

// ---------------------------------------------------------------- paquetes (Claude ↔ teléfono)
function paqueteParaJarvis() {
  const desde = F.suma(F.hoyISO(), -60)
  return {
    miplan: 1, tipo: 'para-jarvis', version: VERSION, creado: new Date().toISOString(),
    perfil: E.kv.perfil ? { ...E.kv.perfil.v, actualizado: E.kv.perfil.actualizado } : null,
    ajustes: { tema: aj().tema || 'auto', tope: aj().tope || null, diasFonda: aj().diasFonda || null },
    precios: kv('precios', {}),
    pesos: Object.values(E.pesos),
    dias: Object.values(E.dias).filter((d) => d.fecha >= desde),
    recetas: Object.values(E.recetas),
    menus: Object.values(E.menus),
    semanas: Object.values(E.semanas).filter((s) => s.lunes >= F.suma(desde, -7)),
    super: Object.values(E.super).filter((s) => s.lunes >= F.suma(desde, -7)),
  }
}
function leePaquete(txt) {
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}')
  if (a < 0 || b < a) throw new Error('No encontré un paquete en lo que pegaste')
  let p
  try { p = JSON.parse(txt.slice(a, b + 1)) } catch (e) { throw new Error('El paquete llegó incompleto: vuelve a copiarlo') }
  if (!p || p.miplan !== 1) throw new Error('Eso no es un paquete de Mi plan')
  return p
}
async function aplicaPaquete(p) {
  if (p.tipo === 'para-jarvis') throw new Error('Ese es el paquete que tú mandas. Aquí va el que te da Claude con «Copiar para mi teléfono».')
  if (p.tipo !== 'de-jarvis' && p.tipo !== 'copia') throw new Error('No conozco ese paquete')
  const n = { recetas: 0, menus: 0, pesos: 0, dias: 0, semanas: 0, super: 0, precios: 0 }
  if (p.perfil && (p.perfil.actualizado || 0) > (E.kv.perfil?.actualizado || 0)) {
    const { actualizado, ...v } = p.perfil
    await guardaKV('perfil', v, actualizado || Date.now()); n.perfil = 1
  }
  for (const s of ['recetas', 'menus', 'pesos', 'dias', 'semanas', 'super']) {
    for (const r of p[s] || []) {
      const k = r?.[A.CLAVE[s]]; if (k == null || typeof r !== 'object') continue
      const yo = E[s][k]
      if (!yo || (r.actualizado || 0) > (yo.actualizado || 0)) { E[s][k] = r; await escribe(s, r); n[s]++ }
    }
  }
  if (p.precios && typeof p.precios === 'object') {
    const pr = { ...kv('precios', {}) }
    for (const [id, v] of Object.entries(p.precios)) if (PRODUCTOS[id] && +v > 0 && pr[id] !== +v) { pr[id] = +v; n.precios++ }
    if (n.precios) await guardaKV('precios', pr)
  }
  if (p.tipo === 'copia') for (const o of p.kv || []) if (o?.k && o.k !== 'perfil' && (o.actualizado || 0) > (E.kv[o.k]?.actualizado || 0)) { E.kv[o.k] = o; await escribe('kv', o) }
  if (p.mensaje?.texto && p.mensaje.fecha !== kv('mensaje', {})?.fecha) await guardaKV('mensaje', { ...p.mensaje, visto: false })
  const cambios = {}
  if (p.urlClaude) cambios.urlClaude = p.urlClaude
  if (p.recibido) cambios.ultimoRecibido = Date.parse(p.recibido) || p.recibido
  if (Object.keys(cambios).length) await ajusta(cambios)
  recalcula(); aplicaTema()
  return n
}
// Mi plan en Claude abre la app con el paquete después del #: «#de-jarvis=1.<base64url de deflate-raw>»
// (0. si va sin comprimir). Lo que va después del # no sale del teléfono: GitHub nunca lo ve.
async function desempaca(c) {
  const v = c.slice(0, 2), b = atob(c.slice(2).replace(/-/g, '+').replace(/_/g, '/'))
  let u = Uint8Array.from(b, (x) => x.charCodeAt(0))
  if (v === '1.') u = new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
  else if (v !== '0.') throw new Error('Ese enlace no es de Mi plan')
  return JSON.parse(new TextDecoder().decode(u))
}
async function traeEnlace() {
  const h = location.hash
  if (!h.startsWith('#de-jarvis=')) return false
  history.replaceState(null, '', location.pathname + '#hoy')
  try {
    const p = await desempaca(decodeURIComponent(h.slice(11)))
    if (!p || p.miplan !== 1) throw new Error('Ese enlace no es de Mi plan')
    await traePaquete(p)
  } catch (e) {
    const cortado = e instanceof SyntaxError || e?.name === 'InvalidCharacterError' || e instanceof TypeError
    aviso(cortado ? 'El enlace llegó cortado. Ábrelo otra vez desde Mi plan en Claude.' : e?.message || String(e), 'mal')
    pinta(true)
  }
  return true
}
async function traeTexto(txt) {
  try { await traePaquete(leePaquete(txt)) } catch (e) { aviso(e.message || String(e), 'mal') }
}
async function traePaquete(p) {
  const n = await aplicaPaquete(p)
  persiste()
  const partes = [n.perfil ? 'tus datos' : '', n.recetas ? `${n.recetas} receta${n.recetas > 1 ? 's' : ''}` : '', n.menus ? `${n.menus} menú${n.menus > 1 ? 's' : ''}` : '',
    n.pesos ? `${n.pesos} peso${n.pesos > 1 ? 's' : ''}` : '', n.dias ? `${n.dias} día${n.dias > 1 ? 's' : ''}` : '', n.precios ? `${n.precios} precio${n.precios > 1 ? 's' : ''}` : ''].filter(Boolean)
  cierraHoja()
  aviso(partes.length ? 'Listo: llegaron ' + partes.join(', ') + '.' : 'Listo: ya tenías todo lo de Jarvis.')
  pinta(true)
}
async function copia(texto) {
  try { await navigator.clipboard.writeText(texto); return true } catch (e) { /* se intenta a la antigua */ }
  try {
    const t = document.createElement('textarea'); t.value = texto; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0'
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok
  } catch (e) { return false }
}
function persiste() { try { navigator.storage?.persist?.() } catch (e) { /* no pasa nada */ } }

// ---------------------------------------------------------------- relojes y modo cocina
function arrancaRelojes() {
  clearInterval(E.tic)
  E.tic = setInterval(() => {
    const t = kv('timers', {}), ahora = Date.now()
    for (const [id, fin] of Object.entries(t)) {
      const el = document.querySelector(`[data-reloj="${id}"]`), falta = Math.max(0, Math.round((fin - ahora) / 1000))
      if (el) { el.querySelector('b').textContent = falta ? mmss(falta) : '¡Listo!'; el.classList.toggle('listo', !falta); el.classList.toggle('corre', !!falta) }
      if (!falta && !E.sonado[id]) { E.sonado[id] = true; suena() }
    }
  }, 1000)
}
function suena() {
  try { navigator.vibrate?.([400, 150, 400, 150, 800]) } catch (e) { /* sin vibración */ }
  try {
    const ctx = E.audio || (E.audio = new (window.AudioContext || window.webkitAudioContext)())
    ctx.resume?.()
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.45
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      o.start(t); o.stop(t + 0.4)
    }
  } catch (e) { /* sin sonido */ }
}
async function modoCocina(on) {
  if (on) {
    if (!('wakeLock' in navigator)) { aviso('Tu teléfono no deja mantener la pantalla prendida desde aquí', 'mal'); return }
    try {
      E.wake = await navigator.wakeLock.request('screen')
      E.wake.addEventListener('release', () => { E.wake = null })
      E.cocina = true
    } catch (e) { aviso('No se pudo mantener la pantalla prendida', 'mal'); return }
  } else { E.cocina = false; try { await E.wake?.release() } catch (e) { /* ya estaba suelta */ } E.wake = null }
  pinta()
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && E.cocina && !E.wake) modoCocina(true) })

// ---------------------------------------------------------------- acciones (toques)
const hoy = () => F.hoyISO()
const ACC = {
  'cierra-hoja': () => cierraHoja(),
  'ir': ({ r }) => ir(r),
  'anotar': () => hAnotar(),
  'mensaje-visto': async () => { await guardaKV('mensaje', { ...kv('mensaje', {}), visto: true }); pinta() },
  'palomea': async ({ c }) => {
    const f = hoy(), p = diaPlan(f)
    if (p[c] === 'fonda') return hFonda()
    await cambiaDia(f, (d) => { d.comidas[c] = d.comidas[c] ? null : 'si' })
    pinta(); rebota(c)
  },
  'comida': ({ c }) => hComida(c),
  'comida-si': async ({ c }) => { await cambiaDia(hoy(), (d) => { d.comidas[c] = 'si'; delete d.otra[c] }); cierraHoja(); pinta(); rebota(c) },
  'comida-no': () => { const o = $('#otra'); if (o) { o.hidden = false; $('#otra-t')?.focus() } },
  'comida-no-guarda': async ({ c }) => { const t = $('#otra-t')?.value.trim() || ''; await cambiaDia(hoy(), (d) => { d.comidas[c] = 'no'; if (t) d.otra[c] = t; else delete d.otra[c] }); cierraHoja(); pinta() },
  'comida-borra': async ({ c }) => { await cambiaDia(hoy(), (d) => { d.comidas[c] = null; delete d.otra[c] }); cierraHoja(); pinta() },
  'fonda': async ({ k }) => {
    await cambiaDia(hoy(), (d) => { d.comidas.comida = k || null })
    cierraHoja(); pinta(); if (k) rebota('comida')
    if (k === 'rojo') aviso('Va. Mañana pide verde y doble ensalada.')
  },
  'agua': async ({ n }) => { n = +n; await cambiaDia(hoy(), (d) => { d.agua = d.agua === n ? n - 1 : n }); pinta() },
  'agua-mas': async () => { await cambiaDia(hoy(), (d) => { d.agua = Math.min(VASOS_AGUA * 2, (d.agua || 0) + 1) }); cierraHoja(); pinta(); aviso(`Llevas ${dia(hoy()).agua} vasos de agua`) },
  'espalda': async () => { await cambiaDia(hoy(), (d) => { d.espalda = !d.espalda }); cierraHoja(); pinta(); if (dia(hoy()).espalda) aviso('Rutina de espalda anotada') },
  'caminar': () => hNumero({ titulo: `${ms('directions_walk')} ¿Cuánto caminaste hoy?`, valor: dia(hoy()).caminar || 20, chico: 5, grande: 15, min: 0, max: 300, dec: 0, unidad: 'minutos', guarda: (v) => cambiaDia(hoy(), (d) => { d.caminar = v }) }),
  'sueno': () => hNumero({ titulo: `${ms('bedtime')} ¿Cuánto dormiste anoche?`, sub: 'Dormir 7 horas ayuda a comer menos al día siguiente.', valor: dia(hoy()).sueno || 6, chico: 0.5, grande: 1, min: 0, max: 14, dec: 1, unidad: 'horas', guarda: (v) => cambiaDia(hoy(), (d) => { d.sueno = v }) }),
  'refresco': () => hNumero({ titulo: `${ms('local_drink')} Refrescos de hoy`, sub: 'Cuenta los de 600 ml. Sin regaños: es para que veas la semana.', valor: dia(hoy()).refresco || 0, chico: 1, grande: 2, min: 0, max: 10, dec: 0, unidad: 'refrescos', guarda: (v) => cambiaDia(hoy(), (d) => { d.refresco = v }) }),
  'nota': () => hNota(),
  'nota-ok': async () => { const t = $('#nota')?.value.trim() || ''; await cambiaDia(hoy(), (d) => { d.nota = t }); cierraHoja(); pinta() },
  'peso': () => {
    const l = pesosOrden(), v = l.length ? l[l.length - 1].kg : perfil()?.peso_inicio || 70
    hNumero({
      titulo: `${ms('monitor_weight', true)} Tu peso`, sub: 'En ayunas, después del baño, con la misma báscula.', valor: v, chico: 0.1, grande: 1, min: 30, max: 300, dec: 1, unidad: 'kilos', fecha: true,
      guarda: async (kgs) => {
        const f = $('#num-fecha')?.value || hoy(), antes = pesosOrden().filter((x) => x.fecha < f).pop()
        await guarda('pesos', { ...(E.pesos[f] || { fecha: f }), kg: kgs })
        const ini = perfil()?.peso_inicio
        if (antes) aviso(`${difKg(kgs - antes.kg)} desde el ${F.corta(antes.fecha)}${ini ? ' · ' + difKg(kgs - ini) + ' desde el inicio' : ''}`)
        else aviso('Peso anotado')
      },
    })
  },
  'cintura': () => {
    const l = Object.values(E.pesos).filter((x) => x.cintura != null).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)), v = l.length ? l[l.length - 1].cintura : perfil()?.cintura_inicio || 90
    hNumero({ titulo: `${ms('straighten')} Tu cintura`, sub: 'A la altura del ombligo, sin apretar y sin meter la panza.', valor: v, chico: 0.5, grande: 2, min: 40, max: 200, dec: 1, unidad: 'centímetros', fecha: true,
      guarda: async (cm) => { const f = $('#num-fecha')?.value || hoy(); await guarda('pesos', { ...(E.pesos[f] || { fecha: f }), cintura: cm }); aviso('Cintura anotada') } })
  },
  'num': ({ d }) => {
    const i = $('#num'), h = E.h; if (!i || !h) return
    let v = numero(i.value) ?? 0
    v = Math.min(h.max, Math.max(h.min, Math.round((v + +d) * 10 ** h.dec) / 10 ** h.dec))
    i.value = v.toFixed(h.dec)
  },
  'num-guarda': async () => {
    const h = E.h, v = numero($('#num')?.value)
    if (v == null || v < h.min || v > h.max) return aviso(`Escribe un número entre ${h.min} y ${h.max}`, 'mal')
    const g = h.g
    cierraHoja(); await g(Math.round(v * 10 ** h.dec) / 10 ** h.dec); pinta()
  },
  // semana
  'semana-mueve': ({ n }) => { E.ui.semana = F.suma(semanaVista(), +n); pinta(true) },
  'dia': ({ f }) => hDia(f),
  'dia-menu': async ({ f, m }) => { await cambiaSemana(F.lunesDe(f), (s) => { s.dias[F.dif(F.lunesDe(f), f)] = { menu: m } }); pinta(); hDia(f) },
  'elige': ({ f, c, vuelve }) => hElige(f, c, vuelve),
  'elige-ok': async ({ f, c, id }) => {
    const vuelve = E.h?.vuelve
    await cambiaSemana(F.lunesDe(f), (s) => { const d = s.dias[F.dif(F.lunesDe(f), f)]; if (id && id !== E.M[d.menu]?.[c]) d[c] = id; else delete d[c] })
    pinta()
    if (vuelve === 'dia') hDia(f); else cierraHoja()
  },
  'semana-tipo': () => hConfirma('Tu semana vuelve a los menús de siempre y se borran los cambios de esta semana.', async () => {
    const L = semanaVista(); await guarda('semanas', semanaTipo(L)); pinta()
  }, 'Sí, regresar'),
  'menus': () => hMenus(),
  'menu': ({ id }) => hMenu(id),
  'menu-nuevo': async () => { const m = { id: 'm-' + uid(), n: 'Mi menú', e: '⭐', desayuno: 'huevo-mexicana', cena: 'huevo-calabacita' }; await guarda('menus', m); hMenu(m.id) },
  'menu-elige': ({ id, c }) => { guardaNombreMenu(id); hMenuElige(id, c) },
  'menu-elige-ok': async ({ id, c, r }) => { const m = { ...clona(E.M[id]), [c]: r }; delete m.base; delete m.restaurado; await guarda('menus', m); pinta(); hMenu(id) },
  'menu-dia': async ({ id, i }) => { guardaNombreMenu(id); await cambiaSemana(semanaVista(), (s) => { s.dias[+i] = { menu: id } }); pinta(); hMenu(id) },
  'menu-listo': async ({ id }) => { await guardaNombreMenu(id); cierraHoja(); pinta() },
  'menu-borra': ({ id }) => hConfirma('Se borra este menú. Los días que lo tenían regresan a la semana tipo.', async () => { await guarda('menus', { id, borrado: true }); pinta() }),
  'menu-restaura': async ({ id }) => { await guarda('menus', { id, restaurado: true }); pinta(); hMenu(id) },
  // preparar
  'paso': async ({ id }) => { const L = semanaVista(), t = clona(kv('preparado', {})); t[L] ||= {}; t[L][id] = !t[L][id]; await guardaKV('preparado', t); pinta() },
  'reloj': async ({ id, seg }) => {
    const t = { ...kv('timers', {}) }
    if (t[id] && t[id] > Date.now()) return hConfirma('¿Detener este reloj?', async () => { const x = { ...kv('timers', {}) }; delete x[id]; await guardaKV('timers', x); pinta() }, 'Sí, detener')
    if (t[id]) { delete t[id]; delete E.sonado[id] } else { t[id] = Date.now() + +seg * 1000; delete E.sonado[id]; try { E.audio ||= new (window.AudioContext || window.webkitAudioContext)(); E.audio.resume() } catch (e) { /* nada */ } }
    await guardaKV('timers', t); pinta()
  },
  'cocina': () => modoCocina(!E.cocina),
  // recetas
  'filtro': ({ k }) => { E.ui.filtro = k; pinta() },
  'receta-nueva': () => ir('#editar/nueva'),
  'porciones': ({ n }) => { E.ui.porciones = +n; pinta() },
  'tacha': ({ id, n }) => { const t = (E.ui.tachados[id] ||= {}); t[n] = !t[n]; pinta() },
  'a-semana': ({ id }) => hASemana(id),
  'a-semana-ok': async ({ id, f }) => {
    const r = E.R[id], c = r.c
    await cambiaSemana(F.lunesDe(f), (s) => { const d = s.dias[F.dif(F.lunesDe(f), f)]; if (E.M[d.menu]?.[c] === id) delete d[c]; else d[c] = id })
    cierraHoja(); aviso(`Listo: ${r.n} el ${F.larga(f).toLowerCase()}`); pinta()
  },
  'e-emo': ({ e }, el) => { document.querySelectorAll('.emos button').forEach((b) => b.classList.toggle('sel', b === el)) },
  'e-c': (_, el) => { document.querySelectorAll('[data-a="e-c"]').forEach((b) => b.classList.toggle('sel', b === el)) },
  'e-prep': (_, el) => { document.querySelectorAll('[data-a="e-prep"]').forEach((b) => b.classList.toggle('sel', b === el)) },
  'e-congela': (_, el) => el.classList.toggle('sel'),
  'e-guarda': async () => {
    const r = E.ui.edit; if (!r) return
    const n = $('#e-n').value.trim()
    if (!n) { aviso('Ponle nombre a la receta', 'mal'); $('#e-n').focus(); return }
    const viejos = new Map((r.ing || []).map((i) => [textoIng(i), i]))
    const ing = $('#e-ing').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => viejos.get(l) || parseIng(l))
    const pasos = $('#e-pasos').value.split('\n').map((l) => l.trim()).filter(Boolean)
    const prep = $('[data-a="e-prep"].sel')?.dataset.p || 'fresco'
    const nueva = {
      ...r, n, e: $('.emos .sel')?.dataset.e || r.e || '⭐', c: $('[data-a="e-c"].sel')?.dataset.c || r.c || 'cena',
      min: numero($('#e-min').value), kcal: numero($('#e-kcal').value), prot: numero($('#e-prot').value), ing, pasos, prep,
      refri: +$('#e-refri').value || 3, congela: !!$('[data-a="e-congela"].sel'), costo: $('#e-costo').value === '' ? null : numero($('#e-costo').value), nota: $('#e-nota').value.trim(),
    }
    for (const k of ['base', 'editada', 'nueva', 'restaurada', 'oculta', 'borrada']) delete nueva[k]
    if (prep === 'domingo' && !nueva.lote) nueva.lote = nueva.id
    if (prep !== 'lata') delete nueva.lata
    await guarda('recetas', nueva)
    aviso('Receta guardada'); ir('#receta/' + encodeURIComponent(nueva.id))
  },
  'e-borra': () => hConfirma('Se borra esta receta tuya.', async () => { await guarda('recetas', { id: E.ui.edit.id, borrada: true }); ir('#recetas') }),
  'e-quita': () => hConfirma('Esta receta ya no saldrá en tus recetas ni en tus menús. Puedes traerla de regreso con Jarvis.', async () => { await guarda('recetas', { id: E.ui.edit.id, oculta: true }); ir('#recetas') }, 'Sí, quitar'),
  'e-restaura': async () => { await guarda('recetas', { id: E.ui.edit.id, restaurada: true }); aviso('Regresó la receta original'); ir('#receta/' + encodeURIComponent(E.ui.edit.id)) },
  // súper
  'compra': async ({ id }) => { const L = semanaVista(); await cambiaSuper(L, (s) => { s.comprado[id] = !s.comprado[id] }); pinta() },
  'item': ({ id }) => hItem(id),
  'item-precio': async ({ id }) => {
    const v = numero($('#it-precio')?.value); if (v == null || v < 0) return aviso('Escribe el precio en pesos', 'mal')
    const pr = { ...kv('precios', {}) }; if (v === PRODUCTOS[id].precio) delete pr[id]; else pr[id] = v
    await guardaKV('precios', pr); cierraHoja(); pinta(); aviso('Precio guardado')
  },
  'item-tengo': async ({ id }) => { const L = semanaVista(); await cambiaSuper(L, (s) => { s.tengo[id] = !s.tengo[id] }); cierraHoja(); pinta() },
  'item-quita': async ({ id }) => { const L = semanaVista(); await cambiaSuper(L, (s) => { s.extras = s.extras.filter((x) => x.id !== id) }); cierraHoja(); pinta() },
  'extra': () => hExtra(),
  'extra-ok': async () => {
    const n = $('#ex-n')?.value.trim(); if (!n) return aviso('Escribe qué vas a comprar', 'mal')
    const p = numero($('#ex-p')?.value) || 0, L = semanaVista()
    await cambiaSuper(L, (s) => { s.extras.push({ id: 'x-' + uid(), n, precio: p }) }); cierraHoja(); pinta()
  },
  'comparte': async () => {
    const L = semanaVista(), items = listaSuper(L), s = E.super[L] || {}
    const txt = `Súper · semana del ${F.rango(L)}\n` + items.filter((x) => !(s.tengo || {})[x.id]).map((x) => `${(s.comprado || {})[x.id] ? '✅' : '⬜'} ${x.n} · ${x.paq} · ${plata(x.precio)}`).join('\n') + `\nTotal: ${plata(totalSuper(L, items))}`
    if (navigator.share) { try { await navigator.share({ title: 'Lista del súper', text: txt }); return } catch (e) { if (e.name === 'AbortError') return } }
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener')
  },
  // yo y ajustes
  'yo-seg': ({ k }) => { E.ui.yo = k; pinta() },
  'tema': async ({ t }) => { await ajusta({ tema: t }); aplicaTema(); pinta() },
  'fonda-dia': (_, el) => el.classList.toggle('sel'),
  'aj-guarda': async () => {
    const n = $('#aj-nombre').value.trim(), tope = numero($('#aj-tope').value)
    const dias = [...document.querySelectorAll('[data-a="fonda-dia"].sel')].map((b) => +b.dataset.d)
    if (n !== (perfil()?.nombre || '')) await guardaKV('perfil', { ...perfil(), nombre: n })
    await ajusta({ tope: tope > 0 ? tope : null, diasFonda: dias })
    aviso('Guardado'); pinta()
  },
  'respaldo': async () => {
    const txt = JSON.stringify({ miplan: 1, tipo: 'copia', version: VERSION, creado: new Date().toISOString(), kv: Object.values(E.kv), dias: Object.values(E.dias), pesos: Object.values(E.pesos), recetas: Object.values(E.recetas), menus: Object.values(E.menus), semanas: Object.values(E.semanas), super: Object.values(E.super) })
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = `mi-plan-copia-${hoy()}.json`
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 2000)
    await ajusta({ ultimoRespaldo: Date.now() }); aviso('Copia guardada en Descargas'); pinta()
  },
  'restaura': () => $('#archivo')?.click(),
  'borra-todo': () => hConfirma('Se borra todo lo de Mi plan en este teléfono. Lo que ya mandaste a Claude se queda allá y lo puedes traer de regreso.', async () => {
    await A.borraTodo(); for (const s of Object.keys(A.CLAVE)) E[s] = {}; recalcula(); aplicaTema(); location.hash = ''; pinta(true)
  }),
  'confirma-ok': async () => { const f = E.h?.accion; cierraHoja(); if (f) await f() },
  'instalar': async () => {
    if (!E.instalar) return
    E.instalar.prompt()
    let r = null
    try { r = await E.instalar.userChoice } catch (e) { /* nada */ }
    E.instalar = null
    if (r?.outcome === 'accepted') await ajusta({ instalada: true })
    pinta()
  },
  'instalada': async () => { await ajusta({ instalada: true }); pinta() },
  'no-la-encuentro': async () => { await ajusta({ instalada: false }); pinta() },
  'instala-cierra': () => { E.ui.sinInstala = true; pinta() },
  // Jarvis
  'mandar': async () => {
    const txt = JSON.stringify(paqueteParaJarvis())
    const ok = await copia(txt)
    if (!ok) return hTextoManual(txt)
    await ajusta({ ultimoCopiado: Date.now() })
    pinta(); hCopiado()
  },
  'manual-sel': async () => { const t = $('#manual'); t.focus(); t.select(); if (document.execCommand('copy')) { await ajusta({ ultimoCopiado: Date.now() }); aviso('Copiado'); cierraHoja(); pinta() } },
  'traer': async () => {
    let txt = ''
    try { txt = await navigator.clipboard.readText() } catch (e) { /* sin permiso: se pega a mano */ }
    if (txt && txt.includes('"miplan"') && txt.includes('"de-jarvis"')) return traeTexto(txt)
    hPegar('traer')
  },
  'pega-ok': () => traeTexto($('#pega')?.value || ''),
  'sin-jarvis': () => hSinJarvis(),
  'sj-ok': async () => {
    const n = $('#sj-n').value.trim(), k = numero($('#sj-kg').value), cm = numero($('#sj-cm').value)
    if (!(k >= 30 && k <= 300)) return aviso('Escribe tu peso en kilos', 'mal')
    const h = hoy(), r1 = (x) => Math.round(x * 10) / 10
    await guardaKV('perfil', { nombre: n, peso_inicio: k, fecha_peso_inicio: h, inicio: F.lunesDe(h), estatura_cm: cm || null, metas: [{ kg: r1(k * 0.95), t: 'Meta 1', d: '−5 %' }, { kg: r1(k * 0.9), t: 'Meta 2', d: '−10 %' }], ritmo: [0.5, 1] })
    persiste(); cierraHoja(); history.replaceState(null, '', '#hoy'); pinta(true)
  },
}
async function guardaNombreMenu(id) {
  const i = $('#m-n'); if (!i) return
  const n = i.value.trim(); if (!n || n === E.M[id]?.n) return
  const m = { ...clona(E.M[id]), n }; delete m.base; delete m.restaurado
  await guarda('menus', m)
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]'); if (!el) return
  if (el.dataset.a === 'cierra-tras') { setTimeout(() => cierraHoja(), 300); return }
  const f = ACC[el.dataset.a]; if (!f) return
  ev.preventDefault()
  Promise.resolve(f({ ...el.dataset }, el, ev)).catch((e) => aviso('Algo falló: ' + (e?.message || e), 'mal'))
})
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'busca') { E.ui.busca = ev.target.value; const g = $('#rejilla'); if (g) g.innerHTML = tarjetasRecetas() }
})
document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'archivo') return
  const file = ev.target.files?.[0]; if (!file) return
  try { await traeTexto(await file.text()) } finally { ev.target.value = '' }
})
window.addEventListener('hashchange', () => {
  if (E.hojaAbierta) { E.hojaAbierta = false; quitaCapa() }
  if (location.hash.startsWith('#de-jarvis=')) { traeEnlace(); return }
  E.ui.porciones = 1; pinta(true)
})
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recargaSiCambio().catch(() => {}) })
window.addEventListener('storage', (e) => { if (e.key === 'miplan-marca') recargaSiCambio().catch(() => {}) })
window.addEventListener('error', (e) => aviso('Algo falló: ' + (e.message || 'error'), 'mal'))
window.addEventListener('unhandledrejection', (e) => aviso('Algo falló: ' + (e.reason?.message || e.reason || 'error'), 'mal'))
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); E.instalar = e; if (!perfil() || $('#instala') || ruta().r === 'ajustes') pinta() })
window.addEventListener('appinstalled', async () => { E.instalar = null; aviso('¡Listo! Mi plan ya está en tu pantalla de inicio.'); persiste(); await ajusta({ instalada: true }); pinta() })
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicaTema)
setInterval(() => { if ((aj().tema || 'auto') === 'hora') aplicaTema() }, 60000)

// ---------------------------------------------------------------- arranque
async function arranca() {
  try {
    await A.abrir()
    const d = await A.cargar()
    for (const s of Object.keys(A.CLAVE)) E[s] = d[s] || {}
  } catch (e) {
    $('#app').innerHTML = `<div class="bienvenida"><div class="card rojo"><h3>No pude abrir tus datos</h3><p>${esc(e?.message || e)}</p><p>Cierra Mi plan y vuelve a abrirla. Si sigue igual, avísale a Jarvis.</p></div></div>`
    return
  }
  recalcula(); aplicaTema()
  try { E.marca = localStorage.getItem('miplan-marca') } catch (e) { /* sin localStorage */ }
  if (comoApp() && !aj().instalada) await ajusta({ instalada: true })
  const q = new URLSearchParams(location.search), atajo = q.get('atajo')
  if (atajo) history.replaceState(null, '', location.pathname + '#' + (atajo === 'super' ? 'super' : 'hoy'))
  if (!(await traeEnlace())) pinta(true)
  if (atajo === 'peso' && perfil()) ACC.peso()
  window.__miplan = { E, F, diaPlan, fuentes, listaSuper, preparar, costo, paqueteParaJarvis, aplicaPaquete, desempaca, VERSION }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const habia = !!navigator.serviceWorker.controller
    let recargando = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia && !recargando) { recargando = true; location.reload() } })
    try {
      const reg = await navigator.serviceWorker.register('./sw.js')
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) aviso('Hay una versión nueva de Mi plan', '', { t: 'Actualizar', fn: () => w.postMessage('saltar') })
        })
      })
    } catch (e) { console.warn('Sin service worker:', e) }
  }
}
arranca()
