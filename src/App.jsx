import React, { useState } from 'react';
import { 
  guardarDatosSIPS, 
  guardarConsumosBrutos, 
  guardarConsumosProcesados,
  guardarOferta,
  cargarConsumosBrutos,
  cargarOferta,
  obtenerSiguienteOfertaId
} from './supabaseServices';

// ============================================
// PALETA DE COLORES CORPORATIVOS YLIO
// ============================================
// Pantone Black 7C - RGB 59,59,59
const COLOR_CORP_DARK = "#3B3B3B";
// Pantone 1595C - RGB 235,98,33  
const COLOR_CORP = "#EB6221";
// Pantone 1365C - RGB 255,172,62
const COLOR_CORP_LIGHT = "#FFAC3E";
const COLOR_CORP_BG = "#FEF6EE";  // Fondo suave naranja

const COLOR_BG = "#FFFFFF";
const COLOR_BG_SECONDARY = "#F5F5F5";
const COLOR_TEXT = "#3B3B3B";  // Pantone Black 7C
const COLOR_TEXT_LIGHT = "#6C757D";
const COLOR_SUCCESS = "#28A745";
const COLOR_WARNING = "#FFAC3E";  // Pantone 1365C
const COLOR_DANGER = "#DC3545";
const COLOR_INFO = "#17A2B8";

// ============================================
// UTILIDADES PARA EXPORTACIÓN CSV/EXCEL
// ============================================

/**
 * Exporta datos a CSV con la plantilla estándar (fecha;hora;demanda)
 */
const exportarCSV = (datos, nombreArchivo = 'consumos_horarios.csv') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  // Función para convertir fecha YYYY-MM-DD a DD-MM-YYYY
  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    const partes = fecha.split('-');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`; // DD-MM-YYYY
    }
    return fecha;
  };
  
  // Ordenar por mes, día, hora (enero a diciembre)
  const datosOrdenados = [...datos].sort((a, b) => {
    const [aYear, aMonth, aDay] = a.fecha.split('-').map(Number);
    const [bYear, bMonth, bDay] = b.fecha.split('-').map(Number);
    
    // Primero por mes (1-12)
    if (aMonth !== bMonth) return aMonth - bMonth;
    // Luego por día
    if (aDay !== bDay) return aDay - bDay;
    // Finalmente por hora
    return a.hora - b.hora;
  });
  
  const cabecera = 'fecha;hora;demanda\n';
  // Usar coma como separador decimal para compatibilidad con Excel español
  const filas = datosOrdenados.map(d => `${formatearFecha(d.fecha)};${d.hora};${d.consumo.toFixed(4).replace('.', ',')}`).join('\n');
  const contenido = cabecera + filas;
  
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Carga SheetJS dinámicamente si no está disponible
 */
const cargarSheetJS = () => {
  return new Promise((resolve, reject) => {
    // Primero verificar si ya está cargado globalmente
    if (window.XLSX) {
      console.log('SheetJS ya disponible globalmente');
      resolve(window.XLSX);
      return;
    }
    
    // En entornos con CSP restrictivo, no podemos cargar scripts externos
    // Intentar una sola vez y fallar rápido
    console.log('SheetJS no disponible, intentando cargar...');
    
    // Timeout corto de 3 segundos
    const timeout = setTimeout(() => {
      console.log('Timeout cargando SheetJS');
      reject(new Error('No se pudo cargar la librería Excel. Por favor, convierte el archivo a CSV.'));
    }, 3000);
    
    try {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
      script.onload = () => {
        clearTimeout(timeout);
        setTimeout(() => {
          if (window.XLSX) {
            console.log('SheetJS cargado correctamente');
            resolve(window.XLSX);
          } else {
            reject(new Error('SheetJS no se inicializó. Usa CSV.'));
          }
        }, 300);
      };
      script.onerror = () => {
        clearTimeout(timeout);
        console.log('Error cargando script SheetJS - CSP puede estar bloqueándolo');
        reject(new Error('No se puede cargar Excel en este entorno. Convierte el archivo a CSV.'));
      };
      document.head.appendChild(script);
    } catch (e) {
      clearTimeout(timeout);
      reject(new Error('Error: ' + e.message + '. Usa CSV.'));
    }
  });
};

/**
 * Exporta datos a Excel (.xlsx) con la plantilla estándar (fecha, hora, demanda)
 * Usa SheetJS para generar archivo Excel real
 * Formato fecha: DD-MM-YYYY, ordenado de enero a diciembre
 */
const exportarExcel = async (datos, nombreArchivo = 'consumos_horarios.xlsx') => {
  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  // Función para convertir fecha YYYY-MM-DD a DD-MM-YYYY
  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    const partes = fecha.split('-');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`; // DD-MM-YYYY
    }
    return fecha;
  };
  
  try {
    const XLSX = await cargarSheetJS();
    
    // Ordenar por mes, día, hora (enero a diciembre)
    const datosOrdenados = [...datos].sort((a, b) => {
      const [aYear, aMonth, aDay] = a.fecha.split('-').map(Number);
      const [bYear, bMonth, bDay] = b.fecha.split('-').map(Number);
      
      if (aMonth !== bMonth) return aMonth - bMonth;
      if (aDay !== bDay) return aDay - bDay;
      return a.hora - b.hora;
    });
    
    // Preparar datos con cabecera y fecha formateada
    const datosExcel = [
      ['fecha', 'hora', 'demanda'], // Cabecera
      ...datosOrdenados.map(d => [formatearFecha(d.fecha), d.hora, parseFloat(d.consumo.toFixed(4))])
    ];
    
    // Crear libro y hoja
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(datosExcel);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 12 }, // fecha
      { wch: 6 },  // hora
      { wch: 12 }  // demanda
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Consumos');
    
    // Descargar
    XLSX.writeFile(wb, nombreArchivo);
  } catch (error) {
    alert('Error exportando Excel: ' + error.message);
  }
};

/**
 * Lee archivo Excel (.xlsx, .xls) y lo convierte a formato CSV estándar interno
 * Formato estándar: fecha;hora;consumo (YYYY-MM-DD;H;valor)
 * Detecta automáticamente las columnas relevantes
 */
const leerArchivoExcel = async (file) => {
  console.log('Iniciando lectura de Excel:', file.name);
  
  try {
    const XLSX = await cargarSheetJS();
    console.log('SheetJS disponible, procesando archivo...');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: false });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          console.log('Filas leídas:', rows.length);
          
          if (rows.length < 2) {
            throw new Error('El archivo no contiene datos suficientes');
          }
          
          // Detectar columnas en la cabecera
          const cabecera = rows[0].map(c => String(c).toLowerCase().trim());
          console.log('Cabecera original:', cabecera);
          
          // Detectar columna de fecha
          let colFecha = cabecera.findIndex(c => 
            c === 'fecha' || c === 'date' || c.includes('datetime') || c.includes('fecha')
          );
          if (colFecha === -1) colFecha = cabecera.findIndex(c => c.includes('date'));
          if (colFecha === -1) colFecha = 0;
          
          // Detectar columna de hora
          let colHora = cabecera.findIndex(c => 
            c === 'hora' || c === 'hour' || c === 'h' || c === 'periodo'
          );
          if (colHora === -1) colHora = cabecera.findIndex(c => c.includes('hora') && !c.includes('fecha'));
          
          // Detectar columna de consumo (priorizar AE_kWh, luego otros)
          const patronesConsumoAlta = ['ae_kwh', 'ae kwh', 'consumo_kwh', 'demanda'];
          const patronesConsumoMedia = ['ae', 'consumo', 'kwh', 'energia', 'activa', 'valor'];
          const patronesExcluir = ['as_kwh', 'as kwh', 'as_', 'reactiva', 'autocons', 'r1', 'r2', 'r3', 'r4', 'exporta'];
          
          let colConsumo = cabecera.findIndex(c => 
            patronesConsumoAlta.some(p => c.includes(p)) &&
            !patronesExcluir.some(p => c.includes(p))
          );
          if (colConsumo === -1) {
            colConsumo = cabecera.findIndex(c => 
              patronesConsumoMedia.some(p => c.includes(p)) &&
              !patronesExcluir.some(p => c.includes(p))
            );
          }
          if (colConsumo === -1) colConsumo = 3; // Por defecto columna D
          
          console.log(`Columnas detectadas - Fecha: ${colFecha} (${cabecera[colFecha]}), Hora: ${colHora} (${cabecera[colHora]}), Consumo: ${colConsumo} (${cabecera[colConsumo]})`);
          
          // Función para convertir fecha de Excel a string YYYY-MM-DD
          const excelDateToString = (val) => {
            if (typeof val === 'number' && val > 40000 && val < 60000) {
              const date = new Date((val - 25569) * 86400 * 1000);
              const year = date.getUTCFullYear();
              const month = String(date.getUTCMonth() + 1).padStart(2, '0');
              const day = String(date.getUTCDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
            return String(val || '');
          };
          
          // Convertir a formato estándar: fecha;hora;consumo
          const csvLines = ['fecha;hora;consumo']; // Cabecera estándar
          
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            // Obtener fecha
            let fecha = excelDateToString(row[colFecha]);
            if (!fecha || fecha === 'undefined') continue;
            
            // Obtener hora
            let hora = 0;
            if (colHora >= 0 && colHora < row.length) {
              const valHora = row[colHora];
              if (typeof valHora === 'number') {
                hora = Math.floor(valHora);
              } else {
                hora = parseInt(String(valHora).split(':')[0]) || 0;
              }
            }
            if (hora === 24) hora = 0;
            if (hora < 0 || hora > 23) hora = 0;
            
            // Obtener consumo
            let consumo = 0;
            if (colConsumo >= 0 && colConsumo < row.length) {
              const valConsumo = row[colConsumo];
              if (typeof valConsumo === 'number') {
                consumo = valConsumo;
              } else {
                consumo = parseFloat(String(valConsumo).replace(',', '.')) || 0;
              }
            }
            
            csvLines.push(`${fecha};${hora};${consumo}`);
          }
          
          console.log(`Conversión completada: ${csvLines.length - 1} registros`);
          console.log('Ejemplo líneas:', csvLines.slice(0, 4));
          
          resolve(csvLines.join('\n'));
        } catch (err) {
          console.error('Error procesando Excel:', err);
          reject(new Error('Error leyendo Excel: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsArrayBuffer(file);
    });
  } catch (xlsxError) {
    console.error('Error cargando SheetJS:', xlsxError);
    throw new Error('No se pudo procesar el archivo Excel: ' + xlsxError.message);
  }
};

// ============================================
// UTILIDADES PARA VALIDACIÓN DE CONSUMOS
// ============================================

