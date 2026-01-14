// ============================================
// SERVICIOS SUPABASE - YLIO v2.1
// ============================================

// Configuración Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://edhyacacepvfvjuwfzrp.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHlhY2FjZXB2ZnZqdXdmenJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzU4MTUsImV4cCI6MjA4Mzk1MTgxNX0.9M1Cs9OZi5FIzSKuzw5nT3H2Dq8PCoG1g2Xy6rlhQm0';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// ============================================
// FUNCIONES DE OFERTAS
// ============================================

// Obtener siguiente ID de oferta
export const obtenerSiguienteOfertaId = async () => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas?select=oferta_id&order=oferta_id.desc&limit=1`,
      { headers }
    );
    const data = await res.json();
    
    let siguienteNum = 1;
    if (data && data.length > 0) {
      const ultimoId = data[0].oferta_id;
      const num = parseInt(ultimoId.replace(/\D/g, '')) || 0;
      siguienteNum = num + 1;
    }
    
    const nuevoId = '10' + String(siguienteNum).padStart(3, '0');
    console.log('✅ Siguiente ID:', nuevoId);
    return { success: true, id: nuevoId };
  } catch (error) {
    console.error('❌ Error obteniendo siguiente ID:', error);
    return { success: false, error: error.message, id: '10001' };
  }
};

// Guardar oferta (datos generales)
export const guardarOferta = async (ofertaId, datos) => {
  try {
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
      proyecto_coordenada_x: datos.coordenada_x ? parseInt(datos.coordenada_x) : null,
      proyecto_coordenada_y: datos.coordenada_y ? parseInt(datos.coordenada_y) : null,
      proyecto_huso: datos.huso ? parseInt(datos.huso) : null,
      proyecto_referencia_catastral: datos.referencia_catastral || null,
      
      archivo_sips: datos.archivo_sips || null,
      fuente_datos_consumo: datos.fuente_datos_consumo || null,
      archivo_consumo: datos.archivo_consumo || null,
      
      sips_cups: datos.sips_cups || null,
      sips_distribuidora: datos.sips_distribuidora || null,
      sips_tarifa: datos.sips_tarifa || null,
      sips_tension: datos.sips_tension || null,
      sips_potencia_max_bie: datos.sips_potencia_max_bie ? parseFloat(datos.sips_potencia_max_bie) : null,
      sips_derechos_extension: datos.sips_derechos_extension ? parseFloat(datos.sips_derechos_extension) : null,
      sips_derechos_acceso: datos.sips_derechos_acceso ? parseFloat(datos.sips_derechos_acceso) : null,
      sips_potencia_p1: datos.sips_potencia_p1 ? parseFloat(datos.sips_potencia_p1) : null,
      sips_potencia_p2: datos.sips_potencia_p2 ? parseFloat(datos.sips_potencia_p2) : null,
      sips_potencia_p3: datos.sips_potencia_p3 ? parseFloat(datos.sips_potencia_p3) : null,
      sips_potencia_p4: datos.sips_potencia_p4 ? parseFloat(datos.sips_potencia_p4) : null,
      sips_potencia_p5: datos.sips_potencia_p5 ? parseFloat(datos.sips_potencia_p5) : null,
      sips_potencia_p6: datos.sips_potencia_p6 ? parseFloat(datos.sips_potencia_p6) : null,
      sips_consumo_anual: datos.sips_consumo_anual ? parseInt(datos.sips_consumo_anual) : null,
      sips_consumo_p1: datos.sips_consumo_p1 ? parseFloat(datos.sips_consumo_p1) : null,
      sips_consumo_p2: datos.sips_consumo_p2 ? parseFloat(datos.sips_consumo_p2) : null,
      sips_consumo_p3: datos.sips_consumo_p3 ? parseFloat(datos.sips_consumo_p3) : null,
      sips_consumo_p4: datos.sips_consumo_p4 ? parseFloat(datos.sips_consumo_p4) : null,
      sips_consumo_p5: datos.sips_consumo_p5 ? parseFloat(datos.sips_consumo_p5) : null,
      sips_consumo_p6: datos.sips_consumo_p6 ? parseFloat(datos.sips_consumo_p6) : null,
    };

    // Verificar si existe
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas?oferta_id=eq.${ofertaId}`,
      { headers }
    );
    const existe = await checkRes.json();

    let res;
    if (existe && existe.length > 0) {
      // UPDATE
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/ofertas?oferta_id=eq.${ofertaId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(ofertaData)
        }
      );
    } else {
      // INSERT
      res = await fetch(
        `${SUPABASE_URL}/rest/v1/ofertas`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(ofertaData)
        }
      );
    }

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    console.log('✅ Oferta guardada correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando oferta:', error);
    return { success: false, error: error.message };
  }
};

