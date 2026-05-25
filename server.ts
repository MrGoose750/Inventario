import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Archivo de persistencia de base de datos simulada pero real del lado del servidor
const DB_FILE = path.join(process.cwd(), "inventario_hogar_live.json");

// Semilla inicial
const INITIAL_DB = {
  categories: [
    { id: 1, name: "Muebles" },
    { id: 2, name: "Textiles de Hogar" },
    { id: 3, name: "Iluminación" }
  ],
  subcategories: [
    { id: 1, name: "Sofás y Sillones", category_id: 1 },
    { id: 2, name: "Mesas e Isletas", category_id: 1 },
    { id: 3, name: "Sábanas y Fundas", category_id: 2 },
    { id: 4, name: "Edredones y Mantas", category_id: 2 },
    { id: 5, name: "Lámparas de Mesa", category_id: 3 },
    { id: 6, name: "Lámparas Colgantes", category_id: 3 }
  ],
  products: [
    {
      id: 1,
      name: "Sofá Modular 'Hygge'",
      description: "Sofá escandinavo minimalista con tela repelente a líquidos y soporte ergonómico.",
      category_id: 1,
      subcategory_id: 1,
      image_path: "/img/sofa_hygge.jpg",
      date_added: "2026-05-10T14:30:00Z"
    },
    {
      id: 2,
      name: "Juego Sábanas Algodón Egipcio",
      description: "Sábanas de lujo de 400 hilos, hipoalergénicas y con tacto satinado ultrasuave.",
      category_id: 2,
      subcategory_id: 3,
      image_path: "/img/sabanas_lux.jpg",
      date_added: "2026-05-15T09:15:00Z"
    },
    {
      id: 3,
      name: "Lámpara Minimalista 'Aura'",
      description: "Lámpara inteligente con luz cálida regulable y base de madera de encino natural.",
      category_id: 3,
      subcategory_id: 5,
      image_path: "/img/lampara_aura.jpg",
      date_added: "2026-05-20T18:45:00Z"
    }
  ],
  variants: [
    {
      id: 1,
      product_id: 1,
      size: "3 Plazas (220cm)",
      target_audience: "Estándar / Familiar",
      stock_actual: 8,
      precio_compra: 320.0,
      precio_venta_base: 599.99,
      porcentaje_descuento: 10.0
    },
    {
      id: 2,
      product_id: 1,
      size: "2 Plazas (160cm)",
      target_audience: "Juvenil / Compacto",
      stock_actual: 3,
      precio_compra: 240.0,
      precio_venta_base: 449.99,
      porcentaje_descuento: 0.0
    },
    {
      id: 3,
      product_id: 2,
      size: "King Size",
      target_audience: "Residencial / Unisex",
      stock_actual: 25,
      precio_compra: 40.0,
      precio_venta_base: 95.0,
      porcentaje_descuento: 15.0
    },
    {
      id: 4,
      product_id: 2,
      size: "Queen Size",
      target_audience: "Residencial / Unisex",
      stock_actual: 40,
      precio_compra: 35.0,
      precio_venta_base: 79.99,
      porcentaje_descuento: 5.0
    },
    {
      id: 5,
      product_id: 3,
      size: "Estándar (Alto: 45cm)",
      target_audience: "Oficina / Dormitorio",
      stock_actual: 14,
      precio_compra: 15.0,
      precio_venta_base: 45.0,
      porcentaje_descuento: 0.0
    },
    {
      id: 6,
      product_id: 3,
      size: "Mini (Alto: 25cm)",
      target_audience: "Infantil / Infantil",
      stock_actual: 1,
      precio_compra: 10.0,
      precio_venta_base: 29.99,
      porcentaje_descuento: 20.0
    }
  ]
};

// Cargar o inicializar base de datos física local
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), "utf-8");
    return INITIAL_DB;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return INITIAL_DB;
  }
}

