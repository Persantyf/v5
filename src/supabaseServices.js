// ============================================
// SERVICIOS SUPABASE - YLIO v2.3
// Con debug detallado para diagnosticar problemas
// ============================================

// CONFIGURACIÓN - TUS CREDENCIALES
const SUPABASE_URL = 'https://edhyacacepvfvjuwfzrp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHlhY2FjZXB2ZnZqdXdmenJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzU4MTUsImV4cCI6MjA4Mzk1MTgxNX0.9M1Cs9OZi5FIzSKuzw5nT3H2Dq8PCoG1g2Xy6rlhQm0';

console.log('🔧 Supabase Config:', { url: SUPABASE_URL, keyLength: SUPABASE_KEY.length });

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ============================================
// FUNCIÓN BASE PARA PETICIONES
// ============================================
const supabaseFetch = async (endpoint, options = {}) => {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const method = options.method || 'GET';
  
  console.log(`📡 [${method}] ${endpoint}`);
  
  try {
    const fetchOptions = {
      method,
      headers: { ...headers, ...options.headers },
    };
    
    if (options.body) {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    
    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();
    
    console.log(`📥 Status: ${response.status}`);
    
    let data = null;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    }
    
    if (!response.ok) {
      console.error('❌ Error:', response.status, data);
      return { 
        success: false, 
        error: typeof data === 'object' ? (data.message || data.error || JSON.stringify(data)) : data,
        status: response.status 
      };
    }
    
    console.log('✅ OK - Datos:', Array.isArray(data) ? `${data.length} registros` : 'objeto');
    return { success: true, data };
    
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    return { success: false, error: error.message, networkError: true };
  }
};

// ============================================
// TEST DE CONEXIÓN (ejecutar al cargar)
// ============================================
export const testConexion = async () => {
  console.log('🔄 Probando conexión a Supabase...');
  const result = await supabaseFetch('ofertas?select=oferta_id&limit=1');
  
  if (result.success) {
    console.log('✅ CONEXIÓN OK');
    return { success: true, message: 'Conexión establecida' };
  } else {
    console.error('❌ CONEXIÓN FALLIDA:', result.error);
    return result;
  }
};

// Ejecutar test al importar el módulo
testConexion();

// ============================================
// OFERTAS
// ============================================

export const obtenerSiguienteOfertaId = async () => {
  console.log('🔢 Obteniendo siguiente ID...');
  const result = await supabaseFetch('ofertas?select=oferta_id&order=oferta_id.desc&limit=1');
  
  let nuevoId = '10001';
  
  if (result.success && result.data && result.data.length > 0) {
    const ultimoId = result.data[0].oferta_id;
    console.log('📌 Último ID encontrado:', ultimoId);
    const match = ultimoId.match(/(\d+)$/);
    if (match) {
      nuevoId = '10' + String(parseInt(match[1]) + 1).padStart(3, '0');
    }
  }
  
  console.log('🆔 Nuevo ID:', nuevoId);
  return { success: true, id: nuevoId };
};