// Cargar oferta
export const cargarOferta = async (ofertaId) => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas?oferta_id=eq.${ofertaId}`,
      { headers }
    );
    const data = await res.json();
    
    if (data && data[0]) {
      console.log('✅ Oferta cargada');
      return { success: true, data: data[0] };
    }
    return { success: false, error: 'No encontrada' };
  } catch (error) {
    console.error('❌ Error cargando oferta:', error);
    return { success: false, error: error.message };
  }
};

// Listar ofertas
export const listarOfertas = async () => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas?select=oferta_id,oferta_denominacion,cliente_denominacion,proyecto_municipio,fecha_creacion,fecha_modificacion&order=fecha_modificacion.desc&limit=50`,
      { headers }
    );
    const data = await res.json();
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('❌ Error listando ofertas:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// ============================================
// FUNCIONES DE SIPS
// ============================================

export const guardarDatosSIPS = async (ofertaId, datosSIPS) => {
  try {
    const sipsData = {
      oferta_id: ofertaId,
      cups: datosSIPS.sips_cups || null,
      distribuidora: datosSIPS.sips_distribuidora || null,
      comercializadora: datosSIPS.sips_comercializadora || null,
      tarifa: datosSIPS.sips_tarifa || null,
      tension: datosSIPS.sips_tension || null,
      potencia_max_bie: datosSIPS.sips_potencia_max_bie ? parseFloat(datosSIPS.sips_potencia_max_bie) : null,
      derechos_extension: datosSIPS.sips_derechos_extension ? parseFloat(datosSIPS.sips_derechos_extension) : null,
      derechos_acceso: datosSIPS.sips_derechos_acceso ? parseFloat(datosSIPS.sips_derechos_acceso) : null,
      potencia_p1: datosSIPS.sips_potencia_p1 ? parseFloat(datosSIPS.sips_potencia_p1) : null,
      potencia_p2: datosSIPS.sips_potencia_p2 ? parseFloat(datosSIPS.sips_potencia_p2) : null,
      potencia_p3: datosSIPS.sips_potencia_p3 ? parseFloat(datosSIPS.sips_potencia_p3) : null,
      potencia_p4: datosSIPS.sips_potencia_p4 ? parseFloat(datosSIPS.sips_potencia_p4) : null,
      potencia_p5: datosSIPS.sips_potencia_p5 ? parseFloat(datosSIPS.sips_potencia_p5) : null,
      potencia_p6: datosSIPS.sips_potencia_p6 ? parseFloat(datosSIPS.sips_potencia_p6) : null,
      consumo_anual: datosSIPS.sips_consumo_anual ? parseInt(datosSIPS.sips_consumo_anual) : null,
      consumo_p1: datosSIPS.sips_consumo_p1 ? parseFloat(datosSIPS.sips_consumo_p1) : null,
      consumo_p2: datosSIPS.sips_consumo_p2 ? parseFloat(datosSIPS.sips_consumo_p2) : null,
      consumo_p3: datosSIPS.sips_consumo_p3 ? parseFloat(datosSIPS.sips_consumo_p3) : null,
      consumo_p4: datosSIPS.sips_consumo_p4 ? parseFloat(datosSIPS.sips_consumo_p4) : null,
      consumo_p5: datosSIPS.sips_consumo_p5 ? parseFloat(datosSIPS.sips_consumo_p5) : null,
      consumo_p6: datosSIPS.sips_consumo_p6 ? parseFloat(datosSIPS.sips_consumo_p6) : null,
      cp: datosSIPS.ubicacion_cp || null,
      municipio: datosSIPS.ubicacion_municipio || null,
      provincia: datosSIPS.ubicacion_provincia || null,
      cnae: datosSIPS.cnae || null,
      archivo_origen: datosSIPS.archivo_sips || null,
      datos_raw: datosSIPS
    };

    // Eliminar existente
    await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_sips?oferta_id=eq.${ofertaId}`,
      { method: 'DELETE', headers }
    );

    // Insertar nuevo
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_sips`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(sipsData)
      }
    );

    if (!res.ok) throw new Error(await res.text());

    console.log('✅ Datos SIPS guardados correctamente');
    return { success: true };
  } catch (error) {
    console.error('❌ Error guardando SIPS:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// FUNCIONES DE CONSUMOS
// ============================================

// Guardar consumos brutos (archivo original)
export const guardarConsumosBrutos = async (ofertaId, consumosBrutos) => {
  try {
    const batchSize = 500;
    let totalInsertados = 0;

    // Eliminar existentes
    await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_consumos_brutos?oferta_id=eq.${ofertaId}`,
      { method: 'DELETE', headers }
    );

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

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ofertas_consumos_brutos`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(batch)
        }
      );

      if (!res.ok) throw new Error(await res.text());
      totalInsertados += batch.length;
    }

    console.log(`✅ ${totalInsertados} consumos brutos guardados`);
    return { success: true, count: totalInsertados };
  } catch (error) {
    console.error('❌ Error guardando consumos brutos:', error);
    return { success: false, error: error.message };
  }
};

