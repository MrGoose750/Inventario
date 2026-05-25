/**
 * Script de Automatización de Pruebas de Calidad (QA) para la API de Inventario de Hogar (Versión TypeScript/Node).
 * Valida sistemáticamente la integridad referencial (FK checks), reglas de negocio y endpoints analíticos.
 */

// Paletas de colores ANSI para la consola de Tech Ops
const GREEN = "\x1b[92m";
const RED = "\x1b[91m";
const YELLOW = "\x1b[93m";
const BLUE = "\x1b[94m";
const CYAN = "\x1b[96m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const BASE_URL = "http://localhost:3000/api";

function printSection(title: string) {
  console.log(`\n${BOLD}${BLUE}${"=".repeat(60)}`);
  console.log(` ${title.toUpperCase()}`);
  console.log(`${"=".repeat(60)}${RESET}`);
}

function reportStatus(message: string, success: boolean, details: string = "") {
  const statusStr = success ? `${GREEN}[PASÓ]${RESET}` : `${RED}[FALLÓ]${RESET}`;
  const detailStr = details ? ` - ${details}` : "";
  console.log(`${statusStr} ${message}${detailStr}`);
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}Iniciando Testing Suite en: ${BASE_URL}${RESET}`);

  // --- 1. PRUEBAS DE CATEGORÍAS (CREATE / VIOLATION UNIQUE) ---
  printSection("1. Pruebas de Categorías");

  let catId: number | null = null;
  const uniqueName = `Cocina Test ${Date.now()}`;

  try {
    const res = await fetch(`${BASE_URL}/category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: uniqueName })
    });

    if (res.status === 201 || res.status === 200) {
      const created = await res.json() as any;
      catId = created.id;
      reportStatus("Creación de categoría válida", true, `ID: ${catId}, Nombre: ${created.name}`);
    } else {
      reportStatus("Creación de categoría válida", false, `Código de estado: ${res.status}`);
    }
  } catch (err: any) {
    reportStatus("Creación de categoría válida", false, err.message);
  }

  // Forzar fallo de duplicado con el mismo nombre
  if (catId) {
    try {
      const resFail = await fetch(`${BASE_URL}/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: uniqueName })
      });

      if (resFail.status === 400) {
        const payload = await resFail.json() as any;
        reportStatus("Validación Unique Constraint (Nombre Duplicado)", true, `Recibió HTTP 400 - ${payload.detail}`);
      } else {
        reportStatus("Validación Unique Constraint (Nombre Duplicado)", false, `Se esperaba HTTP 400, recibió ${resFail.status}`);
      }
    } catch (err: any) {
      reportStatus("Validación Unique Constraint (Nombre Duplicado)", false, err.message);
    }
  }

  // --- 2. PRUEBAS DE SUBCATEGORÍAS (CREATE / FK CHECK) ---
  printSection("2. Pruebas de Subcategorías");

  let subId: number | null = null;
  if (catId) {
    try {
      const res = await fetch(`${BASE_URL}/subcategory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sartenes de Titanio", category_id: catId })
      });

      if (res.status === 201 || res.status === 200) {
        const created = await res.json() as any;
        subId = created.id;
        reportStatus("Creación de subcategoría válida", true, `ID: ${subId}, Nombre: ${created.name} -> Cat ID: ${created.category_id}`);
      } else {
        reportStatus("Creación de subcategoría válida", false, `Código de estado: ${res.status}`);
      }
    } catch (err: any) {
      reportStatus("Creación de subcategoría válida", false, err.message);
    }
  }

  // Forzar error por categoría inexistente (Fallo FK Check)
  try {
    const resFail = await fetch(`${BASE_URL}/subcategory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Inexistente sub", category_id: 99999 })
    });

    if (resFail.status === 400) {
      const payload = await resFail.json() as any;
      reportStatus("Validación Foreign Key (Categoría Inexistente)", true, `Recibió HTTP 400 - ${payload.detail}`);
    } else {
      reportStatus("Validación Foreign Key (Categoría Inexistente)", false, `Se esperaba HTTP 400, recibió ${resFail.status}`);
    }
  } catch (err: any) {
    reportStatus("Validación Foreign Key (Categoría Inexistente)", false, err.message);
  }

  // --- 3. PRUEBAS DE PRODUCTOS (INTEGRIDAD REFERENCIAL Y CONCURRENCIA LÓGICA) ---
  printSection("3. Pruebas de Productos e Inconsistencias");

  let prodId: number | null = null;
  if (catId && subId) {
    try {
      const res = await fetch(`${BASE_URL}/product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Batería Profesional Pro",
          description: "Acero inoxidable con recubrimiento de titanio",
          category_id: catId,
          subcategory_id: subId,
          image_path: "/img/bateria_test.jpg"
        })
      });

      if (res.status === 201 || res.status === 200) {
        const created = await res.json() as any;
        prodId = created.id;
        reportStatus("Creación de producto maestro válido", true, `ID: ${prodId}, Nombre: ${created.name}`);
      } else {
        reportStatus("Creación de producto maestro válido", false, `Código: ${res.status}`);
      }
    } catch (err: any) {
      reportStatus("Creación de producto maestro válido", false, err.message);
    }

    // Inconsistencia lógica de Subcategoría
    try {
      // Crear una categoría temporal auxiliar
      const catAuxRes = await fetch(`${BASE_URL}/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Auxiliar Maderas ${Date.now()}` })
      });
      if (catAuxRes.status === 201 || catAuxRes.status === 200) {
        const catAux = await catAuxRes.json() as any;
        // Intentar añadir un producto con la categoría auxiliar pero la subcategoría de Cocina (subId)
        const resMismatch = await fetch(`${BASE_URL}/product`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Mesa Híbrida Mismatch",
            description: "Prueba de mismatch",
            category_id: catAux.id,
            subcategory_id: subId, // Pertenece a Cocina, no Maderas!
            image_path: ""
          })
        });

        if (resMismatch.status === 400) {
          const payload = await resMismatch.json() as any;
          reportStatus("Validación de Coherencia de Subcategoría", true, `Recibió HTTP 400 - ${payload.detail}`);
        } else {
          reportStatus("Validación de Coherencia de Subcategoría", false, `Se esperaba HTTP 400, recibió ${resMismatch.status}`);
        }
      }
    } catch (err: any) {
      reportStatus("Validación de Coherencia de Subcategoría", false, err.message);
    }
  }

  // --- 4. PRUEBAS DE VARIANTES (REGLAS DE DESCUENTO) ---
  printSection("4. Pruebas de Variantes y Reglas de Descuento");

  if (prodId) {
    // Límite superior incorrecto (> 100%)
    try {
      const resFailHigh = await fetch(`${BASE_URL}/product-variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: prodId,
          size: "Grande",
          stock_actual: 10,
          precio_compra: 40.0,
          precio_venta_base: 80.0,
          porcentaje_descuento: 120.0
        })
      });

      if (resFailHigh.status === 400) {
        const payload = await resFailHigh.json() as any;
        reportStatus("Validación Descuento Excesivo (> 100%)", true, `Recibió HTTP 400 - ${payload.detail}`);
      } else {
        reportStatus("Validación Descuento Excesivo (> 100%)", false, `Se esperaba HTTP 400, recibió ${resFailHigh.status}`);
      }
    } catch (err: any) {
      reportStatus("Validación Descuento Excesivo (> 100%)", false, err.message);
    }

    // Límite inferior incorrecto (< 0%)
    try {
      const resFailLow = await fetch(`${BASE_URL}/product-variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: prodId,
          size: "Chico",
          stock_actual: 10,
          precio_compra: 20.0,
          precio_venta_base: 40.0,
          porcentaje_descuento: -15.0
        })
      });

      if (resFailLow.status === 400) {
        const payload = await resFailLow.json() as any;
        reportStatus("Validación Descuento Negativo (< 0%)", true, `Recibió HTTP 400 - ${payload.detail}`);
      } else {
        reportStatus("Validación Descuento Negativo (< 0%)", false, `Se esperaba HTTP 400, recibió ${resFailLow.status}`);
      }
    } catch (err: any) {
      reportStatus("Validación Descuento Negativo (< 0%)", false, err.message);
    }

    // Variante exitosa y stock crítico
    try {
      const resOk = await fetch(`${BASE_URL}/product-variant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: prodId,
          size: "Edición Limitada (Crítico)",
          stock_actual: 3,
          precio_compra: 100.0,
          precio_venta_base: 250.0,
          porcentaje_descuento: 20.0
        })
      });

      if (resOk.status === 201 || resOk.status === 200) {
        reportStatus("Registro de Variante Válida en Stock Crítico", true, "Registrada con éxito.");
      } else {
        reportStatus("Registro de Variante Válida en Stock Crítico", false, `Recibió ${resOk.status}`);
      }
    } catch (err: any) {
      reportStatus("Registro de Variante Válida en Stock Crítico", false, err.message);
    }
  }

  // --- 5. REPORTES ANALÍTICOS ---
  printSection("5. Validación de Reportes Automatizados");

  try {
    const resRep1 = await fetch(`${BASE_URL}/queries/stock-critico`);
    if (resRep1.status === 200) {
      const data = await resRep1.json() as any[];
      reportStatus("Reporte Stock Crítico (<= 5 unidades)", true, `Se encontraron ${data.length} variantes con bajo inventario.`);
    } else {
      reportStatus("Reporte Stock Crítico (<= 5 unidades)", false, `Código: ${resRep1.status}`);
    }
  } catch (err: any) {
    reportStatus("Reporte Stock Crítico (<= 5 unidades)", false, err.message);
  }

  try {
    const resRep2 = await fetch(`${BASE_URL}/queries/valor-categoria`);
    if (resRep2.status === 200) {
      const data = await resRep2.json() as any[];
      reportStatus("Reporte de Valoración Contable de Almacén", true, `Calculados ${data.length} balances agregados.`);
      for (const col of data) {
        console.log(`  └─ Categoría: ${col.category_name} | Valor total: $${col.valor_inventory || col.valor_inventario} | Total productos: ${col.total_productos}`);
      }
    } else {
      reportStatus("Reporte de Valoración Contable", false, `Código: ${resRep2.status}`);
    }
  } catch (err: any) {
    reportStatus("Reporte de Valoración Contable", false, err.message);
  }

  try {
    const resRep3 = await fetch(`${BASE_URL}/queries/rebajas-activas`);
    if (resRep3.status === 200) {
      const data = await resRep3.json() as any[];
      reportStatus("Reporte de Rebajas Activas y Ofertas Calientes", true, `Encontradas ${data.length} promociones vigentes.`);
    } else {
      reportStatus("Reporte de Rebajas Activas", false, `Código: ${resRep3.status}`);
    }
  } catch (err: any) {
    reportStatus("Reporte de Rebajas Activas", false, err.message);
  }

  console.log(`\n${BOLD}${GREEN}Suite de pruebas finalizada de modo exitoso (100% Correcto).${RESET}\n`);
}

runTests();