function writeDb(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ==========================================
//              API ENDPOINTS
// ==========================================

// CATEGORÍAS
app.get("/api/category", (req, res) => {
  const db = readDb();
  res.json(db.categories);
});

app.post("/api/category", (req, res) => {
  const db = readDb();
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ detail: "El nombre de la categoría es requerido." });
  }

  // Validar unicidad
  const exists = db.categories.some((c: any) => c.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ detail: `La categoría '${name}' ya se encuentra registrada.` });
  }

  const newId = db.categories.length > 0 ? Math.max(...db.categories.map((c: any) => c.id)) + 1 : 1;
  const newCat = { id: newId, name: name.trim() };
  db.categories.push(newCat);
  writeDb(db);

  res.status(201).json(newCat);
});

// SUBCATEGORÍAS
app.get("/api/subcategory", (req, res) => {
  const db = readDb();
  res.json(db.subcategories);
});

app.post("/api/subcategory", (req, res) => {
  const db = readDb();
  const { name, category_id } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ detail: "El nombre de la subcategoría es requerido." });
  }

  // Validar existencia de categoría padre
  const parent = db.categories.find((c: any) => c.id === Number(category_id));
  if (!parent) {
    return res.status(400).json({ detail: `Error de Integridad: La categoría con ID ${category_id} no existe.` });
  }

  const newId = db.subcategories.length > 0 ? Math.max(...db.subcategories.map((sub: any) => sub.id)) + 1 : 1;
  const newSub = { id: newId, name: name.trim(), category_id: Number(category_id) };
  db.subcategories.push(newSub);
  writeDb(db);

  res.status(201).json(newSub);
});

// PRODUCTOS
app.get("/api/product", (req, res) => {
  const db = readDb();
  res.json(db.products);
});

app.post("/api/product", (req, res) => {
  const db = readDb();
  const { name, description, category_id, subcategory_id, image_path } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ detail: "El nombre comercial del producto es requerido." });
  }

  const cat = db.categories.find((c: any) => c.id === Number(category_id));
  if (!cat) {
    return res.status(400).json({ detail: `Error de Integridad: La categoría ID ${category_id} no existe.` });
  }

  const sub = db.subcategories.find((s: any) => s.id === Number(subcategory_id));
  if (!sub) {
    return res.status(400).json({ detail: `Error de Integridad: La subcategoría ID ${subcategory_id} no existe.` });
  }

  // Validar coherencia: la subcategoría debe pertenecer a la categoría informada
  if (sub.category_id !== Number(category_id)) {
    return res.status(400).json({
      detail: `Inconsistencia de Datos: La subcategoría '${sub.name}' no pertenece a la categoría '${cat.name}'.`
    });
  }

  const newId = db.products.length > 0 ? Math.max(...db.products.map((p: any) => p.id)) + 1 : 1;
  const newProd = {
    id: newId,
    name: name.trim(),
    description: description ? description.trim() : "Sin descripción",
    category_id: Number(category_id),
    subcategory_id: Number(subcategory_id),
    image_path: image_path || "/img/default.jpg",
    date_added: new Date().toISOString()
  };

  db.products.push(newProd);
  writeDb(db);

  res.status(201).json(newProd);
});

// VARIANTES
app.get("/api/product-variant", (req, res) => {
  const db = readDb();
  res.json(db.variants);
});

app.post("/api/product-variant", (req, res) => {
  const db = readDb();
  const { product_id, size, target_audience, stock_actual, precio_compra, precio_venta_base, porcentaje_descuento } = req.body;

  const parentProduct = db.products.find((p: any) => p.id === Number(product_id));
  if (!parentProduct) {
    return res.status(400).json({ detail: `Error de Integridad: El producto padre con ID ${product_id} no existe.` });
  }

  const disc = Number(porcentaje_descuento) || 0;
  if (disc < 0 || disc > 100) {
    return res.status(400).json({ detail: "Validación de Negocio: El porcentaje de descuento debe estar estrictamente entre 0 y 100." });
  }

  const newId = db.variants.length > 0 ? Math.max(...db.variants.map((v: any) => v.id)) + 1 : 1;
  const newVariant = {
    id: newId,
    product_id: Number(product_id),
    size: size || "Estándar",
    target_audience: target_audience || "General",
    stock_actual: Math.max(0, Number(stock_actual) || 0),
    precio_compra: Math.max(0, Number(precio_compra) || 0),
    precio_venta_base: Math.max(0, Number(precio_venta_base) || 0),
    porcentaje_descuento: disc
  };

  db.variants.push(newVariant);
  writeDb(db);

  res.status(201).json(newVariant);
});


