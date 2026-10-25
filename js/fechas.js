// Fechas en hora local, como texto 'AAAA-MM-DD'. La semana empieza en lunes.
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const dos = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
export const deISO = (s) => { const [a, m, d] = String(s).split('-').map(Number); return new Date(a, m - 1, d, 12) }
export const esISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s))
export const hoyISO = () => iso(new Date())
export const suma = (s, n) => { const d = deISO(s); d.setDate(d.getDate() + n); return iso(d) }
export const dow = (s) => deISO(s).getDay()
export const lunesDe = (s) => suma(s, -((dow(s) + 6) % 7))
export const dif = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5)
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
export const larga = (s) => { const d = deISO(s); return `${cap(DIAS[d.getDay()])} ${d.getDate()} ${MESES_C[d.getMonth()]}` }
export const corta = (s) => { const d = deISO(s); return `${d.getDate()} ${MESES_C[d.getMonth()]}` }
export const diaC = (s) => DIAS_C[dow(s)]
export const rango = (lunes) => {
  const a = deISO(lunes), b = deISO(suma(lunes, 6))
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MESES_C[b.getMonth()]}` : `${corta(lunes)} – ${corta(suma(lunes, 6))}`
}
export const mes = (s) => MESES[deISO(s).getMonth()]

// «hoy 9:30 pm», «ayer 8:10 am», «26 oct»
export function cuando(ms) {
  if (!ms) return 'nunca'
  const d = new Date(ms), h = d.getHours(), m = dos(d.getMinutes())
  const hora = `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'am' : 'pm'}`
  const dd = dif(iso(d), hoyISO())
  if (dd === 0) return 'hoy ' + hora
  if (dd === 1) return 'ayer ' + hora
  return corta(iso(d))
}
