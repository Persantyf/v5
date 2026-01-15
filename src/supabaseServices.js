// SERVICIOS SUPABASE - YLIO v3.0
const SUPABASE_URL = 'https://edhyacacepvfvjuwfzrp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHlhY2FjZXB2ZnZqdXdmenJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzU4MTUsImV4cCI6MjA4Mzk1MTgxNX0.9M1Cs9OZi5FIzSKuzw5nT3H2Dq8PCoG1g2Xy6rlhQm0';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const supabaseFetch = async (endpoint, options = {}) => {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  console.log(`📡 [${options.method || 'GET'}] ${endpoint}`);
  try {
    const res = await fetch(url, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) { console.error('❌', res.status, data); return { success: false, error: data?.message || text }; }
    console.log('✅ OK');
    return { success: true, data };
  } catch (err) { console.error('❌', err.message); return { success: false, error: err.message }; }
};

// Test al cargar
(async () => { console.log('🔄 Test Supabase...'); const r = await supabaseFetch('ofertas?select=oferta_id&limit=1'); console.log(r.success ? '✅ Conexión OK' : '❌ FALLIDA'); })();

export const obtenerSiguienteOfertaId = async () => {
  const r = await supabaseFetch('ofertas?select=oferta_id&order=oferta_id.desc&limit=1');
  let id = '10001';
  if (r.success && r.data?.[0]) { const m = r.data[0].oferta_id.match(/(\d+)$/); if (m) id = '10' + String(parseInt(m[1]) + 1).padStart(3, '0'); }
  return { success: true, id };
};

export const guardarOferta = async (ofertaId, datos) => {
  const d = { oferta_id: ofertaId, oferta_denominacion: datos.denominacion_oferta || null, cliente_denominacion: datos.cliente_denominacion || null, cliente_razon_social: datos.cliente_nombre || null, cliente_cif: datos.cliente_cif || null, proyecto_direccion: datos.ubicacion_direccion || null, proyecto_cp: datos.ubicacion_cp || null, proyecto_municipio: datos.ubicacion_municipio || null, sips_cups: datos.sips_cups || null, sips_tarifa: datos.sips_tarifa || null };
  const check = await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}&select=id`);
  return check.success && check.data?.length > 0 ? supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}`, { method: 'PATCH', body: d }) : supabaseFetch('ofertas', { method: 'POST', body: d });
};

export const cargarOferta = async (ofertaId) => { const r = await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}`); return r.success && r.data?.[0] ? { success: true, data: r.data[0] } : { success: false }; };

export const guardarDatosSIPS = async (ofertaId, datos) => { await supabaseFetch(`ofertas_sips?oferta_id=eq.${ofertaId}`, { method: 'DELETE' }); return supabaseFetch('ofertas_sips', { method: 'POST', body: { oferta_id: ofertaId, cups: datos.sips_cups, tarifa: datos.sips_tarifa, datos_raw: datos } }); };

export const guardarConsumosBrutos = async (ofertaId, consumos) => {
  await supabaseFetch(`ofertas_consumos_brutos?oferta_id=eq.${ofertaId}`, { method: 'DELETE' });
  for (let i = 0; i < consumos.length; i += 500) { const batch = consumos.slice(i, i + 500).map(c => ({ oferta_id: ofertaId, fecha: c.fecha, hora: c.hora, consumo: c.consumo })); const r = await supabaseFetch('ofertas_consumos_brutos', { method: 'POST', body: batch }); if (!r.success) return r; }
  return { success: true, count: consumos.length };
};

export const cargarConsumosBrutos = async (ofertaId) => { const r = await supabaseFetch(`ofertas_consumos_brutos?oferta_id=eq.${ofertaId}&order=fecha,hora`); return r.success ? { success: true, data: r.data || [] } : r; };

export const guardarConsumosProcesados = async (ofertaId, consumos) => {
  await supabaseFetch(`ofertas_consumos_horarios?oferta_id=eq.${ofertaId}`, { method: 'DELETE' });
  for (let i = 0; i < consumos.length; i += 500) { const batch = consumos.slice(i, i + 500).map(c => ({ oferta_id: ofertaId, fecha: c.fecha, hora: c.hora, consumo: c.consumo })); const r = await supabaseFetch('ofertas_consumos_horarios', { method: 'POST', body: batch }); if (!r.success) return r; }
  return { success: true, count: consumos.length };
};

export const cargarConsumosProcesados = async (ofertaId) => { const r = await supabaseFetch(`ofertas_consumos_horarios?oferta_id=eq.${ofertaId}&order=fecha,hora`); return r.success ? { success: true, data: r.data || [] } : r; };