// REPORTES / CONSULTAS AVANZADAS

// 1. Stock Crítico (<= 5)
app.get("/api/queries/stock-critico", (req, res) => {
  const db = readDb();
  const critical = db.variants
    .filter((v: any) => v.stock_actual <= 5)
    .map((v: any) => {
      const prod = db.products.find((p: any) => p.id === v.product_id);
      return {
        variant_id: v.id,
        product_name: prod ? prod.name : "Producto Desconocido",
        size: v.size,
        stock_actual: v.stock_actual,
        precio_venta_base: v.precio_venta_base
      };
    })
    .sort((a: any, b: any) => a.stock_actual - b.stock_actual);

  res.json(critical);
});

// 2. Valor total en almacén por categoría
app.get("/api/queries/valor-categoria", (req, res) => {
  const db = readDb();
  
  const valuation = db.categories.map((cat: any) => {
    // Filtrar productos de esta categoría
    const prods = db.products.filter((p: any) => p.category_id === cat.id);
    const prodIds = prods.map((p: any) => p.id);
    
    // Filtrar variantes asociadas a estos productos
    const assocVariants = db.variants.filter((v: any) => prodIds.includes(v.product_id));
    
    const piezasTotales = assocVariants.reduce((sum: number, v: any) => sum + v.stock_actual, 0);
    const valorInventario = assocVariants.reduce((sum: number, v: any) => sum + (v.stock_actual * v.precio_venta_base), 0);
    
    return {
      category_id: cat.id,
      category_name: cat.name,
      total_productos: prods.length,
      piezas_totales: piezasTotales,
      valor_inventario: Number(valorInventario.toFixed(2))
    };
  });

  res.json(valuation);
});

// 3. Rebajas activas con cálculo dinámico
app.get("/api/queries/rebajas-activas", (req, res) => {
  const db = readDb();
  
  const discounts = db.variants
    .filter((v: any) => v.porcentaje_descuento > 0)
    .map((v: any) => {
      const prod = db.products.find((p: any) => p.id === v.product_id);
      const precioOferta = v.precio_venta_base * (1.0 - (v.porcentaje_descuento / 100.0));
      return {
        product_name: prod ? prod.name : "Producto Desconocido",
        size: v.size,
        precio_venta_base: v.precio_venta_base,
        porcentaje_descuento: v.porcentaje_descuento,
        precio_oferta: Number(precioOferta.toFixed(2))
      };
    });

  res.json(discounts);
});


// RESET DE BASE DE DATOS FÍSICA PARA DESARROLLO/SIMULACIÓN
app.post("/api/db/reset", (req, res) => {
  writeDb(INITIAL_DB);
  res.json({ status: "success", message: "Base de datos restaurada al origen con éxito." });
});

// VACIAR BASE DE DATOS FÍSICA
app.post("/api/db/clear", (req, res) => {
  const emptyDb = {
    categories: [],
    subcategories: [],
    products: [],
    variants: []
  };
  writeDb(emptyDb);
  res.json({ status: "success", message: "Base de datos vaciada por completo. Puede iniciar el inventario desde cero." });
});

// ELIMINAR VARIANT
const deleteVariantHandler = (req: any, res: any) => {
  const db = readDb();
  const id = Number(req.params.id);
  const exists = db.variants.some((v: any) => v.id === id);
  if (!exists) {
    return res.status(404).json({ detail: `La variante física con ID ${id} no existe.` });
  }
  db.variants = db.variants.filter((v: any) => v.id !== id);
  writeDb(db);
  res.json({ status: "success", message: "Variante física eliminada con éxito del inventario físico.", id });
};

app.delete("/api/product-variant/:id", deleteVariantHandler);
app.delete("/api/variants/:id", deleteVariantHandler);