// Guardar consumos procesados (8760 horas)
export const guardarConsumosProcesados = async (ofertaId, consumosProcesados) => {
  try {
    const batchSize = 500;
    let totalInsertados = 0;

    // Eliminar existentes
    await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_consumos_horarios?oferta_id=eq.${ofertaId}`,
      { method: 'DELETE', headers }
    );

    // Insertar en batches
    for (let i = 0; i < consumosProcesados.length; i += batchSize) {
      const batch = consumosProcesados.slice(i, i + batchSize).map(c => ({
        oferta_id: ofertaId,
        fecha: c.fechaOriginal || c.fecha,
        hora: c.hora,
        consumo: c.consumo
      }));

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ofertas_consumos_horarios`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(batch)
        }
      );

      if (!res.ok) throw new Error(await res.text());
      totalInsertados += batch.length;
    }

    // Actualizar estadísticas en ofertas
    const consumoTotal = consumosProcesados.reduce((sum, c) => sum + c.consumo, 0);
    const estadisticas = {
      total: consumoTotal,
      media: consumoTotal / consumosProcesados.length,
      max: Math.max(...consumosProcesados.map(c => c.consumo)),
      min: Math.min(...consumosProcesados.map(c => c.consumo)),
      registros: consumosProcesados.length
    };

    await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas?oferta_id=eq.${ofertaId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ oferta_consumos: estadisticas })
      }
    );

    console.log(`✅ ${totalInsertados} consumos procesados guardados`);
    return { success: true, count: totalInsertados };
  } catch (error) {
    console.error('❌ Error guardando consumos procesados:', error);
    return { success: false, error: error.message };
  }
};

// Cargar consumos brutos
export const cargarConsumosBrutos = async (ofertaId) => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_consumos_brutos?oferta_id=eq.${ofertaId}&order=fecha,hora`,
      { headers }
    );
    const data = await res.json();

    const consumos = (data || []).map(c => ({
      fecha: c.fecha,
      hora: c.hora,
      consumo: parseFloat(c.consumo),
      añoOriginal: c.ano_original,
      lineaOriginal: c.linea_original
    }));

    console.log(`✅ ${consumos.length} consumos brutos cargados`);
    return { success: true, data: consumos };
  } catch (error) {
    console.error('❌ Error cargando consumos brutos:', error);
    return { success: false, error: error.message };
  }
};

// Cargar consumos procesados
export const cargarConsumosProcesados = async (ofertaId) => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ofertas_consumos_horarios?oferta_id=eq.${ofertaId}&order=fecha,hora`,
      { headers }
    );
    const data = await res.json();

    const consumos = (data || []).map(c => ({
      fecha: c.fecha,
      hora: c.hora,
      consumo: parseFloat(c.consumo)
    }));

    console.log(`✅ ${consumos.length} consumos procesados cargados`);
    return { success: true, data: consumos };
  } catch (error) {
    console.error('❌ Error cargando consumos procesados:', error);
    return { success: false, error: error.message };
  }
};