const parsearCSVConsumo = (contenido) => {
  const lineas = contenido.trim().split('\n').filter(l => l.trim());
  if (lineas.length < 2) {
    return { datos: [], formato: null, totalLineas: 0, separador: ';', cabecera: [] };
  }
  
  const primeraLinea = lineas[0];
  const separador = primeraLinea.includes(';') ? ';' : (primeraLinea.includes('\t') ? '\t' : ',');
  const cabecera = lineas[0].split(separador).map(c => c.trim().toLowerCase().replace(/"/g, ''));
  const primeraLineaDatos = lineas.length > 1 ? lineas[1] : null;
  
  console.log('=== DETECCIÓN AUTOMÁTICA DE FORMATO ===');
  console.log('Separador:', separador === ';' ? 'punto y coma' : separador === '\t' ? 'tabulador' : 'coma');
  console.log('Cabecera:', cabecera);
  console.log('Primera línea datos:', primeraLineaDatos?.substring(0, 100));
  
  // Detectar formato de columnas (ahora con primera línea de datos para autodetección)
  const formato = detectarFormatoCSV(cabecera, primeraLineaDatos);
  console.log('Formato detectado:', formato.nombre || formato.tipo);
  console.log('Columnas: Fecha=' + formato.colFecha + ', Hora=' + formato.colHora + ', Consumo=' + formato.colConsumo);
  
  const datos = [];
  let erroresParsingCount = 0;
  
  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (!linea) continue;
    
    const valores = linea.split(separador).map(v => v.trim().replace(/"/g, ''));
    if (valores.length >= 2) {
      const registro = parsearRegistroConsumo(valores, formato);
      if (registro) {
        datos.push(registro);
      } else {
        erroresParsingCount++;
        if (erroresParsingCount <= 3) {
          console.warn(`Error parseando línea ${i}:`, valores);
        }
      }
    }
  }
  
  console.log('=== RESULTADO PARSING ===');
  console.log(`✅ ${datos.length} registros válidos`);
  if (erroresParsingCount > 0) console.log(`⚠️ ${erroresParsingCount} líneas con errores`);
  
  return { datos, formato, totalLineas: lineas.length - 1, separador, cabecera };
};

const detectarFormatoCSV = (cabecera, primeraLineaDatos = null) => {
  const formato = { tipo: 'desconocido', colFecha: -1, colHora: -1, colConsumo: -1, nombre: '' };
  
  // Normalizar cabecera para comparación
  const cabNorm = cabecera.map(c => c.toLowerCase().trim());
  
  // =====================================================
  // FORMATO 1: CURVA DE CARGA (Date;Active)
  // Ejemplo: 2024-06-01T00:00:00;0,8653
  // =====================================================
  if (cabNorm.includes('date') && cabNorm.includes('active')) {
    formato.tipo = 'curva_carga';
    formato.nombre = 'Curva de Carga (Date;Active)';
    formato.colFecha = cabNorm.indexOf('date');
    formato.colHora = -1; // La hora está incluida en el timestamp ISO
    formato.colConsumo = cabNorm.indexOf('active');
    formato.tieneHoraEnFecha = true; // Flag para indicar que la hora viene en el campo fecha
    console.log('✅ Formato detectado: Curva de Carga (Date;Active)');
    return formato;
  }
  
  // =====================================================
  // FORMATO 2: DISTRIBUIDORA (CUPS, Fecha, Hora, AE_kWh...)
  // Ejemplo: ES00..., 45292, 0, 16, ...
  // =====================================================
  if (cabNorm.includes('cups') && (cabNorm.includes('ae_kwh') || cabNorm.includes('ae kwh'))) {
    formato.tipo = 'distribuidora';
    formato.nombre = 'Distribuidora (CUPS, Fecha, Hora, AE_kWh)';
    formato.colFecha = cabNorm.findIndex(c => c === 'fecha' || c === 'date');
    formato.colHora = cabNorm.findIndex(c => c === 'hora' || c === 'hour' || c === 'h');
    formato.colConsumo = cabNorm.findIndex(c => c === 'ae_kwh' || c === 'ae kwh');
    formato.fechaEsSerialExcel = true; // Flag para indicar que la fecha es número serial de Excel
    console.log('✅ Formato detectado: Distribuidora (CUPS, Fecha, Hora, AE_kWh)');
    return formato;
  }
  
  // =====================================================
  // FORMATO 3: ESTÁNDAR YLIO (fecha;hora;consumo)
  // =====================================================
  if (cabecera.length === 3 && cabNorm[0] === 'fecha' && cabNorm[1] === 'hora' && (cabNorm[2] === 'consumo' || cabNorm[2] === 'demanda')) {
    formato.tipo = 'estandar';
    formato.nombre = 'Formato YLIO estándar';
    formato.colFecha = 0;
    formato.colHora = 1;
    formato.colConsumo = 2;
    console.log('✅ Formato detectado: Estándar YLIO (fecha;hora;consumo)');
    return formato;
  }
  
  // =====================================================
  // FORMATO 4: SOLO DATE;ACTIVE SIN CABECERA EXACTA
  // Detectar por contenido si parece ISO timestamp
  // =====================================================
  if (primeraLineaDatos) {
    const valores = primeraLineaDatos.split(/[;,\t]/).map(v => v.trim());
    // Si el primer valor parece un timestamp ISO (contiene T)
    if (valores[0] && valores[0].includes('T') && valores[0].match(/^\d{4}-\d{2}-\d{2}T/)) {
      formato.tipo = 'curva_carga_auto';
      formato.nombre = 'Curva de Carga (autodetectado)';
      formato.colFecha = 0;
      formato.colHora = -1;
      formato.colConsumo = 1;
      formato.tieneHoraEnFecha = true;
      console.log('✅ Formato autodetectado: Timestamp ISO en primera columna');
      return formato;
    }
    // Si el primer valor parece CUPS (empieza con ES y tiene 20+ chars)
    if (valores[0] && valores[0].match(/^ES\d{16,}/i)) {
      formato.tipo = 'distribuidora_auto';
      formato.nombre = 'Distribuidora (autodetectado)';
      formato.colFecha = 1;
      formato.colHora = 2;
      formato.colConsumo = 3;
      formato.fechaEsSerialExcel = true;
      console.log('✅ Formato autodetectado: CUPS en primera columna');
      return formato;
    }
  }
  
  // =====================================================
  // DETECCIÓN GENÉRICA (fallback)
  // =====================================================
  console.log('⚠️ Usando detección genérica de columnas...');
  
  // Patrones para detectar columna de fecha
  const patronesFecha = ['fecha', 'date', 'dia', 'day', 'datetime', 'time', 'timestamp'];
  formato.colFecha = cabNorm.findIndex(c => patronesFecha.some(p => c === p || c.includes(p)));
  
  // Patrones para detectar columna de hora
  const patronesHora = ['hora', 'hour', 'periodo', 'intervalo'];
  formato.colHora = cabNorm.findIndex(c => {
    const esHora = patronesHora.some(p => c === p || c === 'h' || c.startsWith(p + '_') || c.endsWith('_' + p));
    const noEsFecha = !c.includes('fecha') && !c.includes('date') && !c.includes('datetime');
    return esHora && noEsFecha;
  });
  
  // Patrones para detectar columna de consumo
  const patronesConsumoAlta = ['ae_kwh', 'ae kwh', 'consumo_kwh', 'energia_kwh', 'demanda', 'active'];
  const patronesConsumoMedia = ['ae', 'consumo', 'kwh', 'energia', 'energy', 'activa', 'valor', 'value'];
  const patronesConsumoExcluir = ['as_kwh', 'as kwh', 'as_', 'reactiva', 'exportada', 'autocons', 'r1_', 'r2_', 'r3_', 'r4_'];
  
  formato.colConsumo = cabNorm.findIndex(c => 
    patronesConsumoAlta.some(p => c.includes(p)) &&
    !patronesConsumoExcluir.some(p => c.includes(p))
  );
  
  if (formato.colConsumo === -1) {
    formato.colConsumo = cabNorm.findIndex(c => 
      patronesConsumoMedia.some(p => c.includes(p)) &&
      !patronesConsumoExcluir.some(p => c.includes(p))
    );
  }
  
  // Valores por defecto
  if (formato.colFecha === -1) formato.colFecha = 0;
  if (formato.colConsumo === -1) formato.colConsumo = cabecera.length >= 3 ? 2 : 1;
  if (formato.colHora === -1 && cabecera.length >= 3) formato.colHora = 1;
  if (formato.colHora === formato.colConsumo || formato.colHora === formato.colFecha) formato.colHora = -1;
  
  formato.tipo = 'generico';
  formato.nombre = 'Formato genérico';
  
  return formato;
};

const parsearFecha = (valor) => {
  if (!valor) return null;
  
  // Si es número, podría ser fecha de Excel
  if (typeof valor === 'number' || (!isNaN(Number(valor)) && Number(valor) > 40000 && Number(valor) < 60000)) {
    const excelDate = Number(valor);
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  valor = String(valor).trim().replace(/"/g, '');
  
  const formatos = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, orden: [3, 2, 1] },          // DD/MM/YYYY
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})/, orden: [1, 2, 3] },              // YYYY-MM-DD
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, orden: [3, 2, 1] },             // DD-MM-YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, orden: [3, 2, 1], siglo: true }, // DD/MM/YY
    { regex: /^(\d{4})(\d{2})(\d{2})$/, orden: [1, 2, 3] },                   // YYYYMMDD
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, orden: [3, 2, 1] },           // DD.MM.YYYY
  ];
  
  for (const fmt of formatos) {
    const match = valor.match(fmt.regex);
    if (match) {
      let year = match[fmt.orden[0]];
      let month = match[fmt.orden[1]];
      let day = match[fmt.orden[2]];
      if (fmt.siglo) year = parseInt(year) > 50 ? '19' + year : '20' + year;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  try {
    const date = new Date(valor);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch (e) {}
  
  return null;
};

const parsearRegistroConsumo = (valores, formato) => {
  try {
    let fecha, hora, consumo;
    
    // Obtener valor de fecha
    let valorFecha = valores[formato.colFecha];
    if (valorFecha === undefined || valorFecha === null || valorFecha === '') return null;
    
    const valorFechaStr = String(valorFecha).trim();
    
    // =====================================================
    // FORMATO CURVA DE CARGA: Timestamp ISO con hora incluida
    // Ejemplo: 2024-06-01T00:00:00
    // =====================================================
    if (formato.tieneHoraEnFecha || valorFechaStr.includes('T')) {
      const partes = valorFechaStr.split('T');
      fecha = parsearFecha(partes[0]);
      const horaStr = partes[1] || '00:00:00';
      hora = parseInt(horaStr.split(':')[0]) || 0;
      
      // Consumo: puede tener coma decimal
      let valorConsumo = valores[formato.colConsumo];
      if (typeof valorConsumo === 'string') {
        // Limpiar: quitar espacios, reemplazar coma por punto, quitar punto y coma final
        valorConsumo = valorConsumo.trim().replace(/;$/, '').replace(',', '.');
      }
      consumo = parseFloat(valorConsumo) || 0;
    }
    // =====================================================
    // FORMATO DISTRIBUIDORA: Fecha serial Excel + hora separada
    // Ejemplo: 45292 (= 01/01/2024), 0, 16
    // =====================================================
    else if (formato.fechaEsSerialExcel) {
      // La fecha es un número serial de Excel
      const serialExcel = parseFloat(valorFechaStr);
      if (!isNaN(serialExcel) && serialExcel > 40000 && serialExcel < 60000) {
        const date = new Date((serialExcel - 25569) * 86400 * 1000);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        fecha = `${year}-${month}-${day}`;
      } else {
        // Intentar parseo normal
        fecha = parsearFecha(valorFechaStr);
      }
      
      // Hora desde columna separada
      if (formato.colHora >= 0 && formato.colHora < valores.length) {
        hora = parseInt(valores[formato.colHora]) || 0;
      } else {
        hora = 0;
      }
      
      // Consumo directo (normalmente ya es número)
      let valorConsumo = valores[formato.colConsumo];
      consumo = parseFloat(String(valorConsumo).replace(',', '.')) || 0;
    }
    // =====================================================
    // FORMATO ESTÁNDAR/GENÉRICO
    // =====================================================
    else {
      fecha = parsearFecha(valorFecha);
      
      // Hora desde columna separada o 0 si no existe
      if (formato.colHora !== formato.colFecha && formato.colHora >= 0 && formato.colHora < valores.length) {
        let valorHora = valores[formato.colHora];
        if (typeof valorHora === 'number') {
          hora = Math.floor(valorHora);
        } else {
          const valorHoraStr = String(valorHora || '').trim();
          if (valorHoraStr && !valorHoraStr.includes(',') && !valorHoraStr.includes('.')) {
            hora = valorHoraStr.includes(':') ? parseInt(valorHoraStr.split(':')[0]) || 0 : parseInt(valorHoraStr) || 0;
          } else {
            hora = 0;
          }
        }
      } else {
        hora = 0;
      }
      
      // Consumo
      let valorConsumo = valores[formato.colConsumo];
      if (typeof valorConsumo === 'number') {
        consumo = valorConsumo;
      } else {
        const valorConsumoStr = String(valorConsumo || '0').trim().replace(',', '.').replace(/[^\d.-]/g, '');
        consumo = parseFloat(valorConsumoStr) || 0;
      }
    }
    
    // Normalizar hora
    if (hora === 24) hora = 0;
    if (hora > 24) hora = hora - 1;
    if (hora < 0) hora = 0;
    
    if (!fecha) return null;
    return { fecha, hora, consumo, lineaOriginal: valores.join(';') };
  } catch (e) {
    console.error('Error parseando registro:', e, valores);
    return null;
  }
};

const validarDatosConsumo = (datos) => {
  const errores = { duplicados: [], huecos: [], negativos: [], outliers: [], filasInvalidas: [] };
  if (!datos || datos.length === 0) return { errores, estadisticas: null, resumenMeses: null, analisis: null };
  
  const mapaRegistros = new Map();
  const consumosPositivos = datos.filter(d => d.consumo > 0).map(d => d.consumo);
  const media = consumosPositivos.length > 0 ? consumosPositivos.reduce((a, b) => a + b, 0) / consumosPositivos.length : 0;
  const desviacion = consumosPositivos.length > 0 ? Math.sqrt(consumosPositivos.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / consumosPositivos.length) : 0;
  const umbralOutlier = media + 4 * desviacion;
  
  // Analizar distribución por año-mes
  const datosPorAnoMes = new Map();
  const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  // Datos para gráficos
  const consumoPorHora = Array(24).fill(0);
  const contadorPorHora = Array(24).fill(0);
  const consumoPorMes = {};
  
  datos.forEach((registro, index) => {
    const clave = `${registro.fecha}-${registro.hora}`;
    const [year, month] = registro.fecha.split('-');
    const anoMes = `${year}-${month}`;
    
    // Agregar para gráficos
    consumoPorHora[registro.hora] += registro.consumo;
    contadorPorHora[registro.hora]++;
    if (!consumoPorMes[anoMes]) consumoPorMes[anoMes] = { total: 0, count: 0 };
    consumoPorMes[anoMes].total += registro.consumo;
    consumoPorMes[anoMes].count++;
    
    // Agrupar por año-mes
    if (!datosPorAnoMes.has(anoMes)) {
      datosPorAnoMes.set(anoMes, { registros: 0, consumoTotal: 0 });
    }
    datosPorAnoMes.get(anoMes).registros++;
    datosPorAnoMes.get(anoMes).consumoTotal += registro.consumo;
    
    // Detectar duplicados
    if (mapaRegistros.has(clave)) {
      errores.duplicados.push({ index, fecha: registro.fecha, hora: registro.hora, valor: registro.consumo, duplicadoDe: mapaRegistros.get(clave) });
    } else {
      mapaRegistros.set(clave, index);
    }
    
    // Detectar negativos
    if (registro.consumo < 0) {
      errores.negativos.push({ index, fecha: registro.fecha, hora: registro.hora, valor: registro.consumo });
    }
    
    // Detectar outliers
    if (umbralOutlier > 0 && registro.consumo > umbralOutlier && registro.consumo > media * 5) {
      errores.outliers.push({ index, fecha: registro.fecha, hora: registro.hora, valor: registro.consumo, umbral: umbralOutlier.toFixed(2) });
    }
  });
  
  // Generar resumen de meses disponibles (para priorización)
  const resumenMeses = [];
  const añosDisponibles = [...new Set([...datosPorAnoMes.keys()].map(k => k.split('-')[0]))].sort().reverse();
  const tieneMultiplesAnos = añosDisponibles.length > 1;
  
  for (let mes = 1; mes <= 12; mes++) {
    const mesStr = String(mes).padStart(2, '0');
    const opcionesMes = [];
    añosDisponibles.forEach(año => {
      const clave = `${año}-${mesStr}`;
      if (datosPorAnoMes.has(clave)) {
        const info = datosPorAnoMes.get(clave);
        opcionesMes.push({ año, clave, registros: info.registros, consumoTotal: info.consumoTotal.toFixed(2) });
      }
    });
    resumenMeses.push({ mes, nombre: mesesNombres[mes - 1], opciones: opcionesMes, seleccionado: opcionesMes.length > 0 ? opcionesMes[0].año : null });
  }
  
  // Detectar huecos
  if (datos.length > 24) {
    const fechasOrdenadas = [...new Set(datos.map(d => d.fecha))].sort();
    if (fechasOrdenadas.length > 1) {
      const fechaInicio = new Date(fechasOrdenadas[0]);
      const fechaFin = new Date(fechasOrdenadas[fechasOrdenadas.length - 1]);
      const diasRango = (fechaFin - fechaInicio) / (1000 * 60 * 60 * 24);
      if (diasRango <= 400) {
        const registrosExistentes = new Set();
        datos.forEach(d => registrosExistentes.add(`${d.fecha}-${d.hora}`));
        const current = new Date(fechaInicio);
        while (current <= fechaFin) {
          const fechaStr = current.toISOString().split('T')[0];
          const tieneAlgunDatoEsteDia = Array.from({ length: 24 }, (_, h) => registrosExistentes.has(`${fechaStr}-${h}`)).some(x => x);
          if (tieneAlgunDatoEsteDia) {
            for (let hora = 0; hora < 24; hora++) {
              const clave = `${fechaStr}-${hora}`;
              if (!registrosExistentes.has(clave) && errores.huecos.length < 500) {
                errores.huecos.push({ fecha: fechaStr, hora, esperado: true });
              }
            }
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }
  }
  
  // Análisis inteligente de errores
  const analisis = {
    duplicadosCambioHorario: [],
    huecosCambioHorario: [],
    otrosDuplicados: [],
    otrosHuecos: [],
    graficoHoras: consumoPorHora.map((total, hora) => ({
      hora: `${String(hora).padStart(2, '0')}:00`,
      horaNum: hora,
      consumoMedio: contadorPorHora[hora] > 0 ? parseFloat((total / contadorPorHora[hora]).toFixed(4)) : 0,
      consumoTotal: parseFloat(total.toFixed(2))
    })),
    graficoMeses: Object.entries(consumoPorMes).sort(([a], [b]) => a.localeCompare(b)).map(([mes, data]) => ({
      mes,
      mesCorto: mesesNombres[parseInt(mes.split('-')[1]) - 1]?.substring(0, 3) + "'" + mes.split('-')[0].substring(2),
      consumoTotal: parseFloat(data.total.toFixed(2)),
      registros: data.count
    }))
  };
  
  // Clasificar duplicados (detectar cambios de horario)
  errores.duplicados.forEach(dup => {
    const fecha = new Date(dup.fecha);
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const diaSemana = fecha.getDay();
    // Último domingo de octubre, hora 2 = cambio verano→invierno
    if (mes === 10 && dia >= 25 && diaSemana === 0 && dup.hora === 2) {
      analisis.duplicadosCambioHorario.push({ ...dup, causa: 'Cambio horario verano → invierno (la hora 2:00 se repite)' });
    } else {
      analisis.otrosDuplicados.push(dup);
    }
  });
  
  // Clasificar huecos (detectar cambios de horario)
  errores.huecos.forEach(hueco => {
    const fecha = new Date(hueco.fecha);
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const diaSemana = fecha.getDay();
    // Último domingo de marzo, hora 2 = cambio invierno→verano
    if (mes === 3 && dia >= 25 && diaSemana === 0 && hueco.hora === 2) {
      analisis.huecosCambioHorario.push({ ...hueco, causa: 'Cambio horario invierno → verano (la hora 2:00 se salta)' });
    } else {
      analisis.otrosHuecos.push(hueco);
    }
  });
  
  const consumoTotal = datos.reduce((sum, d) => sum + Math.max(0, d.consumo), 0);
  const estadisticas = {
    totalRegistros: datos.length,
    registrosValidos: datos.length - errores.duplicados.length,
    consumoTotal: consumoTotal.toFixed(2),
    consumoMedia: media.toFixed(4),
    consumoMax: consumosPositivos.length > 0 ? Math.max(...consumosPositivos).toFixed(4) : '0',
    consumoMin: consumosPositivos.length > 0 ? Math.min(...consumosPositivos).toFixed(4) : '0',
    fechaInicio: datos.length > 0 ? datos[0].fecha : null,
    fechaFin: datos.length > 0 ? datos[datos.length - 1].fecha : null,
    tieneMultiplesAnos,
    añosDisponibles
  };
  return { errores, estadisticas, resumenMeses, analisis };
};

/**
 * Procesa un archivo de producción simulada (PVSyst o PVGIS)
 * Retorna los datos horarios y un resumen por mes
 */
const procesarArchivoProduccion = async (file, multiplicador = 1) => {
  return new Promise(async (resolve, reject) => {
    try {
      const nombre = file.name.toLowerCase();
      let contenido = '';
      
      // Leer archivo
      if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
        // Procesar Excel
        const XLSX = await cargarSheetJS();
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true });
            
            // Procesar filas
            const resultado = procesarFilasProduccion(rows, multiplicador);
            resolve(resultado);
          } catch (err) {
            reject(new Error('Error procesando Excel: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsArrayBuffer(file);
      } else {
        // Procesar CSV
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const texto = e.target.result;
            const lineas = texto.split(/\r?\n/).filter(l => l.trim());
            const rows = lineas.map(l => {
              const sep = l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',';
              return l.split(sep);
            });
            
            const resultado = procesarFilasProduccion(rows, multiplicador);
            resolve(resultado);
          } catch (err) {
            reject(new Error('Error procesando CSV: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        reader.readAsText(file);
      }
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Procesa filas de datos de producción y genera estadísticas
 */
const procesarFilasProduccion = (rows, multiplicador = 1) => {
  const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  // Detectar columnas
  const cabecera = rows[0]?.map(c => String(c).toLowerCase().trim()) || [];
  
  // Detectar columna de fecha
  let colFecha = cabecera.findIndex(c => 
    c === 'fecha' || c === 'date' || c === 'time' || c.includes('datetime') || c.includes('fecha')
  );
  if (colFecha === -1) colFecha = 0;
  
  // Detectar columna de hora
  let colHora = cabecera.findIndex(c => 
    c === 'hora' || c === 'hour' || c === 'h' || c === 'periodo'
  );
  
  // Detectar columna de producción (kWh, P, produccion, energia, etc.)
  const patronesProduccion = ['produccion', 'production', 'kwh', 'energia', 'energy', 'p_', 'e_array', 'e_grid', 'globhor'];
  let colProduccion = cabecera.findIndex(c => 
    patronesProduccion.some(p => c.includes(p))
  );
  if (colProduccion === -1) {
    // Buscar primera columna numérica después de fecha/hora
    colProduccion = cabecera.findIndex((c, idx) => idx > Math.max(colFecha, colHora) && !isNaN(parseFloat(rows[1]?.[idx])));
  }
  if (colProduccion === -1) colProduccion = cabecera.length > 2 ? 2 : 1;
  
  console.log('Procesando producción - Columnas:', { colFecha, colHora, colProduccion, cabecera });
  
  // Función para parsear fecha
  const parsearFecha = (val) => {
    if (!val) return null;
    
    // Fecha Excel (número)
    if (typeof val === 'number' && val > 40000 && val < 60000) {
      const date = new Date((val - 25569) * 86400 * 1000);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const str = String(val).trim();
    
    // ISO: YYYY-MM-DD o YYYYMMDD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    if (/^\d{8}$/.test(str)) return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
    
    // DD/MM/YYYY o DD-MM-YYYY
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
      let [, d, m, y] = match;
      if (y.length === 2) y = (parseInt(y) > 50 ? '19' : '20') + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    return null;
  };
  
  // Procesar datos
  const datosHorarios = [];
  const produccionPorMes = {};
  let totalAnual = 0;
  let registrosValidos = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Obtener fecha
    const fecha = parsearFecha(row[colFecha]);
    if (!fecha) continue;
    
    // Obtener hora
    let hora = 0;
    if (colHora >= 0 && colHora < row.length) {
      const valHora = row[colHora];
      if (typeof valHora === 'number') {
        hora = Math.floor(valHora);
      } else {
        const horaStr = String(valHora).trim();
        hora = parseInt(horaStr.split(':')[0]) || 0;
      }
    }
    if (hora === 24) hora = 0;
    if (hora < 0 || hora > 23) hora = 0;
    
    // Obtener producción y aplicar multiplicador
    let produccion = 0;
    if (colProduccion >= 0 && colProduccion < row.length) {
      const valProd = row[colProduccion];
      if (typeof valProd === 'number') {
        produccion = valProd;
      } else {
        produccion = parseFloat(String(valProd).replace(',', '.')) || 0;
      }
    }
    
    // Aplicar multiplicador (para PVGIS 1kWp)
    const produccionFinal = produccion * multiplicador;
    
    datosHorarios.push({
      fecha,
      hora,
      produccion: produccionFinal,
      produccionOriginal: produccion
    });
    
    // Acumular por mes
    const mes = parseInt(fecha.split('-')[1]);
    if (!produccionPorMes[mes]) {
      produccionPorMes[mes] = { total: 0, registros: 0 };
    }
    produccionPorMes[mes].total += produccionFinal;
    produccionPorMes[mes].registros++;
    
    totalAnual += produccionFinal;
    registrosValidos++;
  }
  
  // Generar resumen por mes
  const resumenMeses = [];
  for (let mes = 1; mes <= 12; mes++) {
    const dataMes = produccionPorMes[mes] || { total: 0, registros: 0 };
    resumenMeses.push({
      mes,
      nombre: mesesNombres[mes - 1],
      nombreCorto: mesesNombres[mes - 1].substring(0, 3),
      produccion: parseFloat(dataMes.total.toFixed(2)),
      registros: dataMes.registros
    });
  }
  
  return {
    datosHorarios,
    resumenMeses,
    totalAnual: parseFloat(totalAnual.toFixed(2)),
    registrosValidos,
    multiplicadorAplicado: multiplicador
  };
};

const limpiarDatosConsumo = (datos, errores, opciones = {}, resumenMeses = null) => {
  const { metodoDuplicados = 'promedio', metodoHuecos = 'interpolar', metodoNegativos = 'cero', metodoOutliers = 'interpolar', construirAnoCompleto = false, seleccionMeses = null, completarA8760 = false } = opciones;
  const log = [];
  let datosCorregidos = datos.map(d => ({ ...d }));
  const mapaRegistros = new Map();
  const indicesEliminar = new Set();
  const duplicadosAgrupados = new Map();
  
  // CASO 1: Construir año completo con selección de meses (múltiples años)
  if (construirAnoCompleto && seleccionMeses && resumenMeses) {
    
    // VALIDACIÓN: Verificar que se seleccionaron los 12 meses
    const mesesSeleccionados = seleccionMeses.filter(s => s !== null && s !== undefined && s !== '');
    const mesesFaltantes = [];
    const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    seleccionMeses.forEach((sel, idx) => {
      if (!sel) mesesFaltantes.push(mesesNombres[idx]);
    });
    
    if (mesesSeleccionados.length < 12) {
      // NO completar a 8760 si faltan meses - solo usar los datos seleccionados
      log.push({
        tipo: 'advertencia',
        fecha: '-',
        hora: '-',
        valorOriginal: `Solo ${mesesSeleccionados.length} meses seleccionados`,
        valorCorregido: `Faltan: ${mesesFaltantes.join(', ')}`,
        metodo: 'sin_completar'
      });
      
      // Solo filtrar los meses seleccionados, sin completar a 8760
      const datosFiltrados = [];
      const resumenFinal = [];
      
      seleccionMeses.forEach((añoSeleccionado, mesIndex) => {
        if (!añoSeleccionado) return;
        
        const mes = mesIndex + 1;
        const mesStr = String(mes).padStart(2, '0');
        const infoMes = resumenMeses.find(r => r.mes === mes);
        
        const datosDelMes = datosCorregidos.filter(d => {
          const [year, month] = d.fecha.split('-');
          return year === añoSeleccionado && month === mesStr;
        });
        
        datosDelMes.forEach(d => {
          const [year, month, day] = d.fecha.split('-');
          if (month === '02' && day === '29') return;
          datosFiltrados.push({
            ...d,
            fechaOriginal: d.fecha,
            añoOriginal: year,
            fecha: `2024-${month}-${day}`
          });
        });
        
        resumenFinal.push({
          mes: infoMes?.nombre || `Mes ${mes}`,
          añoUsado: añoSeleccionado,
          registros: datosDelMes.length,
          consumoTotal: datosDelMes.reduce((s, d) => s + d.consumo, 0).toFixed(2)
        });
      });
      
      // Eliminar duplicados dentro de los meses seleccionados
      const mapaUnico = new Map();
      datosFiltrados.forEach(d => {
        const clave = `${d.fecha}-${d.hora}`;
        if (mapaUnico.has(clave)) {
          const existente = mapaUnico.get(clave);
          existente.consumo = (existente.consumo + d.consumo) / 2;
        } else {
          mapaUnico.set(clave, { ...d });
        }
      });
      
      datosCorregidos = Array.from(mapaUnico.values()).sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora - b.hora;
      });
      
      return { 
        datosCorregidos, 
        log, 
        resumen: { 
          duplicadosCorregidos: datosFiltrados.length - mapaUnico.size, 
          negativosCorregidos: 0, 
          outliersCorregidos: 0, 
          huecosRellenados: 0, 
          totalCambios: log.length,
          advertencia: `Solo ${mesesSeleccionados.length} de 12 meses seleccionados. Selecciona los 12 meses para obtener 8760 horas.`
        } 
      };
    }
    
    // Si llegamos aquí, tenemos los 12 meses seleccionados
    const datosFiltrados = [];
    const resumenFinal = [];
    
    seleccionMeses.forEach((añoSeleccionado, mesIndex) => {
      const mes = mesIndex + 1;
      const mesStr = String(mes).padStart(2, '0');
      const infoMes = resumenMeses.find(r => r.mes === mes);
      
      if (añoSeleccionado) {
        // Filtrar datos de ese mes-año específico
        const datosDelMes = datosCorregidos.filter(d => {
          const [year, month] = d.fecha.split('-');
          return year === añoSeleccionado && month === mesStr;
        });
        
        // Normalizar fechas al año de referencia (2024 para años bisiestos)
        datosDelMes.forEach(d => {
          const [year, month, day] = d.fecha.split('-');
          // Saltar 29 de febrero
          if (month === '02' && day === '29') return;
          datosFiltrados.push({
            ...d,
            fechaOriginal: d.fecha,
            añoOriginal: year,
            fecha: `2024-${month}-${day}` // Normalizar a 2024
          });
        });
        
        resumenFinal.push({
          mes: infoMes?.nombre || `Mes ${mes}`,
          añoUsado: añoSeleccionado,
          registros: datosDelMes.length,
          consumoTotal: datosDelMes.reduce((s, d) => s + d.consumo, 0).toFixed(2)
        });
        
        log.push({
          tipo: 'seleccion_mes',
          fecha: infoMes?.nombre || `Mes ${mes}`,
          hora: '-',
          valorOriginal: `Datos disponibles de varios años`,
          valorCorregido: `Usando datos de ${añoSeleccionado}`,
          metodo: 'priorización'
        });
      }
    });
    
    datosCorregidos = datosFiltrados;
    
    // Guardar resumen en log
    log.unshift({
      tipo: 'resumen_construccion',
      fecha: '-',
      hora: '-',
      valorOriginal: `${datos.length} registros originales`,
      valorCorregido: `${datosCorregidos.length} registros (año completo)`,
      metodo: 'construir_año',
      resumenMeses: resumenFinal
    });
    
    // PASO 1: Eliminar duplicados (promediando valores) - importante para cambios de horario
    const mapaUnico = new Map();
    datosCorregidos.forEach(d => {
      const clave = `${d.fecha}-${d.hora}`;
      if (mapaUnico.has(clave)) {
        // Promediar con el existente
        const existente = mapaUnico.get(clave);
        existente.consumo = (existente.consumo + d.consumo) / 2;
        existente.promediado = true;
      } else {
        mapaUnico.set(clave, { ...d });
      }
    });
    
    // Contar duplicados eliminados
    const duplicadosEliminados = datosCorregidos.length - mapaUnico.size;
    if (duplicadosEliminados > 0) {
      log.push({
        tipo: 'duplicados_horario',
        fecha: '-',
        hora: '-',
        valorOriginal: `${duplicadosEliminados} duplicados`,
        valorCorregido: 'Promediados (cambio horario)',
        metodo: 'promediar'
      });
    }
    
    // Calcular media para rellenar huecos
    const valoresExistentes = Array.from(mapaUnico.values());
    const mediaGeneral = valoresExistentes.length > 0 
      ? valoresExistentes.reduce((s, d) => s + d.consumo, 0) / valoresExistentes.length 
      : 0;
    
    // PASO 2: Construir exactamente 8760 registros (año no bisiesto)
    const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const datosFinales = [];
    let huecosRellenados = 0;
    
    for (let mes = 0; mes < 12; mes++) {
      const mesStr = String(mes + 1).padStart(2, '0');
      const añoOriginal = seleccionMeses[mes] || '2024';
      
      for (let dia = 1; dia <= diasPorMes[mes]; dia++) {
        const diaStr = String(dia).padStart(2, '0');
        const fecha = `2024-${mesStr}-${diaStr}`;
        const fechaOriginal = `${añoOriginal}-${mesStr}-${diaStr}`;
        
        for (let hora = 0; hora < 24; hora++) {
          const clave = `${fecha}-${hora}`;
          
          if (mapaUnico.has(clave)) {
            // Usar dato existente
            datosFinales.push(mapaUnico.get(clave));
          } else {
            // Interpolar valor para hueco
            let valorInterpolado = mediaGeneral;
            const claveAnterior = hora > 0 ? `${fecha}-${hora - 1}` : null;
            const claveSiguiente = hora < 23 ? `${fecha}-${hora + 1}` : null;
            const valAnterior = claveAnterior ? mapaUnico.get(claveAnterior)?.consumo : null;
            const valSiguiente = claveSiguiente ? mapaUnico.get(claveSiguiente)?.consumo : null;
            
            if (valAnterior != null && valSiguiente != null) valorInterpolado = (valAnterior + valSiguiente) / 2;
            else if (valAnterior != null) valorInterpolado = valAnterior;
            else if (valSiguiente != null) valorInterpolado = valSiguiente;
            
            datosFinales.push({
              fecha,
              fechaOriginal,
              añoOriginal,
              hora,
              consumo: valorInterpolado,
              interpolado: true
            });
            huecosRellenados++;
          }
        }
      }
    }
    
    if (huecosRellenados > 0) {
      log.push({
        tipo: 'completar_8760',
        fecha: '-',
        hora: '-',
        valorOriginal: `${mapaUnico.size} horas`,
        valorCorregido: `8760 horas (${huecosRellenados} interpoladas)`,
        metodo: 'interpolar'
      });
    }
    
    datosCorregidos = datosFinales;
    
    // Ya tenemos exactamente 8760 horas, retornar directamente
    return { 
      datosCorregidos, 
      log, 
      resumen: { 
        duplicadosCorregidos: duplicadosEliminados, 
        negativosCorregidos: 0, 
        outliersCorregidos: 0, 
        huecosRellenados, 
        totalCambios: log.length 
      } 
    };
  }
  
  // Eliminar 29 de febrero si aún queda alguno
  const registros29Feb = datosCorregidos.filter(d => {
    const [, month, day] = d.fecha.split('-');
    return month === '02' && day === '29';
  });
  
  if (registros29Feb.length > 0) {
    datosCorregidos = datosCorregidos.filter(d => {
      const [, month, day] = d.fecha.split('-');
      return !(month === '02' && day === '29');
    });
    
    log.push({
      tipo: '29_febrero',
      fecha: '29-Feb',
      hora: '-',
      valorOriginal: `${registros29Feb.length} registros`,
      valorCorregido: 'Eliminados (normalizar a 8760h)',
      metodo: 'eliminar_bisiesto'
    });
  }
  
  // Procesar duplicados
  errores.duplicados.forEach(dup => {
    const clave = `${dup.fecha}-${dup.hora}`;
    if (!duplicadosAgrupados.has(clave)) duplicadosAgrupados.set(clave, [dup.duplicadoDe]);
    duplicadosAgrupados.get(clave).push(dup.index);
  });
  
  duplicadosAgrupados.forEach((indices, clave) => {
    const valores = indices.map(i => datosCorregidos[i]?.consumo || 0).filter(v => v !== undefined);
    if (valores.length === 0) return;
    
    let valorFinal;
    if (metodoDuplicados === 'primero') { valorFinal = valores[0]; indices.slice(1).forEach(i => indicesEliminar.add(i)); }
    else if (metodoDuplicados === 'ultimo') { valorFinal = valores[valores.length - 1]; indices.slice(0, -1).forEach(i => indicesEliminar.add(i)); }
    else if (metodoDuplicados === 'maximo') { valorFinal = Math.max(...valores); indices.slice(1).forEach(i => indicesEliminar.add(i)); }
    else if (metodoDuplicados === 'minimo') { valorFinal = Math.min(...valores); indices.slice(1).forEach(i => indicesEliminar.add(i)); }
    else { valorFinal = valores.reduce((a, b) => a + b, 0) / valores.length; indices.slice(1).forEach(i => indicesEliminar.add(i)); if (datosCorregidos[indices[0]]) datosCorregidos[indices[0]].consumo = valorFinal; }
    
    const partes = clave.split('-');
    log.push({ tipo: 'duplicado', fecha: partes.slice(0, 3).join('-'), hora: parseInt(partes[3]) || 0, valorOriginal: valores.join(', '), valorCorregido: valorFinal.toFixed(4), metodo: metodoDuplicados });
  });
  
  // Corregir negativos
  errores.negativos.forEach(neg => {
    if (datosCorregidos[neg.index]) {
      const valorOriginal = datosCorregidos[neg.index].consumo;
      let valorCorregido;
      if (metodoNegativos === 'absoluto') valorCorregido = Math.abs(valorOriginal);
      else if (metodoNegativos === 'interpolar') {
        const anterior = datosCorregidos[neg.index - 1]?.consumo || 0;
        const siguiente = datosCorregidos[neg.index + 1]?.consumo || 0;
        valorCorregido = (anterior + siguiente) / 2;
      }
      else valorCorregido = 0;
      datosCorregidos[neg.index].consumo = valorCorregido;
      log.push({ tipo: 'negativo', fecha: neg.fecha, hora: neg.hora, valorOriginal: valorOriginal.toFixed(4), valorCorregido: valorCorregido.toFixed(4), metodo: metodoNegativos });
    }
  });
  
  // Corregir outliers
  if (metodoOutliers !== 'mantener') {
    const consumosValidos = datosCorregidos.filter((d, i) => !errores.outliers.some(o => o.index === i) && d.consumo > 0).map(d => d.consumo);
    const mediaValidos = consumosValidos.length > 0 ? consumosValidos.reduce((a, b) => a + b, 0) / consumosValidos.length : 0;
    errores.outliers.forEach(out => {
      if (datosCorregidos[out.index]) {
        const valorOriginal = datosCorregidos[out.index].consumo;
        let valorCorregido;
        if (metodoOutliers === 'media') valorCorregido = mediaValidos;
        else if (metodoOutliers === 'mediana') {
          const sorted = [...consumosValidos].sort((a, b) => a - b);
          valorCorregido = sorted[Math.floor(sorted.length / 2)];
        }
        else { const anterior = datosCorregidos[out.index - 1]?.consumo || mediaValidos; const siguiente = datosCorregidos[out.index + 1]?.consumo || mediaValidos; valorCorregido = (anterior + siguiente) / 2; }
        datosCorregidos[out.index].consumo = valorCorregido;
        log.push({ tipo: 'outlier', fecha: out.fecha, hora: out.hora, valorOriginal: valorOriginal.toFixed(4), valorCorregido: valorCorregido.toFixed(4), metodo: metodoOutliers });
      }
    });
  }
  
  // Eliminar duplicados marcados
  const datosFiltrados = datosCorregidos.filter((_, i) => !indicesEliminar.has(i));
  
  // Rellenar huecos
  if (metodoHuecos !== 'ignorar' && errores.huecos.length > 0 && errores.huecos.length < 200) {
    datosFiltrados.forEach(d => mapaRegistros.set(`${d.fecha}-${d.hora}`, d.consumo));
    const mediaGeneral = datosFiltrados.reduce((s, d) => s + d.consumo, 0) / datosFiltrados.length;
    errores.huecos.forEach(hueco => {
      let valorCorregido = 0;
      if (metodoHuecos === 'interpolar') {
        const claveAnterior = hueco.hora > 0 ? `${hueco.fecha}-${hueco.hora - 1}` : null;
        const claveSiguiente = hueco.hora < 23 ? `${hueco.fecha}-${hueco.hora + 1}` : null;
        const valAnterior = claveAnterior ? mapaRegistros.get(claveAnterior) : null;
        const valSiguiente = claveSiguiente ? mapaRegistros.get(claveSiguiente) : null;
        if (valAnterior != null && valSiguiente != null) valorCorregido = (valAnterior + valSiguiente) / 2;
        else if (valAnterior != null) valorCorregido = valAnterior;
        else if (valSiguiente != null) valorCorregido = valSiguiente;
        else valorCorregido = mediaGeneral;
      } else if (metodoHuecos === 'anterior') {
        const claveAnt = hueco.hora > 0 ? `${hueco.fecha}-${hueco.hora - 1}` : null;
        valorCorregido = claveAnt ? (mapaRegistros.get(claveAnt) || mediaGeneral) : mediaGeneral;
      } else if (metodoHuecos === 'media') {
        valorCorregido = mediaGeneral;
      } else if (metodoHuecos === 'cero') {
        valorCorregido = 0;
      }
      datosFiltrados.push({ fecha: hueco.fecha, hora: hueco.hora, consumo: valorCorregido, interpolado: true });
      log.push({ tipo: 'hueco', fecha: hueco.fecha, hora: hueco.hora, valorOriginal: 'N/A', valorCorregido: valorCorregido.toFixed(4), metodo: metodoHuecos });
    });
    datosFiltrados.sort((a, b) => { if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha); return a.hora - b.hora; });
  }
  
  return { datosCorregidos: datosFiltrados, log, resumen: { duplicadosCorregidos: errores.duplicados.length, negativosCorregidos: errores.negativos.length, outliersCorregidos: metodoOutliers !== 'mantener' ? errores.outliers.length : 0, huecosRellenados: metodoHuecos !== 'ignorar' && errores.huecos.length < 200 ? errores.huecos.length : 0, totalCambios: log.length } };
};


// ============================================
// COMPONENTE LOGO YLIO
// ============================================
const YlioLogo = ({ width = 280, variant = 'default' }) => {
  // variant: 'default' (fondo claro), 'negative' (fondo naranja)
  const textColor = variant === 'negative' ? '#FFFFFF' : '#3B3B3B';
  const circleColor = variant === 'negative' ? '#FFFFFF' : '#EB6221';
  
  return (
    <svg width={width} viewBox="0 0 420 60" style={{ display: 'block' }}>
      {/* Y */}
      <path d="M8 8 L23 32 L23 52 M38 8 L23 32" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* L */}
      <path d="M55 8 L55 52 L80 52" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {/* I */}
      <path d="M100 8 L100 52" stroke={textColor} strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* O (círculo naranja) */}
      <circle cx="145" cy="30" r="22" fill={circleColor}/>
      {/* SUSTAINABLE ENGINEERING */}
      <text x="185" y="24" fontFamily="Arial, sans-serif" fontSize="12" fill={textColor} letterSpacing="3" fontWeight="400">SUSTAINABLE</text>
      <text x="185" y="44" fontFamily="Arial, sans-serif" fontSize="12" fill={textColor} letterSpacing="3" fontWeight="400">ENGINEERING</text>
    </svg>
  );
};

// ============================================
// PASOS DEL WIZARD
// ============================================
const PASOS_OPORTUNIDAD = [
  { id: 1, nombre: 'Proyecto', icono: '📋', descripcion: 'Datos del cliente y ubicación' },
  { id: 2, nombre: 'Tarifa', icono: '💰', descripcion: 'Tarifa eléctrica y precios' },
  { id: 3, nombre: 'Situación Actual', icono: '🏭', descripcion: 'Instalaciones existentes' },
  { id: 4, nombre: 'Propuesta', icono: '☀️', descripcion: 'Características de la instalación' },
  { id: 5, nombre: 'Dimensionamiento', icono: '⚡', descripcion: 'Análisis de escenarios' },
  { id: 6, nombre: 'Selección', icono: '✅', descripcion: 'Confirmar y guardar' },
];

// ============================================
// ESTADOS DEL FUNNEL DE OFERTAS
// ============================================
const ESTADOS_OFERTA = [
  { id: 'oferta', nombre: 'Oferta', icono: '📋', color: '#F59E0B', descripcion: 'Fase de oferta comercial' },
  { id: 'contrato', nombre: 'Contrato', icono: '📝', color: '#14B8A6', descripcion: 'Fase de contratación' },
  { id: 'ingenieria', nombre: 'Ingeniería', icono: '🔧', color: '#F97316', descripcion: 'Fase de ingeniería' },
  { id: 'tramitacion', nombre: 'Tramitación', icono: '📑', color: '#8B5CF6', descripcion: 'Fase de tramitación administrativa' },
  { id: 'mantenimiento', nombre: 'Mantenimiento', icono: '🛠️', color: '#10B981', descripcion: 'Fase de mantenimiento' },
];

// ============================================
// COMPONENTE VALIDADOR DE CONSUMOS (MODAL)
// ============================================
const ValidadorConsumos = ({ archivo, datosOriginales, errores, estadisticas, resumenMeses, analisis, formatoDetectado, onAceptar, onCancelar, onCorregir }) => {
  // Debug
  console.log('ValidadorConsumos - resumenMeses:', resumenMeses?.length, 'meses');
  console.log('ValidadorConsumos - estadisticas:', estadisticas);
  console.log('ValidadorConsumos - formatoDetectado:', formatoDetectado);
  
  const [opcionesCorreccion, setOpcionesCorreccion] = useState({ 
    metodoDuplicados: 'promedio', 
    metodoHuecos: 'interpolar', 
    metodoNegativos: 'cero', 
    metodoOutliers: 'interpolar',
    construirAnoCompleto: estadisticas?.tieneMultiplesAnos || false,
    completarA8760: true // Siempre intentar completar a 8760 horas
  });
  const [seleccionMeses, setSeleccionMeses] = useState(
    resumenMeses ? resumenMeses.map(m => m.seleccionado) : Array(12).fill(null)
  );
  const [mostrarDetalle, setMostrarDetalle] = useState(null);
  const [datosCorregidos, setDatosCorregidos] = useState(null);
  const [logCambios, setLogCambios] = useState([]);
  const [resumenTratamiento, setResumenTratamiento] = useState(null);
  const [vistaGrafico, setVistaGrafico] = useState('horas'); // 'horas' o 'meses'

  const totalErrores = errores.duplicados.length + errores.huecos.length + errores.negativos.length + errores.outliers.length;
  const tieneMultiplesAnos = estadisticas?.tieneMultiplesAnos || false;
  
  // Verificar si todos los meses tienen datos
  const mesesConDatos = resumenMeses ? resumenMeses.filter(m => m.opciones && m.opciones.length > 0).length : 0;
  const tieneAnoCompleto = mesesConDatos === 12;
  
  console.log('ValidadorConsumos - mesesConDatos:', mesesConDatos, 'tieneAnoCompleto:', tieneAnoCompleto);

  // Iconos y colores por tipo de formato
  const getFormatoInfo = (formato) => {
    if (!formato) return { icon: '📄', color: '#666', nombre: 'Desconocido' };
    switch (formato.tipo) {
      case 'curva_carga':
      case 'curva_carga_auto':
        return { icon: '📈', color: '#1565C0', nombre: formato.nombre || 'Curva de Carga' };
      case 'distribuidora':
      case 'distribuidora_auto':
        return { icon: '🏭', color: '#2E7D32', nombre: formato.nombre || 'Distribuidora' };
      case 'estandar':
        return { icon: '✅', color: '#E85A2C', nombre: 'Formato YLIO estándar' };
      default:
        return { icon: '📄', color: '#666', nombre: formato.nombre || 'Formato genérico' };
    }
  };

  const formatoInfo = getFormatoInfo(formatoDetectado);

  const handleCorregir = () => {
    const resultado = onCorregir({ 
      ...opcionesCorreccion, 
      seleccionMeses: (opcionesCorreccion.construirAnoCompleto || tieneAnoCompleto) ? seleccionMeses : null,
      completarA8760: tieneAnoCompleto // Completar si tiene los 12 meses
    });
    setDatosCorregidos(resultado.datosCorregidos);
    setLogCambios(resultado.log);
    // Extraer resumen de tratamiento del log
    const resumen = resultado.log.find(l => l.tipo === 'resumen_construccion');
    if (resumen) setResumenTratamiento(resumen.resumenMeses);
  };

  const handleCambiarMes = (mesIndex, año) => {
    const nuevaSeleccion = [...seleccionMeses];
    nuevaSeleccion[mesIndex] = año;
    setSeleccionMeses(nuevaSeleccion);
  };

  const Badge = ({ tipo, cantidad }) => {
    const colores = { duplicados: { bg: '#FFF3CD', text: '#856404', icon: '🔄' }, huecos: { bg: '#D1ECF1', text: '#0C5460', icon: '⏳' }, negativos: { bg: '#F8D7DA', text: '#721C24', icon: '➖' }, outliers: { bg: '#FFE0B2', text: '#E65100', icon: '📈' } };
    const estilo = colores[tipo] || { bg: '#E5E5E5', text: '#333', icon: '•' };
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: estilo.bg, color: estilo.text, borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}><span>{estilo.icon}</span><span>{cantidad}</span></span>;
  };

  const SelectOpcion = ({ label, campo, opciones, descripcion }) => (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '4px' }}>{label}</label>
      <select value={opcionesCorreccion[campo]} onChange={(e) => setOpcionesCorreccion({ ...opcionesCorreccion, [campo]: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px', backgroundColor: 'white' }}>
        {opciones.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {descripcion && <span style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '2px', display: 'block' }}>{descripcion}</span>}
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '95%', maxWidth: '1100px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: COLOR_TEXT, fontSize: '20px' }}>📊 Validación y Transformación de Datos</h2>
            <p style={{ margin: '4px 0 0 0', color: COLOR_TEXT_LIGHT, fontSize: '13px' }}>
              {archivo}
              {formatoDetectado && (
                <span style={{ 
                  marginLeft: '12px', 
                  padding: '3px 10px', 
                  backgroundColor: formatoInfo.color + '15', 
                  color: formatoInfo.color, 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  fontWeight: '600' 
                }}>
                  {formatoInfo.icon} {formatoInfo.nombre}
                </span>
              )}
              {tieneMultiplesAnos && <span style={{ marginLeft: '8px', color: COLOR_CORP, fontWeight: '600' }}>• Múltiples años detectados</span>}
            </p>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: COLOR_TEXT_LIGHT }}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: COLOR_CORP }}>{estadisticas?.totalRegistros?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Registros leídos</div>
            </div>
            <div style={{ backgroundColor: tieneMultiplesAnos ? '#E3F2FD' : (totalErrores > 0 ? '#FFF3CD' : '#D4EDDA'), borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: tieneMultiplesAnos ? '#1565C0' : (totalErrores > 0 ? '#856404' : COLOR_SUCCESS) }}>{tieneMultiplesAnos ? estadisticas.añosDisponibles?.length : totalErrores}</div>
              <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>{tieneMultiplesAnos ? 'Años disponibles' : 'Errores detectados'}</div>
            </div>
            <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: COLOR_TEXT }}>{parseFloat(estadisticas?.consumoTotal || 0).toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>kWh Total</div>
            </div>
            <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: COLOR_TEXT }}>{parseFloat(estadisticas?.consumoMedia || 0).toFixed(2)}</div>
              <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>kWh Media/hora</div>
            </div>
          </div>

          {/* Selector de meses (cuando hay múltiples años) */}
          {/* Sección de selección de meses - siempre visible */}
          {resumenMeses && resumenMeses.length > 0 && (
            <div style={{ backgroundColor: tieneMultiplesAnos ? '#E3F2FD' : '#F5F5F5', border: `1px solid ${tieneMultiplesAnos ? '#90CAF9' : '#E0E0E0'}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: tieneMultiplesAnos ? '#1565C0' : COLOR_TEXT }}>📅 {tieneMultiplesAnos ? 'Selección de Datos por Mes' : 'Resumen de Datos por Mes'}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: tieneMultiplesAnos ? '#1976D2' : COLOR_TEXT_LIGHT }}>
                    {tieneMultiplesAnos 
                      ? `Años disponibles: ${estadisticas.añosDisponibles?.join(', ')}`
                      : `Año: ${estadisticas.añosDisponibles?.[0] || 'N/A'}`
                    }
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Contador de registros seleccionados */}
                  <div style={{ backgroundColor: 'white', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${tieneMultiplesAnos ? '#90CAF9' : '#E0E0E0'}` }}>
                    <span style={{ fontSize: '12px', color: tieneMultiplesAnos ? '#1565C0' : COLOR_TEXT_LIGHT }}>Registros: </span>
                    <strong style={{ color: COLOR_CORP, fontSize: '14px' }}>
                      {(() => {
                        if (!opcionesCorreccion.construirAnoCompleto && !tieneMultiplesAnos) return estadisticas?.totalRegistros?.toLocaleString() || 0;
                        let total = 0;
                        seleccionMeses.forEach((año, idx) => {
                          if (año && resumenMeses[idx]) {
                            const opcion = resumenMeses[idx].opciones.find(o => o.año === año);
                            if (opcion) total += opcion.registros;
                          }
                        });
                        return total.toLocaleString();
                      })()}
                    </strong>
                  </div>
                  {tieneMultiplesAnos && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COLOR_TEXT, backgroundColor: 'white', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={opcionesCorreccion.construirAnoCompleto} onChange={(e) => setOpcionesCorreccion({ ...opcionesCorreccion, construirAnoCompleto: e.target.checked })} />
                      Construir año completo
                    </label>
                  )}
                </div>
              </div>
              
              {tieneMultiplesAnos && (
                <p style={{ fontSize: '12px', color: '#1565C0', marginBottom: '12px' }}>Selecciona qué año usar para cada mes. Haz clic en una celda para seleccionar ese año para ese mes.</p>
              )}
              
              {/* TABLA MES/AÑO */}
              {(() => {
                const añosDisponibles = estadisticas.añosDisponibles || [];
                const mesesNombresCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                
                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#E3F2FD' }}>
                          <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '600', color: '#1565C0', borderBottom: '2px solid #90CAF9' }}>Año / Mes</th>
                          {mesesNombresCortos.map((mes, i) => (
                            <th key={i} style={{ padding: '10px 6px', textAlign: 'center', fontWeight: '600', color: '#1565C0', borderBottom: '2px solid #90CAF9', minWidth: '55px' }}>{mes}</th>
                          ))}
                          <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600', color: '#1565C0', borderBottom: '2px solid #90CAF9' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {añosDisponibles.map((año, añoIdx) => {
                          let totalAño = 0;
                          return (
                            <tr key={año} style={{ borderBottom: '1px solid #E0E0E0' }}>
                              <td style={{ padding: '8px', fontWeight: '600', color: COLOR_TEXT, backgroundColor: '#FAFAFA' }}>{año}</td>
                              {resumenMeses.map((mes, mesIdx) => {
                                const opcion = mes.opciones.find(o => o.año === año);
                                const estaSeleccionado = seleccionMeses[mesIdx] === año;
                                const tieneDatos = !!opcion;
                                if (opcion) totalAño += opcion.consumoTotal;
                                
                                return (
                                  <td 
                                    key={mesIdx} 
                                    onClick={() => {
                                      if (tieneDatos && (opcionesCorreccion.construirAnoCompleto || tieneMultiplesAnos)) {
                                        handleCambiarMes(mesIdx, año);
                                      }
                                    }}
                                    style={{ 
                                      padding: '6px 4px', 
                                      textAlign: 'center',
                                      backgroundColor: estaSeleccionado ? '#C8E6C9' : (tieneDatos ? '#F5F5F5' : '#FFEBEE'),
                                      border: estaSeleccionado ? '2px solid #4CAF50' : '1px solid #E0E0E0',
                                      cursor: tieneDatos && (opcionesCorreccion.construirAnoCompleto || tieneMultiplesAnos) ? 'pointer' : 'default',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {tieneDatos ? (
                                      <div>
                                        <div style={{ fontWeight: estaSeleccionado ? '700' : '500', color: estaSeleccionado ? '#2E7D32' : COLOR_TEXT }}>
                                          {opcion.registros}h
                                        </div>
                                        <div style={{ fontSize: '9px', color: estaSeleccionado ? '#388E3C' : COLOR_TEXT_LIGHT }}>
                                          {(opcion.consumoTotal / 1000).toFixed(1)}k
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#BDBDBD', fontSize: '10px' }}>-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', backgroundColor: '#FAFAFA', color: COLOR_TEXT }}>
                                {totalAño > 0 ? `${(totalAño / 1000).toFixed(0)}k` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Fila de selección actual */}
                        <tr style={{ backgroundColor: '#E8F5E9', borderTop: '2px solid #4CAF50' }}>
                          <td style={{ padding: '8px', fontWeight: '700', color: '#2E7D32' }}>✓ Selección</td>
                          {resumenMeses.map((mes, mesIdx) => {
                            const añoSel = seleccionMeses[mesIdx];
                            const opcion = mes.opciones.find(o => o.año === añoSel);
                            return (
                              <td key={mesIdx} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '600', color: '#2E7D32' }}>
                                {añoSel || '-'}
                              </td>
                            );
                          })}
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: '700', color: '#2E7D32' }}>
                            {(() => {
                              let total = 0;
                              seleccionMeses.forEach((año, idx) => {
                                if (año && resumenMeses[idx]) {
                                  const opcion = resumenMeses[idx].opciones.find(o => o.año === año);
                                  if (opcion) total += opcion.consumoTotal;
                                }
                              });
                              return total > 0 ? `${(total / 1000).toFixed(0)}k` : '-';
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              
              {/* Leyenda */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '10px', color: COLOR_TEXT_LIGHT }}>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#C8E6C9', border: '2px solid #4CAF50', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span> Seleccionado</span>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#F5F5F5', border: '1px solid #E0E0E0', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span> Disponible</span>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span> Sin datos</span>
              </div>
            </div>
          )}

          {/* Errores detectados */}
          {totalErrores > 0 && (
            <div style={{ backgroundColor: '#FFFBF0', border: '1px solid #FFE0B2', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: COLOR_TEXT }}>⚠️ Errores Detectados</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', cursor: errores.duplicados.length > 0 ? 'pointer' : 'default', border: mostrarDetalle === 'duplicados' ? `2px solid ${COLOR_CORP}` : '1px solid #E5E5E5' }} onClick={() => errores.duplicados.length > 0 && setMostrarDetalle(mostrarDetalle === 'duplicados' ? null : 'duplicados')}>
                  <span style={{ fontSize: '12px', color: COLOR_TEXT }}>🔄 Duplicados</span>
                  <Badge tipo="duplicados" cantidad={errores.duplicados.length} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', cursor: errores.huecos.length > 0 ? 'pointer' : 'default', border: mostrarDetalle === 'huecos' ? `2px solid ${COLOR_CORP}` : '1px solid #E5E5E5' }} onClick={() => errores.huecos.length > 0 && setMostrarDetalle(mostrarDetalle === 'huecos' ? null : 'huecos')}>
                  <span style={{ fontSize: '12px', color: COLOR_TEXT }}>⏳ Huecos</span>
                  <Badge tipo="huecos" cantidad={errores.huecos.length} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', cursor: errores.negativos.length > 0 ? 'pointer' : 'default', border: mostrarDetalle === 'negativos' ? `2px solid ${COLOR_CORP}` : '1px solid #E5E5E5' }} onClick={() => errores.negativos.length > 0 && setMostrarDetalle(mostrarDetalle === 'negativos' ? null : 'negativos')}>
                  <span style={{ fontSize: '12px', color: COLOR_TEXT }}>➖ Negativos</span>
                  <Badge tipo="negativos" cantidad={errores.negativos.length} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px', cursor: errores.outliers.length > 0 ? 'pointer' : 'default', border: mostrarDetalle === 'outliers' ? `2px solid ${COLOR_CORP}` : '1px solid #E5E5E5' }} onClick={() => errores.outliers.length > 0 && setMostrarDetalle(mostrarDetalle === 'outliers' ? null : 'outliers')}>
                  <span style={{ fontSize: '12px', color: COLOR_TEXT }}>📈 Anómalos</span>
                  <Badge tipo="outliers" cantidad={errores.outliers.length} />
                </div>
              </div>
              {mostrarDetalle && errores[mostrarDetalle]?.length > 0 && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'white', borderRadius: '8px', maxHeight: '150px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead><tr style={{ backgroundColor: COLOR_BG_SECONDARY }}><th style={{ padding: '6px', textAlign: 'left' }}>Fecha</th><th style={{ padding: '6px', textAlign: 'left' }}>Hora</th><th style={{ padding: '6px', textAlign: 'right' }}>Valor</th></tr></thead>
                    <tbody>{errores[mostrarDetalle].slice(0, 15).map((err, i) => <tr key={i} style={{ borderBottom: '1px solid #E5E5E5' }}><td style={{ padding: '6px' }}>{err.fecha}</td><td style={{ padding: '6px' }}>{err.hora}:00</td><td style={{ padding: '6px', textAlign: 'right' }}>{err.valor !== undefined ? `${err.valor.toFixed?.(4) || err.valor} kWh` : '-'}</td></tr>)}</tbody>
                  </table>
                  {errores[mostrarDetalle].length > 15 && <p style={{ textAlign: 'center', color: COLOR_TEXT_LIGHT, margin: '6px 0 0 0', fontSize: '10px' }}>... y {errores[mostrarDetalle].length - 15} más</p>}
                </div>
              )}
              
              {/* Análisis Inteligente */}
              {analisis && (analisis.duplicadosCambioHorario.length > 0 || analisis.huecosCambioHorario.length > 0) && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#E3F2FD', borderRadius: '8px', border: '1px solid #90CAF9' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1565C0' }}>🔍 Análisis Inteligente</h4>
                  <div style={{ fontSize: '12px', color: '#1565C0' }}>
                    {analisis.duplicadosCambioHorario.map((d, i) => (
                      <div key={`dup-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', padding: '8px', backgroundColor: 'white', borderRadius: '6px' }}>
                        <span style={{ fontSize: '16px' }}>🔄</span>
                        <div>
                          <strong>{d.fecha} {d.hora}:00</strong> - Duplicado detectado
                          <div style={{ fontSize: '11px', color: '#1976D2' }}>{d.causa}</div>
                        </div>
                      </div>
                    ))}
                    {analisis.huecosCambioHorario.map((h, i) => (
                      <div key={`hueco-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', padding: '8px', backgroundColor: 'white', borderRadius: '6px' }}>
                        <span style={{ fontSize: '16px' }}>⏳</span>
                        <div>
                          <strong>{h.fecha} {h.hora}:00</strong> - Hueco detectado
                          <div style={{ fontSize: '11px', color: '#1976D2' }}>{h.causa}</div>
                        </div>
                      </div>
                    ))}
                    {analisis.otrosDuplicados.length === 0 && analisis.otrosHuecos.length === 0 && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '8px', borderRadius: '4px' }}>
                        ✅ Todos los errores detectados corresponden a cambios de horario (verano/invierno). Los datos son correctos.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Opciones de corrección */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: COLOR_TEXT }}>🔧 Transformaciones</h3>
              {errores.duplicados.length > 0 && <SelectOpcion label="Duplicados" campo="metodoDuplicados" opciones={[{ value: 'promedio', label: 'Promediar' }, { value: 'maximo', label: 'Máximo' }, { value: 'minimo', label: 'Mínimo' }, { value: 'primero', label: 'Primero' }, { value: 'ultimo', label: 'Último' }]} />}
              {errores.negativos.length > 0 && <SelectOpcion label="Negativos" campo="metodoNegativos" opciones={[{ value: 'cero', label: 'Convertir a 0' }, { value: 'absoluto', label: 'Valor absoluto' }, { value: 'interpolar', label: 'Interpolar' }]} />}
              {errores.outliers.length > 0 && <SelectOpcion label="Valores anómalos" campo="metodoOutliers" opciones={[{ value: 'interpolar', label: 'Interpolar' }, { value: 'media', label: 'Usar media' }, { value: 'mediana', label: 'Usar mediana' }, { value: 'mantener', label: 'Mantener' }]} />}
              {errores.huecos.length > 0 && <SelectOpcion label="Huecos (horas faltantes)" campo="metodoHuecos" opciones={[{ value: 'interpolar', label: 'Interpolar' }, { value: 'anterior', label: 'Hora anterior' }, { value: 'media', label: 'Media general' }, { value: 'cero', label: 'Poner a cero' }, { value: 'ignorar', label: 'Ignorar' }]} />}
              <button onClick={handleCorregir} style={{ width: '100%', padding: '10px', backgroundColor: COLOR_CORP, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' }}>🔄 Aplicar Transformaciones</button>
            </div>
            
            {/* Log de cambios */}
            <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: COLOR_TEXT }}>📋 Log de Transformaciones {logCambios.length > 0 && `(${logCambios.length})`}</h3>
              {logCambios.length === 0 ? <p style={{ color: COLOR_TEXT_LIGHT, fontSize: '12px', textAlign: 'center', padding: '20px' }}>Aplica las transformaciones para ver los cambios</p> : (
                <div>
                  {/* Resumen de transformaciones por tipo */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {(() => {
                      const conteo = {};
                      logCambios.forEach(c => {
                        const tipo = c.metodo || c.tipo;
                        if (!conteo[tipo]) conteo[tipo] = 0;
                        conteo[tipo]++;
                      });
                      const tipoLabels = {
                        'duplicado': '🔄 Duplicados',
                        'promedio': '🔄 Promediados',
                        'primero': '🔄 Primer valor',
                        'hueco': '🕳️ Huecos',
                        'interpolar': '📈 Interpolados',
                        'anterior': '⬅️ Valor anterior',
                        'media': '📊 Media general',
                        'cero': '0️⃣ Puestos a cero',
                        'negativo': '➖ Negativos',
                        'outlier': '📍 Outliers',
                        'construccion': '🏗️ Construcción año'
                      };
                      return Object.entries(conteo).map(([tipo, cantidad]) => (
                        <div key={tipo} style={{ padding: '6px 10px', backgroundColor: 'white', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: COLOR_TEXT_LIGHT }}>{tipoLabels[tipo] || tipo}</span>
                          <strong style={{ color: COLOR_CORP }}>{cantidad}</strong>
                        </div>
                      ));
                    })()}
                  </div>
                  
                  {/* Detalle de cambios */}
                  <div style={{ maxHeight: '150px', overflow: 'auto', backgroundColor: 'white', borderRadius: '6px', padding: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
                          <th style={{ padding: '4px', textAlign: 'left', color: COLOR_TEXT_LIGHT }}>Tipo</th>
                          <th style={{ padding: '4px', textAlign: 'left', color: COLOR_TEXT_LIGHT }}>Fecha/Hora</th>
                          <th style={{ padding: '4px', textAlign: 'right', color: COLOR_TEXT_LIGHT }}>Original</th>
                          <th style={{ padding: '4px', textAlign: 'center', color: COLOR_TEXT_LIGHT }}></th>
                          <th style={{ padding: '4px', textAlign: 'right', color: COLOR_TEXT_LIGHT }}>Corregido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logCambios.filter(c => c.tipo !== 'resumen_construccion').slice(0, 20).map((cambio, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F5F5F5' }}>
                            <td style={{ padding: '4px' }}>
                              <span style={{ padding: '2px 5px', backgroundColor: '#E5E5E5', borderRadius: '3px', fontSize: '9px' }}>{cambio.metodo || cambio.tipo}</span>
                            </td>
                            <td style={{ padding: '4px', color: COLOR_TEXT }}>{cambio.fecha} {cambio.hora !== '-' && `${cambio.hora}:00`}</td>
                            <td style={{ padding: '4px', textAlign: 'right', color: COLOR_DANGER }}>{cambio.valorOriginal}</td>
                            <td style={{ padding: '4px', textAlign: 'center', color: COLOR_TEXT_LIGHT }}>→</td>
                            <td style={{ padding: '4px', textAlign: 'right', color: COLOR_SUCCESS, fontWeight: '600' }}>{cambio.valorCorregido}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {logCambios.length > 20 && <p style={{ textAlign: 'center', color: COLOR_TEXT_LIGHT, margin: '8px 0 0 0', fontSize: '10px' }}>... y {logCambios.length - 20} transformaciones más</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen del tratamiento */}
            <div style={{ backgroundColor: resumenTratamiento ? '#E8F5E9' : COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', border: resumenTratamiento ? '1px solid #A5D6A7' : 'none' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', color: resumenTratamiento ? COLOR_SUCCESS : COLOR_TEXT }}>📊 Resumen del Tratamiento</h3>
              {!resumenTratamiento ? (
                <p style={{ color: COLOR_TEXT_LIGHT, fontSize: '12px', textAlign: 'center', padding: '20px' }}>El resumen aparecerá aquí después de aplicar</p>
              ) : (
                <div style={{ maxHeight: '180px', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead><tr style={{ backgroundColor: '#C8E6C9' }}><th style={{ padding: '6px', textAlign: 'left' }}>Mes</th><th style={{ padding: '6px', textAlign: 'center' }}>Año</th><th style={{ padding: '6px', textAlign: 'right' }}>Horas</th><th style={{ padding: '6px', textAlign: 'right' }}>kWh</th></tr></thead>
                    <tbody>{resumenTratamiento.map((r, i) => <tr key={i} style={{ borderBottom: '1px solid #A5D6A7' }}><td style={{ padding: '6px' }}>{r.mes}</td><td style={{ padding: '6px', textAlign: 'center', fontWeight: '600', color: COLOR_CORP }}>{r.añoUsado}</td><td style={{ padding: '6px', textAlign: 'right' }}>{r.registros}</td><td style={{ padding: '6px', textAlign: 'right' }}>{parseFloat(r.consumoTotal).toLocaleString()}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Datos finales y gráficos */}
          {datosCorregidos && (() => {
            // Ordenar datos por fecha ORIGINAL y hora (para orden cronológico real)
            const datosOrdenados = [...datosCorregidos].sort((a, b) => {
              const fechaA = a.fechaOriginal || a.fecha;
              const fechaB = b.fechaOriginal || b.fecha;
              const cmpFecha = fechaA.localeCompare(fechaB);
              return cmpFecha !== 0 ? cmpFecha : a.hora - b.hora;
            });
            
            // Verificar si hay advertencia (menos de 8760 horas)
            const tieneAdvertencia = datosOrdenados.length < 8760;
            const horasFaltantes = 8760 - datosOrdenados.length;
            
            // Calcular estadísticas
            const consumoTotal = datosOrdenados.reduce((s, d) => s + d.consumo, 0);
            const consumoMedia = consumoTotal / datosOrdenados.length;
            const fechaInicio = datosOrdenados[0]?.fechaOriginal || datosOrdenados[0]?.fecha;
            const fechaFin = datosOrdenados[datosOrdenados.length - 1]?.fechaOriginal || datosOrdenados[datosOrdenados.length - 1]?.fecha;
            
            // Calcular consumo por hora
            const consumoPorHora = Array(24).fill(0);
            const contadorPorHora = Array(24).fill(0);
            datosOrdenados.forEach(d => {
              consumoPorHora[d.hora] += d.consumo;
              contadorPorHora[d.hora]++;
            });
            const mediasPorHora = consumoPorHora.map((total, i) => contadorPorHora[i] > 0 ? total / contadorPorHora[i] : 0);
            const maxMediaHora = Math.max(...mediasPorHora);
            
            // Calcular consumo por mes (usando añoOriginal si está disponible)
            const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const consumoPorMes = {};
            datosOrdenados.forEach(d => {
              // Usar añoOriginal si existe (datos de múltiples años), sino usar la fecha normal
              const año = d.añoOriginal || d.fecha.substring(0, 4);
              const mes = d.fecha.substring(5, 7);
              const clave = `${año}-${mes}`;
              if (!consumoPorMes[clave]) consumoPorMes[clave] = 0;
              consumoPorMes[clave] += d.consumo;
            });
            // Ordenar cronológicamente por año-mes real
            const mesesOrdenados = Object.entries(consumoPorMes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([anoMes, total]) => ({
                anoMes,
                label: mesesNombres[parseInt(anoMes.split('-')[1]) - 1] + "'" + anoMes.split('-')[0].slice(2),
                total
              }));
            const maxConsumoMes = Math.max(...mesesOrdenados.map(m => m.total));
            
            // Función para convertir fecha YYYY-MM-DD a DD-MM-YYYY
            const formatearFecha = (fecha) => {
              if (!fecha) return '';
              const partes = fecha.split('-');
              if (partes.length === 3) {
                return `${partes[2]}-${partes[1]}-${partes[0]}`; // DD-MM-YYYY
              }
              return fecha;
            };
            
            // Ordenar por mes, día, hora (enero a diciembre)
            const datosParaExportar = [...datosOrdenados].sort((a, b) => {
              const fechaA = a.fechaOriginal || a.fecha;
              const fechaB = b.fechaOriginal || b.fecha;
              const [aYear, aMonth, aDay] = fechaA.split('-').map(Number);
              const [bYear, bMonth, bDay] = fechaB.split('-').map(Number);
              
              if (aMonth !== bMonth) return aMonth - bMonth;
              if (aDay !== bDay) return aDay - bDay;
              return a.hora - b.hora;
            });
            
            // Funciones de descarga locales
            const descargarCSV = () => {
              const cabecera = 'fecha;hora;demanda\n';
              const filas = datosParaExportar.map(d => {
                const fecha = formatearFecha(d.fechaOriginal || d.fecha);
                // Usar coma decimal para Excel español
                return `${fecha};${d.hora};${d.consumo.toFixed(4).replace('.', ',')}`;
              }).join('\n');
              const blob = new Blob([cabecera + filas], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'curva_carga_final.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            };
            
            return (
              <div style={{ backgroundColor: tieneAdvertencia ? '#FFF8E1' : '#E8F5E9', border: `1px solid ${tieneAdvertencia ? '#FFB300' : '#A5D6A7'}`, borderRadius: '12px', padding: '20px' }}>
                {/* Advertencia si faltan horas */}
                {tieneAdvertencia && (
                  <div style={{ backgroundColor: '#FFE082', border: '1px solid #FFB300', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: '600', color: '#E65100', fontSize: '13px' }}>Año incompleto: faltan {horasFaltantes.toLocaleString()} horas</div>
                      <div style={{ fontSize: '11px', color: '#795548' }}>Selecciona los 12 meses en el panel de selección para obtener un año completo de 8760 horas.</div>
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: tieneAdvertencia ? '#E65100' : COLOR_SUCCESS }}>{tieneAdvertencia ? '⚠️ Curva de Carga Parcial' : '✅ Curva de Carga Final'}</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={descargarCSV} style={{ padding: '8px 16px', backgroundColor: '#17A2B8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>📄 Descargar CSV</button>
                  </div>
                </div>
                
                {/* Estadísticas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ backgroundColor: datosOrdenados.length === 8760 ? '#C8E6C9' : '#FFE0B2', borderRadius: '8px', padding: '12px', textAlign: 'center', border: datosOrdenados.length === 8760 ? '2px solid #4CAF50' : '2px solid #FF9800' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: datosOrdenados.length === 8760 ? '#2E7D32' : '#E65100' }}>{datosOrdenados.length.toLocaleString()}</div>
                    <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT }}>{datosOrdenados.length === 8760 ? '✓ 8760 horas' : `Faltan ${8760 - datosOrdenados.length}`}</div>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: COLOR_TEXT }}>{consumoTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                    <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT }}>kWh Total</div>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: COLOR_TEXT }}>{consumoMedia.toFixed(2)}</div>
                    <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT }}>kWh Media/h</div>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: COLOR_TEXT }}>{fechaInicio}</div>
                    <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT }}>Fecha Inicio</div>
                  </div>
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: COLOR_TEXT }}>{fechaFin}</div>
                    <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT }}>Fecha Fin</div>
                  </div>
                </div>
                
                {/* Selector de gráfico */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', color: '#2E7D32' }}>📈 Perfil de Consumo</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setVistaGrafico('horas')} style={{ padding: '6px 16px', fontSize: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: vistaGrafico === 'horas' ? '#2E7D32' : 'white', color: vistaGrafico === 'horas' ? 'white' : COLOR_TEXT }}>Perfil Horario</button>
                    <button onClick={() => setVistaGrafico('meses')} style={{ padding: '6px 16px', fontSize: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: vistaGrafico === 'meses' ? '#2E7D32' : 'white', color: vistaGrafico === 'meses' ? 'white' : COLOR_TEXT }}>Consumo Mensual</button>
                  </div>
                </div>
                
                {/* Gráfico Horario */}
                {vistaGrafico === 'horas' && (() => {
                  const maxTotalHora = Math.max(...consumoPorHora);
                  return (
                    <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, margin: '0 0 16px 0', textAlign: 'center' }}>Consumo total por hora del día (kWh)</p>
                      <div style={{ position: 'relative', height: '220px' }}>
                        {/* Barras con valores */}
                        <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', height: '150px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 5px' }}>
                          {consumoPorHora.map((total, hora) => (
                            <div key={hora} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '30px' }}>
                              <div style={{ fontSize: '8px', color: COLOR_TEXT, fontWeight: '600', marginBottom: '2px' }}>
                                {total > 0 ? (total >= 1000 ? Math.round(total/1000) + 'k' : total.toLocaleString(undefined, {maximumFractionDigits: 0})) : ''}
                              </div>
                              <div 
                                style={{ 
                                  width: '80%', 
                                  backgroundColor: COLOR_CORP, 
                                  borderRadius: '2px 2px 0 0', 
                                  height: `${maxTotalHora > 0 ? Math.max((total / maxTotalHora) * 120, 2) : 2}px`
                                }} 
                                title={`Hora ${hora}: ${total.toLocaleString(undefined, {maximumFractionDigits: 2})} kWh`}
                              />
                            </div>
                          ))}
                        </div>
                        {/* Eje X - 24 horas */}
                        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '40px', display: 'flex', justifyContent: 'space-around', padding: '0 5px', borderTop: '2px solid #E5E5E5' }}>
                          {Array.from({length: 24}, (_, i) => (
                            <div key={i} style={{ flex: 1, maxWidth: '30px', fontSize: '9px', color: COLOR_TEXT_LIGHT, paddingTop: '6px', textAlign: 'center' }}>
                              {i}h
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>Hora del día</div>
                    </div>
                  );
                })()}
                
                {/* Gráfico Mensual */}
                {vistaGrafico === 'meses' && (
                  <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px' }}>
                    <p style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, margin: '0 0 16px 0', textAlign: 'center' }}>Consumo total por mes (kWh)</p>
                    <div style={{ position: 'relative', height: '220px' }}>
                      {/* Barras con etiquetas */}
                      <div style={{ position: 'absolute', bottom: '40px', left: '0', right: '0', height: '150px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 10px' }}>
                        {mesesOrdenados.map((m, i) => (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '60px' }}>
                            <div style={{ fontSize: '9px', color: COLOR_TEXT, fontWeight: '600', marginBottom: '4px' }}>
                              {m.total.toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                            <div 
                              style={{ 
                                width: '80%', 
                                backgroundColor: COLOR_WARNING, 
                                borderRadius: '3px 3px 0 0', 
                                height: `${maxConsumoMes > 0 ? Math.max((m.total / maxConsumoMes) * 120, 4) : 4}px`
                              }} 
                              title={`${m.label}: ${m.total.toLocaleString()} kWh`}
                            />
                          </div>
                        ))}
                      </div>
                      {/* Eje X */}
                      <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '40px', display: 'flex', justifyContent: 'space-around', padding: '0 10px', borderTop: '2px solid #E5E5E5' }}>
                        {mesesOrdenados.map((m, i) => (
                          <div key={i} style={{ flex: 1, maxWidth: '60px', fontSize: '10px', color: COLOR_TEXT_LIGHT, paddingTop: '8px', textAlign: 'center' }}>
                            {m.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLOR_BG_SECONDARY }}>
          <button onClick={onCancelar} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #DEE2E6', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: COLOR_TEXT }}>Cancelar</button>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {!datosCorregidos && <span style={{ fontSize: '12px', color: COLOR_WARNING }}>⚠️ Aplica transformaciones primero</span>}
            {datosCorregidos && datosCorregidos.length !== 8760 && (
              <span style={{ fontSize: '12px', color: '#E65100' }}>⚠️ {datosCorregidos.length} horas (faltan {8760 - datosCorregidos.length})</span>
            )}
            {datosCorregidos && datosCorregidos.length === 8760 && (
              <span style={{ fontSize: '12px', color: COLOR_SUCCESS }}>✓ 8760 horas completas</span>
            )}
            <button 
              onClick={() => onAceptar(datosCorregidos || datosOriginales)} 
              disabled={!datosCorregidos} 
              style={{ 
                padding: '10px 24px', 
                backgroundColor: !datosCorregidos ? '#CCC' : (datosCorregidos.length === 8760 ? COLOR_SUCCESS : COLOR_WARNING), 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontSize: '13px', 
                fontWeight: '600', 
                cursor: datosCorregidos ? 'pointer' : 'not-allowed' 
              }}
            >
              {datosCorregidos && datosCorregidos.length === 8760 ? '✅ Guardar Datos' : '⚠️ Guardar (Incompleto)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// VALIDADOR DE PRODUCCIÓN FV
// ============================================
const ValidadorProduccion = ({ archivo, datosOriginales, errores, estadisticas, formatoDetectado, potenciaNominal, onAceptar, onCancelar, onCorregir }) => {
  const [datosCorregidos, setDatosCorregidos] = useState(null);
  const [vistaDetalle, setVistaDetalle] = useState('resumen'); // 'resumen' | 'anomalias' | 'meses'
  const [añoSeleccionado, setAñoSeleccionado] = useState(null);
  const [opcionesCorreccion, setOpcionesCorreccion] = useState({
    metodoDuplicados: 'promedio',
    metodoHuecos: 'interpolar',
    metodoNegativos: 'cero',
    metodoExcesoPotencia: 'promedio' // promedio, maximo, minimo, limitar
  });

  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const datosParaMostrar = datosCorregidos || datosOriginales || [];
  
  // Potencia nominal para validación (en kW = kWh máximo por hora)
  const potNominal = parseFloat(potenciaNominal) || 0;

  // Análisis avanzado de anomalías
  const analizarAnomalias = (datos) => {
    const anomalias = {
      duplicados: [],
      negativos: [],
      excesoPotencia: [], // Energía horaria > potencia nominal
      huecos: []
    };
    
    // Ordenar datos cronológicamente
    const datosOrdenados = [...datos].sort((a, b) => {
      const cmp = a.fecha.localeCompare(b.fecha);
      return cmp !== 0 ? cmp : a.hora - b.hora;
    });
    
    // Mapa para detectar duplicados
    const mapaRegistros = new Map();
    
    // Analizar cada registro
    datosOrdenados.forEach((d, index) => {
      const clave = `${d.fecha}-${d.hora}`;
      const valor = d.consumo || d.produccion || 0;
      
      // Detectar duplicados
      if (mapaRegistros.has(clave)) {
        const prevIndex = mapaRegistros.get(clave);
        anomalias.duplicados.push({
          index,
          fecha: d.fecha,
          hora: d.hora,
          valor,
          valorAnterior: datosOrdenados[prevIndex].consumo || datosOrdenados[prevIndex].produccion
        });
      } else {
        mapaRegistros.set(clave, index);
      }
      
      // Detectar negativos
      if (valor < 0) {
        anomalias.negativos.push({ index, fecha: d.fecha, hora: d.hora, valor });
      }
      
      // Detectar exceso de potencia (energía horaria > potencia nominal)
      if (potNominal > 0 && valor > potNominal) {
        // Buscar valores anterior y posterior para opciones de corrección
        const valorAnterior = index > 0 ? (datosOrdenados[index - 1].consumo || datosOrdenados[index - 1].produccion || 0) : 0;
        const valorPosterior = index < datosOrdenados.length - 1 ? (datosOrdenados[index + 1].consumo || datosOrdenados[index + 1].produccion || 0) : 0;
        
        anomalias.excesoPotencia.push({
          index,
          fecha: d.fecha,
          hora: d.hora,
          valor,
          potenciaNominal: potNominal,
          exceso: ((valor / potNominal - 1) * 100).toFixed(1),
          valorAnterior,
          valorPosterior,
          promedio: (valorAnterior + valorPosterior) / 2,
          maximo: Math.max(valorAnterior, valorPosterior),
          minimo: Math.min(valorAnterior, valorPosterior)
        });
      }
    });
    
    return anomalias;
  };

  const anomaliasDetectadas = analizarAnomalias(datosParaMostrar);
  const totalAnomalias = anomaliasDetectadas.duplicados.length + 
                         anomaliasDetectadas.negativos.length + 
                         anomaliasDetectadas.excesoPotencia.length;

  // Agrupar datos por año y mes
  const datosPorAnoMes = {};
  datosParaMostrar.forEach(d => {
    const año = d.fecha.substring(0, 4);
    const mes = parseInt(d.fecha.substring(5, 7)) - 1;
    const valor = d.consumo || d.produccion || 0;
    
    if (!datosPorAnoMes[año]) {
      datosPorAnoMes[año] = {
        total: 0,
        registros: 0,
        meses: Array(12).fill(null).map(() => ({ total: 0, registros: 0, max: 0, min: Infinity }))
      };
    }
    
    datosPorAnoMes[año].total += valor;
    datosPorAnoMes[año].registros++;
    datosPorAnoMes[año].meses[mes].total += valor;
    datosPorAnoMes[año].meses[mes].registros++;
    datosPorAnoMes[año].meses[mes].max = Math.max(datosPorAnoMes[año].meses[mes].max, valor);
    if (valor > 0) datosPorAnoMes[año].meses[mes].min = Math.min(datosPorAnoMes[año].meses[mes].min, valor);
  });

  const años = Object.keys(datosPorAnoMes).sort();
  
  // Seleccionar primer año si no hay ninguno seleccionado
  if (!añoSeleccionado && años.length > 0) {
    setAñoSeleccionado(años[0]);
  }

  const handleCorregir = () => {
    const resultado = onCorregir({ ...opcionesCorreccion, anomalias: anomaliasDetectadas });
    setDatosCorregidos(resultado.datosCorregidos);
  };

  // Iconos y colores por tipo de formato
  const getFormatoInfo = (formato) => {
    if (!formato) return { icon: '📄', color: '#666', nombre: 'Desconocido' };
    switch (formato?.tipo) {
      case 'curva_carga':
      case 'curva_carga_auto':
        return { icon: '📈', color: '#1565C0', nombre: formato.nombre || 'Curva de Carga' };
      case 'estandar':
        return { icon: '✅', color: '#E85A2C', nombre: 'Formato YLIO estándar' };
      default:
        return { icon: '📄', color: '#666', nombre: formato?.nombre || 'Formato genérico' };
    }
  };

  const formatoInfo = getFormatoInfo(formatoDetectado);

  const Badge = ({ tipo, cantidad, color, bgColor }) => (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px', 
      padding: '4px 10px', 
      backgroundColor: bgColor, 
      color: color, 
      borderRadius: '12px', 
      fontSize: '11px', 
      fontWeight: '600' 
    }}>
      {cantidad}
    </span>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '95%', maxWidth: '1100px', maxHeight: '95vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: COLOR_TEXT, fontSize: '20px' }}>☀️ Validación de Datos de Producción</h2>
            <p style={{ margin: '4px 0 0 0', color: COLOR_TEXT_LIGHT, fontSize: '13px' }}>
              {archivo}
              {formatoDetectado && (
                <span style={{ marginLeft: '12px', padding: '3px 10px', backgroundColor: formatoInfo.color + '15', color: formatoInfo.color, borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                  {formatoInfo.icon} {formatoInfo.nombre}
                </span>
              )}
            </p>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: COLOR_TEXT_LIGHT }}>✕</button>
        </div>

        {/* Tabs de navegación */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
          {[
            { id: 'resumen', label: '📊 Resumen', count: null },
            { id: 'meses', label: '📅 Por Año/Mes', count: null },
            { id: 'anomalias', label: '⚠️ Anomalías', count: totalAnomalias }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVistaDetalle(tab.id)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: vistaDetalle === tab.id ? 'white' : 'transparent',
                borderBottom: vistaDetalle === tab.id ? `3px solid ${COLOR_CORP}` : '3px solid transparent',
                color: vistaDetalle === tab.id ? COLOR_CORP : COLOR_TEXT_LIGHT,
                fontWeight: vistaDetalle === tab.id ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <Badge cantidad={tab.count} color="#856404" bgColor="#FFF3CD" />
              )}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          
          {/* VISTA RESUMEN */}
          {vistaDetalle === 'resumen' && (
            <>
              {/* Resumen General */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: COLOR_CORP }}>{estadisticas?.totalRegistros?.toLocaleString() || 0}</div>
                  <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Registros leídos</div>
                </div>
                <div style={{ backgroundColor: totalAnomalias > 0 ? '#FFF3CD' : '#D4EDDA', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: totalAnomalias > 0 ? '#856404' : COLOR_SUCCESS }}>{totalAnomalias}</div>
                  <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Anomalías detectadas</div>
                </div>
                <div style={{ backgroundColor: COLOR_BG_SECONDARY, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: COLOR_TEXT }}>{(parseFloat(estadisticas?.consumoTotal || 0) / 1000).toFixed(1)}</div>
                  <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>MWh Total</div>
                </div>
                <div style={{ backgroundColor: '#E3F2FD', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#1565C0' }}>{años.length}</div>
                  <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Años disponibles</div>
                </div>
              </div>

              {/* Desglose por Año */}
              <div style={{ backgroundColor: '#F5F5F5', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: COLOR_TEXT }}>📅 Desglose por Año</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {años.map(año => {
                    const info = datosPorAnoMes[año];
                    const horasEsperadas = 8760;
                    const completitud = ((info.registros / horasEsperadas) * 100).toFixed(1);
                    const esCompleto = info.registros >= horasEsperadas;
                    
                    return (
                      <div key={año} style={{ 
                        backgroundColor: 'white', 
                        borderRadius: '8px', 
                        padding: '12px',
                        border: esCompleto ? '2px solid #4CAF50' : '1px solid #E0E0E0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '700', color: COLOR_TEXT }}>{año}</span>
                          {esCompleto && <span style={{ fontSize: '14px' }}>✅</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>
                          <div>{info.registros.toLocaleString()} registros ({completitud}%)</div>
                          <div style={{ fontWeight: '600', color: COLOR_CORP, marginTop: '4px', fontSize: '14px' }}>
                            {(info.total / 1000).toFixed(1)} MWh
                          </div>
                        </div>
                        <div style={{ marginTop: '8px', height: '4px', backgroundColor: '#E0E0E0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, parseFloat(completitud))}%`, backgroundColor: esCompleto ? '#4CAF50' : COLOR_CORP }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* VISTA POR AÑO/MES */}
          {vistaDetalle === 'meses' && (
            <>
              {/* Selector de año */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {años.map(año => (
                  <button
                    key={año}
                    onClick={() => setAñoSeleccionado(año)}
                    style={{
                      padding: '8px 16px',
                      border: añoSeleccionado === año ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
                      borderRadius: '8px',
                      backgroundColor: añoSeleccionado === año ? '#FFF3E0' : 'white',
                      color: añoSeleccionado === año ? COLOR_CORP : COLOR_TEXT,
                      fontWeight: añoSeleccionado === año ? '600' : '400',
                      cursor: 'pointer'
                    }}
                  >
                    {año}
                  </button>
                ))}
              </div>

              {/* Tabla de meses */}
              {añoSeleccionado && datosPorAnoMes[añoSeleccionado] && (
                <div style={{ backgroundColor: '#F5F5F5', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: COLOR_TEXT }}>
                    Producción mensual {añoSeleccionado}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    {datosPorAnoMes[añoSeleccionado].meses.map((mes, idx) => {
                      const horasEsperadas = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744][idx];
                      const completitud = mes.registros > 0 ? ((mes.registros / horasEsperadas) * 100).toFixed(0) : 0;
                      const tieneData = mes.registros > 0;
                      
                      return (
                        <div key={idx} style={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          padding: '12px',
                          border: tieneData ? '1px solid #E0E0E0' : '1px dashed #CCC',
                          opacity: tieneData ? 1 : 0.5
                        }}>
                          <div style={{ fontWeight: '600', color: COLOR_TEXT, marginBottom: '8px' }}>{mesesNombres[idx]}</div>
                          {tieneData ? (
                            <>
                              <div style={{ fontSize: '18px', fontWeight: '700', color: COLOR_CORP }}>
                                {(mes.total / 1000).toFixed(1)} <span style={{ fontSize: '12px', fontWeight: '400' }}>MWh</span>
                              </div>
                              <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                                {mes.registros} h ({completitud}%)
                              </div>
                              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '2px' }}>
                                Max: {mes.max.toFixed(1)} kWh | Min: {mes.min === Infinity ? 0 : mes.min.toFixed(1)} kWh
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Sin datos</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Total del año */}
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: COLOR_TEXT }}>Total {añoSeleccionado}</span>
                    <span style={{ fontSize: '20px', fontWeight: '700', color: COLOR_CORP }}>
                      {(datosPorAnoMes[añoSeleccionado].total / 1000).toFixed(1)} MWh
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* VISTA ANOMALÍAS */}
          {vistaDetalle === 'anomalias' && (
            <>
              {totalAnomalias === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: COLOR_SUCCESS }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>✅</span>
                  <h3 style={{ margin: 0 }}>No se detectaron anomalías</h3>
                  <p style={{ color: COLOR_TEXT_LIGHT }}>
                    {potNominal > 0 
                      ? `Los datos están dentro del límite de potencia nominal (${potNominal} kW)`
                      : 'Los datos están listos para usar. Define la potencia nominal para detectar excesos.'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {/* Resumen de anomalías */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ backgroundColor: '#FFF3CD', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#856404' }}>{anomaliasDetectadas.duplicados.length}</div>
                      <div style={{ fontSize: '11px', color: '#856404' }}>🔄 Duplicados</div>
                    </div>
                    <div style={{ backgroundColor: '#F8D7DA', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#721C24' }}>{anomaliasDetectadas.negativos.length}</div>
                      <div style={{ fontSize: '11px', color: '#721C24' }}>➖ Negativos</div>
                    </div>
                    <div style={{ backgroundColor: '#FFCDD2', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#C62828' }}>{anomaliasDetectadas.excesoPotencia.length}</div>
                      <div style={{ fontSize: '11px', color: '#C62828' }}>⚡ Exceso Potencia</div>
                    </div>
                  </div>

                  {/* Info de potencia nominal */}
                  {potNominal > 0 && (
                    <div style={{ backgroundColor: '#E3F2FD', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>⚡</span>
                      <span style={{ fontSize: '13px', color: '#1565C0' }}>
                        Potencia Nominal de referencia: <strong>{potNominal} kW</strong> (máxima energía horaria permitida)
                      </span>
                    </div>
                  )}

                  {/* Detalle de anomalías */}
                  <div style={{ backgroundColor: '#FFF8E1', border: '1px solid #FFB300', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: '#E65100' }}>
                      ⚠️ Detalle de Anomalías Detectadas
                    </h3>
                    
                    {/* Duplicados */}
                    {anomaliasDetectadas.duplicados.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '13px', color: '#856404', margin: '0 0 8px 0' }}>
                          🔄 Duplicados ({anomaliasDetectadas.duplicados.length})
                        </h4>
                        <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '8px', maxHeight: '100px', overflow: 'auto' }}>
                          {anomaliasDetectadas.duplicados.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, padding: '2px 0' }}>
                              {d.fecha} H{d.hora}: {d.valor.toFixed(2)} kWh (anterior: {d.valorAnterior?.toFixed(2)} kWh)
                            </div>
                          ))}
                          {anomaliasDetectadas.duplicados.length > 5 && (
                            <div style={{ fontSize: '11px', color: '#856404', fontStyle: 'italic' }}>
                              ... y {anomaliasDetectadas.duplicados.length - 5} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Exceso de Potencia */}
                    {anomaliasDetectadas.excesoPotencia.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '13px', color: '#C62828', margin: '0 0 8px 0' }}>
                          ⚡ Exceso de Potencia - Energía {">"} Potencia Nominal ({anomaliasDetectadas.excesoPotencia.length})
                        </h4>
                        <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '8px', maxHeight: '150px', overflow: 'auto' }}>
                          {anomaliasDetectadas.excesoPotencia.slice(0, 8).map((d, i) => (
                            <div key={i} style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, padding: '4px 0', borderBottom: '1px solid #F0F0F0' }}>
                              <strong>{d.fecha} H{d.hora}</strong>: {d.valor.toFixed(2)} kWh 
                              <span style={{ color: '#C62828' }}> (+{d.exceso}% sobre {potNominal} kW)</span>
                              <br/>
                              <span style={{ fontSize: '10px', color: '#999' }}>
                                Anterior: {d.valorAnterior.toFixed(2)} | Posterior: {d.valorPosterior.toFixed(2)} | 
                                Promedio: {d.promedio.toFixed(2)} | Máx: {d.maximo.toFixed(2)} | Mín: {d.minimo.toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {anomaliasDetectadas.excesoPotencia.length > 8 && (
                            <div style={{ fontSize: '11px', color: '#C62828', fontStyle: 'italic', paddingTop: '4px' }}>
                              ... y {anomaliasDetectadas.excesoPotencia.length - 8} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Negativos */}
                    {anomaliasDetectadas.negativos.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '13px', color: '#721C24', margin: '0 0 8px 0' }}>
                          ➖ Valores Negativos ({anomaliasDetectadas.negativos.length})
                        </h4>
                        <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '8px', maxHeight: '100px', overflow: 'auto' }}>
                          {anomaliasDetectadas.negativos.slice(0, 5).map((d, i) => (
                            <div key={i} style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT, padding: '2px 0' }}>
                              {d.fecha} H{d.hora}: {d.valor.toFixed(2)} kWh
                            </div>
                          ))}
                          {anomaliasDetectadas.negativos.length > 5 && (
                            <div style={{ fontSize: '11px', color: '#721C24', fontStyle: 'italic' }}>
                              ... y {anomaliasDetectadas.negativos.length - 5} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Opciones de corrección */}
                    <h4 style={{ fontSize: '14px', color: COLOR_TEXT, margin: '20px 0 12px 0', borderTop: '1px solid #FFB300', paddingTop: '16px' }}>
                      🔧 Opciones de Tratamiento
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      {anomaliasDetectadas.duplicados.length > 0 && (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>Duplicados</label>
                          <select
                            value={opcionesCorreccion.metodoDuplicados}
                            onChange={(e) => setOpcionesCorreccion({ ...opcionesCorreccion, metodoDuplicados: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DEE2E6', fontSize: '12px' }}
                          >
                            <option value="promedio">Promediar valores</option>
                            <option value="primero">Mantener primero</option>
                            <option value="ultimo">Mantener último</option>
                            <option value="maximo">Mantener máximo</option>
                          </select>
                        </div>
                      )}
                      {anomaliasDetectadas.negativos.length > 0 && (
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>Negativos</label>
                          <select
                            value={opcionesCorreccion.metodoNegativos}
                            onChange={(e) => setOpcionesCorreccion({ ...opcionesCorreccion, metodoNegativos: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DEE2E6', fontSize: '12px' }}
                          >
                            <option value="cero">Convertir a 0</option>
                            <option value="absoluto">Valor absoluto</option>
                            <option value="eliminar">Eliminar registro</option>
                          </select>
                        </div>
                      )}
                      {anomaliasDetectadas.excesoPotencia.length > 0 && (
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>
                            Exceso de Potencia (energía {">"} {potNominal} kW)
                          </label>
                          <select
                            value={opcionesCorreccion.metodoExcesoPotencia}
                            onChange={(e) => setOpcionesCorreccion({ ...opcionesCorreccion, metodoExcesoPotencia: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DEE2E6', fontSize: '12px' }}
                          >
                            <option value="promedio">Promedio de horas anterior y posterior</option>
                            <option value="maximo">Máximo de horas anterior y posterior</option>
                            <option value="minimo">Mínimo de horas anterior y posterior</option>
                            <option value="limitar">Limitar a potencia nominal ({potNominal} kW)</option>
                            <option value="mantener">Mantener valor original</option>
                          </select>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={handleCorregir}
                      style={{
                        marginTop: '16px',
                        padding: '10px 24px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '100%'
                      }}
                    >
                      🔧 Aplicar correcciones ({totalAnomalias} anomalías)
                    </button>
                  </div>
                </>
              )}

              {/* Mensaje de datos corregidos */}
              {datosCorregidos && (
                <div style={{ backgroundColor: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>✅</span>
                    <span style={{ fontWeight: '600', color: '#2E7D32' }}>Datos corregidos correctamente</span>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: COLOR_TEXT_LIGHT }}>
                    {datosCorregidos.length.toLocaleString()} registros listos para guardar
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E5E5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAFAFA' }}>
          <button
            onClick={onCancelar}
            style={{ padding: '10px 24px', backgroundColor: 'white', border: '1px solid #DEE2E6', borderRadius: '8px', color: COLOR_TEXT, fontSize: '14px', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {totalAnomalias > 0 && !datosCorregidos && (
              <span style={{ fontSize: '12px', color: '#856404' }}>⚠️ {totalAnomalias} anomalías sin corregir</span>
            )}
            <button
              onClick={() => onAceptar(datosCorregidos || datosOriginales)}
              style={{
                padding: '10px 24px',
                backgroundColor: COLOR_CORP,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ✓ Aceptar y guardar ({(datosCorregidos || datosOriginales).length.toLocaleString()} registros)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RESUMEN DE PRODUCCIÓN GUARDADA
// ============================================
const ResumenProduccionGuardado = ({ produccion, estadisticas, onCambiarArchivo }) => {
  if (!produccion || produccion.length === 0) return null;

  // Agrupar por año
  const datosPorAno = {};
  produccion.forEach(d => {
    const año = d.fecha.substring(0, 4);
    if (!datosPorAno[año]) datosPorAno[año] = { registros: 0, total: 0 };
    datosPorAno[año].registros++;
    datosPorAno[año].total += d.consumo || d.produccion || 0;
  });

  const años = Object.keys(datosPorAno).sort();
  const produccionTotal = produccion.reduce((s, d) => s + (d.consumo || d.produccion || 0), 0);

  return (
    <div style={{ backgroundColor: '#FFF8E1', border: '1px solid #FFB300', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#E65100' }}>☀️ Producción FV Cargada</h4>
        <button
          onClick={onCambiarArchivo}
          style={{ padding: '4px 12px', fontSize: '11px', backgroundColor: 'white', border: '1px solid #FFB300', borderRadius: '6px', color: '#E65100', cursor: 'pointer' }}
        >
          Cambiar
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
        {años.map(año => (
          <div key={año} style={{ backgroundColor: 'white', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: COLOR_TEXT }}>{año}</div>
            <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>{datosPorAno[año].registros.toLocaleString()} h</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#E65100' }}>
              {(datosPorAno[año].total / 1000).toFixed(1)} MWh
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>
        Total: {(produccionTotal / 1000).toFixed(1)} MWh ({produccion.length.toLocaleString()} registros)
      </div>
    </div>
  );
};

// Componente para mostrar resumen de consumo guardado
const ResumenConsumoGuardado = ({ consumos, estadisticas, onCambiarArchivo, onEditarAnalisis }) => {
  const [vistaGrafico, setVistaGrafico] = useState('horas');
  
  if (!consumos || consumos.length === 0) return null;
  
  // Ordenar datos cronológicamente
  const datosOrdenados = [...consumos].sort((a, b) => {
    const fechaA = a.fechaOriginal || a.fecha;
    const fechaB = b.fechaOriginal || b.fecha;
    const cmpFecha = fechaA.localeCompare(fechaB);
    return cmpFecha !== 0 ? cmpFecha : a.hora - b.hora;
  });
  
  // Calcular estadísticas
  const consumoTotal = datosOrdenados.reduce((s, d) => s + d.consumo, 0);
  const consumoMedia = consumoTotal / datosOrdenados.length;
  const fechaInicio = datosOrdenados[0]?.fechaOriginal || datosOrdenados[0]?.fecha;
  const fechaFin = datosOrdenados[datosOrdenados.length - 1]?.fechaOriginal || datosOrdenados[datosOrdenados.length - 1]?.fecha;
  
  // Calcular consumo por hora
  const consumoPorHora = Array(24).fill(0);
  datosOrdenados.forEach(d => { consumoPorHora[d.hora] += d.consumo; });
  const maxTotalHora = Math.max(...consumoPorHora);
  
  // Calcular consumo por mes
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const consumoPorMes = {};
  datosOrdenados.forEach(d => {
    const año = d.añoOriginal || d.fecha.substring(0, 4);
    const mes = d.fecha.substring(5, 7);
    const clave = `${año}-${mes}`;
    if (!consumoPorMes[clave]) consumoPorMes[clave] = 0;
    consumoPorMes[clave] += d.consumo;
  });
  const mesesOrdenados = Object.entries(consumoPorMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anoMes, total]) => ({
      anoMes,
      label: mesesNombres[parseInt(anoMes.split('-')[1]) - 1] + "'" + anoMes.split('-')[0].slice(2),
      total
    }));
  const maxConsumoMes = Math.max(...mesesOrdenados.map(m => m.total));
  
  // Función para convertir fecha YYYY-MM-DD a DD-MM-YYYY
  const formatearFecha = (fecha) => {
    if (!fecha) return '';
    const partes = fecha.split('-');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`; // DD-MM-YYYY
    }
    return fecha;
  };
  
  // Ordenar por mes, día, hora (enero a diciembre)
  const datosParaExportar = [...datosOrdenados].sort((a, b) => {
    const fechaA = a.fechaOriginal || a.fecha;
    const fechaB = b.fechaOriginal || b.fecha;
    const [aYear, aMonth, aDay] = fechaA.split('-').map(Number);
    const [bYear, bMonth, bDay] = fechaB.split('-').map(Number);
    
    if (aMonth !== bMonth) return aMonth - bMonth;
    if (aDay !== bDay) return aDay - bDay;
    return a.hora - b.hora;
  });
  
  // Funciones de descarga
  // Función para descargar CSV
  const descargarCSV = () => {
    const cabecera = 'fecha;hora;demanda\n';
    const filas = datosParaExportar.map(d => {
      const fecha = formatearFecha(d.fechaOriginal || d.fecha);
      // Usar coma decimal para Excel español
      return `${fecha};${d.hora};${d.consumo.toFixed(4).replace('.', ',')}`;
    }).join('\n');
    const blob = new Blob([cabecera + filas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'curva_carga.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div style={{ marginTop: '20px', backgroundColor: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: COLOR_SUCCESS }}>📊 Curva de Consumo Procesada</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={descargarCSV} style={{ padding: '6px 12px', backgroundColor: '#17A2B8', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>📄 CSV</button>
          {onEditarAnalisis && (
            <button onClick={onEditarAnalisis} style={{ padding: '6px 12px', backgroundColor: COLOR_CORP, color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>✏️ Editar</button>
          )}
          <button onClick={onCambiarArchivo} style={{ padding: '6px 12px', backgroundColor: COLOR_WARNING, color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>🔄 Cambiar archivo</button>
        </div>
      </div>
      
      {/* Estadísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: datosOrdenados.length === 8760 ? '#E8F5E9' : '#FFF3E0', borderRadius: '8px', padding: '10px', textAlign: 'center', border: datosOrdenados.length === 8760 ? '2px solid #4CAF50' : '2px solid #FF9800' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: datosOrdenados.length === 8760 ? '#2E7D32' : '#E65100' }}>{datosOrdenados.length.toLocaleString()}</div>
          <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT }}>Registros {datosOrdenados.length === 8760 ? '✓' : `(faltan ${8760 - datosOrdenados.length})`}</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: COLOR_TEXT }}>{consumoTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT }}>kWh Total</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: COLOR_TEXT }}>{consumoMedia.toFixed(2)}</div>
          <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT }}>kWh Media/h</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: COLOR_TEXT }}>{fechaInicio}</div>
          <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT }}>Fecha Inicio</div>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: COLOR_TEXT }}>{fechaFin}</div>
          <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT }}>Fecha Fin</div>
        </div>
      </div>
      
      {/* Selector de gráfico */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: '#2E7D32', fontWeight: '600' }}>📈 Perfil de Consumo</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setVistaGrafico('horas')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: vistaGrafico === 'horas' ? '#2E7D32' : 'white', color: vistaGrafico === 'horas' ? 'white' : COLOR_TEXT }}>Horario</button>
          <button onClick={() => setVistaGrafico('meses')} style={{ padding: '4px 12px', fontSize: '11px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: vistaGrafico === 'meses' ? '#2E7D32' : 'white', color: vistaGrafico === 'meses' ? 'white' : COLOR_TEXT }}>Mensual</button>
        </div>
      </div>
      
      {/* Gráfico Horario */}
      {vistaGrafico === 'horas' && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px' }}>
          <div style={{ position: 'relative', height: '160px' }}>
            <div style={{ position: 'absolute', bottom: '30px', left: '0', right: '0', height: '105px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 2px' }}>
              {consumoPorHora.map((total, hora) => (
                <div key={hora} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '25px' }}>
                  <div style={{ fontSize: '7px', color: COLOR_TEXT, fontWeight: '600', marginBottom: '1px' }}>
                    {total > 0 ? (total >= 1000 ? Math.round(total/1000) + 'k' : total.toLocaleString(undefined, {maximumFractionDigits: 0})) : ''}
                  </div>
                  <div style={{ width: '80%', backgroundColor: COLOR_CORP, borderRadius: '2px 2px 0 0', height: `${maxTotalHora > 0 ? Math.max((total / maxTotalHora) * 80, 2) : 2}px` }} title={`${hora}h: ${total.toLocaleString(undefined, {maximumFractionDigits: 0})} kWh`} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '30px', display: 'flex', justifyContent: 'space-around', padding: '0 2px', borderTop: '1px solid #E5E5E5' }}>
              {Array.from({length: 24}, (_, i) => (
                <div key={i} style={{ flex: 1, maxWidth: '25px', fontSize: '8px', color: COLOR_TEXT_LIGHT, paddingTop: '4px', textAlign: 'center' }}>{i}h</div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Gráfico Mensual */}
      {vistaGrafico === 'meses' && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px' }}>
          <div style={{ position: 'relative', height: '150px' }}>
            <div style={{ position: 'absolute', bottom: '30px', left: '0', right: '0', height: '95px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '0 5px' }}>
              {mesesOrdenados.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '50px' }}>
                  <div style={{ fontSize: '8px', color: COLOR_TEXT, fontWeight: '600', marginBottom: '2px' }}>{m.total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                  <div style={{ width: '80%', backgroundColor: COLOR_WARNING, borderRadius: '2px 2px 0 0', height: `${maxConsumoMes > 0 ? Math.max((m.total / maxConsumoMes) * 70, 3) : 3}px` }} title={`${m.label}: ${m.total.toLocaleString()} kWh`} />
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '30px', display: 'flex', justifyContent: 'space-around', padding: '0 5px', borderTop: '1px solid #E5E5E5' }}>
              {mesesOrdenados.map((m, i) => (
                <div key={i} style={{ flex: 1, maxWidth: '50px', fontSize: '9px', color: COLOR_TEXT_LIGHT, paddingTop: '6px', textAlign: 'center' }}>{m.label}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// PANTALLA DE PROYECTOS - PIPELINE
// ============================================
const PantallaOfertas = ({ ofertas, onAbrirOferta, onCambiarEstado, onVolver }) => {
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Contar ofertas por estado
  const contarPorEstado = (estadoId) => {
    return ofertas.filter(o => o.estado_oferta === estadoId).length;
  };

  // Filtrar ofertas
  const ofertasFiltradas = ofertas.filter(oferta => {
    const cumpleFiltroEstado = estadoFiltro === 'todos' || oferta.estado_oferta === estadoFiltro;
    const cumpleBusqueda = busqueda === '' || 
      (oferta.id_oferta || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (oferta.denominacion_oferta || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (oferta.cliente_denominacion || '').toLowerCase().includes(busqueda.toLowerCase());
    return cumpleFiltroEstado && cumpleBusqueda;
  });

  // Obtener info del estado
  const getEstadoInfo = (estadoId) => {
    return ESTADOS_OFERTA.find(e => e.id === estadoId) || ESTADOS_OFERTA[0];
  };

  // Formatear fecha
  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: COLOR_BG_SECONDARY,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '24px 32px',
        backgroundColor: COLOR_BG,
        borderBottom: `1px solid #E5E7EB`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: COLOR_TEXT }}>
            📊 Pipeline de Proyectos
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: COLOR_TEXT_LIGHT }}>
            Gestión del ciclo de vida de los proyectos
          </p>
        </div>
        <button
          onClick={onVolver}
          style={{
            padding: '10px 20px',
            border: `1px solid #E5E7EB`,
            borderRadius: '8px',
            backgroundColor: COLOR_BG,
            color: COLOR_TEXT,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Volver al inicio
        </button>
      </div>

      {/* Funnel visual */}
      <div style={{ 
        padding: '20px 32px',
        backgroundColor: COLOR_BG,
        borderBottom: `1px solid #E5E7EB`,
        overflowX: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '8px',
          minWidth: 'max-content'
        }}>
          {/* Botón Todos */}
          <button
            onClick={() => setEstadoFiltro('todos')}
            style={{
              padding: '12px 20px',
              border: estadoFiltro === 'todos' ? `2px solid ${COLOR_CORP}` : '1px solid #E5E7EB',
              borderRadius: '10px',
              backgroundColor: estadoFiltro === 'todos' ? COLOR_CORP_BG : COLOR_BG,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '90px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '20px' }}>📋</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: COLOR_TEXT }}>Todos</span>
            <span style={{ 
              fontSize: '16px', 
              fontWeight: '700', 
              color: estadoFiltro === 'todos' ? COLOR_CORP : COLOR_TEXT 
            }}>
              {ofertas.length}
            </span>
          </button>

          {/* Separador */}
          <div style={{ width: '1px', backgroundColor: '#E5E7EB', margin: '8px 4px' }} />

          {/* Estados del funnel */}
          {ESTADOS_OFERTA.map((estado, index) => {
            const count = contarPorEstado(estado.id);
            const isActive = estadoFiltro === estado.id;
            
            return (
              <button
                key={estado.id}
                onClick={() => setEstadoFiltro(estado.id)}
                style={{
                  padding: '12px 16px',
                  border: isActive ? `2px solid ${estado.color}` : '1px solid #E5E7EB',
                  borderRadius: '10px',
                  backgroundColor: isActive ? `${estado.color}15` : COLOR_BG,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: '85px',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: '18px' }}>{estado.icono}</span>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: '600', 
                  color: COLOR_TEXT,
                  whiteSpace: 'nowrap'
                }}>
                  {estado.nombre}
                </span>
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: isActive ? estado.color : COLOR_TEXT 
                }}>
                  {count}
                </span>
                {/* Flecha entre estados */}
                {index < ESTADOS_OFERTA.length - 1 && (
                  <span style={{
                    position: 'absolute',
                    right: '-14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#D1D5DB',
                    fontSize: '12px',
                    zIndex: 1
                  }}>→</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div style={{ padding: '16px 32px', backgroundColor: COLOR_BG_SECONDARY }}>
        <input
          type="text"
          placeholder="🔍 Buscar por ID, denominación o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '12px 16px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      {/* Lista de ofertas */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '0 32px 32px 32px'
      }}>
        {ofertasFiltradas.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            backgroundColor: COLOR_BG,
            borderRadius: '12px',
            marginTop: '16px'
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>
              {estadoFiltro === 'todos' ? '📭' : getEstadoInfo(estadoFiltro).icono}
            </span>
            <p style={{ color: COLOR_TEXT_LIGHT, fontSize: '15px' }}>
              {busqueda ? 'No se encontraron ofertas con ese criterio' : 
               estadoFiltro === 'todos' ? 'No hay ofertas todavía' : 
               `No hay ofertas en estado "${getEstadoInfo(estadoFiltro).nombre}"`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            {ofertasFiltradas.map((oferta) => {
              const estadoInfo = getEstadoInfo(oferta.estado_oferta);
              
              return (
                <div
                  key={oferta.id_oferta}
                  style={{
                    backgroundColor: COLOR_BG,
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => onAbrirOferta(oferta)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = COLOR_CORP;
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Info principal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                    {/* Estado badge */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: `${estadoInfo.color}15`,
                      borderRadius: '10px',
                      minWidth: '90px'
                    }}>
                      <span style={{ fontSize: '24px' }}>{estadoInfo.icono}</span>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: '600', 
                        color: estadoInfo.color,
                        marginTop: '4px',
                        textAlign: 'center'
                      }}>
                        {estadoInfo.nombre}
                      </span>
                    </div>

                    {/* Datos oferta - simplificado */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ 
                          fontSize: '15px', 
                          fontWeight: '700', 
                          color: COLOR_CORP 
                        }}>
                          {oferta.id_oferta}
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: COLOR_TEXT,
                        marginBottom: '2px'
                      }}>
                        {oferta.denominacion_oferta || 'Sin denominación'}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: COLOR_TEXT_LIGHT
                      }}>
                        👤 {oferta.cliente_denominacion || 'Sin cliente'}
                      </div>
                    </div>
                  </div>

                  {/* Acciones - simplificado */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Selector de estado */}
                    <select
                      value={oferta.estado_oferta || 'generando'}
                      onChange={(e) => {
                        e.stopPropagation();
                        onCambiarEstado(oferta.id_oferta, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        backgroundColor: COLOR_BG,
                        minWidth: '150px'
                      }}
                    >
                      {ESTADOS_OFERTA.map(estado => (
                        <option key={estado.id} value={estado.id}>
                          {estado.icono} {estado.nombre}
                        </option>
                      ))}
                    </select>

                    {/* Botón editar */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrirOferta(oferta);
                      }}
                      style={{
                        padding: '10px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        backgroundColor: COLOR_CORP,
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer con info HubSpot */}
      <div style={{
        padding: '12px 32px',
        backgroundColor: COLOR_BG,
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>
          💡 Próximamente: Integración con HubSpot CRM
        </span>
        <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>
          {ofertas.length} ofertas en total
        </span>
      </div>
    </div>
  );
};

const PantallaInicio = ({ onSeleccionarModulo, oportunidadesGuardadas, onAbrirOportunidad }) => {
  // Módulos disponibles
  const modulos = [
    { 
      id: 'nueva_oportunidad', 
      nombre: 'Nueva Oferta', 
      icono: '➕', 
      descripcion: 'Crear nuevo estudio fotovoltaico',
      color: COLOR_CORP,
      activo: true
    },
    { 
      id: 'ofertas', 
      nombre: 'Proyectos', 
      icono: '📊', 
      descripcion: 'Pipeline de proyectos',
      color: COLOR_CORP_LIGHT,
      activo: true,
      badge: oportunidadesGuardadas.length > 0 ? oportunidadesGuardadas.length : null
    },
    { 
      id: 'contratos', 
      nombre: 'Contratos', 
      icono: '📝', 
      descripcion: 'Próximamente',
      color: '#14B8A6',
      activo: false
    },
    { 
      id: 'ingenieria', 
      nombre: 'Ingeniería', 
      icono: '🔧', 
      descripcion: 'Próximamente',
      color: '#F97316',
      activo: false
    },
    { 
      id: 'tramitacion', 
      nombre: 'Tramitación', 
      icono: '📑', 
      descripcion: 'Próximamente',
      color: '#8B5CF6',
      activo: false
    },
    { 
      id: 'mantenimiento', 
      nombre: 'Mantenimiento', 
      icono: '🛠️', 
      descripcion: 'Próximamente',
      color: '#10B981',
      activo: false
    },
    { 
      id: 'clientes', 
      nombre: 'Clientes', 
      icono: '👥', 
      descripcion: 'Próximamente',
      color: COLOR_INFO,
      activo: false
    },
  ];

  return (
    <div style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '50px 40px',
      backgroundColor: COLOR_BG_SECONDARY
    }}>
      {/* Título de bienvenida con estilo YLIO */}
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <div style={{ 
          display: 'inline-block',
          marginBottom: '20px'
        }}>
          <span style={{ 
            fontSize: '48px',
            display: 'block',
            marginBottom: '8px'
          }}>☀️</span>
        </div>
        <h1 style={{ 
          margin: '0 0 12px 0', 
          color: COLOR_CORP_DARK, 
          fontSize: '32px',
          fontWeight: '300',
          letterSpacing: '-0.5px'
        }}>
          Plataforma de Gestión Integral
        </h1>
        <p style={{ 
          margin: 0, 
          color: COLOR_TEXT_LIGHT, 
          fontSize: '15px' 
        }}>
          Selecciona una opción para comenzar
        </p>
      </div>
      
      {/* Grid de módulos */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 220px))',
        gap: '24px',
        justifyContent: 'center',
        maxWidth: '1000px',
        margin: '0 auto 50px auto'
      }}>
        {modulos.map((modulo) => (
          <button
            key={modulo.id}
            onClick={() => modulo.activo && onSeleccionarModulo(modulo.id)}
            disabled={!modulo.activo}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              backgroundColor: modulo.activo ? COLOR_BG : '#FAFAFA',
              border: modulo.activo ? `2px solid ${modulo.color}` : '2px solid #E8E8E8',
              borderRadius: '16px',
              cursor: modulo.activo ? 'pointer' : 'not-allowed',
              transition: 'all 0.25s ease',
              boxShadow: modulo.activo ? '0 4px 12px rgba(235,98,33,0.15)' : 'none',
              opacity: modulo.activo ? 1 : 0.5,
              minHeight: '170px',
              position: 'relative'
            }}
            onMouseOver={(e) => {
              if (modulo.activo) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(235,98,33,0.25)';
                e.currentTarget.style.borderColor = COLOR_CORP;
              }
            }}
            onMouseOut={(e) => {
              if (modulo.activo) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(235,98,33,0.15)';
                e.currentTarget.style.borderColor = modulo.color;
              }
            }}
          >
            {/* Badge de contador */}
            {modulo.badge && (
              <span style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: COLOR_CORP,
                color: 'white',
                fontSize: '12px',
                fontWeight: '700',
                padding: '4px 10px',
                borderRadius: '12px',
                minWidth: '24px',
                textAlign: 'center'
              }}>
                {modulo.badge}
              </span>
            )}
            <span style={{ 
              fontSize: '40px', 
              marginBottom: '12px',
              filter: modulo.activo ? 'none' : 'grayscale(100%)'
            }}>
              {modulo.icono}
            </span>
            <span style={{ 
              fontSize: '15px', 
              fontWeight: '600', 
              color: modulo.activo ? modulo.color : COLOR_TEXT_LIGHT,
              marginBottom: '6px'
            }}>
              {modulo.nombre}
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: COLOR_TEXT_LIGHT,
              textAlign: 'center'
            }}>
              {modulo.activo ? modulo.descripcion : 'Próximamente'}
            </span>
          </button>
        ))}
      </div>
      
      {/* Lista de oportunidades guardadas */}
      {oportunidadesGuardadas.length > 0 && (
        <div style={{ 
          maxWidth: '900px', 
          margin: '0 auto',
          width: '100%'
        }}>
          <h3 style={{ 
            color: COLOR_TEXT, 
            fontSize: '18px', 
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📋 Ofertas en curso
            <span style={{ 
              fontSize: '12px', 
              backgroundColor: COLOR_CORP,
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {oportunidadesGuardadas.length}
            </span>
          </h3>
          <div style={{ 
            backgroundColor: COLOR_BG, 
            borderRadius: '10px', 
            border: '1px solid #E5E5E5',
            overflow: 'hidden'
          }}>
            {oportunidadesGuardadas.map((opo, index) => (
              <div
                key={opo.id_oferta}
                onClick={() => onAbrirOportunidad(opo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '15px 20px',
                  borderBottom: index < oportunidadesGuardadas.length - 1 ? '1px solid #E5E5E5' : 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = COLOR_BG_SECONDARY}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '24px' }}>📋</span>
                  <div>
                    <div style={{ fontWeight: '600', color: COLOR_CORP, fontSize: '14px' }}>
                      {opo.id_oferta}
                    </div>
                    <div style={{ color: COLOR_TEXT, fontSize: '14px' }}>
                      {opo.denominacion_oferta || opo.cliente_nombre || 'Sin nombre'}
                    </div>
                    <div style={{ color: COLOR_TEXT_LIGHT, fontSize: '12px' }}>
                      {opo.ubicacion_municipio && opo.ubicacion_provincia 
                        ? `${opo.ubicacion_municipio}, ${opo.ubicacion_provincia}`
                        : 'Sin ubicación'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '11px', 
                    color: COLOR_TEXT_LIGHT,
                    marginBottom: '4px'
                  }}>
                    Paso {opo.pasoActual || 1} de 6
                  </div>
                  <button
                    style={{
                      padding: '6px 14px',
                      border: `1px solid ${COLOR_CORP}`,
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      color: COLOR_CORP,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// LISTA DE COMUNIDADES AUTÓNOMAS
// ============================================
const COMUNIDADES_AUTONOMAS = [
  "Andalucía",
  "Aragón",
  "Canarias",
  "Cantabria",
  "Castilla y León",
  "Castilla-La Mancha",
  "Cataluña",
  "Ceuta",
  "Comunidad de Madrid",
  "Comunidad Foral de Navarra",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "Islas Baleares",
  "La Rioja",
  "Melilla",
  "País Vasco",
  "Principado de Asturias",
  "Región de Murcia",
];

// ============================================
// PASO 1: DATOS DEL PROYECTO (CON VALIDADOR DE CONSUMOS)
// ============================================
const Paso1Proyecto = ({ datos, onChange }) => {
  // Estados para el validador de consumos
  const [mostrarValidador, setMostrarValidador] = useState(false);
  const [datosConsumoTemp, setDatosConsumoTemp] = useState([]);
  const [erroresConsumo, setErroresConsumo] = useState({ duplicados: [], huecos: [], negativos: [], outliers: [], filasInvalidas: [] });
  const [estadisticasConsumo, setEstadisticasConsumo] = useState(null);
  const [resumenMesesConsumo, setResumenMesesConsumo] = useState(null);
  const [analisisConsumo, setAnalisisConsumo] = useState(null);
  const [archivoConsumoTemp, setArchivoConsumoTemp] = useState('');
  const [formatoDetectado, setFormatoDetectado] = useState(null);

  const handleChange = (campo, valor) => {
    onChange({ ...datos, [campo]: valor });
  };

  // Estados para guardar los archivos originales (para descarga)
  const [archivoSIPSBlob, setArchivoSIPSBlob] = React.useState(null);
  const [archivoConsumoBlob, setArchivoConsumoBlob] = React.useState(null);

  // Parsear archivo SIPS y autorellenar campos
  const handleSIPSUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('=== INICIO CARGA SIPS ===');
    console.log('Archivo:', file.name, '| Tamaño:', file.size, 'bytes');
    
    // Guardar el archivo para poder descargarlo después
    setArchivoSIPSBlob(file);
    
    // Actualizar nombre del archivo inmediatamente
    onChange({ ...datos, archivo_sips: file.name });
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    try {
      let rows = [];
      
      if (extension === 'xlsx' || extension === 'xls') {
        console.log('Procesando como Excel...');
        try {
          // Intentar procesar con SheetJS
          const XLSX = await cargarSheetJS();
          if (!XLSX) {
            throw new Error('SheetJS no disponible');
          }
          console.log('SheetJS cargado');
          
          const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              console.log('FileReader completado');
              resolve(new Uint8Array(ev.target.result));
            };
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsArrayBuffer(file);
          });
          
          console.log('Datos leídos, parseando workbook...');
          const workbook = XLSX.read(data, { type: 'array' });
          console.log('Hojas:', workbook.SheetNames);
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true });
          console.log('Filas extraídas:', rows.length);
        } catch (xlsxError) {
          console.error('Error con SheetJS:', xlsxError.message);
          // Mostrar mensaje al usuario
          alert('⚠️ No se puede procesar archivos Excel en este entorno.\n\nPor favor, guarda el archivo SIPS como CSV:\n1. Abre el archivo en Excel\n2. Archivo → Guardar como\n3. Selecciona "CSV (delimitado por comas)"\n4. Sube el archivo .csv');
          return; // Salir sin procesar
        }
      } else {
        console.log('Procesando como CSV...');
        // Procesar CSV
        const contenido = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = () => reject(new Error('Error leyendo archivo'));
          reader.readAsText(file);
        });
        const lineas = contenido.split(/\r?\n/).filter(l => l.trim());
        const sep = lineas[0]?.includes(';') ? ';' : lineas[0]?.includes('\t') ? '\t' : ',';
        rows = lineas.map(l => l.split(sep).map(c => c.trim().replace(/^["']|["']$/g, '')));
        console.log('Líneas CSV:', rows.length);
      }
      
      console.log('SIPS rows:', rows.length);
      if (rows.length > 0) console.log('Fila 0:', rows[0]);
      if (rows.length > 1) console.log('Fila 1:', rows[1]);
      if (rows.length > 2) console.log('Fila 2:', rows[2]);
      
      // Detectar formato: El archivo SIPS tiene cabeceras en fila 2 (índice 1) y datos en fila 3 (índice 2)
      // La fila 1 (índice 0) suele tener el nombre del archivo
      let cabeceraIdx = 0;
      let datosIdx = 1;
      
      // Si la primera fila parece ser un título (una sola celda o pocas), buscar cabecera en fila 2
      if (rows[0] && rows[1]) {
        const celdasFila0 = rows[0].filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
        const celdasFila1 = rows[1].filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
        
        console.log('Celdas fila 0:', celdasFila0, '| Celdas fila 1:', celdasFila1);
        
        if (celdasFila0 < 5 && celdasFila1 > 5) {
          // Fila 0 es título, fila 1 es cabecera, fila 2 es datos
          cabeceraIdx = 1;
          datosIdx = 2;
        }
      }
      
      const cabecera = (rows[cabeceraIdx] || []).map(c => String(c || '').toLowerCase().trim());
      const datosFila = rows[datosIdx] || [];
      
      console.log('Cabecera detectada (fila ' + (cabeceraIdx + 1) + '):', cabecera.slice(0, 10));
      console.log('Datos detectados (fila ' + (datosIdx + 1) + '):', datosFila.slice(0, 10));
      
      // Función para buscar valor por nombre de columna
      const buscarValor = (nombres) => {
        for (const nombre of nombres) {
          const idx = cabecera.findIndex(c => c.includes(nombre.toLowerCase()));
          if (idx >= 0 && datosFila[idx] !== undefined && datosFila[idx] !== null) {
            return String(datosFila[idx]).trim();
          }
        }
        return '';
      };
      
      // Mapeo exacto basado en el archivo SIPS real
      const datosSIPS = {
        sips_cups: buscarValor(['cups']),
        sips_distribuidora: buscarValor(['nombre distribuidora', 'distribuidora']),
        sips_tarifa: buscarValor(['tarifa atr', 'tarifa']),
        sips_tension: buscarValor(['tension']),
        sips_potencia_max_bie: buscarValor(['potencia max bie', 'potmaxbie', 'pot max bie']),
        sips_derechos_extension: buscarValor(['valorderechosextensionkw', 'derechos extension', 'der_extension']),
        sips_derechos_acceso: buscarValor(['valorderechosaccesokw', 'derechos acceso', 'der_acceso']),
        sips_potencia_p1: buscarValor(['potencia contratada p1', 'pot_p1', 'potcontratadap1']),
        sips_potencia_p2: buscarValor(['potencia contratada p2', 'pot_p2', 'potcontratadap2']),
        sips_potencia_p3: buscarValor(['potencia contratada p3', 'pot_p3', 'potcontratadap3']),
        sips_potencia_p4: buscarValor(['potencia contratada p4', 'pot_p4', 'potcontratadap4']),
        sips_potencia_p5: buscarValor(['potencia contratada p5', 'pot_p5', 'potcontratadap5']),
        sips_potencia_p6: buscarValor(['potencia contratada p6', 'pot_p6', 'potcontratadap6']),
        sips_consumo_anual: buscarValor(['consumo anual kwh', 'consumo anual', 'consumoanual']),
        sips_consumo_p1: buscarValor(['consumo anual p1', 'consumo p1', 'consumop1']),
        sips_consumo_p2: buscarValor(['consumo anual p2', 'consumo p2', 'consumop2']),
        sips_consumo_p3: buscarValor(['consumo anual p3', 'consumo p3', 'consumop3']),
        sips_consumo_p4: buscarValor(['consumo anual p4', 'consumo p4', 'consumop4']),
        sips_consumo_p5: buscarValor(['consumo anual p5', 'consumo p5', 'consumop5']),
        sips_consumo_p6: buscarValor(['consumo anual p6', 'consumo p6', 'consumop6']),
        ubicacion_cp: buscarValor(['código postal ps', 'codigo postal ps', 'código postal', 'codigo postal', 'cp']),
        ubicacion_municipio: buscarValor(['municipio ps', 'municipio', 'localidad', 'poblacion']),
        cnae: buscarValor(['cnae']),
      };
      
      console.log('Datos SIPS extraídos:', datosSIPS);
      
      // Actualizar estado con los valores encontrados (sin sobrescribir si no hay valor)
      const nuevosDatos = {
        ...datos,
        archivo_sips: file.name,
      };
      
      // Solo actualizar campos que tienen valor
      if (datosSIPS.ubicacion_cp) nuevosDatos.ubicacion_cp = datosSIPS.ubicacion_cp;
      if (datosSIPS.ubicacion_municipio) nuevosDatos.ubicacion_municipio = datosSIPS.ubicacion_municipio;
      if (datosSIPS.cnae) nuevosDatos.cnae = datosSIPS.cnae;
      
      // Añadir todos los campos sips_ que tienen valor
      Object.entries(datosSIPS).forEach(([key, value]) => {
        if (key.startsWith('sips_') && value) {
          nuevosDatos[key] = value;
        }
      });
      
      console.log('Actualizando datos:', Object.keys(nuevosDatos).filter(k => nuevosDatos[k]));
      onChange(nuevosDatos);
      console.log('=== FIN CARGA SIPS ===');
      
      // ====== GUARDAR EN SUPABASE ======
      const ofertaId = datos.id_oferta || nuevosDatos.id_oferta;
      if (ofertaId) {
        console.log('💾 Guardando SIPS en Supabase...');
        const resSips = await guardarDatosSIPS(ofertaId, nuevosDatos);
        if (resSips.success) {
          console.log('✅ Datos SIPS guardados en BD');
        }
      }
      
    } catch (err) {
      console.error('Error procesando SIPS:', err);
      alert('Error procesando archivo SIPS: ' + err.message);
    }
  };
  
  // Función para descargar el archivo SIPS
  const descargarArchivoSIPS = () => {
    if (archivoSIPSBlob) {
      const url = URL.createObjectURL(archivoSIPSBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = datos.archivo_sips || 'archivo_sips';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
  
  // Función para descargar el archivo de consumo
  const descargarArchivoConsumo = () => {
    if (archivoConsumoBlob) {
      const url = URL.createObjectURL(archivoConsumoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = datos.archivo_consumo || 'archivo_consumo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // Cargar archivo de consumo - SOPORTA CSV Y EXCEL
  const handleConsumoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoConsumoTemp(file.name);
      setArchivoConsumoBlob(file); // Guardar para descarga
      const extension = file.name.split('.').pop().toLowerCase();
      console.log('=== INICIO CARGA ARCHIVO ===');
      console.log('Archivo:', file.name, '| Tamaño:', file.size, 'bytes | Extensión:', extension);
      
      try {
        let contenido;
        
        if (extension === 'csv' || extension === 'txt') {
          console.log('Leyendo como CSV/TXT...');
          contenido = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsText(file);
          });
        } else if (extension === 'xlsx' || extension === 'xls') {
          console.log('Leyendo como Excel...');
          try {
            contenido = await leerArchivoExcel(file);
            console.log('Excel leído correctamente');
          } catch (excelError) {
            console.error('Error leyendo Excel:', excelError);
            console.log('Intentando como XML/texto...');
            contenido = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => resolve(event.target.result);
              reader.onerror = () => reject(excelError);
              reader.readAsText(file);
            });
          }
        } else {
          throw new Error('Formato no soportado. Use CSV o Excel.');
        }
        
        console.log('Contenido obtenido, longitud:', contenido?.length || 0);
        console.log('Primeros 300 chars:', contenido?.substring(0, 300));
        
        const { datos: datosParseados, formato, cabecera } = parsearCSVConsumo(contenido);
        console.log('Datos parseados:', datosParseados.length, 'registros');
        console.log('Formato detectado:', formato);
        console.log('Cabecera:', cabecera);
        
        if (datosParseados.length > 0) {
          console.log('Ejemplo primer registro:', datosParseados[0]);
          console.log('Ejemplo último registro:', datosParseados[datosParseados.length - 1]);
        }
        
        if (datosParseados.length === 0) {
          throw new Error('No se encontraron datos válidos en el archivo. Verifica el formato.');
        }
        
        const { errores, estadisticas, resumenMeses, analisis } = validarDatosConsumo(datosParseados);
        console.log('Validación completada:', estadisticas);
        console.log('Resumen meses:', resumenMeses?.length, 'meses detectados');
        
        // Guardar los datos BRUTOS inmediatamente (nuevo archivo = nuevos brutos)
        onChange({
          ...datos,
          archivo_consumo: file.name,
          consumos_horarios_bruto: datosParseados, // Datos brutos originales
          // Limpiar datos procesados anteriores (se regenerarán al aceptar)
          consumos_horarios: null,
          consumos_estadisticas: null
        });
        
        setDatosConsumoTemp(datosParseados);
        setErroresConsumo(errores);
        setEstadisticasConsumo(estadisticas);
        setResumenMesesConsumo(resumenMeses);
        setAnalisisConsumo(analisis);
        setFormatoDetectado(formato); // Guardar formato detectado
        setMostrarValidador(true);
        console.log('=== FIN CARGA ARCHIVO (ÉXITO) ===');
        
        // ====== GUARDAR BRUTOS EN SUPABASE ======
        const ofertaId = datos.id_oferta;
        if (ofertaId) {
          console.log('💾 Guardando consumos brutos en Supabase...');
          const resBrutos = await guardarConsumosBrutos(ofertaId, datosParseados);
          if (resBrutos.success) {
            console.log(`✅ ${resBrutos.count} consumos brutos guardados en BD`);
          }
        }
        
      } catch (error) {
        console.error('=== ERROR CARGA ARCHIVO ===', error);
        alert('Error al procesar el archivo: ' + error.message + '\n\nFormatos soportados:\n• Curva de Carga (Date;Active)\n• Distribuidora (CUPS, Fecha, Hora, AE_kWh)\n• Formato YLIO (fecha;hora;consumo)');
      }
    }
  };

  // Cuando el usuario acepta los datos del validador
  const handleAceptarConsumo = async (datosFinales) => {
    // Ordenar cronológicamente antes de guardar
    const datosOrdenados = [...datosFinales].sort((a, b) => {
      const fechaA = a.fechaOriginal || a.fecha;
      const fechaB = b.fechaOriginal || b.fecha;
      const cmpFecha = fechaA.localeCompare(fechaB);
      return cmpFecha !== 0 ? cmpFecha : a.hora - b.hora;
    });
    
    const fechaInicio = datosOrdenados[0]?.fechaOriginal || datosOrdenados[0]?.fecha;
    const fechaFin = datosOrdenados[datosOrdenados.length - 1]?.fechaOriginal || datosOrdenados[datosOrdenados.length - 1]?.fecha;
    const consumoTotal = datosOrdenados.reduce((s, d) => s + d.consumo, 0);
    
    // Guardar datos brutos si no existen ya (solo la primera vez que se carga el archivo)
    const datosBrutos = datos.consumos_horarios_bruto || datosConsumoTemp;
    
    // Actualizar estado local
    const nuevosDatos = {
      ...datos,
      archivo_consumo: archivoConsumoTemp,
      consumos_horarios_bruto: datosBrutos,
      consumos_horarios: datosOrdenados,
      consumos_estadisticas: {
        totalRegistros: datosOrdenados.length,
        consumoTotal: consumoTotal.toFixed(2),
        consumoMedia: (consumoTotal / datosOrdenados.length).toFixed(4),
        fechaInicio,
        fechaFin,
        registrosBrutos: datosBrutos.length
      }
    };
    
    onChange(nuevosDatos);
    setMostrarValidador(false);
    
    // ====== GUARDAR EN SUPABASE ======
    const ofertaId = datos.id_oferta;
    if (ofertaId) {
      console.log('💾 Guardando consumos en Supabase...');
      
      // Guardar consumos brutos (si es la primera vez)
      if (!datos.consumos_horarios_bruto) {
        const resBrutos = await guardarConsumosBrutos(ofertaId, datosBrutos);
        if (resBrutos.success) {
          console.log(`✅ ${resBrutos.count} consumos brutos guardados en BD`);
        }
      }
      
      // Guardar consumos procesados (siempre sobrescribe)
      const resProcesados = await guardarConsumosProcesados(ofertaId, datosOrdenados);
      if (resProcesados.success) {
        console.log(`✅ ${resProcesados.count} consumos procesados guardados en BD`);
      }
    } else {
      console.warn('⚠️ No se puede guardar en BD: falta ID de oferta');
    }
  };

  // Función para aplicar correcciones
  const handleCorregirConsumo = (opciones) => {
    return limpiarDatosConsumo(datosConsumoTemp, erroresConsumo, opciones, resumenMesesConsumo);
  };

  const InputField = ({ label, campo, tipo = 'text', placeholder, width = '100%', opcional = false, desdeSIPS = false }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
        {label}
        {opcional && <span style={{ color: COLOR_TEXT_LIGHT, fontWeight: '400' }}>(Opcional)</span>}
      </label>
      <input type={tipo} value={datos[campo] || ''} onChange={(e) => handleChange(campo, e.target.value)} placeholder={placeholder}
        style={{ width, padding: '10px 14px', border: desdeSIPS && datos[campo] ? `2px solid #4CAF50` : '1px solid #DEE2E6', borderRadius: '8px', fontSize: '14px', backgroundColor: desdeSIPS && datos[campo] ? '#F1F8E9' : 'white', transition: 'all 0.2s', outline: 'none', boxSizing: 'border-box' }}
        onFocus={(e) => e.target.style.borderColor = COLOR_CORP}
        onBlur={(e) => e.target.style.borderColor = desdeSIPS && datos[campo] ? '#4CAF50' : '#DEE2E6'}
      />
    </div>
  );

  const SelectField = ({ label, campo, opciones, opcional = false }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
        {label}
        {opcional && <span style={{ color: COLOR_TEXT_LIGHT, fontWeight: '400', marginLeft: '6px' }}>(Opcional)</span>}
      </label>
      <select value={datos[campo] || ''} onChange={(e) => handleChange(campo, e.target.value)}
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #DEE2E6', borderRadius: '8px', fontSize: '14px', backgroundColor: 'white', cursor: 'pointer', boxSizing: 'border-box' }}>
        <option value="">Seleccionar...</option>
        {opciones.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
    </div>
  );

  const SectionTitle = ({ children }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '28px', marginBottom: '18px' }}>
      <span style={{ fontSize: '15px', fontWeight: '600', color: COLOR_CORP }}>{children}</span>
      <div style={{ flex: 1, height: '2px', backgroundColor: COLOR_CORP_LIGHT, marginLeft: '15px' }} />
    </div>
  );

  const FileUploadBox = ({ label, descripcion, archivo, onUpload, accept, tipo, estadisticas, onDownload, onVerDatos, tieneDatos }) => (
    <div style={{ border: `2px dashed ${archivo ? COLOR_SUCCESS : '#DEE2E6'}`, borderRadius: '10px', padding: '20px', textAlign: 'center', backgroundColor: archivo ? `${COLOR_SUCCESS}10` : COLOR_BG_SECONDARY, transition: 'all 0.3s' }}>
      <input type="file" accept={accept} onChange={onUpload} style={{ display: 'none' }} id={`file-${tipo}`} />
      {/* Si tiene datos guardados, al hacer clic entra a ver el análisis */}
      {tieneDatos ? (
        <div 
          onClick={onVerDatos}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}>✅</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: COLOR_SUCCESS, display: 'block', marginBottom: '4px' }}>{archivo || 'Datos cargados'}</span>
          <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Click para ver análisis</span>
        </div>
      ) : (
        <label htmlFor={`file-${tipo}`} style={{ cursor: 'pointer', display: 'block' }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}>{archivo ? '✅' : '📁'}</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: archivo ? COLOR_SUCCESS : COLOR_TEXT, display: 'block', marginBottom: '4px' }}>{archivo || label}</span>
          <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>{archivo ? 'Click para cambiar archivo' : descripcion}</span>
        </label>
      )}
      {archivo && onDownload && !tieneDatos && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDownload(); }}
          style={{
            marginTop: '10px',
            padding: '6px 12px',
            backgroundColor: 'white',
            border: '1px solid #4CAF50',
            borderRadius: '4px',
            color: '#4CAF50',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          📥 Descargar archivo
        </button>
      )}
      {estadisticas && (
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#E8F5E9', borderRadius: '6px', fontSize: '11px', color: '#2E7D32' }}>
          <strong>{estadisticas.totalRegistros}</strong> registros | <strong>{parseFloat(estadisticas.consumoTotal).toLocaleString()}</strong> kWh total
        </div>
      )}
    </div>
  );

  const ResumenSIPS = () => {
    if (!datos.archivo_sips) return null;
    
    // Función para descargar SIPS como CSV
    const descargarSIPScsv = () => {
      if (!archivoSIPSBlob) return;
      const url = URL.createObjectURL(archivoSIPSBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = datos.archivo_sips.replace(/\.[^.]+$/, '.csv') || 'sips.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
    
    // Función para cambiar archivo SIPS
    const cambiarArchivoSIPS = () => {
      document.getElementById('file-sips').click();
    };
    
    return (
      <div style={{ backgroundColor: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '12px 16px', marginTop: '12px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontWeight: '600', color: '#2E7D32', display: 'flex', alignItems: 'center', gap: '6px' }}>✅ Datos cargados desde SIPS</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {archivoSIPSBlob && (
              <button onClick={descargarSIPScsv} style={{ padding: '4px 10px', backgroundColor: '#17A2B8', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>📄 CSV</button>
            )}
            <button onClick={cambiarArchivoSIPS} style={{ padding: '4px 10px', backgroundColor: COLOR_WARNING, color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>🔄 Cambiar</button>
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#558B2F', marginBottom: '8px' }}>📁 {datos.archivo_sips}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', color: '#1B5E20' }}>
          <span>CP: {datos.ubicacion_cp || '-'}</span>
          <span>Municipio: {datos.ubicacion_municipio || '-'}</span>
          <span>CNAE: {datos.cnae || '-'}</span>
        </div>
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #A5D6A7', color: '#2E7D32' }}>
          <strong>Datos adicionales para Paso 2 (Tarifa):</strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
            <span>CUPS: {datos.sips_cups || '-'}</span>
            <span>Distribuidora: {datos.sips_distribuidora?.substring(0, 25) || '-'}...</span>
            <span>Tarifa: {datos.sips_tarifa || '-'}</span>
            <span>Tensión: {datos.sips_tension || '-'}</span>
            <span>Consumo anual: {datos.sips_consumo_anual?.toLocaleString() || '-'} kWh</span>
            <span>Potencias: P1-P5={datos.sips_potencia_p1}kW, P6={datos.sips_potencia_p6}kW</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h2 style={{ margin: '0 0 8px 0', color: COLOR_TEXT, fontSize: '22px' }}>📋 Datos del Proyecto</h2>
      <p style={{ margin: '0 0 20px 0', color: COLOR_TEXT_LIGHT, fontSize: '14px' }}>Información del proyecto, cliente y ubicación de la instalación</p>

      {/* Input oculto para cambiar archivo de consumo cuando hay datos guardados */}
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleConsumoUpload} style={{ display: 'none' }} id="file-consumo-hidden" />

      <SectionTitle>Carga de Archivos</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <FileUploadBox label="Archivo SIPS" descripcion="Cargar datos SIPS (.csv, .xlsx)" archivo={datos.archivo_sips} onUpload={handleSIPSUpload} accept=".csv,.xlsx,.xls" tipo="sips" onDownload={archivoSIPSBlob ? descargarArchivoSIPS : null} />
        <div>
          {/* Selector de fuente de datos - PRIMERO */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '4px' }}>
              Fuente de datos de consumo
            </label>
            <select
              value={datos.fuente_datos_consumo || ''}
              onChange={(e) => handleChange('fuente_datos_consumo', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #DEE2E6',
                borderRadius: '6px',
                fontSize: '13px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="">Seleccionar fuente...</option>
              <option value="real_distribuidora">Consumo Real - Distribuidora</option>
              <option value="real_monitorizacion">Consumo Real - Monitorización</option>
              <option value="curva_perfilada">Consumo Curva Perfilada</option>
              <option value="simulado">Consumo Simulado</option>
            </select>
          </div>
          
          {/* Archivo de consumo - Solo mostrar FileUploadBox si NO hay datos (ni brutos ni procesados) */}
          {(!datos.consumos_horarios_bruto || datos.consumos_horarios_bruto.length === 0) && (!datos.consumos_horarios || datos.consumos_horarios.length === 0) ? (
            <>
              <FileUploadBox 
                label="Archivo de Consumo" 
                descripcion="Curva de consumo horario (.csv, .xlsx)" 
                archivo={datos.archivo_consumo} 
                onUpload={handleConsumoUpload} 
                accept=".csv,.xlsx,.xls" 
                tipo="consumo" 
                estadisticas={datos.consumos_estadisticas} 
                onDownload={archivoConsumoBlob ? descargarArchivoConsumo : null} 
              />
              <button 
                onClick={() => {
                  // Generar plantilla CSV con formato español DD/MM/YYYY
                  const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                  let csv = 'fecha;hora;consumo\n';
                  for (let mes = 0; mes < 12; mes++) {
                    for (let dia = 1; dia <= diasPorMes[mes]; dia++) {
                      for (let hora = 0; hora < 24; hora++) {
                        const fecha = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/2024`;
                        csv += `${fecha};${hora};\n`;
                      }
                    }
                  }
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'Plantilla_Consumo_YLIO.csv';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                style={{ 
                  marginTop: '8px', 
                  padding: '6px 12px', 
                  fontSize: '11px', 
                  color: COLOR_CORP, 
                  backgroundColor: 'white', 
                  border: `1px solid ${COLOR_CORP}`, 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📥 Descargar plantilla CSV (8760 horas)
              </button>
            </>
          ) : (
            /* Si hay datos guardados, mostrar resumen compacto */
            <div 
              style={{ 
                border: `2px solid ${datos.consumos_horarios?.length > 0 ? COLOR_SUCCESS : '#FF9800'}`, 
                borderRadius: '10px', 
                padding: '16px', 
                backgroundColor: datos.consumos_horarios?.length > 0 ? '#E8F5E9' : '#FFF8E1',
                cursor: 'pointer'
              }}
              onClick={() => {
                // SIEMPRE cargar los datos BRUTOS para poder re-seleccionar años y re-transformar
                const datosBrutos = datos.consumos_horarios_bruto || datos.consumos_horarios;
                
                setDatosConsumoTemp(datosBrutos);
                setArchivoConsumoTemp(datos.archivo_consumo || 'Datos guardados');
                
                // Regenerar resumen de meses y errores desde los datos BRUTOS
                const { errores, estadisticas, resumenMeses, analisis } = validarDatosConsumo(datosBrutos);
                setErroresConsumo(errores);
                setEstadisticasConsumo(estadisticas);
                setResumenMesesConsumo(resumenMeses);
                setAnalisisConsumo(analisis);
                
                // Abrir el validador
                setMostrarValidador(true);
                // Scroll al validador
                setTimeout(() => {
                  const elemento = document.getElementById('validador-consumo');
                  if (elemento) elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{datos.consumos_horarios?.length > 0 ? '✅' : '⏳'}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: datos.consumos_horarios?.length > 0 ? COLOR_SUCCESS : '#E65100' }}>
                      {datos.archivo_consumo || 'Curva de consumo cargada'}
                    </div>
                    <div style={{ fontSize: '11px', color: datos.consumos_horarios?.length > 0 ? '#558B2F' : '#795548' }}>
                      <span style={{ marginRight: '10px' }}>📁 Brutos: {(datos.consumos_horarios_bruto?.length || 0).toLocaleString()}</span>
                      {datos.consumos_horarios?.length > 0 ? (
                        <span>✅ Procesados: {datos.consumos_horarios.length.toLocaleString()} ({datos.consumos_estadisticas?.consumoTotal ? parseFloat(datos.consumos_estadisticas.consumoTotal).toLocaleString() : '0'} kWh)</span>
                      ) : (
                        <span style={{ color: '#E65100' }}>⚠️ Pendiente de procesar</span>
                      )}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: datos.consumos_horarios?.length > 0 ? COLOR_SUCCESS : '#E65100' }}>📊 Ver/Editar análisis →</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Resumen de Consumo Guardado */}
      {datos.consumos_horarios && datos.consumos_horarios.length > 0 && (
        <div id="resumen-consumo-guardado">
          <ResumenConsumoGuardado 
            consumos={datos.consumos_horarios} 
            estadisticas={datos.consumos_estadisticas}
            onCambiarArchivo={() => document.getElementById('file-consumo-hidden').click()}
            onEditarAnalisis={() => {
              // Cargar datos BRUTOS y abrir el validador
              const datosBrutos = datos.consumos_horarios_bruto || datos.consumos_horarios;
              setDatosConsumoTemp(datosBrutos);
              setArchivoConsumoTemp(datos.archivo_consumo || 'Datos guardados');
              const { errores, estadisticas, resumenMeses, analisis } = validarDatosConsumo(datosBrutos);
              setErroresConsumo(errores);
              setEstadisticasConsumo(estadisticas);
              setResumenMesesConsumo(resumenMeses);
              setAnalisisConsumo(analisis);
              setMostrarValidador(true);
              setTimeout(() => {
                const elemento = document.getElementById('validador-consumo');
                if (elemento) elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
          />
        </div>
      )}
      
      <ResumenSIPS />

      <SectionTitle>Identificación del Proyecto</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <InputField label="ID de la Oferta" campo="id_oferta" placeholder="OFE_2024_001" />
        <InputField label="Denominación de la Oferta" campo="denominacion_oferta" placeholder="Nombre descriptivo del proyecto" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        <InputField label="Versión" campo="version" placeholder="1.0" />
        <InputField label="Descripción de la Versión" campo="descripcion_version" placeholder="Versión inicial, revisión..." />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <InputField label="Fecha Solicitud Oferta" campo="fecha_solicitud" tipo="date" />
        <InputField label="Fecha Inicio Oferta" campo="fecha_inicio" tipo="date" />
      </div>

      <SectionTitle>Datos del Cliente</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <InputField label="Denominación del Cliente" campo="cliente_denominacion" placeholder="Nombre comercial o descriptivo del cliente" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <InputField label="Nombre / Razón Social" campo="cliente_nombre" placeholder="Empresa S.L." />
        <InputField label="CIF / NIF" campo="cliente_cif" placeholder="B12345678" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <InputField label="CNAE" campo="cnae" placeholder="4634" opcional desdeSIPS />
      </div>

      <SectionTitle>Ubicación del Proyecto</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <InputField label="Dirección" campo="ubicacion_direccion" placeholder="Calle, número, nave..." />
        <InputField label="Código Postal" campo="ubicacion_cp" placeholder="41018" desdeSIPS />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <InputField label="Municipio" campo="ubicacion_municipio" placeholder="Sevilla" desdeSIPS />
        <InputField label="Provincia" campo="ubicacion_provincia" placeholder="Sevilla" />
        <SelectField label="Comunidad Autónoma" campo="ubicacion_comunidad" opciones={COMUNIDADES_AUTONOMAS.map(ca => ({ value: ca, label: ca }))} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <InputField label="Latitud" campo="ubicacion_latitud" placeholder="37.3891°" />
        <InputField label="Longitud" campo="ubicacion_longitud" placeholder="-5.9845°" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <InputField label="Coordenada X" campo="coordenada_x" placeholder="234567.89" />
        <InputField label="Coordenada Y" campo="coordenada_y" placeholder="4123456.78" />
        <InputField label="Huso" campo="huso" placeholder="30" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <InputField label="Referencia Catastral" campo="referencia_catastral" placeholder="1234567AB1234C0001XX" opcional />
      </div>

      {/* Modal del Validador de Consumos */}
      {mostrarValidador && (
        <div id="validador-consumo">
          <ValidadorConsumos
            archivo={archivoConsumoTemp}
            datosOriginales={datosConsumoTemp}
            errores={erroresConsumo}
            estadisticas={estadisticasConsumo}
            resumenMeses={resumenMesesConsumo}
            analisis={analisisConsumo}
            formatoDetectado={formatoDetectado}
            onAceptar={handleAceptarConsumo}
            onCancelar={() => setMostrarValidador(false)}
            onCorregir={handleCorregirConsumo}
          />
        </div>
      )}
    </div>
  );
};

// ============================================
// PASO 2: TARIFA Y PRECIOS
// ============================================
const Paso2Tarifa = ({ datos, onChange }) => {
  const handleChange = (campo, valor) => {
    onChange({ ...datos, [campo]: valor });
  };

  // Función para obtener valor: primero el campo directo, luego el SIPS
  const getValor = (campo, campoSips) => {
    if (datos[campo] !== undefined && datos[campo] !== '') return datos[campo];
    if (campoSips && datos[campoSips] !== undefined) return datos[campoSips];
    return '';
  };

  // Determinar número de periodos según tarifa
  const getNumPeriodos = () => {
    const tarifa = datos.tarifa_acceso || datos.sips_tarifa || '';
    if (tarifa.startsWith('2.0')) return 2;
    if (tarifa.startsWith('3.0')) return 3;
    if (tarifa.startsWith('6.')) return 6;
    return 6; // Por defecto mostrar todos
  };

  const numPeriodos = getNumPeriodos();

  // Componentes de formulario con soporte para autorellenado SIPS
  const InputField = ({ label, campo, campoSips, tipo = 'text', placeholder, unidad, desdeSIPS = false }) => {
    const valorSips = campoSips ? datos[campoSips] : null;
    const valor = datos[campo] !== undefined && datos[campo] !== '' ? datos[campo] : (valorSips ?? '');
    const tieneValorSips = valorSips !== undefined && valorSips !== null && valorSips !== '';
    
    return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ 
        display: 'block', 
        fontSize: '13px', 
        fontWeight: '500',
        color: COLOR_TEXT,
        marginBottom: '6px'
      }}>
        {label}
        {tieneValorSips && (
          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>
            (SIPS)
          </span>
        )}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type={tipo}
          value={valor}
          onChange={(e) => handleChange(campo, e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: (desdeSIPS || tieneValorSips) && valor ? '2px solid #4CAF50' : '1px solid #DEE2E6',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: (desdeSIPS || tieneValorSips) && valor ? '#F1F8E9' : 'white',
            transition: 'all 0.2s',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {unidad && (
          <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>{unidad}</span>
        )}
      </div>
    </div>
  )};

  const SelectField = ({ label, campo, campoSips, opciones, desdeSIPS = false }) => {
    const valorSips = campoSips ? datos[campoSips] : null;
    const valor = datos[campo] !== undefined && datos[campo] !== '' ? datos[campo] : (valorSips ?? '');
    const tieneValorSips = valorSips !== undefined && valorSips !== null && valorSips !== '';
    
    return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ 
        display: 'block', 
        fontSize: '13px', 
        fontWeight: '500',
        color: COLOR_TEXT,
        marginBottom: '6px'
      }}>
        {label}
        {tieneValorSips && (
          <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>
            (SIPS)
          </span>
        )}
      </label>
      <select
        value={valor}
        onChange={(e) => handleChange(campo, e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: (desdeSIPS || tieneValorSips) && valor ? '2px solid #4CAF50' : '1px solid #DEE2E6',
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: (desdeSIPS || tieneValorSips) && valor ? '#F1F8E9' : 'white',
          cursor: 'pointer',
          boxSizing: 'border-box'
        }}
      >
        <option value="">Seleccionar...</option>
        {opciones.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
    </div>
  )};

  const SectionTitle = ({ children }) => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      marginTop: '28px', 
      marginBottom: '18px' 
    }}>
      <span style={{ 
        fontSize: '15px', 
        fontWeight: '600', 
        color: COLOR_CORP 
      }}>
        {children}
      </span>
      <div style={{ 
        flex: 1, 
        height: '2px', 
        backgroundColor: COLOR_CORP_LIGHT, 
        marginLeft: '15px' 
      }} />
    </div>
  );

  // Tabla de potencias contratadas
  const TablaPotencias = () => {
    const periodos = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].slice(0, numPeriodos);
    
    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${numPeriodos}, 1fr)`, 
        gap: '12px',
        marginBottom: '16px'
      }}>
        {periodos.map((p, i) => {
          const campoSips = `sips_potencia_p${i + 1}`;
          const campo = `potencia_p${i + 1}`;
          const valorSips = datos[campoSips];
          const valor = datos[campo] || valorSips || '';
          
          return (
            <div key={p}>
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                fontWeight: '600',
                color: COLOR_CORP,
                marginBottom: '6px',
                textAlign: 'center'
              }}>
                {p}
              </label>
              <input
                type="number"
                step="0.1"
                value={valor}
                onChange={(e) => handleChange(campo, e.target.value)}
                placeholder="0.0"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: valorSips ? '2px solid #4CAF50' : '1px solid #DEE2E6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  textAlign: 'center',
                  backgroundColor: valorSips ? '#F1F8E9' : 'white',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ 
                display: 'block', 
                fontSize: '11px', 
                color: COLOR_TEXT_LIGHT, 
                textAlign: 'center',
                marginTop: '4px'
              }}>
                kW
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Tabla de precios energía

  // Resumen datos SIPS disponibles para este paso
  const ResumenSIPSTarifa = () => {
    if (!datos.sips_cups) return null;
    
    return (
      <div style={{
        backgroundColor: '#E8F5E9',
        border: '1px solid #A5D6A7',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        fontSize: '12px'
      }}>
        <div style={{ fontWeight: '600', color: '#2E7D32', marginBottom: '6px' }}>
          ✅ Datos precargados desde SIPS (editables)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', color: '#1B5E20' }}>
          <span>CUPS: {datos.sips_cups}</span>
          <span>Tarifa: {datos.sips_tarifa || '-'}</span>
          <span>Distribuidora: {datos.sips_distribuidora?.substring(0, 20) || '-'}...</span>
        </div>
        {(datos.sips_potencia_max_bie || datos.sips_derechos_extension || datos.sips_derechos_acceso) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', color: '#1B5E20', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #A5D6A7' }}>
            <span>BIE: {datos.sips_potencia_max_bie || '-'} kW</span>
            <span>D. Extensión: {datos.sips_derechos_extension || '-'} kW</span>
            <span>D. Acceso: {datos.sips_derechos_acceso || '-'} kW</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h2 style={{ margin: '0 0 8px 0', color: COLOR_TEXT, fontSize: '22px' }}>
        💰 Tarifa Eléctrica y Precios
      </h2>
      <p style={{ margin: '0 0 20px 0', color: COLOR_TEXT_LIGHT, fontSize: '14px' }}>
        Configuración de tarifa de acceso, potencias y precios de energía
      </p>

      <ResumenSIPSTarifa />

      {/* DATOS DEL PUNTO DE SUMINISTRO */}
      <SectionTitle>Datos del Punto de Suministro</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
        <InputField 
          label="CUPS" 
          campo="cups" 
          campoSips="sips_cups"
          placeholder="ES0021000010394508XT"
        />
        <SelectField 
          label="Tarifa de Acceso" 
          campo="tarifa_acceso"
          campoSips="sips_tarifa"
          opciones={[
            { value: '2.0TD', label: '2.0TD' },
            { value: '3.0TD', label: '3.0TD' },
            { value: '6.1TD', label: '6.1TD' },
            { value: '6.2TD', label: '6.2TD' },
            { value: '6.3TD', label: '6.3TD' },
            { value: '6.4TD', label: '6.4TD' },
          ]}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
        <InputField 
          label="Distribuidora" 
          campo="distribuidora" 
          campoSips="sips_distribuidora"
          placeholder="Nombre distribuidora"
        />
        <InputField 
          label="Comercializadora" 
          campo="comercializadora" 
          placeholder="Nombre comercializadora"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '16px' }}>
        <InputField 
          label="Tensión" 
          campo="tension" 
          campoSips="sips_tension"
          placeholder="3X400/230"
          unidad="V"
        />
        <InputField 
          label="Potencia Máxima BIE" 
          campo="potencia_max_bie" 
          campoSips="sips_potencia_max_bie"
          tipo="number"
          placeholder="0"
          unidad="kW"
        />
        <InputField 
          label="Derecho de Extensión" 
          campo="derechos_extension" 
          campoSips="sips_derechos_extension"
          tipo="number"
          placeholder="0"
          unidad="kW"
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        <InputField 
          label="Derecho de Acceso" 
          campo="derechos_acceso" 
          campoSips="sips_derechos_acceso"
          tipo="number"
          placeholder="0"
          unidad="kW"
        />
      </div>

      {/* POTENCIAS CONTRATADAS Y PRECIOS */}
      <SectionTitle>Potencias Contratadas</SectionTitle>
      {(() => {
        const tarifa = datos.tarifa_acceso || datos.sips_tarifa || '';
        const es2TD = tarifa === '2.0TD';
        const es3TD = tarifa === '3.0TD';
        const es6TD = tarifa.startsWith('6.');
        
        // Determinar cuántos periodos mostrar
        let numPeriodosPot = 6; // Por defecto todos
        if (es2TD) numPeriodosPot = 2;
        else if (es3TD) numPeriodosPot = 3;
        
        const periodos = Array.from({ length: numPeriodosPot }, (_, i) => i + 1);
        
        // Máximo 3 columnas para evitar desbordamiento
        const columnas = Math.min(numPeriodosPot, 3);
        
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: '16px' }}>
            {periodos.map(p => (
              <InputField 
                key={`pot_${p}`}
                label={`Potencia P${p}`}
                campo={`potencia_p${p}`}
                campoSips={`sips_potencia_p${p}`}
                tipo="number"
                placeholder="0"
                unidad="kW"
              />
            ))}
          </div>
        );
      })()}

      {/* PRECIOS POTENCIA - justo después de potencias contratadas */}
      <SectionTitle>Precios Potencia</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '16px' }}>
        <SelectField 
          label="Tipo de Precios Potencia" 
          campo="tipo_precios_potencia"
          opciones={[
            { value: 'factura_cliente', label: 'Factura Cliente' },
            { value: 'regulados', label: 'Precios Regulados' },
          ]}
        />
      </div>
      {(() => {
        const tarifa = datos.tarifa_acceso || datos.sips_tarifa || '';
        const es2TD = tarifa === '2.0TD';
        const es3TD = tarifa === '3.0TD';
        
        let numPeriodosPrecio = 6;
        if (es2TD) numPeriodosPrecio = 2;
        else if (es3TD) numPeriodosPrecio = 3;
        
        const periodos = Array.from({ length: numPeriodosPrecio }, (_, i) => i + 1);
        
        // Máximo 3 columnas para evitar desbordamiento
        const columnas = Math.min(numPeriodosPrecio, 3);
        
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: '16px' }}>
            {periodos.map(p => (
              <InputField 
                key={`precio_pot_${p}`}
                label={`Precio P${p}`}
                campo={`precio_potencia_p${p}`}
                tipo="number"
                placeholder="0.000000"
                unidad="€/kW·año"
              />
            ))}
          </div>
        );
      })()}

      {/* TIPO DE CONTRATO */}
      <SectionTitle>Tipo de Contrato</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <SelectField 
          label="Tipo de Contrato" 
          campo="tipo_contrato"
          opciones={[
            { value: 'indexado', label: 'Indexado' },
            { value: 'fijo', label: 'Fijo' },
          ]}
        />
      </div>

      {/* PRECIOS FIJOS ENERGÍA - Solo si contrato fijo */}
      {datos.tipo_contrato === 'fijo' && (
        <>
          <SectionTitle>Precios Fijos Energía</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '16px' }}>
            <SelectField 
              label="Tipo de Precios Energía" 
              campo="tipo_precios_energia"
              opciones={[
                { value: 'sin_peajes', label: 'Sin peajes y cargos' },
                { value: 'con_peajes', label: 'Con peajes y cargos' },
              ]}
            />
          </div>
          {/* Tabla de precios energía según tarifa */}
          {(() => {
            const tarifa = datos.tarifa_acceso || datos.sips_tarifa || '';
            const es2TD = tarifa === '2.0TD';
            const es3TD = tarifa === '3.0TD';
            
            let numPeriodosEnergia = 6;
            if (es2TD) numPeriodosEnergia = 3; // P1, P2, P3 para 2.0TD
            else if (es3TD) numPeriodosEnergia = 3;
            
            const periodos = Array.from({ length: numPeriodosEnergia }, (_, i) => i + 1);
            
            // Máximo 3 columnas para evitar desbordamiento
            const columnas = Math.min(numPeriodosEnergia, 3);
            
            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: '16px' }}>
                {periodos.map(p => (
                  <InputField 
                    key={`precio_energia_${p}`}
                    label={`Precio Energía P${p}`}
                    campo={`precio_energia_p${p}`}
                    tipo="number"
                    placeholder="0.000000"
                    unidad="€/kWh"
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* OTROS */}
      <SectionTitle>Otros</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <InputField 
          label="% Bonificación IEE" 
          campo="bonificacion_iee" 
          tipo="number"
          placeholder="0"
          unidad="%"
        />
        <InputField 
          label="Coste Alquiler Contador" 
          campo="coste_alquiler_contador" 
          tipo="number"
          placeholder="0.00"
          unidad="€/día"
        />
      </div>
    </div>
  );
};

// ============================================
// PASO 3: SITUACIÓN ACTUAL
// ============================================
const Paso3SituacionActual = ({ datos, onChange }) => {
  const handleChange = (campo, valor) => {
    onChange({ ...datos, [campo]: valor });
  };

  // Estados para el validador de producción
  const [mostrarValidadorProduccion, setMostrarValidadorProduccion] = useState(false);
  const [datosProduccionTemp, setDatosProduccionTemp] = useState([]);
  const [erroresProduccion, setErroresProduccion] = useState({ duplicados: [], huecos: [], negativos: [] });
  const [estadisticasProduccion, setEstadisticasProduccion] = useState(null);
  const [archivoProduccionTemp, setArchivoProduccionTemp] = useState('');
  const [tipoArchivoProduccion, setTipoArchivoProduccion] = useState(''); // 'real' o 'simulado'
  const [formatoDetectadoProduccion, setFormatoDetectadoProduccion] = useState(null);

  // Handler para carga de archivo de producción
  const handleProduccionUpload = async (e, tipo) => {
    const file = e.target.files[0];
    if (file) {
      setArchivoProduccionTemp(file.name);
      setTipoArchivoProduccion(tipo);
      const extension = file.name.split('.').pop().toLowerCase();
      
      try {
        let contenido;
        
        if (extension === 'csv' || extension === 'txt') {
          contenido = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Error leyendo archivo'));
            reader.readAsText(file);
          });
        } else if (extension === 'xlsx' || extension === 'xls') {
          try {
            contenido = await leerArchivoExcel(file);
          } catch (excelError) {
            contenido = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => resolve(event.target.result);
              reader.onerror = () => reject(excelError);
              reader.readAsText(file);
            });
          }
        } else {
          throw new Error('Formato no soportado. Use CSV o Excel.');
        }
        
        // Usar el mismo parser que consumos (el formato es idéntico)
        const { datos: datosParseados, formato } = parsearCSVConsumo(contenido);
        
        if (datosParseados.length === 0) {
          throw new Error('No se encontraron datos válidos en el archivo.');
        }
        
        // Validar datos
        const errores = { duplicados: [], huecos: [], negativos: [] };
        const mapaRegistros = new Map();
        
        datosParseados.forEach((registro, index) => {
          const clave = `${registro.fecha}-${registro.hora}`;
          if (mapaRegistros.has(clave)) {
            errores.duplicados.push({ index, fecha: registro.fecha, hora: registro.hora });
          } else {
            mapaRegistros.set(clave, index);
          }
          if (registro.consumo < 0) {
            errores.negativos.push({ index, fecha: registro.fecha, hora: registro.hora, valor: registro.consumo });
          }
        });
        
        // Estadísticas
        const produccionTotal = datosParseados.reduce((s, d) => s + d.consumo, 0);
        const estadisticas = {
          totalRegistros: datosParseados.length,
          consumoTotal: produccionTotal.toFixed(2),
          consumoMedia: (produccionTotal / datosParseados.length).toFixed(4)
        };
        
        setDatosProduccionTemp(datosParseados);
        setErroresProduccion(errores);
        setEstadisticasProduccion(estadisticas);
        setFormatoDetectadoProduccion(formato);
        setMostrarValidadorProduccion(true);
      } catch (error) {
        alert('Error al procesar el archivo: ' + error.message);
      }
    }
  };

  // Cuando el usuario acepta los datos del validador de producción
  const handleAceptarProduccion = (datosFinales) => {
    const datosOrdenados = [...datosFinales].sort((a, b) => {
      const cmpFecha = a.fecha.localeCompare(b.fecha);
      return cmpFecha !== 0 ? cmpFecha : a.hora - b.hora;
    });
    
    const produccionTotal = datosOrdenados.reduce((s, d) => s + d.consumo, 0);
    
    const campoArchivo = tipoArchivoProduccion === 'real' ? 'archivo_produccion_real' : 'archivo_produccion_simulado';
    const campoDatos = tipoArchivoProduccion === 'real' ? 'produccion_real_horaria' : 'produccion_simulada_horaria';
    const campoEstadisticas = tipoArchivoProduccion === 'real' ? 'produccion_real_estadisticas' : 'produccion_simulada_estadisticas';
    
    onChange({
      ...datos,
      [campoArchivo]: archivoProduccionTemp,
      [campoDatos]: datosOrdenados,
      [campoEstadisticas]: {
        totalRegistros: datosOrdenados.length,
        produccionTotal: produccionTotal.toFixed(2),
        produccionMedia: (produccionTotal / datosOrdenados.length).toFixed(4)
      }
    });
    setMostrarValidadorProduccion(false);
  };

  // Función para corregir datos de producción
  const handleCorregirProduccion = (opciones) => {
    let datosCorregidos = [...datosProduccionTemp];
    const anomalias = opciones.anomalias || {};
    
    // Ordenar cronológicamente primero
    datosCorregidos.sort((a, b) => {
      const cmp = a.fecha.localeCompare(b.fecha);
      return cmp !== 0 ? cmp : a.hora - b.hora;
    });
    
    // Tratar duplicados
    if (opciones.metodoDuplicados === 'promedio') {
      const mapa = new Map();
      datosCorregidos.forEach(d => {
        const clave = `${d.fecha}-${d.hora}`;
        if (mapa.has(clave)) {
          const existente = mapa.get(clave);
          existente.consumo = (existente.consumo + d.consumo) / 2;
        } else {
          mapa.set(clave, { ...d });
        }
      });
      datosCorregidos = Array.from(mapa.values());
    } else if (opciones.metodoDuplicados === 'primero') {
      const vistos = new Set();
      datosCorregidos = datosCorregidos.filter(d => {
        const clave = `${d.fecha}-${d.hora}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });
    } else if (opciones.metodoDuplicados === 'ultimo') {
      const mapa = new Map();
      datosCorregidos.forEach(d => {
        const clave = `${d.fecha}-${d.hora}`;
        mapa.set(clave, { ...d });
      });
      datosCorregidos = Array.from(mapa.values());
    } else if (opciones.metodoDuplicados === 'maximo') {
      const mapa = new Map();
      datosCorregidos.forEach(d => {
        const clave = `${d.fecha}-${d.hora}`;
        if (mapa.has(clave)) {
          const existente = mapa.get(clave);
          if (d.consumo > existente.consumo) {
            mapa.set(clave, { ...d });
          }
        } else {
          mapa.set(clave, { ...d });
        }
      });
      datosCorregidos = Array.from(mapa.values());
    }
    
    // Tratar negativos
    if (opciones.metodoNegativos === 'cero') {
      datosCorregidos = datosCorregidos.map(d => ({ ...d, consumo: Math.max(0, d.consumo) }));
    } else if (opciones.metodoNegativos === 'absoluto') {
      datosCorregidos = datosCorregidos.map(d => ({ ...d, consumo: Math.abs(d.consumo) }));
    } else if (opciones.metodoNegativos === 'eliminar') {
      datosCorregidos = datosCorregidos.filter(d => d.consumo >= 0);
    }
    
    // Tratar exceso de potencia (energía > potencia nominal)
    if (anomalias.excesoPotencia?.length > 0 && opciones.metodoExcesoPotencia !== 'mantener') {
      const excesosSet = new Set(anomalias.excesoPotencia.map(e => `${e.fecha}-${e.hora}`));
      
      datosCorregidos = datosCorregidos.map((d, idx) => {
        const clave = `${d.fecha}-${d.hora}`;
        if (excesosSet.has(clave)) {
          const exceso = anomalias.excesoPotencia.find(e => e.fecha === d.fecha && e.hora === d.hora);
          
          let nuevoValor;
          switch (opciones.metodoExcesoPotencia) {
            case 'promedio':
              nuevoValor = exceso.promedio;
              break;
            case 'maximo':
              nuevoValor = exceso.maximo;
              break;
            case 'minimo':
              nuevoValor = exceso.minimo;
              break;
            case 'limitar':
              nuevoValor = exceso.potenciaNominal;
              break;
            default:
              nuevoValor = d.consumo;
          }
          
          return { ...d, consumo: nuevoValor };
        }
        return d;
      });
    }
    
    // Reordenar resultado
    datosCorregidos.sort((a, b) => {
      const cmp = a.fecha.localeCompare(b.fecha);
      return cmp !== 0 ? cmp : a.hora - b.hora;
    });
    
    return { datosCorregidos, log: [] };
  };

  // Añadir un nuevo inversor
  const addInversor = () => {
    const inversores = datos.inversores_existentes || [];
    onChange({
      ...datos,
      inversores_existentes: [...inversores, { marca: '', modelo: '', potencia: '', cantidad: 1 }]
    });
  };

  // Eliminar un inversor
  const removeInversor = (index) => {
    const inversores = [...(datos.inversores_existentes || [])];
    inversores.splice(index, 1);
    onChange({ ...datos, inversores_existentes: inversores });
  };

  // Actualizar un inversor
  const updateInversor = (index, campo, valor) => {
    const inversores = [...(datos.inversores_existentes || [])];
    inversores[index] = { ...inversores[index], [campo]: valor };
    onChange({ ...datos, inversores_existentes: inversores });
  };

  // Añadir un nuevo módulo
  const addModulo = () => {
    const modulos = datos.modulos_existentes || [];
    onChange({
      ...datos,
      modulos_existentes: [...modulos, { marca: '', modelo: '', potencia: '', cantidad: 1 }]
    });
  };

  // Eliminar un módulo
  const removeModulo = (index) => {
    const modulos = [...(datos.modulos_existentes || [])];
    modulos.splice(index, 1);
    onChange({ ...datos, modulos_existentes: modulos });
  };

  // Actualizar un módulo
  const updateModulo = (index, campo, valor) => {
    const modulos = [...(datos.modulos_existentes || [])];
    modulos[index] = { ...modulos[index], [campo]: valor };
    onChange({ ...datos, modulos_existentes: modulos });
  };

  // ========== GESTIÓN DE SISTEMAS DE ALMACENAMIENTO ==========
  const addSistemaAlmacenamiento = () => {
    const sistemas = datos.sistemas_almacenamiento_existentes || [];
    onChange({
      ...datos,
      sistemas_almacenamiento_existentes: [...sistemas, { marca: '', modelo: '', capacidad: '', potencia: '', rendimiento: '95', cantidad: 1 }]
    });
  };

  const removeSistemaAlmacenamiento = (index) => {
    const sistemas = [...(datos.sistemas_almacenamiento_existentes || [])];
    sistemas.splice(index, 1);
    onChange({ ...datos, sistemas_almacenamiento_existentes: sistemas });
  };

  const updateSistemaAlmacenamiento = (index, campo, valor) => {
    const sistemas = [...(datos.sistemas_almacenamiento_existentes || [])];
    sistemas[index] = { ...sistemas[index], [campo]: valor };
    onChange({ ...datos, sistemas_almacenamiento_existentes: sistemas });
  };

  // Calcular totales FV
  const inversores = datos.inversores_existentes || [];
  const modulos = datos.modulos_existentes || [];
  
  // Calcular totales Almacenamiento
  const sistemasAlmacenamiento = datos.sistemas_almacenamiento_existentes || [];
  const capacidadTotalCalculada = sistemasAlmacenamiento.reduce((sum, s) => sum + (parseFloat(s.capacidad) || 0) * (parseInt(s.cantidad) || 0), 0);
  const potenciaAlmacenamientoCalculada = sistemasAlmacenamiento.reduce((sum, s) => sum + (parseFloat(s.potencia) || 0) * (parseInt(s.cantidad) || 0), 0);
  const tieneSistemas = sistemasAlmacenamiento.some(s => s.capacidad && s.cantidad);
  const capacidadTotal = tieneSistemas ? capacidadTotalCalculada : (parseFloat(datos.almacenamiento_capacidad_manual) || 0);
  const potenciaAlmacenamientoTotal = tieneSistemas ? potenciaAlmacenamientoCalculada : (parseFloat(datos.almacenamiento_potencia_manual) || 0);
  
  // Potencia Nominal = suma de (nº inversores × potencia)
  const potenciaNominalCalculada = inversores.reduce((sum, inv) => sum + (parseFloat(inv.potencia) || 0) * (parseInt(inv.cantidad) || 0), 0);
  const tieneInversores = inversores.some(inv => inv.potencia && inv.cantidad);
  const potenciaNominalTotal = tieneInversores ? potenciaNominalCalculada : (parseFloat(datos.fv_potencia_nominal_manual) || 0);
  
  // Potencia Pico = suma de (nº módulos × potencia) / 1000
  const potenciaPicoCalculada = modulos.reduce((sum, mod) => sum + ((parseFloat(mod.potencia) || 0) * (parseInt(mod.cantidad) || 0)) / 1000, 0);
  const tieneModulos = modulos.some(mod => mod.potencia && mod.cantidad);
  const potenciaPico = tieneModulos ? potenciaPicoCalculada : (parseFloat(datos.fv_potencia_pico_manual) || 0);
  
  // Ratio DC/AC
  const ratioDCAC = potenciaNominalTotal > 0 ? (potenciaPico / potenciaNominalTotal).toFixed(2) : '-';
  
  // Producción
  const produccionAnual = parseFloat(datos.fv_produccion_anual) || 0;
  const kWhPorKwp = potenciaPico > 0 ? (produccionAnual / potenciaPico).toFixed(0) : '-';

  const SectionTitle = ({ children }) => (
    <h3 style={{ 
      fontSize: '15px', 
      fontWeight: '600', 
      color: COLOR_CORP, 
      marginTop: '28px', 
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: `2px solid ${COLOR_CORP}20`
    }}>
      {children}
    </h3>
  );

  const InputField = ({ label, campo, tipo = 'text', placeholder, unidad, disabled = false }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type={tipo}
          value={datos[campo] || ''}
          onChange={(e) => handleChange(campo, e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #DEE2E6',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: disabled ? '#F5F5F5' : 'white',
            color: disabled ? COLOR_TEXT_LIGHT : COLOR_TEXT,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {unidad && (
          <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>{unidad}</span>
        )}
      </div>
    </div>
  );

  const ToggleField = ({ label, campo }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => handleChange(campo, 'si')}
          style={{
            padding: '10px 24px',
            border: datos[campo] === 'si' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
            borderRadius: '8px',
            backgroundColor: datos[campo] === 'si' ? '#FFF3E0' : 'white',
            color: datos[campo] === 'si' ? COLOR_CORP : COLOR_TEXT,
            fontWeight: datos[campo] === 'si' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Sí
        </button>
        <button
          onClick={() => handleChange(campo, 'no')}
          style={{
            padding: '10px 24px',
            border: datos[campo] === 'no' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
            borderRadius: '8px',
            backgroundColor: datos[campo] === 'no' ? '#FFF3E0' : 'white',
            color: datos[campo] === 'no' ? COLOR_CORP : COLOR_TEXT,
            fontWeight: datos[campo] === 'no' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          No
        </button>
      </div>
    </div>
  );

  const FileUploadButton = ({ label, campo, accept = ".csv,.xlsx,.xls", onUpload }) => (
    <div>
      <input
        type="file"
        id={`file-${campo}`}
        accept={accept}
        onChange={onUpload || ((e) => {
          const file = e.target.files[0];
          if (file) handleChange(campo, file.name);
        })}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => document.getElementById(`file-${campo}`).click()}
        style={{
          padding: '12px 20px',
          backgroundColor: datos[campo] ? '#E8F5E9' : 'white',
          border: datos[campo] ? '2px solid #4CAF50' : `1px solid ${COLOR_CORP}`,
          borderRadius: '8px',
          color: datos[campo] ? '#2E7D32' : COLOR_CORP,
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          justifyContent: 'center'
        }}
      >
        {datos[campo] ? '✅' : '📁'} {label}
      </button>
      {datos[campo] && (
        <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px', textAlign: 'center' }}>
          {datos[campo]}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '700', color: COLOR_TEXT, marginBottom: '8px' }}>
        Situación Actual
      </h2>
      <p style={{ color: COLOR_TEXT_LIGHT, marginBottom: '24px', fontSize: '14px' }}>
        Información sobre instalaciones existentes
      </p>

      {/* PREGUNTAS PREVIAS */}
      <SectionTitle>Preguntas Previas</SectionTitle>
      
      <ToggleField label="¿FV existente?" campo="fv_existente" />

      {/* Modalidad de Autoconsumo - solo si hay FV */}
      {datos.fv_existente === 'si' && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: datos.modalidad_autoconsumo === 'con_excedentes' || datos.modalidad_autoconsumo === 'con_compensacion' ? '1fr 1fr' : '1fr', gap: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Modalidad de Autoconsumo
              </label>
              <select
                value={datos.modalidad_autoconsumo || ''}
                onChange={(e) => handleChange('modalidad_autoconsumo', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #DEE2E6',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">Seleccionar modalidad...</option>
                <option value="sin_excedentes">Sin Excedentes</option>
                <option value="con_excedentes">Con Excedentes</option>
                <option value="con_compensacion">Con Compensación</option>
              </select>
            </div>
            {(datos.modalidad_autoconsumo === 'con_excedentes' || datos.modalidad_autoconsumo === 'con_compensacion') && (
              <InputField 
                label="Potencia Máxima de Vertido"  
                campo="potencia_max_vertido" 
                tipo="number"
                placeholder="100"
                unidad="kW"
              />
            )}
          </div>
        </div>
      )}

      <ToggleField label="¿Almacenamiento existente?" campo="almacenamiento_existente" />

      {/* CARACTERÍSTICAS FV EXISTENTE */}
      {datos.fv_existente === 'si' && (
        <>
          {/* Separador visual para FV */}
          <div style={{ 
            marginTop: '30px', 
            marginBottom: '20px', 
            borderTop: '3px solid #F59E0B',
            paddingTop: '30px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '28px' }}>☀️</span>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#D97706',
                margin: 0
              }}>
                Instalación Fotovoltaica Existente
              </h2>
            </div>
            <p style={{ color: COLOR_TEXT_LIGHT, fontSize: '13px', marginLeft: '40px' }}>
              Información sobre la instalación solar existente
            </p>
          </div>

          {/* MÓDULOS - primero */}
          <SectionTitle>Módulos</SectionTitle>
          {modulos.map((mod, index) => (
            <div key={index} style={{ 
              backgroundColor: '#FAFAFA', 
              border: '1px solid #E0E0E0', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '12px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>Módulo Tipo {index + 1}</span>
                {modulos.length > 1 && (
                  <button
                    onClick={() => removeModulo(index)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#FFEBEE',
                      border: '1px solid #EF5350',
                      borderRadius: '6px',
                      color: '#C62828',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Marca</label>
                  <input
                    type="text"
                    value={mod.marca}
                    onChange={(e) => updateModulo(index, 'marca', e.target.value)}
                    placeholder="JA Solar, Longi..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Modelo</label>
                  <input
                    type="text"
                    value={mod.modelo}
                    onChange={(e) => updateModulo(index, 'modelo', e.target.value)}
                    placeholder="JAM72S30-550/MR"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Potencia (Wp)</label>
                  <input
                    type="number"
                    value={mod.potencia}
                    onChange={(e) => updateModulo(index, 'potencia', e.target.value)}
                    placeholder="550"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Uds.</label>
                  <input
                    type="number"
                    value={mod.cantidad}
                    onChange={(e) => updateModulo(index, 'cantidad', e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addModulo}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: `1px dashed ${COLOR_CORP}`,
              borderRadius: '8px',
              color: COLOR_CORP,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '24px'
            }}
          >
            + Añadir otro tipo de módulo
          </button>

          {/* INVERSORES - segundo */}
          <SectionTitle>Inversores</SectionTitle>
          {inversores.map((inv, index) => (
            <div key={index} style={{ 
              backgroundColor: '#FAFAFA', 
              border: '1px solid #E0E0E0', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '12px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>Inversor Tipo {index + 1}</span>
                {inversores.length > 1 && (
                  <button
                    onClick={() => removeInversor(index)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#FFEBEE',
                      border: '1px solid #EF5350',
                      borderRadius: '6px',
                      color: '#C62828',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Marca</label>
                  <input
                    type="text"
                    value={inv.marca}
                    onChange={(e) => updateInversor(index, 'marca', e.target.value)}
                    placeholder="Huawei, SMA..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Modelo</label>
                  <input
                    type="text"
                    value={inv.modelo}
                    onChange={(e) => updateInversor(index, 'modelo', e.target.value)}
                    placeholder="SUN2000-100KTL"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Potencia (kWn)</label>
                  <input
                    type="number"
                    value={inv.potencia}
                    onChange={(e) => updateInversor(index, 'potencia', e.target.value)}
                    placeholder="100"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Uds.</label>
                  <input
                    type="number"
                    value={inv.cantidad}
                    onChange={(e) => updateInversor(index, 'cantidad', e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addInversor}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: `1px dashed ${COLOR_CORP}`,
              borderRadius: '8px',
              color: COLOR_CORP,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '24px'
            }}
          >
            + Añadir otro tipo de inversor
          </button>

          {/* CARACTERÍSTICAS FV - después de módulos e inversores */}
          <SectionTitle>Características FV Existente</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            {/* Potencia Pico - calculada desde módulos o manual */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Potencia Pico Total
                {tieneModulos && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>(calculado)</span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneModulos ? potenciaPico.toFixed(2) : (datos.fv_potencia_pico_manual || '')}
                  onChange={(e) => !tieneModulos && handleChange('fv_potencia_pico_manual', e.target.value)}
                  disabled={tieneModulos}
                  placeholder="120"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: tieneModulos ? '2px solid #4CAF50' : '1px solid #DEE2E6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: tieneModulos ? '#F1F8E9' : 'white',
                    color: COLOR_TEXT,
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kWp</span>
              </div>
              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                {tieneModulos ? 'Suma: nº módulos × potencia / 1000' : 'Rellena módulos o introduce manualmente'}
              </div>
            </div>
            
            {/* Potencia Nominal - calculada desde inversores o manual */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Potencia Nominal Inversores
                {tieneInversores && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>(calculado)</span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneInversores ? potenciaNominalTotal.toFixed(1) : (datos.fv_potencia_nominal_manual || '')}
                  onChange={(e) => !tieneInversores && handleChange('fv_potencia_nominal_manual', e.target.value)}
                  disabled={tieneInversores}
                  placeholder="100"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: tieneInversores ? '2px solid #4CAF50' : '1px solid #DEE2E6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: tieneInversores ? '#F1F8E9' : 'white',
                    color: COLOR_TEXT,
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kWn</span>
              </div>
              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                {tieneInversores ? 'Suma: nº inversores × potencia' : 'Rellena inversores o introduce manualmente'}
              </div>
            </div>
            
            {/* Ratio DC/AC */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Ratio DC/AC
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={ratioDCAC}
                  disabled
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #DEE2E6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#F5F5F5',
                    color: COLOR_TEXT,
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>Calculado automáticamente</div>
            </div>
          </div>

          {/* DATOS DE PRODUCCIÓN HORARIA DE FV EXISTENTE */}
          <SectionTitle>Datos de Producción Horaria de FV Existente</SectionTitle>
          
          {/* Resumen de Producción */}
          <div style={{ 
            backgroundColor: '#FEF3C7', 
            border: '1px solid #FCD34D', 
            borderRadius: '12px', 
            padding: '16px', 
            marginBottom: '20px' 
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#92400E', marginBottom: '12px' }}>
              📊 Resumen de Producción
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                  Producción Anual Simulada
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={datos.fv_produccion_anual_simulada || ''}
                    onChange={(e) => handleChange('fv_produccion_anual_simulada', e.target.value)}
                    placeholder="140075"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #FCD34D',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: 'white'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>kWh/año</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                  Producción Anual Real
                  {datos.produccion_real_estadisticas?.produccionTotal && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', color: '#4CAF50' }}>(del archivo)</span>
                  )}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={datos.produccion_real_estadisticas?.produccionTotal || datos.fv_produccion_anual_real || ''}
                    onChange={(e) => handleChange('fv_produccion_anual_real', e.target.value)}
                    disabled={datos.produccion_real_estadisticas?.produccionTotal}
                    placeholder="-"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: datos.produccion_real_estadisticas?.produccionTotal ? '2px solid #4CAF50' : '1px solid #FCD34D',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: datos.produccion_real_estadisticas?.produccionTotal ? '#F1F8E9' : 'white'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>kWh/año</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                  Ratio Producción
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={kWhPorKwp}
                    disabled
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #FCD34D',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#F5F5F5'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>kWh/kWp·año</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Botón para descargar plantilla */}
          <button 
            onClick={() => {
              const diasPorMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
              let csv = 'fecha;hora;produccion\n';
              for (let mes = 0; mes < 12; mes++) {
                for (let dia = 1; dia <= diasPorMes[mes]; dia++) {
                  for (let hora = 0; hora < 24; hora++) {
                    const fecha = `${String(dia).padStart(2, '0')}-${String(mes + 1).padStart(2, '0')}-2024`;
                    csv += `${fecha};${hora};\n`;
                  }
                }
              }
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'Plantilla_Produccion_YLIO.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            style={{ 
              marginBottom: '20px', 
              padding: '8px 16px', 
              fontSize: '12px', 
              color: COLOR_CORP, 
              backgroundColor: 'white', 
              border: `1px solid ${COLOR_CORP}`, 
              borderRadius: '6px', 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📥 Descargar plantilla CSV producción (8760 horas)
          </button>

          {/* Archivo de Producción Simulada */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
              Archivo de Producción Simulada
            </label>
            <input
              type="file"
              id="file-produccion-simulado"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleProduccionUpload(e, 'simulado')}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => document.getElementById('file-produccion-simulado').click()}
              style={{
                padding: '12px 20px',
                backgroundColor: datos.archivo_produccion_simulado ? '#E8F5E9' : 'white',
                border: datos.archivo_produccion_simulado ? '2px solid #4CAF50' : `1px solid ${COLOR_CORP}`,
                borderRadius: '8px',
                color: datos.archivo_produccion_simulado ? '#2E7D32' : COLOR_CORP,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                maxWidth: '400px',
                justifyContent: 'center'
              }}
            >
              {datos.archivo_produccion_simulado ? '✅' : '📁'} Adjuntar Producción Simulada
            </button>
            {datos.archivo_produccion_simulado && (
              <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>
                {datos.archivo_produccion_simulado}
              </div>
            )}
          </div>

          {/* Pregunta: ¿Se dispone de datos reales? */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
              ¿Se dispone de datos reales?
            </label>
            <select
              value={datos.dispone_datos_reales || ''}
              onChange={(e) => handleChange('dispone_datos_reales', e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #DEE2E6',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
                minWidth: '200px'
              }}
            >
              <option value="">Seleccionar...</option>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>

          {/* Archivo de Producción Real - solo si dispone de datos reales */}
          {datos.dispone_datos_reales === 'si' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
                Archivo de Producción Real
              </label>
              <input
                type="file"
                id="file-produccion-real"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleProduccionUpload(e, 'real')}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => document.getElementById('file-produccion-real').click()}
                style={{
                  padding: '12px 20px',
                  backgroundColor: datos.archivo_produccion_real ? '#E8F5E9' : 'white',
                  border: datos.archivo_produccion_real ? '2px solid #4CAF50' : `1px solid ${COLOR_CORP}`,
                  borderRadius: '8px',
                  color: datos.archivo_produccion_real ? '#2E7D32' : COLOR_CORP,
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  maxWidth: '400px',
                  justifyContent: 'center'
                }}
              >
                {datos.archivo_produccion_real ? '✅' : '📁'} Adjuntar Producción Real
              </button>
              {datos.archivo_produccion_real && (
                <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>
                  {datos.archivo_produccion_real}
                </div>
              )}
            </div>
          )}

          {/* Resumen de producción simulada cargada */}
          {datos.produccion_simulada_horaria && datos.produccion_simulada_horaria.length > 0 && (
            <ResumenProduccionGuardado 
              produccion={datos.produccion_simulada_horaria}
              estadisticas={datos.produccion_simulada_estadisticas}
              onCambiarArchivo={() => document.getElementById('file-produccion-simulado').click()}
            />
          )}

          {/* Resumen de producción real cargada */}
          {datos.produccion_real_horaria && datos.produccion_real_horaria.length > 0 && (
            <ResumenProduccionGuardado 
              produccion={datos.produccion_real_horaria}
              estadisticas={datos.produccion_real_estadisticas}
              onCambiarArchivo={() => document.getElementById('file-produccion-real').click()}
            />
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* SEPARADOR VISUAL ENTRE FV Y ALMACENAMIENTO */}
      {/* ============================================================ */}
      {datos.almacenamiento_existente === 'si' && (
        <div style={{ 
          marginTop: '40px', 
          marginBottom: '20px', 
          borderTop: '3px solid #8B5CF6',
          paddingTop: '30px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '28px' }}>🔋</span>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: '#7C3AED',
              margin: 0
            }}>
              Sistema de Almacenamiento Existente
            </h2>
          </div>
          <p style={{ color: COLOR_TEXT_LIGHT, fontSize: '13px', marginLeft: '40px' }}>
            Información sobre el sistema de baterías instalado
          </p>
        </div>
      )}

      {/* SISTEMAS DE ALMACENAMIENTO */}
      {datos.almacenamiento_existente === 'si' && (
        <>
          {/* Sistemas de almacenamiento - tarjetas */}
          <SectionTitle>Equipos de Almacenamiento</SectionTitle>
          {sistemasAlmacenamiento.map((sistema, index) => (
            <div key={index} style={{ 
              backgroundColor: '#FAF5FF', 
              border: '1px solid #DDD6FE', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '12px' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#7C3AED' }}>Sistema Tipo {index + 1}</span>
                {sistemasAlmacenamiento.length > 1 && (
                  <button
                    onClick={() => removeSistemaAlmacenamiento(index)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#FFEBEE',
                      border: '1px solid #EF5350',
                      borderRadius: '6px',
                      color: '#C62828',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Eliminar
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 80px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Marca</label>
                  <input
                    type="text"
                    value={sistema.marca}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'marca', e.target.value)}
                    placeholder="BYD, Huawei..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Modelo</label>
                  <input
                    type="text"
                    value={sistema.modelo}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'modelo', e.target.value)}
                    placeholder="Battery-Box Premium"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Capacidad Ud. (kWh)</label>
                  <input
                    type="number"
                    value={sistema.capacidad}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'capacidad', e.target.value)}
                    placeholder="100"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Potencia Ud. (kW)</label>
                  <input
                    type="number"
                    value={sistema.potencia}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'potencia', e.target.value)}
                    placeholder="50"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Rendimiento (%)</label>
                  <input
                    type="number"
                    value={sistema.rendimiento}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'rendimiento', e.target.value)}
                    placeholder="95"
                    min="0"
                    max="100"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Uds.</label>
                  <input
                    type="number"
                    value={sistema.cantidad}
                    onChange={(e) => updateSistemaAlmacenamiento(index, 'cantidad', e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DDD6FE', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addSistemaAlmacenamiento}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: '1px dashed #8B5CF6',
              borderRadius: '8px',
              color: '#8B5CF6',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '24px'
            }}
          >
            + Añadir otro tipo de sistema de almacenamiento
          </button>

          {/* Características totales del almacenamiento */}
          <SectionTitle>Características Totales del Sistema de Almacenamiento</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Capacidad Total */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Capacidad Total
                {tieneSistemas && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#8B5CF6', fontWeight: '400' }}>(calculado)</span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneSistemas ? capacidadTotal.toFixed(1) : (datos.almacenamiento_capacidad_manual || '')}
                  onChange={(e) => !tieneSistemas && handleChange('almacenamiento_capacidad_manual', e.target.value)}
                  disabled={tieneSistemas}
                  placeholder="100"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: tieneSistemas ? '2px solid #8B5CF6' : '1px solid #DEE2E6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: tieneSistemas ? '#FAF5FF' : 'white',
                    color: COLOR_TEXT,
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kWh</span>
              </div>
              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                {tieneSistemas ? 'Suma: nº sistemas × capacidad' : 'Rellena sistemas o introduce manualmente'}
              </div>
            </div>

            {/* Potencia Total */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Potencia Total
                {tieneSistemas && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#8B5CF6', fontWeight: '400' }}>(calculado)</span>
                )}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneSistemas ? potenciaAlmacenamientoTotal.toFixed(1) : (datos.almacenamiento_potencia_manual || '')}
                  onChange={(e) => !tieneSistemas && handleChange('almacenamiento_potencia_manual', e.target.value)}
                  disabled={tieneSistemas}
                  placeholder="50"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: tieneSistemas ? '2px solid #8B5CF6' : '1px solid #DEE2E6',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: tieneSistemas ? '#FAF5FF' : 'white',
                    color: COLOR_TEXT,
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kW</span>
              </div>
              <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                {tieneSistemas ? 'Suma: nº sistemas × potencia' : 'Rellena sistemas o introduce manualmente'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal del Validador de Producción */}
      {mostrarValidadorProduccion && (
        <ValidadorProduccion
          archivo={archivoProduccionTemp}
          datosOriginales={datosProduccionTemp}
          errores={erroresProduccion}
          estadisticas={estadisticasProduccion}
          formatoDetectado={formatoDetectadoProduccion}
          potenciaNominal={potenciaNominalTotal}
          onAceptar={handleAceptarProduccion}
          onCancelar={() => setMostrarValidadorProduccion(false)}
          onCorregir={handleCorregirProduccion}
        />
      )}
    </div>
  );
};

// ============================================
// PASO 4: PROPUESTA - CARACTERÍSTICAS DE LA INSTALACIÓN
// ============================================
const Paso4Propuesta = ({ datos, onChange }) => {
  const handleChange = (campo, valor) => {
    onChange({ ...datos, [campo]: valor });
  };

  // Estados para guardar archivos originales (para descarga)
  const [archivosPVSystBlobs, setArchivosPVSystBlobs] = React.useState({});
  const [archivosPVGISBlobs, setArchivosPVGISBlobs] = React.useState({});
  const [archivoPVSystTotalBlob, setArchivoPVSystTotalBlob] = React.useState(null);

  // Función genérica para descargar archivo
  const descargarArchivo = (blob, nombreArchivo) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // ========== GESTIÓN DE ÁREAS DE PRODUCCIÓN ==========
  const addAreaProduccion = () => {
    const areas = datos.prop_areas_produccion || [];
    onChange({
      ...datos,
      prop_areas_produccion: [...areas, {
        nombre: `Área producción ${areas.length + 1}`,
        orientacion: '',
        inclinacion: '',
        localizacion_estructura: '',
        tipo_estructura: '',
        tipo_modulo_idx: '0',
        num_modulos: '',
        kwp: '',
        kwh_ano: '',
        incluir: 'si'
      }]
    });
  };

  const removeAreaProduccion = (index) => {
    const areas = [...(datos.prop_areas_produccion || [])];
    if (areas.length > 1) {
      areas.splice(index, 1);
      onChange({ ...datos, prop_areas_produccion: areas });
    }
  };

  const updateAreaProduccion = (index, campo, valor) => {
    const areas = [...(datos.prop_areas_produccion || [])];
    areas[index] = { ...areas[index], [campo]: valor };
    
    // Auto-calcular kWp si hay módulos y potencia de módulo
    if (campo === 'num_modulos' || campo === 'potencia_modulo') {
      const numModulos = parseFloat(areas[index].num_modulos) || 0;
      const potenciaModulo = parseFloat(datos.prop_modulo_potencia) || 0;
      if (numModulos > 0 && potenciaModulo > 0) {
        areas[index].kwp = ((numModulos * potenciaModulo) / 1000).toFixed(3);
      }
    }
    
    onChange({ ...datos, prop_areas_produccion: areas });
  };

  // ========== GESTIÓN DE INVERSORES ==========
  const addInversor = () => {
    const inversores = datos.prop_inversores || [];
    onChange({
      ...datos,
      prop_inversores: [...inversores, { marca: '', modelo: '', potencia: '', cantidad: 1 }]
    });
  };

  const removeInversor = (index) => {
    const inversores = [...(datos.prop_inversores || [])];
    if (inversores.length > 1) {
      inversores.splice(index, 1);
      onChange({ ...datos, prop_inversores: inversores });
    }
  };

  const updateInversor = (index, campo, valor) => {
    const inversores = [...(datos.prop_inversores || [])];
    inversores[index] = { ...inversores[index], [campo]: valor };
    onChange({ ...datos, prop_inversores: inversores });
  };

  // ========== GESTIÓN DE MÓDULOS ==========
  const addModulo = () => {
    const modulos = datos.prop_modulos || [];
    onChange({
      ...datos,
      prop_modulos: [...modulos, { marca: '', modelo: '', potencia: '', cantidad: 1 }]
    });
  };

  const removeModulo = (index) => {
    const modulos = [...(datos.prop_modulos || [])];
    if (modulos.length > 1) {
      modulos.splice(index, 1);
      onChange({ ...datos, prop_modulos: modulos });
    }
  };

  const updateModulo = (index, campo, valor) => {
    const modulos = [...(datos.prop_modulos || [])];
    modulos[index] = { ...modulos[index], [campo]: valor };
    onChange({ ...datos, prop_modulos: modulos });
  };

  // ========== CÁLCULOS AUTOMÁTICOS ==========
  // Potencia Pico Total desde módulos
  const modulos = datos.prop_modulos || [{ marca: '', modelo: '', potencia: '', cantidad: 1 }];
  const tieneModulos = modulos.some(m => m.potencia && m.cantidad);
  const potenciaPico = modulos.reduce((acc, m) => {
    const pot = parseFloat(m.potencia) || 0;
    const cant = parseFloat(m.cantidad) || 0;
    return acc + (pot * cant / 1000);
  }, 0);

  // Potencia Nominal Total desde inversores
  const inversores = datos.prop_inversores || [{ marca: '', modelo: '', potencia: '', cantidad: 1 }];
  const tieneInversores = inversores.some(inv => inv.potencia && inv.cantidad);
  const potenciaNominalTotal = inversores.reduce((acc, inv) => {
    const pot = parseFloat(inv.potencia) || 0;
    const cant = parseFloat(inv.cantidad) || 0;
    return acc + (pot * cant);
  }, 0);

  // Ratio DC/AC
  const ratioDCAC = potenciaNominalTotal > 0 ? (potenciaPico / potenciaNominalTotal).toFixed(2) : '-';

  // Total módulos
  const totalModulos = modulos.reduce((acc, m) => acc + (parseFloat(m.cantidad) || 0), 0);

  // kWh/kWp·año
  const produccionAnual = parseFloat(datos.prop_produccion_anual) || 0;
  const potenciaPicoFinal = tieneModulos ? potenciaPico : (parseFloat(datos.prop_potencia_pico_manual) || 0);
  const kWhPorKwp = potenciaPicoFinal > 0 ? (produccionAnual / potenciaPicoFinal).toFixed(1) : '-';

  // Inicializar arrays si no existen
  if (!datos.prop_areas_produccion || datos.prop_areas_produccion.length === 0) {
    setTimeout(() => {
      onChange({
        ...datos,
        prop_areas_produccion: [{
          nombre: 'Área producción 1',
          orientacion: '',
          inclinacion: '',
          localizacion_estructura: '',
          tipo_estructura: '',
          num_modulos: '',
          kwp: '',
          kwh_ano: '',
          incluir: 'si'
        }]
      });
    }, 0);
  }

  // Componentes de UI
  const SectionTitle = ({ children }) => (
    <h3 style={{ 
      fontSize: '14px', 
      fontWeight: '600', 
      color: COLOR_CORP, 
      marginTop: '28px', 
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: `2px solid ${COLOR_CORP}20`
    }}>
      {children}
    </h3>
  );

  const InputField = ({ label, campo, tipo = 'text', placeholder = '', unidad = '', disabled = false }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type={tipo}
          value={datos[campo] || ''}
          onChange={(e) => handleChange(campo, e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #DEE2E6',
            borderRadius: '8px',
            fontSize: '14px',
            backgroundColor: disabled ? '#F5F5F5' : 'white',
            color: disabled ? COLOR_TEXT_LIGHT : COLOR_TEXT,
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {unidad && (
          <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>{unidad}</span>
        )}
      </div>
    </div>
  );

  const ToggleField = ({ label, campo }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => handleChange(campo, 'si')}
          style={{
            padding: '10px 24px',
            border: datos[campo] === 'si' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
            borderRadius: '8px',
            backgroundColor: datos[campo] === 'si' ? '#FFF3E0' : 'white',
            color: datos[campo] === 'si' ? COLOR_CORP : COLOR_TEXT,
            fontWeight: datos[campo] === 'si' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Sí
        </button>
        <button
          onClick={() => handleChange(campo, 'no')}
          style={{
            padding: '10px 24px',
            border: datos[campo] === 'no' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
            borderRadius: '8px',
            backgroundColor: datos[campo] === 'no' ? '#FFF3E0' : 'white',
            color: datos[campo] === 'no' ? COLOR_CORP : COLOR_TEXT,
            fontWeight: datos[campo] === 'no' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          No
        </button>
      </div>
    </div>
  );

  const SelectField = ({ label, campo, opciones }) => (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
        {label}
      </label>
      <select
        value={datos[campo] || ''}
        onChange={(e) => handleChange(campo, e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: '1px solid #DEE2E6',
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: 'white',
          color: COLOR_TEXT,
          outline: 'none',
          cursor: 'pointer'
        }}
      >
        <option value="">Seleccionar...</option>
        {opciones.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: '700', color: COLOR_TEXT, marginBottom: '8px' }}>
        Propuesta de Instalación
      </h2>
      <p style={{ color: COLOR_TEXT_LIGHT, marginBottom: '24px', fontSize: '14px' }}>
        Definición de la instalación base para el análisis del cliente
      </p>

      {/* PREGUNTAS PREVIAS */}
      <SectionTitle>Configuración de la Propuesta</SectionTitle>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ToggleField label="¿Incluir FV en la propuesta?" campo="prop_incluir_fv" />
        <ToggleField label="¿Incluir Batería en la propuesta?" campo="prop_incluir_bateria" />
      </div>


      {/* ========== SECCIÓN FV ========== */}
      {datos.prop_incluir_fv === 'si' && (
        <>
          {/* MÓDULOS - PRIMERO */}
          <SectionTitle>🔲 Módulos Fotovoltaicos</SectionTitle>
          {(datos.prop_modulos || [{ marca: '', modelo: '', potencia: '', cantidad: 1 }]).map((mod, index) => (
            <div key={index} style={{ 
              backgroundColor: '#FAFAFA', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '12px',
              border: '1px solid #E0E0E0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>Módulo Tipo {index + 1}</span>
                {(datos.prop_modulos || []).length > 1 && (
                  <button
                    onClick={() => removeModulo(index)}
                    style={{ background: 'none', border: 'none', color: '#E53935', cursor: 'pointer', fontSize: '18px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Marca</label>
                  <input
                    type="text"
                    value={mod.marca}
                    onChange={(e) => updateModulo(index, 'marca', e.target.value)}
                    placeholder="Jinko, Trina..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Modelo</label>
                  <input
                    type="text"
                    value={mod.modelo}
                    onChange={(e) => updateModulo(index, 'modelo', e.target.value)}
                    placeholder="Tiger Neo 550W"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Potencia (Wp)</label>
                  <input
                    type="number"
                    value={mod.potencia}
                    onChange={(e) => updateModulo(index, 'potencia', e.target.value)}
                    placeholder="550"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Uds.</label>
                  <input
                    type="number"
                    value={mod.cantidad}
                    onChange={(e) => updateModulo(index, 'cantidad', e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addModulo}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: `1px dashed ${COLOR_CORP}`,
              borderRadius: '8px',
              color: COLOR_CORP,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '24px'
            }}
          >
            + Añadir otro tipo de módulo
          </button>

          {/* INVERSORES - SEGUNDO */}
          <SectionTitle>🔌 Inversores</SectionTitle>
          {(datos.prop_inversores || [{ marca: '', modelo: '', potencia: '', cantidad: 1 }]).map((inv, index) => (
            <div key={index} style={{ 
              backgroundColor: '#FAFAFA', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '12px',
              border: '1px solid #E0E0E0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>Inversor Tipo {index + 1}</span>
                {(datos.prop_inversores || []).length > 1 && (
                  <button
                    onClick={() => removeInversor(index)}
                    style={{ background: 'none', border: 'none', color: '#E53935', cursor: 'pointer', fontSize: '18px' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 100px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Marca</label>
                  <input
                    type="text"
                    value={inv.marca}
                    onChange={(e) => updateInversor(index, 'marca', e.target.value)}
                    placeholder="Huawei, SMA..."
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Modelo</label>
                  <input
                    type="text"
                    value={inv.modelo}
                    onChange={(e) => updateInversor(index, 'modelo', e.target.value)}
                    placeholder="SUN2000-100KTL"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Potencia (kW)</label>
                  <input
                    type="number"
                    value={inv.potencia}
                    onChange={(e) => updateInversor(index, 'potencia', e.target.value)}
                    placeholder="100"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Uds.</label>
                  <input
                    type="number"
                    value={inv.cantidad}
                    onChange={(e) => updateInversor(index, 'cantidad', e.target.value)}
                    min="1"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addInversor}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              border: `1px dashed ${COLOR_CORP}`,
              borderRadius: '8px',
              color: COLOR_CORP,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              width: '100%',
              marginBottom: '24px'
            }}
          >
            + Añadir otro tipo de inversor
          </button>

          {/* CARACTERÍSTICAS GENERALES FV - DESPUÉS DE MÓDULOS E INVERSORES */}
          <SectionTitle>☀️ Características Generales FV</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Potencia Pico Total
                {tieneModulos && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>(calculado)</span>}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneModulos ? potenciaPico.toFixed(3) : (datos.prop_potencia_pico_manual || '')}
                  onChange={(e) => !tieneModulos && handleChange('prop_potencia_pico_manual', e.target.value)}
                  disabled={tieneModulos}
                  placeholder="100"
                  style={{
                    flex: 1, padding: '10px 14px',
                    border: tieneModulos ? '2px solid #4CAF50' : '1px solid #DEE2E6',
                    borderRadius: '8px', fontSize: '14px',
                    backgroundColor: tieneModulos ? '#F1F8E9' : 'white',
                    color: COLOR_TEXT, outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kWp</span>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>
                Potencia Nominal Inversores
                {tieneInversores && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#4CAF50', fontWeight: '400' }}>(calculado)</span>}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  value={tieneInversores ? potenciaNominalTotal.toFixed(1) : (datos.prop_potencia_nominal_manual || '')}
                  onChange={(e) => !tieneInversores && handleChange('prop_potencia_nominal_manual', e.target.value)}
                  disabled={tieneInversores}
                  placeholder="100"
                  style={{
                    flex: 1, padding: '10px 14px',
                    border: tieneInversores ? '2px solid #4CAF50' : '1px solid #DEE2E6',
                    borderRadius: '8px', fontSize: '14px',
                    backgroundColor: tieneInversores ? '#F1F8E9' : 'white',
                    color: COLOR_TEXT, outline: 'none'
                  }}
                />
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT, minWidth: '60px' }}>kWn</span>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '6px' }}>Ratio DC/AC</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="text" value={ratioDCAC} disabled
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #DEE2E6', borderRadius: '8px', fontSize: '14px', backgroundColor: '#F5F5F5', color: COLOR_TEXT, outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* ÁREAS DE PRODUCCIÓN */}
          <SectionTitle>📐 Áreas de Producción</SectionTitle>
          <p style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '16px' }}>
            Define las diferentes áreas/orientaciones de la instalación fotovoltaica
          </p>
          
          {(datos.prop_areas_produccion || []).map((area, index) => {
            const soloUnTipoModulo = modulos.length === 1 || !modulos.slice(1).some(m => m.marca || m.modelo || m.potencia);
            const idxModulo = soloUnTipoModulo ? 0 : (parseInt(area.tipo_modulo_idx) || 0);
            const moduloActual = modulos[idxModulo];
            
            return (
              <div key={index} style={{ backgroundColor: '#FFF8E1', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: `1px solid ${COLOR_CORP}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <input type="text" value={area.nombre} onChange={(e) => updateAreaProduccion(index, 'nombre', e.target.value)}
                    style={{ fontSize: '15px', fontWeight: '600', color: COLOR_CORP, border: 'none', background: 'transparent', outline: 'none', width: '200px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: COLOR_TEXT }}>
                      <input type="checkbox" checked={area.incluir === 'si'} onChange={(e) => updateAreaProduccion(index, 'incluir', e.target.checked ? 'si' : 'no')}
                        style={{ width: '16px', height: '16px', accentColor: COLOR_CORP }}
                      />
                      Incluir área
                    </label>
                    {(datos.prop_areas_produccion || []).length > 1 && (
                      <button onClick={() => removeAreaProduccion(index)} style={{ background: 'none', border: 'none', color: '#E53935', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Orientación</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="number" value={area.orientacion} onChange={(e) => updateAreaProduccion(index, 'orientacion', e.target.value)} placeholder="180"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>°</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Inclinación</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="number" value={area.inclinacion} onChange={(e) => updateAreaProduccion(index, 'inclinacion', e.target.value)} placeholder="15"
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>°</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Tipo estructura</label>
                    <select value={area.tipo_estructura} onChange={(e) => updateAreaProduccion(index, 'tipo_estructura', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="coplanar">Coplanar</option>
                      <option value="inclinada">Inclinada</option>
                      <option value="bloque_1h">Bloque 1H</option>
                      <option value="bloque_1v">Bloque 1V</option>
                      <option value="bloque_2h">Bloque 2H</option>
                      <option value="hincada">Hincada</option>
                      <option value="cimentada">Cimentada</option>
                      <option value="parking_sin_chapa">Parking sin chapa</option>
                      <option value="parking_con_chapa">Parking con chapa</option>
                      <option value="flotante">Flotante</option>
                      <option value="tracker">Tracker</option>
                      <option value="lastrada_sur">Lastrada Sur</option>
                      <option value="lastrada_eo">Lastrada E-O</option>
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                      Marca Módulo
                      {soloUnTipoModulo && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#4CAF50' }}>(auto)</span>}
                    </label>
                    <select 
                      value={area.modulo_marca || (soloUnTipoModulo ? (modulos[0]?.marca || '') : '')}
                      onChange={(e) => {
                        const marca = e.target.value;
                        // Buscar modelos disponibles para esta marca
                        const modelosDisponibles = modulos.filter(m => m.marca === marca);
                        const areas = [...(datos.prop_areas_produccion || [])];
                        areas[index] = { 
                          ...areas[index], 
                          modulo_marca: marca,
                          modulo_modelo: modelosDisponibles.length === 1 ? modelosDisponibles[0].modelo : '',
                          tipo_modulo_idx: modulos.findIndex(m => m.marca === marca).toString()
                        };
                        // Recalcular kWp si hay número de módulos
                        if (areas[index].num_modulos && modelosDisponibles.length === 1 && modelosDisponibles[0].potencia) {
                          const kwp = (parseFloat(areas[index].num_modulos) * parseFloat(modelosDisponibles[0].potencia) / 1000).toFixed(3);
                          areas[index].kwp = kwp;
                        }
                        onChange({ ...datos, prop_areas_produccion: areas });
                      }}
                      disabled={soloUnTipoModulo}
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px', 
                        border: soloUnTipoModulo ? '2px solid #4CAF50' : '1px solid #DEE2E6', 
                        borderRadius: '6px', 
                        fontSize: '13px', 
                        backgroundColor: soloUnTipoModulo ? '#F1F8E9' : 'white',
                        cursor: soloUnTipoModulo ? 'default' : 'pointer'
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {[...new Set(modulos.filter(m => m.marca).map(m => m.marca))].map((marca, idx) => (
                        <option key={idx} value={marca}>{marca}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                      Modelo Módulo
                      {(soloUnTipoModulo || modulos.filter(m => m.marca === (area.modulo_marca || modulos[0]?.marca)).length === 1) && 
                        <span style={{ marginLeft: '4px', fontSize: '10px', color: '#4CAF50' }}>(auto)</span>}
                    </label>
                    <select 
                      value={area.modulo_modelo || (soloUnTipoModulo ? (modulos[0]?.modelo || '') : '')}
                      onChange={(e) => {
                        const modelo = e.target.value;
                        const moduloSeleccionado = modulos.find(m => m.marca === (area.modulo_marca || modulos[0]?.marca) && m.modelo === modelo);
                        const areas = [...(datos.prop_areas_produccion || [])];
                        areas[index] = { 
                          ...areas[index], 
                          modulo_modelo: modelo,
                          tipo_modulo_idx: modulos.findIndex(m => m.marca === (area.modulo_marca || modulos[0]?.marca) && m.modelo === modelo).toString()
                        };
                        // Recalcular kWp si hay número de módulos
                        if (areas[index].num_modulos && moduloSeleccionado?.potencia) {
                          const kwp = (parseFloat(areas[index].num_modulos) * parseFloat(moduloSeleccionado.potencia) / 1000).toFixed(3);
                          areas[index].kwp = kwp;
                        }
                        onChange({ ...datos, prop_areas_produccion: areas });
                      }}
                      disabled={soloUnTipoModulo || !area.modulo_marca}
                      style={{ 
                        width: '100%', 
                        padding: '8px 12px', 
                        border: (soloUnTipoModulo || modulos.filter(m => m.marca === (area.modulo_marca || modulos[0]?.marca)).length === 1) ? '2px solid #4CAF50' : '1px solid #DEE2E6', 
                        borderRadius: '6px', 
                        fontSize: '13px', 
                        backgroundColor: (soloUnTipoModulo || modulos.filter(m => m.marca === (area.modulo_marca || modulos[0]?.marca)).length === 1) ? '#F1F8E9' : 'white',
                        cursor: (soloUnTipoModulo || !area.modulo_marca) ? 'default' : 'pointer'
                      }}
                    >
                      <option value="">Seleccionar...</option>
                      {modulos.filter(m => m.marca === (area.modulo_marca || (soloUnTipoModulo ? modulos[0]?.marca : ''))).map((mod, idx) => (
                        <option key={idx} value={mod.modelo}>{mod.modelo} ({mod.potencia} Wp)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>Nº Módulos FV</label>
                    <input type="number" value={area.num_modulos}
                      onChange={(e) => {
                        const numModulos = e.target.value;
                        const potMod = parseFloat(moduloActual?.potencia) || 0;
                        if (numModulos && potMod > 0) {
                          const kwp = (parseFloat(numModulos) * potMod / 1000).toFixed(3);
                          const areas = [...(datos.prop_areas_produccion || [])];
                          areas[index] = { ...areas[index], num_modulos: numModulos, kwp: kwp };
                          onChange({ ...datos, prop_areas_produccion: areas });
                        } else {
                          updateAreaProduccion(index, 'num_modulos', numModulos);
                        }
                      }}
                      placeholder="150"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>
                      kWp {moduloActual?.potencia && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#4CAF50' }}>(auto)</span>}
                    </label>
                    <input type="number" value={area.kwp} onChange={(e) => updateAreaProduccion(index, 'kwp', e.target.value)} placeholder="97.5"
                      style={{ width: '100%', padding: '8px 12px', border: area.kwp && area.num_modulos ? '2px solid #4CAF50' : '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px', backgroundColor: area.kwp && area.num_modulos ? '#F1F8E9' : 'white' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>kWh/año</label>
                    <input type="number" value={area.kwh_ano} onChange={(e) => updateAreaProduccion(index, 'kwh_ano', e.target.value)} placeholder="140075"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '4px' }}>kWh/kWp·año</label>
                    <input type="text" value={area.kwp > 0 && area.kwh_ano > 0 ? (parseFloat(area.kwh_ano) / parseFloat(area.kwp)).toFixed(1) : '-'} disabled
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #DEE2E6', borderRadius: '6px', fontSize: '13px', backgroundColor: '#F5F5F5' }}
                    />
                  </div>
                </div>
                
                {moduloActual?.potencia && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: COLOR_TEXT_LIGHT, display: 'flex', gap: '16px' }}>
                    <span>🔲 Módulo: {moduloActual.marca || 'Sin marca'} {moduloActual.modelo || ''}</span>
                    <span>⚡ Potencia: {moduloActual.potencia} Wp</span>
                    {area.num_modulos && <span>📊 Cálculo: {area.num_modulos} × {moduloActual.potencia} Wp = {(parseFloat(area.num_modulos) * parseFloat(moduloActual.potencia) / 1000).toFixed(3)} kWp</span>}
                  </div>
                )}
              </div>
            );
          })}
          
          <button onClick={addAreaProduccion}
            style={{ padding: '10px 20px', backgroundColor: 'white', border: `1px dashed ${COLOR_CORP}`, borderRadius: '8px', color: COLOR_CORP, fontSize: '13px', fontWeight: '500', cursor: 'pointer', width: '100%', marginBottom: '24px' }}
          >
            + Añadir otra área de producción
          </button>

          {/* PRODUCCIONES DE LA SOLUCIÓN DE PARTIDA */}
          <SectionTitle>📈 Producciones de la Solución de Partida</SectionTitle>
          <p style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '16px' }}>
            Archivos de producción simulada para el análisis energético
          </p>

          {/* Selector de fuente de datos */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
              Fuente de datos de producción
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleChange('prop_fuente_produccion', 'pvsyst')}
                style={{
                  padding: '12px 24px',
                  border: datos.prop_fuente_produccion === 'pvsyst' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
                  borderRadius: '8px',
                  backgroundColor: datos.prop_fuente_produccion === 'pvsyst' ? COLOR_CORP_LIGHT : 'white',
                  color: datos.prop_fuente_produccion === 'pvsyst' ? COLOR_CORP : COLOR_TEXT,
                  fontWeight: datos.prop_fuente_produccion === 'pvsyst' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                PVSyst
              </button>
              <button
                onClick={() => handleChange('prop_fuente_produccion', 'pvgis')}
                style={{
                  padding: '12px 24px',
                  border: datos.prop_fuente_produccion === 'pvgis' ? `2px solid ${COLOR_CORP}` : '1px solid #DEE2E6',
                  borderRadius: '8px',
                  backgroundColor: datos.prop_fuente_produccion === 'pvgis' ? COLOR_CORP_LIGHT : 'white',
                  color: datos.prop_fuente_produccion === 'pvgis' ? COLOR_CORP : COLOR_TEXT,
                  fontWeight: datos.prop_fuente_produccion === 'pvgis' ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                PVGIS
              </button>
            </div>
          </div>

          {/* OPCIÓN PVSyst */}
          {datos.prop_fuente_produccion === 'pvsyst' && (
            <div style={{ backgroundColor: '#FFF8E1', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #FFE082' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#F57C00', marginBottom: '16px' }}>
                ☀️ Configuración PVSyst
              </div>
              
              {/* Tipo de archivo PVSyst */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: COLOR_TEXT, marginBottom: '8px' }}>
                  Tipo de archivo
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="pvsyst_tipo"
                      checked={datos.prop_pvsyst_tipo === 'total'}
                      onChange={() => handleChange('prop_pvsyst_tipo', 'total')}
                      style={{ accentColor: COLOR_CORP }}
                    />
                    <span style={{ fontSize: '13px' }}>Producción total (1 archivo para toda la instalación)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="pvsyst_tipo"
                      checked={datos.prop_pvsyst_tipo === 'por_area'}
                      onChange={() => handleChange('prop_pvsyst_tipo', 'por_area')}
                      style={{ accentColor: COLOR_CORP }}
                    />
                    <span style={{ fontSize: '13px' }}>Por área (1 archivo por cada área)</span>
                  </label>
                </div>
              </div>

              {/* Archivo total PVSyst */}
              {datos.prop_pvsyst_tipo === 'total' && (
                <div>
                  <input
                    type="file"
                    id="file-pvsyst-total"
                    accept=".csv,.xlsx,.xls"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setArchivoPVSystTotalBlob(file); // Guardar para descarga
                        handleChange('prop_pvsyst_procesando_total', true);
                        try {
                          const resultado = await procesarArchivoProduccion(file, 1);
                          onChange({
                            ...datos,
                            prop_pvsyst_archivo_total: file.name,
                            prop_pvsyst_datos_total: resultado,
                            prop_pvsyst_procesando_total: false
                          });
                        } catch (err) {
                          alert('Error procesando archivo: ' + err.message);
                          handleChange('prop_pvsyst_procesando_total', false);
                        }
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => document.getElementById('file-pvsyst-total').click()}
                      disabled={datos.prop_pvsyst_procesando_total}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: datos.prop_pvsyst_datos_total ? '#E8F5E9' : 'white',
                        border: datos.prop_pvsyst_datos_total ? '2px solid #4CAF50' : `1px solid ${COLOR_CORP}`,
                        borderRadius: '8px',
                        color: datos.prop_pvsyst_datos_total ? '#2E7D32' : COLOR_CORP,
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: datos.prop_pvsyst_procesando_total ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {datos.prop_pvsyst_procesando_total ? '⏳ Procesando...' : datos.prop_pvsyst_datos_total ? '✅' : '📁'} 
                      {datos.prop_pvsyst_procesando_total ? '' : 'Archivo producción total PVSyst'}
                    </button>
                    {archivoPVSystTotalBlob && (
                      <button
                        onClick={() => descargarArchivo(archivoPVSystTotalBlob, datos.prop_pvsyst_archivo_total)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: 'white',
                          border: '1px solid #4CAF50',
                          borderRadius: '6px',
                          color: '#4CAF50',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        📥 Descargar
                      </button>
                    )}
                  </div>
                  {datos.prop_pvsyst_archivo_total && (
                    <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '4px' }}>{datos.prop_pvsyst_archivo_total}</div>
                  )}
                  
                  {/* Resumen de producción total PVSyst */}
                  {datos.prop_pvsyst_datos_total && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '16px', 
                      backgroundColor: '#F1F8E9', 
                      borderRadius: '8px',
                      border: '1px solid #AED581'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontSize: '13px', color: '#558B2F', fontWeight: '600' }}>
                          📊 Producción Total Procesada
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#2E7D32' }}>
                          {datos.prop_pvsyst_datos_total.totalAnual.toLocaleString()} kWh/año
                        </div>
                      </div>
                      
                      {/* Gráfico de barras por mes */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {datos.prop_pvsyst_datos_total.resumenMeses.map((mes, i) => {
                          const maxProd = Math.max(...datos.prop_pvsyst_datos_total.resumenMeses.map(m => m.produccion));
                          const altura = maxProd > 0 ? (mes.produccion / maxProd) * 60 : 0;
                          return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: '100%', height: '60px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                <div style={{ width: '80%', height: `${altura}px`, backgroundColor: '#FF9800', borderRadius: '2px 2px 0 0', minHeight: mes.produccion > 0 ? '4px' : '0' }} />
                              </div>
                              <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>{mes.nombreCorto}</div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Tabla de valores */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', fontSize: '10px' }}>
                        {datos.prop_pvsyst_datos_total.resumenMeses.map((mes, i) => (
                          <div key={i} style={{ textAlign: 'center', padding: '4px', backgroundColor: 'white', borderRadius: '4px' }}>
                            <div style={{ fontWeight: '600', color: '#F57C00' }}>{mes.nombreCorto}</div>
                            <div style={{ color: COLOR_TEXT }}>{mes.produccion.toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                      
                      <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '8px', textAlign: 'right' }}>
                        {datos.prop_pvsyst_datos_total.registrosValidos.toLocaleString()} registros procesados
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Archivos por área PVSyst */}
              {datos.prop_pvsyst_tipo === 'por_area' && (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {(datos.prop_areas_produccion || []).filter(a => a.incluir === 'si').map((area, idx) => {
                    const datosProcesados = datos.prop_pvsyst_datos_areas?.[idx];
                    const procesando = datos.prop_pvsyst_procesando_areas?.[idx];
                    
                    return (
                    <div key={idx} style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '8px', 
                      padding: '12px',
                      border: datosProcesados ? '2px solid #4CAF50' : '1px solid #FFE082'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: COLOR_TEXT }}>{area.nombre}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="file"
                            id={`file-pvsyst-area-${idx}`}
                            accept=".csv,.xlsx,.xls"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                // Guardar blob para descarga
                                setArchivosPVSystBlobs(prev => ({ ...prev, [idx]: file }));
                                
                                const procesandoState = { ...(datos.prop_pvsyst_procesando_areas || {}) };
                                procesandoState[idx] = true;
                                handleChange('prop_pvsyst_procesando_areas', procesandoState);
                                
                                try {
                                  const resultado = await procesarArchivoProduccion(file, 1);
                                  
                                  const archivos = { ...(datos.prop_pvsyst_archivos_areas || {}) };
                                  archivos[idx] = file.name;
                                  
                                  const datosState = { ...(datos.prop_pvsyst_datos_areas || {}) };
                                  datosState[idx] = resultado;
                                  
                                  // Actualizar kWh/año del área
                                  const areas = [...(datos.prop_areas_produccion || [])];
                                  const areaIdx = areas.findIndex(a => a.nombre === area.nombre);
                                  if (areaIdx >= 0) {
                                    areas[areaIdx] = { ...areas[areaIdx], kwh_ano: resultado.totalAnual.toFixed(0) };
                                  }
                                  
                                  procesandoState[idx] = false;
                                  
                                  onChange({
                                    ...datos,
                                    prop_pvsyst_archivos_areas: archivos,
                                    prop_pvsyst_datos_areas: datosState,
                                    prop_pvsyst_procesando_areas: procesandoState,
                                    prop_areas_produccion: areas
                                  });
                                } catch (err) {
                                  alert('Error procesando archivo: ' + err.message);
                                  procesandoState[idx] = false;
                                  handleChange('prop_pvsyst_procesando_areas', procesandoState);
                                }
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                          <button
                            onClick={() => document.getElementById(`file-pvsyst-area-${idx}`).click()}
                            disabled={procesando}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: datosProcesados ? '#E8F5E9' : 'white',
                              border: datosProcesados ? '2px solid #4CAF50' : '1px solid #F57C00',
                              borderRadius: '6px',
                              color: datosProcesados ? '#2E7D32' : '#F57C00',
                              fontSize: '12px',
                              cursor: procesando ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {procesando ? '⏳ Procesando...' : datosProcesados ? '✅' : '📁'} 
                            {procesando ? '' : datos.prop_pvsyst_archivos_areas?.[idx] || 'Adjuntar archivo'}
                          </button>
                          {archivosPVSystBlobs[idx] && (
                            <button
                              onClick={() => descargarArchivo(archivosPVSystBlobs[idx], datos.prop_pvsyst_archivos_areas?.[idx])}
                              style={{
                                padding: '6px 10px',
                                backgroundColor: 'white',
                                border: '1px solid #4CAF50',
                                borderRadius: '4px',
                                color: '#4CAF50',
                                fontSize: '10px',
                                cursor: 'pointer'
                              }}
                            >
                              📥
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: COLOR_TEXT_LIGHT, flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🏗️ <strong style={{ color: COLOR_TEXT }}>{area.tipo_estructura || '-'}</strong></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🧭 <strong style={{ color: COLOR_TEXT }}>{area.orientacion ? `${area.orientacion}°` : '-'}</strong></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📐 <strong style={{ color: COLOR_TEXT }}>{area.inclinacion ? `${area.inclinacion}°` : '-'}</strong></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>⚡ <strong style={{ color: COLOR_TEXT }}>{area.kwp ? `${area.kwp} kWp` : '-'}</strong></span>
                      </div>
                      
                      {/* Resumen de producción del área */}
                      {datosProcesados && (
                        <div style={{ 
                          marginTop: '12px', 
                          padding: '12px', 
                          backgroundColor: '#F1F8E9', 
                          borderRadius: '6px',
                          border: '1px solid #AED581'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#558B2F', fontWeight: '600' }}>📊 Producción</span>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#2E7D32' }}>{datosProcesados.totalAnual.toLocaleString()} kWh/año</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px', fontSize: '9px' }}>
                            {datosProcesados.resumenMeses.map((mes, i) => (
                              <div key={i} style={{ textAlign: 'center', padding: '2px', backgroundColor: 'white', borderRadius: '2px' }}>
                                <div style={{ fontWeight: '600', color: '#F57C00' }}>{mes.nombreCorto}</div>
                                <div style={{ color: COLOR_TEXT }}>{(mes.produccion / 1000).toFixed(1)}k</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* OPCIÓN PVGIS */}
          {datos.prop_fuente_produccion === 'pvgis' && (
            <div style={{ backgroundColor: '#E3F2FD', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #90CAF9' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1976D2', marginBottom: '16px' }}>
                🌍 Configuración PVGIS
              </div>
              
              <p style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT, marginBottom: '16px' }}>
                Para cada área, indica si el archivo contiene la producción de 1 kWp o la potencia total del área
              </p>

              {/* Archivos por área PVGIS */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {(datos.prop_areas_produccion || []).filter(a => a.incluir === 'si').map((area, idx) => {
                  const tipoAreaPvgis = datos.prop_pvgis_tipo_areas?.[idx] || 'potencia_total';
                  const archivoSubido = datos.prop_pvgis_archivos_areas?.[idx];
                  const datosProcesados = datos.prop_pvgis_datos_procesados?.[idx];
                  const procesando = datos.prop_pvgis_procesando?.[idx];
                  
                  return (
                  <div key={idx} style={{ 
                    backgroundColor: 'white', 
                    borderRadius: '8px', 
                    padding: '16px',
                    border: datosProcesados ? '2px solid #4CAF50' : '1px solid #BBDEFB'
                  }}>
                    {/* Cabecera con nombre del área */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: COLOR_TEXT }}>{area.nombre}</span>
                      {tipoAreaPvgis === '1kwp' && area.kwp && (
                        <span style={{ fontSize: '12px', color: '#1976D2', backgroundColor: '#E3F2FD', padding: '4px 10px', borderRadius: '12px', fontWeight: '500' }}>
                          Archivo × {area.kwp} kWp
                        </span>
                      )}
                    </div>
                    
                    {/* Resumen del área */}
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: COLOR_TEXT_LIGHT, flexWrap: 'wrap', marginBottom: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🏗️ <strong style={{ color: COLOR_TEXT }}>{area.tipo_estructura || '-'}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🧭 <strong style={{ color: COLOR_TEXT }}>{area.orientacion ? `${area.orientacion}°` : '-'}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📐 <strong style={{ color: COLOR_TEXT }}>{area.inclinacion ? `${area.inclinacion}°` : '-'}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>⚡ <strong style={{ color: COLOR_TEXT }}>{area.kwp ? `${area.kwp} kWp` : '-'}</strong></span>
                    </div>

                    {/* Selector tipo de archivo y botón adjuntar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: COLOR_TEXT_LIGHT }}>Tipo archivo:</span>
                        <select
                          value={tipoAreaPvgis}
                          onChange={(e) => {
                            const tipos = { ...(datos.prop_pvgis_tipo_areas || {}) };
                            tipos[idx] = e.target.value;
                            handleChange('prop_pvgis_tipo_areas', tipos);
                          }}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #90CAF9',
                            borderRadius: '6px',
                            fontSize: '12px',
                            backgroundColor: 'white',
                            color: '#1976D2',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="potencia_total">Potencia total área</option>
                          <option value="1kwp">1 kWp (se multiplica)</option>
                        </select>
                      </div>
                      
                      <input
                        type="file"
                        id={`file-pvgis-area-${idx}`}
                        accept=".csv,.xlsx,.xls"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            // Guardar blob para descarga
                            setArchivosPVGISBlobs(prev => ({ ...prev, [idx]: file }));
                            
                            // Marcar como procesando
                            const procesandoState = { ...(datos.prop_pvgis_procesando || {}) };
                            procesandoState[idx] = true;
                            handleChange('prop_pvgis_procesando', procesandoState);
                            
                            try {
                              // Determinar multiplicador
                              const multiplicador = tipoAreaPvgis === '1kwp' ? (parseFloat(area.kwp) || 1) : 1;
                              
                              // Procesar archivo
                              const resultado = await procesarArchivoProduccion(file, multiplicador);
                              
                              // Guardar nombre del archivo
                              const archivos = { ...(datos.prop_pvgis_archivos_areas || {}) };
                              archivos[idx] = file.name;
                              
                              // Guardar datos procesados
                              const datosProcesadosState = { ...(datos.prop_pvgis_datos_procesados || {}) };
                              datosProcesadosState[idx] = resultado;
                              
                              // Actualizar kWh/año del área con el total anual
                              const areas = [...(datos.prop_areas_produccion || [])];
                              const areaIdx = areas.findIndex(a => a.nombre === area.nombre);
                              if (areaIdx >= 0) {
                                areas[areaIdx] = { ...areas[areaIdx], kwh_ano: resultado.totalAnual.toFixed(0) };
                              }
                              
                              // Quitar estado procesando
                              procesandoState[idx] = false;
                              
                              onChange({
                                ...datos,
                                prop_pvgis_archivos_areas: archivos,
                                prop_pvgis_datos_procesados: datosProcesadosState,
                                prop_pvgis_procesando: procesandoState,
                                prop_areas_produccion: areas
                              });
                              
                              console.log('Archivo procesado:', resultado);
                            } catch (err) {
                              console.error('Error procesando archivo:', err);
                              alert('Error procesando archivo: ' + err.message);
                              procesandoState[idx] = false;
                              handleChange('prop_pvgis_procesando', procesandoState);
                            }
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => document.getElementById(`file-pvgis-area-${idx}`).click()}
                        disabled={procesando}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: datosProcesados ? '#E8F5E9' : procesando ? '#F5F5F5' : 'white',
                          border: datosProcesados ? '2px solid #4CAF50' : '1px solid #1976D2',
                          borderRadius: '6px',
                          color: datosProcesados ? '#2E7D32' : '#1976D2',
                          fontSize: '12px',
                          cursor: procesando ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {procesando ? '⏳ Procesando...' : datosProcesados ? '✅' : '📁'} 
                        {procesando ? '' : archivoSubido || 'Adjuntar archivo'}
                      </button>
                      {archivosPVGISBlobs[idx] && (
                        <button
                          onClick={() => descargarArchivo(archivosPVGISBlobs[idx], datos.prop_pvgis_archivos_areas?.[idx])}
                          style={{
                            padding: '6px 10px',
                            backgroundColor: 'white',
                            border: '1px solid #4CAF50',
                            borderRadius: '4px',
                            color: '#4CAF50',
                            fontSize: '10px',
                            cursor: 'pointer'
                          }}
                        >
                          📥
                        </button>
                      )}
                    </div>

                    {/* Resumen de producción procesada */}
                    {datosProcesados && (
                      <div style={{ 
                        marginTop: '16px', 
                        padding: '16px', 
                        backgroundColor: '#F1F8E9', 
                        borderRadius: '8px',
                        border: '1px solid #AED581'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#558B2F', fontWeight: '600' }}>
                            📊 Producción Procesada
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: '#2E7D32' }}>
                            {datosProcesados.totalAnual.toLocaleString()} kWh/año
                          </div>
                        </div>
                        
                        {tipoAreaPvgis === '1kwp' && (
                          <div style={{ fontSize: '11px', color: '#689F38', marginBottom: '12px', fontStyle: 'italic' }}>
                            ⚙️ Datos multiplicados por {area.kwp} kWp (archivo original de 1 kWp)
                          </div>
                        )}
                        
                        {/* Gráfico de barras por mes */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px', marginBottom: '8px' }}>
                          {datosProcesados.resumenMeses.map((mes, i) => {
                            const maxProd = Math.max(...datosProcesados.resumenMeses.map(m => m.produccion));
                            const altura = maxProd > 0 ? (mes.produccion / maxProd) * 60 : 0;
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ 
                                  width: '100%', 
                                  height: '60px', 
                                  display: 'flex', 
                                  alignItems: 'flex-end',
                                  justifyContent: 'center'
                                }}>
                                  <div style={{ 
                                    width: '80%', 
                                    height: `${altura}px`, 
                                    backgroundColor: '#8BC34A',
                                    borderRadius: '2px 2px 0 0',
                                    minHeight: mes.produccion > 0 ? '4px' : '0'
                                  }} />
                                </div>
                                <div style={{ fontSize: '9px', color: COLOR_TEXT_LIGHT, marginTop: '4px' }}>
                                  {mes.nombreCorto}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Tabla de valores */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', fontSize: '10px' }}>
                          {datosProcesados.resumenMeses.map((mes, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: '4px', backgroundColor: 'white', borderRadius: '4px' }}>
                              <div style={{ fontWeight: '600', color: '#558B2F' }}>{mes.nombreCorto}</div>
                              <div style={{ color: COLOR_TEXT }}>{mes.produccion.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                        
                        <div style={{ fontSize: '10px', color: COLOR_TEXT_LIGHT, marginTop: '8px', textAlign: 'right' }}>
                          {datosProcesados.registrosValidos.toLocaleString()} registros procesados
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mensaje si no se ha seleccionado fuente */}
          {!datos.prop_fuente_produccion && (
            <div style={{ 
              backgroundColor: '#F5F5F5', 
              borderRadius: '8px', 
              padding: '20px', 
              textAlign: 'center',
              color: COLOR_TEXT_LIGHT,
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              Selecciona una fuente de datos (PVSyst o PVGIS) para cargar los archivos de producción
            </div>
          )}

          {/* RESUMEN DE LA INSTALACIÓN */}
          <div style={{ backgroundColor: '#E8F5E9', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: '2px solid #4CAF50' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#2E7D32' }}>📊 Resumen de la Instalación Propuesta</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2E7D32' }}>{totalModulos || '-'}</div>
                <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>Módulos</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2E7D32' }}>{potenciaPicoFinal.toFixed(1) || '-'}</div>
                <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>kWp</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2E7D32' }}>{potenciaNominalTotal.toFixed(1) || '-'}</div>
                <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>kWn</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2E7D32' }}>{ratioDCAC}</div>
                <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>Ratio DC/AC</div>
              </div>
              <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2E7D32' }}>{(datos.prop_areas_produccion || []).filter(a => a.incluir === 'si').length}</div>
                <div style={{ fontSize: '11px', color: COLOR_TEXT_LIGHT }}>Áreas</div>
              </div>
            </div>

            <div style={{ fontSize: '13px', fontWeight: '600', color: '#2E7D32', marginBottom: '12px' }}>Detalle por Áreas de Producción:</div>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#E8F5E9' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #C8E6C9' }}>Área</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Tipo Módulo</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Módulos</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>kWp</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>kWh/año</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Orient.</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Inclin.</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Estructura</th>
                    <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #C8E6C9' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(datos.prop_areas_produccion || []).map((area, idx) => {
                    const idxMod = parseInt(area.tipo_modulo_idx) || 0;
                    const modArea = modulos[idxMod];
                    const nombreModulo = modArea?.marca && modArea?.modelo ? `${modArea.marca} ${modArea.modelo}` : modArea?.potencia ? `${modArea.potencia} Wp` : '-';
                    return (
                    <tr key={idx} style={{ opacity: area.incluir === 'si' ? 1 : 0.5 }}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #E0E0E0' }}>{area.nombre}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0', fontSize: '11px' }}>{nombreModulo}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.num_modulos || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.kwp || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.kwh_ano || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.orientacion ? `${area.orientacion}°` : '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.inclinacion ? `${area.inclinacion}°` : '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>{area.tipo_estructura || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #E0E0E0' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', backgroundColor: area.incluir === 'si' ? '#C8E6C9' : '#FFCDD2', color: area.incluir === 'si' ? '#2E7D32' : '#C62828' }}>
                          {area.incluir === 'si' ? '✓ Incluida' : '✗ Excluida'}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {/* ========== SECCIÓN BATERÍA ========== */}
      {datos.prop_incluir_bateria === 'si' && (
        <>
          {/* EQUIPO */}
          <SectionTitle>🔋 Equipo de Almacenamiento</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <InputField 
              label="Marca" 
              campo="prop_bateria_marca" 
              placeholder="Risen, BYD, Huawei..."
            />
            <InputField 
              label="Modelo" 
              campo="prop_bateria_modelo" 
              placeholder="iCon SU261E125LM"
            />
          </div>

          {/* CAPACIDAD Y POTENCIA */}
          <SectionTitle>⚡ Capacidad y Potencia</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <InputField 
              label="Potencia Unitaria Batería" 
              campo="prop_bateria_potencia" 
              tipo="number"
              placeholder="125"
              unidad="kW"
            />
            <InputField 
              label="Capacidad Unitaria Batería" 
              campo="prop_bateria_capacidad" 
              tipo="number"
              placeholder="261"
              unidad="kWh"
            />
          </div>
        </>
      )}

      {/* Mensaje si no hay nada seleccionado */}
      {datos.prop_incluir_fv !== 'si' && datos.prop_incluir_bateria !== 'si' && (
        <div style={{ textAlign: 'center', padding: '40px', color: COLOR_TEXT_LIGHT }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>⚡</span>
          <p>Selecciona qué incluir en la propuesta para continuar</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPONENTE PRINCIPAL - APP
// ============================================
export default function YlioApp() {
  // Estado de navegación
  const [pantalla, setPantalla] = useState('inicio'); // 'inicio' | 'oportunidad' | 'ofertas'
  const [pasoActual, setPasoActual] = useState(1);
  
  // Estado de oportunidades guardadas
  const [oportunidadesGuardadas, setOportunidadesGuardadas] = useState([]);
  
  // Estado para mostrar notificación de autoguardado
  const [mostrarAutoguardado, setMostrarAutoguardado] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);

  // Función para cargar datos guardados de localStorage
  const cargarDatosGuardados = () => {
    try {
      const datosGuardados = localStorage.getItem('ylio_datos_oportunidad');
      const pasoGuardado = localStorage.getItem('ylio_paso_actual');
      const pantallaGuardada = localStorage.getItem('ylio_pantalla');
      
      if (datosGuardados) {
        return {
          datos: JSON.parse(datosGuardados),
          paso: pasoGuardado ? parseInt(pasoGuardado) : 1,
          pantalla: pantallaGuardada || 'inicio'
        };
      }
    } catch (e) {
      console.error('Error cargando datos guardados:', e);
    }
    return null;
  };

  // Estado de datos de la oportunidad (inicializar desde localStorage si existe)
  const datosIniciales = cargarDatosGuardados();
  const [datosOportunidad, setDatosOportunidad] = useState(datosIniciales?.datos || {
    // Archivos
    archivo_sips: '',
    archivo_consumo: '',
    fuente_datos_consumo: '',
    // Estado de la oferta en el funnel
    estado_oferta: 'oferta',
    // Identificación del Proyecto
    id_oferta: '',
    denominacion_oferta: '',
    version: '',
    descripcion_version: '',
    fecha_solicitud: '',
    fecha_inicio: '',
    // Datos del Cliente
    cliente_denominacion: '',
    cliente_nombre: '',
    cliente_cif: '',
    cnae: '',
    // Ubicación del Proyecto
    ubicacion_direccion: '',
    ubicacion_cp: '',
    ubicacion_municipio: '',
    ubicacion_provincia: '',
    ubicacion_comunidad: '',
    ubicacion_latitud: '',
    ubicacion_longitud: '',
    coordenada_x: '',
    coordenada_y: '',
    huso: '',
    referencia_catastral: '',
    // Datos SIPS (precargados)
    sips_cups: '',
    sips_distribuidora: '',
    sips_tarifa: '',
    sips_tension: '',
    sips_potencia_max_bie: '',
    sips_derechos_extension: '',
    sips_derechos_acceso: '',
    sips_potencia_p1: '',
    sips_potencia_p2: '',
    sips_potencia_p3: '',
    sips_potencia_p4: '',
    sips_potencia_p5: '',
    sips_potencia_p6: '',
    sips_consumo_anual: '',
    sips_consumo_p1: '',
    sips_consumo_p2: '',
    sips_consumo_p3: '',
    sips_consumo_p4: '',
    sips_consumo_p5: '',
    sips_consumo_p6: '',
    // Paso 2: Tarifa y Precios
    cups: '',
    tarifa_acceso: '',
    distribuidora: '',
    comercializadora: '',
    tension: '',
    potencia_max_bie: '',
    derechos_extension: '',
    derechos_acceso: '',
    potencia_p1: '',
    potencia_p2: '',
    potencia_p3: '',
    potencia_p4: '',
    potencia_p5: '',
    potencia_p6: '',
    modalidad_autoconsumo: '',
    arbitraje: '',
    tipo_contrato: '',
    fee_compra: '',
    desvios: '',
    fee_excedentes: '',
    valoracion_excedentes: '',
    excedentes_diferencial_omie: '',
    precio_fijo_excedentes: '',
    excedentes_porcentaje_omie: '',
    tipo_precios_energia: '',
    precio_energia_p1: '',
    precio_energia_p2: '',
    precio_energia_p3: '',
    precio_energia_p4: '',
    precio_energia_p5: '',
    precio_energia_p6: '',
    sips_tension: '',
    sips_potencia_max_bie: '',
    sips_derechos_extension: '',
    sips_derechos_acceso: '',
    sips_potencia_p1: '',
    sips_potencia_p2: '',
    sips_potencia_p3: '',
    sips_potencia_p4: '',
    sips_potencia_p5: '',
    sips_potencia_p6: '',
    sips_consumo_anual: '',
    sips_consumo_p1: '',
    sips_consumo_p2: '',
    sips_consumo_p3: '',
    sips_consumo_p4: '',
    sips_consumo_p5: '',
    sips_consumo_p6: '',
    // Paso 2: Tarifa y Precios
    cups: '',
    tarifa_acceso: '',
    distribuidora: '',
    comercializadora: '',
    tension: '',
    potencia_max_bie: '',
    derechos_extension: '',
    derechos_acceso: '',
    potencia_p1: '',
    potencia_p2: '',
    potencia_p3: '',
    potencia_p4: '',
    potencia_p5: '',
    potencia_p6: '',
    modalidad_autoconsumo: '',
    arbitraje: '',
    tipo_contrato: '',
    fee_compra: '',
    desvios: '',
    fee_excedentes: '',
    valoracion_excedentes: '',
    excedentes_diferencial_omie: '',
    precio_fijo_excedentes: '',
    excedentes_porcentaje_omie: '',
    tipo_precios_energia: '',
    precio_energia_p1: '',
    precio_energia_p2: '',
    precio_energia_p3: '',
    precio_energia_p4: '',
    precio_energia_p5: '',
    precio_energia_p6: '',
    tipo_precios_potencia: '',
    precio_potencia_p1: '',
    precio_potencia_p2: '',
    precio_potencia_p3: '',
    precio_potencia_p4: '',
    precio_potencia_p5: '',
    precio_potencia_p6: '',
    bonificacion_iee: '',
    coste_alquiler_contador: '',
    // Paso 3: Situación Actual
    fv_existente: '',
    archivo_produccion_real: '',
    archivo_produccion_simulado: '',
    modalidad_autoconsumo: '',
    potencia_max_vertido: '',
    almacenamiento_existente: '',
    fv_potencia_pico_manual: '',
    fv_potencia_nominal_manual: '',
    inversores_existentes: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
    modulos_existentes: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
    fv_produccion_anual: '',
    produccion_real_horaria: null,
    produccion_real_estadisticas: null,
    produccion_simulada_horaria: null,
    produccion_simulada_estadisticas: null,
    bateria_marca: '',
    bateria_modelo: '',
    bateria_capacidad: '',
    bateria_potencia: '',
    bateria_cantidad: '',
    // Paso 4: Propuesta
    prop_incluir_fv: '',
    prop_incluir_bateria: '',
    prop_potencia_pico_manual: '',
    prop_potencia_nominal_manual: '',
    prop_inversores: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
    prop_modulos: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
    prop_modulo_unico: 'si',
    prop_areas_produccion: [{
      nombre: 'Área producción 1',
      orientacion: '',
      inclinacion: '',
      localizacion_estructura: '',
      tipo_estructura: '',
      tipo_modulo_idx: '0',
      num_modulos: '',
      kwp: '',
      kwh_ano: '',
      incluir: 'si'
    }],
    prop_bateria_marca: '',
    prop_bateria_modelo: '',
    prop_bateria_capacidad: '',
    prop_bateria_potencia: '',
    prop_bateria_uds_esc1: '',
    prop_bateria_uds_esc2: '',
    prop_bateria_uds_esc3: '',
    prop_bateria_rendimiento: '95',
    prop_bateria_soc_min: '10',
    prop_bateria_soc_max: '100',
    prop_bateria_backup: '',
  });
  
  const [errores, setErrores] = useState({});

  // Efecto para restaurar paso y pantalla al cargar
  React.useEffect(() => {
    if (datosIniciales) {
      setPasoActual(datosIniciales.paso);
      setPantalla(datosIniciales.pantalla);
    }
  }, []);

  // Efecto para autoguardar cuando cambian los datos
  React.useEffect(() => {
    // No guardar si estamos en la pantalla de inicio sin datos
    if (pantalla === 'inicio' && !datosOportunidad.id_oferta) return;
    
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem('ylio_datos_oportunidad', JSON.stringify(datosOportunidad));
        localStorage.setItem('ylio_paso_actual', pasoActual.toString());
        localStorage.setItem('ylio_pantalla', pantalla);
        
        // Mostrar notificación de autoguardado
        setUltimoGuardado(new Date());
        setMostrarAutoguardado(true);
        
        // Ocultar la notificación después de 2 segundos
        setTimeout(() => setMostrarAutoguardado(false), 2000);
        
        console.log('Autoguardado:', new Date().toLocaleTimeString());
      } catch (e) {
        console.error('Error en autoguardado:', e);
      }
    }, 500); // Debounce de 500ms para no guardar en cada tecla
    
    return () => clearTimeout(timeoutId);
  }, [datosOportunidad, pasoActual, pantalla]);

  // Función para limpiar datos guardados
  const limpiarDatosGuardados = () => {
    localStorage.removeItem('ylio_datos_oportunidad');
    localStorage.removeItem('ylio_paso_actual');
    localStorage.removeItem('ylio_pantalla');
  };

  // Generar nuevo ID de oferta
  const generarNuevoId = () => {
    const año = new Date().getFullYear();
    const num = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    return `OFE_${año}_${num}`;
  };

  // Manejar selección de módulo en inicio
  const handleSeleccionarModulo = (moduloId) => {
    if (moduloId === 'ofertas') {
      // Ir a la pantalla de proyectos
      setPantalla('ofertas');
    } else if (moduloId === 'nueva_oportunidad') {
      // Reiniciar datos y entrar al wizard
      setDatosOportunidad({
        // Archivos
        archivo_sips: '',
        archivo_consumo: '',
        fuente_datos_consumo: '',
        // Estado de la oferta en el funnel
        estado_oferta: 'oferta',
        fecha_creacion: new Date().toISOString(),
        // Identificación del Proyecto
        id_oferta: generarNuevoId(),
        denominacion_oferta: '',
        version: '1.0',
        descripcion_version: 'Versión inicial',
        fecha_solicitud: new Date().toISOString().split('T')[0],
        fecha_inicio: '',
        // Datos del Cliente
        cliente_denominacion: '',
        cliente_nombre: '',
        cliente_cif: '',
        cnae: '',
        // Ubicación del Proyecto
        ubicacion_direccion: '',
        ubicacion_cp: '',
        ubicacion_municipio: '',
        ubicacion_provincia: '',
        ubicacion_comunidad: '',
        ubicacion_latitud: '',
        ubicacion_longitud: '',
        coordenada_x: '',
        coordenada_y: '',
        huso: '',
        referencia_catastral: '',
        // Datos SIPS (precargados)
        sips_cups: '',
        sips_distribuidora: '',
        sips_tarifa: '',
        sips_tension: '',
        sips_potencia_max_bie: '',
        sips_derechos_extension: '',
        sips_derechos_acceso: '',
        sips_potencia_p1: '',
        sips_potencia_p2: '',
        sips_potencia_p3: '',
        sips_potencia_p4: '',
        sips_potencia_p5: '',
        sips_potencia_p6: '',
        sips_consumo_anual: '',
        sips_consumo_p1: '',
        sips_consumo_p2: '',
        sips_consumo_p3: '',
        sips_consumo_p4: '',
        sips_consumo_p5: '',
        sips_consumo_p6: '',
        // Paso 2: Tarifa y Precios
        cups: '',
        tarifa_acceso: '',
        distribuidora: '',
        comercializadora: '',
        tension: '',
        potencia_max_bie: '',
        derechos_extension: '',
        derechos_acceso: '',
        potencia_p1: '',
        potencia_p2: '',
        potencia_p3: '',
        potencia_p4: '',
        potencia_p5: '',
        potencia_p6: '',
        modalidad_autoconsumo: '',
        arbitraje: '',
        tipo_contrato: '',
        fee_compra: '',
        desvios: '',
        fee_excedentes: '',
        valoracion_excedentes: '',
        excedentes_diferencial_omie: '',
        precio_fijo_excedentes: '',
        excedentes_porcentaje_omie: '',
        tipo_precios_energia: '',
        precio_energia_p1: '',
        precio_energia_p2: '',
        precio_energia_p3: '',
        precio_energia_p4: '',
        precio_energia_p5: '',
        precio_energia_p6: '',
        tipo_precios_potencia: '',
        precio_potencia_p1: '',
        precio_potencia_p2: '',
        precio_potencia_p3: '',
        precio_potencia_p4: '',
        precio_potencia_p5: '',
        precio_potencia_p6: '',
        bonificacion_iee: '',
        coste_alquiler_contador: '',
        // Paso 3: Situación Actual
        fv_existente: '',
        archivo_produccion_real: '',
        archivo_produccion_simulado: '',
        modalidad_autoconsumo: '',
        potencia_max_vertido: '',
        almacenamiento_existente: '',
        fv_potencia_pico_manual: '',
        fv_potencia_nominal_manual: '',
        inversores_existentes: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
        modulos_existentes: [{ marca: '', modelo: '', potencia: '', cantidad: 1 }],
        fv_produccion_anual: '',
        produccion_real_horaria: null,
        produccion_real_estadisticas: null,
        produccion_simulada_horaria: null,
        produccion_simulada_estadisticas: null,
        bateria_marca: '',
        bateria_modelo: '',
        bateria_capacidad: '',
        bateria_potencia: '',
        bateria_cantidad: '',
      });
      setErrores({});
      setPasoActual(1);
      setPantalla('oportunidad');
    }
    // Aquí iremos añadiendo más módulos...
  };

  // Volver al paso anterior o al inicio
  const handleVolver = () => {
    if (pasoActual > 1) {
      setPasoActual(pasoActual - 1);
    } else {
      // Guardar automáticamente como borrador al salir
      guardarOportunidad();
      setPantalla('inicio');
    }
  };

  // Guardar oportunidad (sin validaciones)
  const guardarOportunidad = () => {
    // Buscar si ya existe
    const index = oportunidadesGuardadas.findIndex(o => o.id_oferta === datosOportunidad.id_oferta);
    
    const nuevaOportunidad = {
      ...datosOportunidad,
      ultimaModificacion: new Date().toISOString(),
      pasoActual: pasoActual,
    };
    
    if (index >= 0) {
      // Actualizar existente
      const nuevasOportunidades = [...oportunidadesGuardadas];
      nuevasOportunidades[index] = nuevaOportunidad;
      setOportunidadesGuardadas(nuevasOportunidades);
    } else {
      // Añadir nueva
      setOportunidadesGuardadas([...oportunidadesGuardadas, nuevaOportunidad]);
    }
  };

  // Abrir oportunidad existente para editar
  const handleAbrirOportunidad = (oportunidad) => {
    setDatosOportunidad(oportunidad);
    setPasoActual(oportunidad.pasoActual || 1);
    setPantalla('oportunidad');
  };

  // Cambiar estado de una oferta en el funnel
  const handleCambiarEstadoOferta = (idOferta, nuevoEstado) => {
    const nuevasOportunidades = oportunidadesGuardadas.map(o => {
      if (o.id_oferta === idOferta) {
        return {
          ...o,
          estado_oferta: nuevoEstado,
          ultimaModificacion: new Date().toISOString()
        };
      }
      return o;
    });
    setOportunidadesGuardadas(nuevasOportunidades);
  };

  // Sin validaciones - siempre permite avanzar
  const validarPaso = () => {
    return true;
  };

  // Avanzar al siguiente paso
  const handleSiguiente = () => {
    if (validarPaso()) {
      if (pasoActual < PASOS_OPORTUNIDAD.length) {
        setPasoActual(pasoActual + 1);
      } else {
        // Último paso: guardar y volver al inicio
        guardarOportunidad();
        alert('Oportunidad finalizada y guardada correctamente');
        setPantalla('inicio');
      }
    }
  };

  // Renderizar contenido del paso actual
  const renderPasoActual = () => {
    switch (pasoActual) {
      case 1:
        return (
          <Paso1Proyecto 
            datos={datosOportunidad} 
            onChange={setDatosOportunidad}
          />
        );
      case 2:
        return (
          <Paso2Tarifa 
            datos={datosOportunidad} 
            onChange={setDatosOportunidad}
          />
        );
      case 3:
        return (
          <Paso3SituacionActual 
            datos={datosOportunidad} 
            onChange={setDatosOportunidad}
          />
        );
      case 4:
        return (
          <Paso4Propuesta 
            datos={datosOportunidad} 
            onChange={setDatosOportunidad}
          />
        );
      case 5:
        return (
          <div style={{ padding: '60px', textAlign: 'center', color: COLOR_TEXT_LIGHT }}>
            <span style={{ fontSize: '64px', display: 'block', marginBottom: '20px' }}>⚡</span>
            <h3 style={{ color: COLOR_TEXT, marginBottom: '10px' }}>Paso 5: Dimensionamiento</h3>
            <p>Análisis de 6 escenarios de potencia</p>
            <p style={{ fontSize: '13px', marginTop: '20px', color: COLOR_CORP }}>
              ⏳ Próximo paso a implementar
            </p>
          </div>
        );
      case 6:
        return (
          <div style={{ padding: '60px', textAlign: 'center', color: COLOR_TEXT_LIGHT }}>
            <span style={{ fontSize: '64px', display: 'block', marginBottom: '20px' }}>✅</span>
            <h3 style={{ color: COLOR_TEXT, marginBottom: '10px' }}>Paso 6: Selección Final</h3>
            <p>Confirmar escenario y guardar en base de datos</p>
            <p style={{ fontSize: '13px', marginTop: '20px', color: COLOR_CORP }}>
              ⏳ Próximo paso a implementar
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ 
      fontFamily: "Arial, sans-serif",
      backgroundColor: COLOR_BG_SECONDARY,
      minHeight: "100vh",
      padding: "0",
    }}>
      <div style={{
        backgroundColor: COLOR_BG,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* ========== HEADER CORPORATIVO YLIO ========== */}
        <div style={{
          backgroundColor: COLOR_BG,
          padding: '12px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `4px solid ${COLOR_CORP}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div 
            onClick={() => setPantalla('inicio')}
            style={{ cursor: 'pointer' }}
          >
            <YlioLogo width={320} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {pantalla === 'oportunidad' && (
              <span style={{ 
                fontSize: '13px', 
                color: COLOR_CORP_DARK,
                backgroundColor: COLOR_CORP_BG,
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                border: `1px solid ${COLOR_CORP}30`
              }}>
                📋 {datosOportunidad.id_oferta}
              </span>
            )}
            {/* Indicador de sesión guardada */}
            {pantalla === 'inicio' && datosIniciales && datosIniciales.datos?.id_oferta && (
              <button
                onClick={() => {
                  setPantalla(datosIniciales.pantalla || 'oportunidad');
                  setPasoActual(datosIniciales.paso || 1);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#FFF3E0',
                  border: `1px solid ${COLOR_CORP}`,
                  borderRadius: '6px',
                  color: COLOR_CORP,
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🔄 Recuperar sesión ({datosIniciales.datos.id_oferta})
              </button>
            )}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              backgroundColor: '#E8F5E9',
              padding: '6px 12px',
              borderRadius: '20px'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                backgroundColor: COLOR_SUCCESS, 
                borderRadius: '50%',
                boxShadow: '0 0 4px #28A745'
              }} />
              <span style={{ fontSize: '12px', color: COLOR_SUCCESS, fontWeight: '500' }}>Online</span>
            </div>
          </div>
        </div>
        
        {/* ========== NOTIFICACIÓN DE AUTOGUARDADO ========== */}
        {mostrarAutoguardado && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#E8F5E9',
            border: '1px solid #4CAF50',
            borderRadius: '8px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <span style={{ fontSize: '18px' }}>💾</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#2E7D32' }}>Autoguardado</div>
              <div style={{ fontSize: '11px', color: '#558B2F' }}>
                {ultimoGuardado ? ultimoGuardado.toLocaleTimeString() : ''}
              </div>
            </div>
          </div>
        )}
        
        {/* ========== CONTENIDO ========== */}
        {pantalla === 'inicio' ? (
          <PantallaInicio 
            onSeleccionarModulo={handleSeleccionarModulo}
            oportunidadesGuardadas={oportunidadesGuardadas}
            onAbrirOportunidad={handleAbrirOportunidad}
          />
        ) : pantalla === 'ofertas' ? (
          <PantallaOfertas 
            ofertas={oportunidadesGuardadas}
            onAbrirOferta={handleAbrirOportunidad}
            onCambiarEstado={handleCambiarEstadoOferta}
            onVolver={() => setPantalla('inicio')}
          />
        ) : (
          <>
            {/* Barra de pasos del wizard */}
            <div style={{ 
              display: 'flex', 
              backgroundColor: COLOR_BG_SECONDARY, 
              padding: '12px 20px',
              gap: '8px',
              borderBottom: '1px solid #DEE2E6',
              overflowX: 'auto'
            }}>
              {PASOS_OPORTUNIDAD.map((paso) => (
                <div 
                  key={paso.id}
                  onClick={() => setPasoActual(paso.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: paso.id === pasoActual ? COLOR_CORP : 
                                     paso.id < pasoActual ? COLOR_CORP_LIGHT : 'transparent',
                    color: paso.id === pasoActual ? 'white' : 
                           paso.id < pasoActual ? COLOR_CORP : COLOR_TEXT_LIGHT,
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: paso.id === pasoActual ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    border: paso.id === pasoActual ? 'none' : '1px solid transparent',
                    ':hover': { backgroundColor: '#F3F4F6' }
                  }}
                  onMouseEnter={(e) => {
                    if (paso.id !== pasoActual && paso.id >= pasoActual) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (paso.id !== pasoActual && paso.id >= pasoActual) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span>{paso.icono}</span>
                  <span>{paso.nombre}</span>
                  {paso.id < pasoActual && <span style={{ marginLeft: '4px' }}>✓</span>}
                </div>
              ))}
            </div>
            
            {/* Contenido del paso */}
            <div style={{ flex: 1, padding: '25px 30px', overflowY: 'auto', backgroundColor: COLOR_BG_SECONDARY }}>
              <div style={{ 
                maxWidth: '950px', 
                margin: '0 auto',
                backgroundColor: COLOR_BG,
                borderRadius: '12px',
                padding: '25px 30px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}>
                {renderPasoActual()}
              </div>
            </div>
            
            {/* Footer con navegación */}
            <div style={{
              borderTop: '1px solid #DEE2E6',
              padding: '15px 25px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: COLOR_BG
            }}>
              <button
                onClick={handleVolver}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  border: '1px solid #DEE2E6',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: COLOR_TEXT,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ← {pasoActual === 1 ? 'Inicio' : 'Anterior'}
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '13px', color: COLOR_TEXT_LIGHT }}>
                  Paso {pasoActual} de {PASOS_OPORTUNIDAD.length}
                </span>
                
                {/* Botón Guardar */}
                <button
                  onClick={() => {
                    guardarOportunidad();
                    alert('Oportunidad guardada correctamente');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    border: `1px solid ${COLOR_SUCCESS}`,
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: COLOR_SUCCESS,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  💾 Guardar
                </button>
              </div>
              
              <button
                onClick={handleSiguiente}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: pasoActual === PASOS_OPORTUNIDAD.length ? COLOR_SUCCESS : COLOR_CORP,
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {pasoActual === PASOS_OPORTUNIDAD.length ? 'Finalizar ✓' : 'Siguiente →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