// ELIMINAR PRODUCTO (CON VALIDACIÓN DE STOCK/VARIANTES)
const deleteProductHandler = (req: any, res: any) => {
  const db = readDb();
  const id = Number(req.params.id);
  const product = db.products.find((p: any) => p.id === id);
  if (!product) {
    return res.status(404).json({ detail: `El artículo con ID ${id} no existe.` });
  }

  const force = req.query.force === "true";
  const associatedVariants = db.variants.filter((v: any) => v.product_id === id);
  const activeStock = associatedVariants.reduce((sum: number, v: any) => sum + v.stock_actual, 0);

  if (activeStock > 0 && !force) {
    return res.status(400).json({
      detail: `No se permite eliminar este producto porque cuenta con stock físico registrado en bodega (${activeStock} piezas). Desactive o liquide las cantidades primero.`
    });
  }

  if (associatedVariants.length > 0 && !force) {
    return res.status(400).json({
      detail: "El artículo posee sub-variantes físicas configuradas. Utilice el botón de confirmación definitiva (Forzado) para eliminarlas en cascada junto con el producto."
    });
  }

  // Eliminar variantes asociadas y el producto
  db.variants = db.variants.filter((v: any) => v.product_id !== id);
  db.products = db.products.filter((p: any) => p.id !== id);
  writeDb(db);

  res.json({ status: "success", message: "Producto y variantes asociadas removidos con éxito.", id });
};

app.delete("/api/product/:id", deleteProductHandler);
app.delete("/api/products/:id", deleteProductHandler);

// ELIMINAR CATEGORÍA (CON LÓGICA DE CASCADA SEGURA)
app.delete("/api/category/:id", (req: any, res: any) => {
  const db = readDb();
  const id = Number(req.params.id);
  const category = db.categories.find((c: any) => c.id === id);
  if (!category) {
    return res.status(404).json({ detail: `La categoría con ID ${id} no existe.` });
  }

  const force = req.query.force === "true";
  const associatedProducts = db.products.filter((p: any) => p.category_id === id);

  if (associatedProducts.length > 0 && !force) {
    return res.status(400).json({
      detail: "Esta categoría contiene artículos activos en catálogo. Use la confirmación avanzada (Borrado Completo/Forzado) si desea liquidarla con sus existencias relacionadas en cascada."
    });
  }

  // Si se fuerza o no tiene productos vinculados, borrar cascada
  if (associatedProducts.length > 0) {
    const prodIds = associatedProducts.map((p: any) => p.id);
    db.products = db.products.filter((p: any) => p.category_id !== id);
    db.variants = db.variants.filter((v: any) => !prodIds.includes(v.product_id));
  }

  // Borrar subcategorías y categoría
  db.subcategories = db.subcategories.filter((s: any) => s.category_id !== id);
  db.categories = db.categories.filter((c: any) => c.id !== id);
  writeDb(db);

  res.json({ status: "success", message: "Categoría y todas sus dependencias eliminadas con éxito.", id });
});



// ==========================================
//          METRICAS AUTOMATIZADAS
// ==========================================

app.get("/api/analytics/dashboard", (req, res) => {
  const db = readDb();
  
  const totalStock = db.variants.reduce((sum: number, v: any) => sum + (v.stock_actual || 0), 0);
  const capitalInvested = db.variants.reduce((sum: number, v: any) => sum + ((v.stock_actual || 0) * (v.precio_compra || 0)), 0);
  const warehouseValue = db.variants.reduce((sum: number, v: any) => {
    const discountFactor = 1.0 - ((v.porcentaje_descuento || 0) / 100.0);
    return sum + ((v.stock_actual || 0) * (v.precio_venta_base || 0) * discountFactor);
  }, 0);
  const criticalVariantsCount = db.variants.filter((v: any) => (v.stock_actual || 0) <= 5).length;
  const projectedGain = warehouseValue - capitalInvested;
  
  res.json({
    total_stock: totalStock,
    capital_invested: Number(capitalInvested.toFixed(2)),
    warehouse_value: Number(warehouseValue.toFixed(2)),
    critical_variants_count: criticalVariantsCount,
    projected_gain: Number(projectedGain.toFixed(2))
  });
});

// ==========================================
//         INTEGRACIÓN CHATBOT GEMINI
// ==========================================

let aiInstance: any = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_MISSING");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiInstance;
}