export const guardarOferta = async (ofertaId, datos) => {
  console.log('💾 Guardando oferta:', ofertaId);
  
  const ofertaData = {
    oferta_id: ofertaId,
    oferta_denominacion: datos.denominacion_oferta || null,
    oferta_version: parseInt(datos.version) || 1,
    oferta_descripcion_version: datos.descripcion_version || null,
    oferta_fecha_solicitud: datos.fecha_solicitud || null,
    oferta_fecha_inicio: datos.fecha_inicio || null,
    cliente_denominacion: datos.cliente_denominacion || null,
    cliente_razon_social: datos.cliente_nombre || null,
    cliente_cif: datos.cliente_cif || null,
    cliente_cnae: datos.cnae || null,
    proyecto_direccion: datos.ubicacion_direccion || null,
    proyecto_cp: datos.ubicacion_cp || null,
    proyecto_municipio: datos.ubicacion_municipio || null,
    proyecto_provincia: datos.ubicacion_provincia || null,
    proyecto_comunidad: datos.ubicacion_comunidad || null,
    proyecto_latitud: datos.ubicacion_latitud ? parseFloat(datos.ubicacion_latitud) : null,
    proyecto_longitud: datos.ubicacion_longitud ? parseFloat(datos.ubicacion_longitud) : null,
    archivo_sips: datos.archivo_sips || null,
    fuente_datos_consumo: datos.fuente_datos_consumo || null,
    archivo_consumo: datos.archivo_consumo || null,
    sips_cups: datos.sips_cups || null,
    sips_distribuidora: datos.sips_distribuidora || null,
    sips_tarifa: datos.sips_tarifa || null,
    sips_tension: datos.sips_tension || null,
    sips_potencia_p1: datos.sips_potencia_p1 ? parseFloat(datos.sips_potencia_p1) : null,
    sips_potencia_p2: datos.sips_potencia_p2 ? parseFloat(datos.sips_potencia_p2) : null,
    sips_potencia_p3: datos.sips_potencia_p3 ? parseFloat(datos.sips_potencia_p3) : null,
    sips_potencia_p4: datos.sips_potencia_p4 ? parseFloat(datos.sips_potencia_p4) : null,
    sips_potencia_p5: datos.sips_potencia_p5 ? parseFloat(datos.sips_potencia_p5) : null,
    sips_potencia_p6: datos.sips_potencia_p6 ? parseFloat(datos.sips_potencia_p6) : null,
    sips_consumo_anual: datos.sips_consumo_anual ? parseInt(datos.sips_consumo_anual) : null,
  };

  // Verificar si existe
  const checkResult = await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}&select=id`);
  
  if (checkResult.success && checkResult.data && checkResult.data.length > 0) {
    console.log('📝 Actualizando oferta existente...');
    return await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}`, {
      method: 'PATCH',
      body: ofertaData
    });
  } else {
    console.log('➕ Creando nueva oferta...');
    return await supabaseFetch('ofertas', {
      method: 'POST',
      body: ofertaData
    });
  }
};

export const cargarOferta = async (ofertaId) => {
  console.log('📂 Cargando oferta:', ofertaId);
  const result = await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}`);
  
  if (result.success && result.data && result.data[0]) {
    return { success: true, data: result.data[0] };
  }
  return { success: false, error: 'Oferta no encontrada' };
};

// ============================================
// SIPS
// ============================================

export const guardarDatosSIPS = async (ofertaId, datosSIPS) => {
  console.log('💾 Guardando SIPS para:', ofertaId);
  
  const sipsData = {
    oferta_id: ofertaId,
    cups: datosSIPS.sips_cups || null,
    distribuidora: datosSIPS.sips_distribuidora || null,
    comercializadora: datosSIPS.sips_comercializadora || null,
    tarifa: datosSIPS.sips_tarifa || null,
    tension: datosSIPS.sips_tension || null,
    potencia_max_bie: datosSIPS.sips_potencia_max_bie ? parseFloat(datosSIPS.sips_potencia_max_bie) : null,
    potencia_p1: datosSIPS.sips_potencia_p1 ? parseFloat(datosSIPS.sips_potencia_p1) : null,
    potencia_p2: datosSIPS.sips_potencia_p2 ? parseFloat(datosSIPS.sips_potencia_p2) : null,
    potencia_p3: datosSIPS.sips_potencia_p3 ? parseFloat(datosSIPS.sips_potencia_p3) : null,
    potencia_p4: datosSIPS.sips_potencia_p4 ? parseFloat(datosSIPS.sips_potencia_p4) : null,
    potencia_p5: datosSIPS.sips_potencia_p5 ? parseFloat(datosSIPS.sips_potencia_p5) : null,
    potencia_p6: datosSIPS.sips_potencia_p6 ? parseFloat(datosSIPS.sips_potencia_p6) : null,
    consumo_anual: datosSIPS.sips_consumo_anual ? parseInt(datosSIPS.sips_consumo_anual) : null,
    cp: datosSIPS.ubicacion_cp || null,
    municipio: datosSIPS.ubicacion_municipio || null,
    provincia: datosSIPS.ubicacion_provincia || null,
    cnae: datosSIPS.cnae || null,
    archivo_origen: datosSIPS.archivo_sips || null,
    datos_raw: datosSIPS
  };

  // Eliminar existente primero
  await supabaseFetch(`ofertas_sips?oferta_id=eq.${ofertaId}`, { method: 'DELETE' });
  
  // Insertar nuevo
  return await supabaseFetch('ofertas_sips', {
    method: 'POST',
    body: sipsData
  });
};

// ============================================
// CONSUMOS BRUTOS
// ============================================

export const guardarConsumosBrutos = async (ofertaId, consumosBrutos) => {
  console.log('💾 Guardando consumos brutos:', consumosBrutos.length, 'registros');
  
  const batchSize = 500;
  let totalInsertados = 0;

  // Eliminar existentes
  await supabaseFetch(`ofertas_consumos_brutos?oferta_id=eq.${ofertaId}`, { method: 'DELETE' });

  // Insertar en batches
  for (let i = 0; i < consumosBrutos.length; i += batchSize) {
    const batch = consumosBrutos.slice(i, i + batchSize).map(c => ({
      oferta_id: ofertaId,
      fecha: c.fecha,
      hora: c.hora,
      consumo: c.consumo,
      ano_original: c.añoOriginal || parseInt(c.fecha.substring(0, 4)),
      linea_original: c.lineaOriginal || null
    }));

    const result = await supabaseFetch('ofertas_consumos_brutos', {
      method: 'POST',
      body: batch
    });

    if (!result.success) {
      console.error('❌ Error en batch', i);
      return { success: false, error: result.error, count: totalInsertados };
    }
    
    totalInsertados += batch.length;
    console.log(`📊 Progreso: ${totalInsertados}/${consumosBrutos.length}`);
  }

  return { success: true, count: totalInsertados };
};

export const cargarConsumosBrutos = async (ofertaId) => {
  console.log('📂 Cargando consumos brutos de:', ofertaId);
  const result = await supabaseFetch(`ofertas_consumos_brutos?oferta_id=eq.${ofertaId}&order=fecha,hora`);
  
  if (result.success) {
    const consumos = (result.data || []).map(c => ({
      fecha: c.fecha,
      hora: c.hora,
      consumo: parseFloat(c.consumo),
      añoOriginal: c.ano_original,
      lineaOriginal: c.linea_original
    }));
    console.log('📊 Cargados:', consumos.length, 'registros');
    return { success: true, data: consumos };
  }
  return result;
};

// ============================================
// CONSUMOS PROCESADOS (8760h)
// ============================================

export const guardarConsumosProcesados = async (ofertaId, consumosProcesados) => {
  console.log('💾 Guardando consumos procesados:', consumosProcesados.length, 'registros');
  
  const batchSize = 500;
  let totalInsertados = 0;

  // Eliminar existentes
  await supabaseFetch(`ofertas_consumos_horarios?oferta_id=eq.${ofertaId}`, { method: 'DELETE' });

  // Insertar en batches
  for (let i = 0; i < consumosProcesados.length; i += batchSize) {
    const batch = consumosProcesados.slice(i, i + batchSize).map(c => ({
      oferta_id: ofertaId,
      fecha: c.fechaOriginal || c.fecha,
      hora: c.hora,
      consumo: c.consumo
    }));

    const result = await supabaseFetch('ofertas_consumos_horarios', {
      method: 'POST',
      body: batch
    });

    if (!result.success) {
      console.error('❌ Error en batch', i);
      return { success: false, error: result.error, count: totalInsertados };
    }
    
    totalInsertados += batch.length;
    console.log(`📊 Progreso: ${totalInsertados}/${consumosProcesados.length}`);
  }

  // Actualizar estadísticas
  const consumoTotal = consumosProcesados.reduce((sum, c) => sum + c.consumo, 0);
  const estadisticas = {
    total: consumoTotal,
    media: consumoTotal / consumosProcesados.length,
    max: Math.max(...consumosProcesados.map(c => c.consumo)),
    min: Math.min(...consumosProcesados.map(c => c.consumo)),
    registros: consumosProcesados.length
  };

  await supabaseFetch(`ofertas?oferta_id=eq.${ofertaId}`, {
    method: 'PATCH',
    body: { oferta_consumos: estadisticas }
  });

  return { success: true, count: totalInsertados };
};

export const cargarConsumosProcesados = async (ofertaId) => {
  console.log('📂 Cargando consumos procesados de:', ofertaId);
  const result = await supabaseFetch(`ofertas_consumos_horarios?oferta_id=eq.${ofertaId}&order=fecha,hora`);
  
  if (result.success) {
    const consumos = (result.data || []).map(c => ({
      fecha: c.fecha,
      hora: c.hora,
      consumo: parseFloat(c.consumo)
    }));
    console.log('📊 Cargados:', consumos.length, 'registros');
    return { success: true, data: consumos };
  }
  return result;
};