app.post("/api/chat", async (req: any, res: any) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ detail: "El mensaje del usuario es requerido." });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      // Clave no configurada: responder amablemente simulando ser el bot de Solo Lectura
      console.warn("[WARNING] GEMINI_API_KEY no configurada. Respondiendo de forma autónoma.");
      const db = readDb();
      const productCount = db.products.length;
      return res.json({
        response: `¡Hola! Soy el asistente analítico de **Solo Lectura** de tu inventario. Actualmente detecto que la clave **GEMINI_API_KEY** no está provista en tus variables de entorno, pero puedo informarte amablemente desde mi base de datos integrada en tiempo real: hoy cuentas con **${productCount} productos registrados** en el catálogo. ¡Por favor, añade tu clave API de Gemini en la configuración para desbloquear mis capacidades de análisis de lenguaje e inteligencia de mercado completos!`
      });
    }

    const db = readDb();

    // 1. Calcular estadísticas de negocio
    const totalStock = db.variants.reduce((sum: number, v: any) => sum + (v.stock_actual || 0), 0);
    const capitalInvested = db.variants.reduce((sum: number, v: any) => sum + ((v.stock_actual || 0) * (v.precio_compra || 0)), 0);
    const warehouseValue = db.variants.reduce((sum: number, v: any) => {
      const discountFactor = 1.0 - ((v.porcentaje_descuento || 0) / 100.0);
      return sum + ((v.stock_actual || 0) * (v.precio_venta_base || 0) * discountFactor);
    }, 0);
    const projectedGain = warehouseValue - capitalInvested;
    
    // 2. Agrupar categorías y subcategorías
    const catList = db.categories.map((c: any) => {
      const subs = db.subcategories.filter((s: any) => s.category_id === c.id).map((s: any) => s.name);
      return `${c.name} (Subcategorías: ${subs.join(", ")})`;
    }).join(" | ");

    // 3. Identificar variantes críticas (stock_actual <= 5)
    const criticalVariants = db.variants
      .filter((v: any) => (v.stock_actual || 0) <= 5)
      .map((v: any) => {
        const prod = db.products.find((p: any) => p.id === v.product_id);
        const name = prod ? prod.nombre : "Producto desconocido";
        const detail = [v.color, v.talla, v.material].filter(Boolean).join(" / ");
        return `- ${name} [${detail || "Único"}]: ${v.stock_actual} unidades (Mínimo recomendado: 5)`;
      })
      .slice(0, 15) // Limitar para no saturar contexto
      .join("\n");

    // 4. Identificar ofertas y promociones activas
    const activeOffers = db.variants
      .filter((v: any) => (v.porcentaje_descuento || 0) > 0)
      .map((v: any) => {
        const prod = db.products.find((p: any) => p.id === v.product_id);
        const name = prod ? prod.nombre : "Producto";
        const detail = [v.color, v.talla].filter(Boolean).join(" / ");
        return `- ${name} (${detail || "Único"}): Descuento del ${v.porcentaje_descuento}% (Precio regular: $${v.precio_venta_base} -> Oferta especial: $${(v.precio_venta_base * (1 - v.porcentaje_descuento / 100)).toFixed(2)})`;
      })
      .join("\n");

    // 5. Detalles generales del catálogo para preguntas específicas por producto
    const catalogOverview = db.products.map((p: any) => {
      const prodVariants = db.variants.filter((v: any) => v.product_id === p.id);
      const variantDetails = prodVariants.map((v: any) => {
        const desc = [v.color, v.talla, v.material].filter(Boolean).join(" / ");
        return `${desc || "Estándar"}: Stock ${v.stock_actual} pzas, Compra: $${v.precio_compra}, Venta Base: $${v.precio_venta_base}${v.porcentaje_descuento > 0 ? ` (Descuento: ${v.porcentaje_descuento}%)` : ""}`;
      }).join("; ");
      return `- ${p.nombre} (ID: ${p.id}): ${p.descripcion || "Sin descripción"}. Variantes: [${variantDetails}]`;
    }).join("\n");

    const realTimeContext = `
[INFORMACIÓN EN TIEMPO REAL DEL INVENTARIO DEL ALMACÉN DE ARTÍCULOS PARA EL HOGAR]
* Estructura de Categorías Registradas:
  ${catList}

* Métricas Globales del Negocio:
  - Total de productos únicos en catálogo: ${db.products.length}
  - Stock físico total en almacén: ${totalStock} unidades
  - Capital total de compra invertido: $${capitalInvested.toFixed(2)}
  - Valor de venta total estimado en almacén (neto con ofertas aplicadas): $${warehouseValue.toFixed(2)}
  - Margen de ganancia neta proyectada: $${projectedGain.toFixed(2)}
  - Cantidad de artículos con inventario crítico (stock de 5 o menos): ${db.variants.filter((v: any) => (v.stock_actual || 0) <= 5).length}

* Alertas de Stock Crítico (5 unidades o menos):
${criticalVariants || "¡Todo en orden! Actualmente no hay productos con stock crítico."}

* Ofertas y Rebajas Activas:
${activeOffers || "Ninguna oferta o promoción está activa actualmente."}

* Resumen Detallado de Productos y sus Variantes para Consultas Específicas:
${catalogOverview}
`;

    // Estructurar el historial para la API
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const t of history) {
        contents.push({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }]
        });
      }
    }

    // Añadir turno actual
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Petición directa a Gemini con contexto inyectado
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "Eres un asistente analítico de inventario de Solo Lectura de Artículos de Hogar de gama alta y decoración. Tienes estrictamente prohibido intentar crear, modificar, editar precios o eliminar registros. Si el usuario te pide una acción de escritura, borrado o reset de cualquier tipo, debes rechazarla amablemente en un tono respetuoso pero firme y sugerirle que use los formularios o los botones físicos que están disponibles directamente en la interfaz del sistema. Tu labor es únicamente leer datos, filtrar elementos, responder dudas basándote de manera exacta y completa en la información en tiempo real provista abajo, hacer cálculos matemáticos de ganancias o stock, y dar recomendaciones operativas de reposición en un español cálido, profesional, estructurado y muy claro.\n\n" + realTimeContext,
      }
    });

    return res.json({ response: response.text || "No tengo una respuesta en este momento. Por favor, reformula tu consulta." });

  } catch (error: any) {
    console.error("[ERROR EN CHATBOT BACKEND]:", error);
    
    const errorMessage = error?.message || "";
    const errorString = typeof error === "object" ? JSON.stringify(error) : String(error);
    
    // Identificar si es un problema de cuota excedida (RESOURCE_EXHAUSTED / 429) o límites de AI Studio
    const isQuotaExceeded = 
      error?.status === "RESOURCE_EXHAUSTED" || 
      error?.statusCode === 429 || 
      error?.status === 429 ||
      errorMessage.includes("RESOURCE_EXHAUSTED") || 
      errorMessage.includes("quota") || 
      errorMessage.includes("Quota") ||
      errorMessage.includes("limit") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429") ||
      errorString.includes("RESOURCE_EXHAUSTED") ||
      errorString.includes("quota") ||
      errorString.includes("Quota") ||
      errorString.includes("limit");

    if (isQuotaExceeded) {
      return res.json({
        response: "⚠️ **Límite de Consultas Alcanzado (Gemini Free Tier)**\n\n¡Hola! He recibido tu consulta con éxito, pero el motor de inteligencia artificial de Gemini (en su plan gratuito de AI Studio) ha alcanzado el límite de consultas por minuto de forma temporal.\n\nPor favor, **espera unos 10 a 15 segundos** y vuelve a enviar tu mensaje. Esto restablecerá la cuota para que podamos seguir analizando el inventario juntos."
      });
    }

    // Retornar un mensaje amigable al chatbot en vez de romper la petición HTTP con un status 500
    return res.json({
      response: `⚠️ **Detalle de comunicación**\n\nOcurrió un error al procesar el mensaje con la inteligencia artificial: *${error?.message || "Error desconocido"}*.\n\nPor favor, asegúrate de que tu conexión e API Key en la configuración estén activas y vuelve a intentarlo.`
    });
  }
});



// ==========================================
//          SERVE FRONTEND WITH VITE/STATIC
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational at http://localhost:${PORT}`);
  });
}

startServer();
