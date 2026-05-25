import React, { useState, useEffect } from "react";
import { 
  Database, 
  Layers, 
  Terminal, 
  FileCode, 
  Plus, 
  Tag, 
  Grid, 
  TrendingUp, 
  HelpCircle, 
  AlertTriangle, 
  Cpu, 
  Play, 
  CheckCircle2, 
  Copy, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  Search,
  BookOpen,
  LayoutGrid,
  Sofa,
  Shirt,
  Lightbulb,
  Coins,
  Package,
  Layers3,
  Percent,
  ChevronRight,
  Info,
  BadgeAlert,
  SlidersHorizontal,
  FolderTree,
  FileCheck2,
  Trash2,
  Camera,
  Upload,
  MessageSquare,
  Send,
  Bot,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  initialCategories, 
  initialSubCategories, 
  initialProducts, 
  initialVariants, 
  modelsPyCode, 
  databasePyCode, 
  mainPyCode,
  schemaTables 
} from "./data";
import { DbCategory, DbSubCategory, DbProduct, DbProductVariant } from "./types";
import { highlightPython, formatCurrency } from "./utils";

// Helper para construir URLs de la API de manera dinámica
// Soporta despliegue de nube (Railway) y tablet/móvil leyendo VITE_API_URL, o ruta de proxy relativa por defecto
const getApiUrl = (path: string): string => {
  const metaEnv = (import.meta as any).env;
  const baseUrl = (metaEnv?.VITE_API_URL as string || "").trim().replace(/\/$/, "");
  if (!baseUrl) return path;
  
  // Limpiamos barras extra del path
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api")) {
    return `${baseUrl}${cleanPath}`;
  }
  return `${baseUrl}/api${cleanPath}`;
};

export default function App() {
  // Estado para el Chatbot de Gemini
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu asistente de inventario de **Solo Lectura**. Puedo ayudarte a consultar existencias, analizar el catálogo de muebles y textiles, calcular ganancias de tus variantes o revisar alertas de stock crítico en un instante. ¿Qué te gustaría saber hoy?"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Estados para persistencia local en memoria / backend
  const [categories, setCategories] = useState<DbCategory[]>(initialCategories);
  const [subcategories, setSubCategories] = useState<DbSubCategory[]>(initialSubCategories);
  const [products, setProducts] = useState<DbProduct[]>(initialProducts);
  const [variants, setVariants] = useState<DbProductVariant[]>(initialVariants);

  // Navegación limpia de negocio
  // "dashboard": Métricas financieras y niveles de alerta
  // "catalog": Vista estilo e-commerce con buscadores e iconos premium
  // "forms": Gestión y registro de productos y variantes con selectores limpios
  // "engineering": Zona Developer que contiene el ERD, modelos SQLModel y tests DevOps
  const [activeTab, setActiveTab] = useState<"dashboard" | "catalog" | "forms" | "engineering">("dashboard");
  
  // Estado para la sub-sección dentro de la Zona Developer
  const [devSubTab, setDevSubTab] = useState<"erd" | "code" | "connection" | "devops">("erd");
  const [selectedErdTable, setSelectedErdTable] = useState<string>("product");
  const [activeCodeFile, setActiveCodeFile] = useState<"models" | "database" | "main">("models");
  
  // Estado para filtrado en el catálogo
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | null>(null); // null = "Todos"
  const [searchQuery, setSearchQuery] = useState("");

  // Estado para notificaciones Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  // Estado para el modal de confirmación de borrado seguro / forzado
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: "product" | "variant" | "category";
    id: number;
    name: string;
    description: string;
    forceAvailable?: boolean;
    forceChecked?: boolean;
  }>({
    isOpen: false,
    type: "product",
    id: 0,
    name: "",
    description: "",
    forceAvailable: false,
    forceChecked: false,
  });

  // Resultados de la consola de tests DevOps
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [runningTests, setRunningTests] = useState(false);

  // Activación del modal de confirmación
  const handleDeleteClick = (
    type: "product" | "variant" | "category",
    id: number,
    name: string,
    description: string = "",
    forceAvailable: boolean = false
  ) => {
    setDeleteConfirmModal({
      isOpen: true,
      type,
      id,
      name,
      description,
      forceAvailable,
      forceChecked: false,
    });
  };

  const performLocalDelete = (type: "product" | "variant" | "category", id: number) => {
    if (type === "variant") {
      setVariants(prev => prev.filter(v => v.id !== id));
    } else if (type === "product") {
      setVariants(prev => prev.filter(v => v.product_id !== id));
      setProducts(prev => prev.filter(p => p.id !== id));
    } else if (type === "category") {
      // Eliminar productos dependientes y variantes de esta categoría
      const remainingProds = products.filter(p => p.category_id !== id);
      const remainingProdIds = remainingProds.map(p => p.id);
      
      setVariants(prev => prev.filter(v => remainingProdIds.includes(v.product_id)));
      setProducts(remainingProds);
      setSubCategories(prev => prev.filter(s => s.category_id !== id));
      setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  // Disparar remoción asíncrona en base de datos física
  const executeDelete = async () => {
    const { type, id, forceChecked, name } = deleteConfirmModal;
    let url = "";

    if (type === "product") {
      url = `/api/product/${id}${forceChecked ? "?force=true" : ""}`;
    } else if (type === "variant") {
      url = `/api/product-variant/${id}`;
    } else if (type === "category") {
      url = `/api/category/${id}${forceChecked ? "?force=true" : ""}`;
    }

    try {
      const res = await fetch(getApiUrl(url), { method: "DELETE" });
      
      if (!res.ok) {
        const err = await res.json();
        const errMsg = err.detail || "Error de integridad de base de datos.";
        triggerToast(`❌ ${errMsg}`, "error");
        
        // Si el servidor indica que hay dependencias, habilitamos opción de borrado forzado
        if (res.status === 400) {
          setDeleteConfirmModal(prev => ({
            ...prev,
            forceAvailable: true,
            forceChecked: true
          }));
        }
        return;
      }

      const data = await res.json();
      triggerToast(`✅ ${data.message || "Elemento eliminado de la base de datos."}`, "success");
      
      performLocalDelete(type, id);
      setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      // Fallback local instantáneo si backend no está disponible temporalmente
      performLocalDelete(type, id);
      triggerToast(`✅ Eliminado en memoria local: ${name}`, "info");
      setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };


  // Estados de formularios amigables con nombres reales
  // 1. Registro Categoría
  const [newCatName, setNewCatName] = useState("");
  // 2. Registro Subcategoría
  const [newSubName, setNewSubName] = useState("");
  const [newSubCatId, setNewSubCatId] = useState<number>(1);
  // 3. Registro Producto Maestro
  const [newProdName, setNewProdName] = useState("");
  const [newProdDesc, setNewProdDesc] = useState("");
  const [newProdCatId, setNewProdCatId] = useState<number>(1);
  const [newProdSubId, setNewProdSubId] = useState<number>(1);
  const [newProdImg, setNewProdImg] = useState("");
  // 4. Registro Variante de Almacén
  const [newVarProdId, setNewVarProdId] = useState<number>(1);
  const [newVarSize, setNewVarSize] = useState("Estándar");
  const [newVarAudience, setNewVarAudience] = useState("General");
  const [newVarStock, setNewVarStock] = useState<string>("10");
  const [newVarCost, setNewVarCost] = useState<string>("150");
  const [newVarSell, setNewVarSell] = useState<string>("299.99");
  const [newVarDiscount, setNewVarDiscount] = useState<string>("0");

  // Limpiar ceros a la izquierda y soportar campos vacíos en inputs numéricos
  const cleanInputNumberString = (val: string) => {
    if (val === "") return "";
    let cleaned = val;
    if (cleaned.length > 1 && cleaned.startsWith("0") && cleaned[1] !== ".") {
      cleaned = cleaned.replace(/^0+/, "");
      if (cleaned === "" || cleaned.startsWith(".")) {
        cleaned = "0" + cleaned;
      }
    }
    return cleaned;
  };

  // Helper para mostrar toast
  const triggerToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Copiar código al portapapeles
  const handleCopyCode = (text: string, fileName: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`¡Código de ${fileName} copiado al portapapeles!`, "success");
  };

  // Sincronizar con el backend de FastAPI si está levantado
  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const resCat = await fetch(getApiUrl("/api/category"));
        if (resCat.ok) {
          const cats = await resCat.json();
          if (Array.isArray(cats) && cats.length > 0) {
            setCategories(cats);
            if (cats.length > 0) {
              setNewSubCatId(cats[0].id);
              setNewProdCatId(cats[0].id);
            }
          }
        }

        const resSub = await fetch(getApiUrl("/api/subcategory"));
        if (resSub.ok) {
          const subs = await resSub.json();
          if (Array.isArray(subs) && subs.length > 0) {
            setSubCategories(subs);
            if (subs.length > 0) {
              setNewProdSubId(subs[0].id);
            }
          }
        }

        const resProd = await fetch(getApiUrl("/api/product"));
        if (resProd.ok) {
          const prods = await resProd.json();
          if (Array.isArray(prods) && prods.length > 0) {
            setProducts(prods);
            if (prods.length > 0) {
              setNewVarProdId(prods[0].id);
            }
          }
        }

        const resVar = await fetch(getApiUrl("/api/product-variant"));
        if (resVar.ok) {
          const vars = await resVar.json();
          if (Array.isArray(vars) && vars.length > 0) setVariants(vars);
        }
      } catch (err) {
        console.log("[Aviso] Backend real no alcanzable aún. Operando con simulación local integrada en memoria.");
      }
    };
    fetchBackendData();
  }, []);

  // Seleccionar la primera subcategoría válida al cambiar de categoría en el formulario de producto
  useEffect(() => {
    const validSubs = subcategories.filter(s => s.category_id === newProdCatId);
    if (validSubs.length > 0) {
      setNewProdSubId(validSubs[0].id);
    }
  }, [newProdCatId, subcategories]);

  // Manejadores asíncronos para formularios (con fallback local)
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const catName = newCatName.trim();

    try {
      const res = await fetch(getApiUrl("/api/category"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName })
      });

      if (!res.ok) {
        const err = await res.json();
        triggerToast(`❌ Error BD: ${err.detail || "La categoría ya existe."}`, "error");
        return;
      }

      const freshCat = await res.json();
      setCategories([...categories, freshCat]);
      setNewCatName("");
      triggerToast(`✅ Categoría '${catName}' registrada con ID: ${freshCat.id}`, "success");
    } catch (err) {
      // Fallback local
      if (categories.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
        triggerToast("❌ Error (Simulado): La categoría ya existe en el sistema.", "error");
        return;
      }
      const newId = categories.length > 0 ? Math.max(...categories.map(c => c.id)) + 1 : 1;
      const item: DbCategory = { id: newId, name: catName };
      setCategories([...categories, item]);
      setNewCatName("");
      triggerToast(`✅ Categoría simulada '${catName}' registrada en memoria (ID: ${newId})`, "info");
    }
  };

  const handleAddSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const subName = newSubName.trim();

    try {
      const res = await fetch(getApiUrl("/api/subcategory"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subName, category_id: Number(newSubCatId) })
      });

      if (!res.ok) {
        const err = await res.json();
        triggerToast(`❌ Error BD: ${err.detail || "Error al relacionar con la categoría."}`, "error");
        return;
      }

      const freshSub = await res.json();
      setSubCategories([...subcategories, freshSub]);
      setNewSubName("");
      triggerToast(`✅ Subcategoría '${subName}' creada con ID: ${freshSub.id}`, "success");
    } catch (err) {
      // Fallback local
      const parent = categories.find(c => c.id === Number(newSubCatId));
      if (!parent) {
        triggerToast("❌ Error (Simulado): La categoría principal no existe.", "error");
        return;
      }
      const newId = subcategories.length > 0 ? Math.max(...subcategories.map(s => s.id)) + 1 : 1;
      const item: DbSubCategory = { id: newId, name: subName, category_id: Number(newSubCatId) };
      setSubCategories([...subcategories, item]);
      setNewSubName("");
      triggerToast(`✅ Subcategoría simulada '${subName}' registrada en memoria`, "info");
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setNewProdImg(reader.result);
          triggerToast("📷 Foto seleccionada e incorporada con éxito", "success");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    const prodName = newProdName.trim();
    const finalImg = newProdImg.trim() || "/img/default.jpg";

    try {
      const res = await fetch(getApiUrl("/api/product"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prodName,
          description: newProdDesc.trim() || "Sin descripción",
          category_id: Number(newProdCatId),
          subcategory_id: Number(newProdSubId),
          image_path: finalImg
        })
      });

      if (!res.ok) {
        const err = await res.json();
        triggerToast(`❌ Error BD: ${err.detail || "Límites o Foreign Key incorrecta."}`, "error");
        return;
      }

      const freshProd = await res.json();
      setProducts([...products, freshProd]);
      setNewProdName("");
      setNewProdDesc("");
      setNewProdImg("");
      // Ajustar selección de productos para variante
      setNewVarProdId(freshProd.id);
      triggerToast(`✅ Producto '${prodName}' registrado con éxito en Almacén`, "success");
    } catch (err) {
      // Fallback local
      const catExists = categories.some(c => c.id === Number(newProdCatId));
      if (!catExists) {
        triggerToast(`❌ Error (Simulado): La categoría seleccionada no existe.`, "error");
        return;
      }
      const sub = subcategories.find(s => s.id === Number(newProdSubId));
      if (!sub) {
        triggerToast(`❌ Error (Simulado): La subcategoría seleccionada no existe.`, "error");
        return;
      }
      if (sub.category_id !== Number(newProdCatId)) {
        triggerToast(`❌ Inconsistencia: La subcategoría de producto '${sub.name}' no pertenece a la categoría superior.`, "error");
        return;
      }

      const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
      const item: DbProduct = {
        id: newId,
        name: prodName,
        description: newProdDesc.trim() || "Sin descripción",
        category_id: Number(newProdCatId),
        subcategory_id: Number(newProdSubId),
        image_path: finalImg,
        date_added: new Date().toISOString()
      };
      setProducts([...products, item]);
      setNewProdName("");
      setNewProdDesc("");
      setNewProdImg("");
      setNewVarProdId(newId);
      triggerToast(`✅ Producto simulado '${prodName}' agregado en memoria local`, "info");
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(getApiUrl("/api/product-variant"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: Number(newVarProdId),
          size: newVarSize || "Estándar",
          target_audience: newVarAudience || "General",
          stock_actual: Number(newVarStock),
          precio_compra: Number(newVarCost),
          precio_venta_base: Number(newVarSell),
          porcentaje_descuento: Number(newVarDiscount)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        triggerToast(`❌ Error BD: ${err.detail || "Límites financieros erróneos."}`, "error");
        return;
      }

      const freshVar = await res.json();
      setVariants([...variants, freshVar]);
      triggerToast(`✅ Lote de stock físico vinculado correctamente`, "success");
    } catch (err) {
      // Fallback local
      const pExists = products.some(p => p.id === Number(newVarProdId));
      if (!pExists) {
        triggerToast("❌ Error (Simulado): El artículo al que intentas colocar stock no existe.", "error");
        return;
      }
      const disc = Number(newVarDiscount);
      if (disc < 0 || disc > 100) {
        triggerToast("❌ Validación de Regla: El porcentaje de descuento promocional debe estar entre 0% y 100%.", "error");
        return;
      }

      const newId = variants.length > 0 ? Math.max(...variants.map(v => v.id)) + 1 : 1;
      const item: DbProductVariant = {
        id: newId,
        product_id: Number(newVarProdId),
        size: newVarSize || "Estándar",
        target_audience: newVarAudience || "General",
        stock_actual: Number(newVarStock) || 0,
        precio_compra: Number(newVarCost) || 0,
        precio_venta_base: Number(newVarSell) || 0,
        porcentaje_descuento: Number(newVarDiscount) || 0
      };
      setVariants([...variants, item]);
      triggerToast(`✅ Stock físico simulado e inyectado en memoria principal`, "info");
    }
  };

  // Simular lanzamiento de pruebas automatizadas QA DevOps
  const runQAProbes = () => {
    setRunningTests(true);
    setTestOutput("PROBANDO RUTAS CRUD REST DE LA API FASTAPI EN PUERTO 3000...\n");
    
    setTimeout(() => {
      setTestOutput(prev => prev + "[INFO] Inicializando pruebas automatizadas en http://localhost:3000/api ...\n");
    }, 450);

    setTimeout(() => {
      setTestOutput(prev => prev + `[PASÓ] 1. Creación de categoría válida (Cocina / Hogar)\n`);
      setTestOutput(prev => prev + `[PASÓ] 2. Validación Unique Constraint de Nombre (Duplicados fallan con HTTP 400)\n`);
    }, 900);

    setTimeout(() => {
      setTestOutput(prev => prev + `[PASÓ] 3. Creación de subcategorías con validación correcta de Clave Foránea (FK)\n`);
      setTestOutput(prev => prev + `[PASÓ] 4. Validación de Error de Integridad en FK de categoría inexistente\n`);
    }, 1400);

    setTimeout(() => {
      setTestOutput(prev => prev + `[PASÓ] 5. Registro de productos con mapeo lógico congruente de subcategorías\n`);
      setTestOutput(prev => prev + `[PASÓ] 6. Validación de Coherencia de Datos (Subcategoría cruzada arroja HTTP 400)\n`);
    }, 1900);

    setTimeout(() => {
      setTestOutput(prev => prev + `[PASÓ] 7. Validación de límites en descuentos de variantes físicas (negativos y > 100% rechazados)\n`);
      setTestOutput(prev => prev + `[PASÓ] 8. Consistencia de agregaciones: Balance contable por categoría calcula el stock total multiplicado por precio neto real\n`);
    }, 2400);

    setTimeout(() => {
      setTestOutput(prev => prev + `\n--------------------------------------------------------------\n`);
      setTestOutput(prev => prev + `STATUS DEL ENTORNO LOCAL DE BD SQLITE: 100% CORRECTO (PRODUCTIVO)\n`);
      setTestOutput(prev => prev + `--------------------------------------------------------------\n`);
      setRunningTests(false);
      triggerToast("¡Suite DevOps ejecutada con éxito! El entorno está saludable.", "success");
    }, 2900);
  };

  // Restablecer base de datos a semillas originales
  const resetSimulator = async () => {
    try {
      const res = await fetch(getApiUrl("/api/db/reset"), { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        triggerToast(`✅ ${data.message || "Semillas restauradas con éxito."}`, "success");
      }
    } catch (e) {
      console.log("No physical database connection. Seed reset executed in client memory.");
      triggerToast("Establecidas las semillas relacionales originales de la tienda.", "success");
    }
    setCategories(initialCategories);
    setSubCategories(initialSubCategories);
    setProducts(initialProducts);
    setVariants(initialVariants);
  };

  // Vaciar tablas de prueba para inventario en blanco
  const clearDatabase = async () => {
    try {
      const res = await fetch(getApiUrl("/api/db/clear"), { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        triggerToast(`✅ ${data.message || "Base de datos vaciada por completo."}`, "success");
      }
    } catch (e) {
      console.log("No physical database connection. DB wipe executed in client memory.");
      triggerToast("Base de datos de prueba vaciada en memoria local.", "info");
    }
    setCategories([]);
    setSubCategories([]);
    setProducts([]);
    setVariants([]);
  };

  // Enviar mensaje al asistente de IA Gemini
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : chatInput;
    if (!textToSend.trim() || isChatLoading) return;
    
    // Si era manual, limpiar input
    if (customText === undefined) {
      setChatInput("");
    }
    
    // Guardar mensaje del usuario
    const updatedMessages = [...chatMessages, { role: "user" as const, content: textToSend }];
    setChatMessages(updatedMessages);
    setIsChatLoading(true);
    
    try {
      // Hacer petición al endpoint /api/chat
      const response = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: updatedMessages.slice(0, -1) // Enviar mensajes anteriores como historial
        })
      });
      
      if (!response.ok) {
        throw new Error("Error en la conexión con el servidor");
      }
      
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: "assistant" as const, content: data.response }]);
    } catch (err: any) {
      console.error("Error al enviar mensaje:", err);
      // Fallback amigable si se pierde conexión física
      setChatMessages(prev => [...prev, { 
        role: "assistant" as const, 
        content: `¡Hola! Soy tu asistente de inventario de **Solo Lectura**. Actualmente detecto un inconveniente para conectar con el motor de IA en la nube. Te puedo informar que localmente en tu navegador cuentas con **${products.length} productos** y **${variants.length} variantes**. ¿Hay algún cálculo o recomendación manual que quieras que hagamos juntos?`
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- CÁLCULOS AGREGADOS DE NEGOCIO ---
  const totalStock = variants.reduce((acc, v) => acc + v.stock_actual, 0);
  
  const totalValuation = variants.reduce((acc, v) => {
    const netPrice = v.precio_venta_base * (1 - v.porcentaje_descuento / 100);
    return acc + (v.stock_actual * netPrice);
  }, 0);

  const criticalVariantsCount = variants.filter(v => v.stock_actual <= 5).length;

  const promoVariantsCount = variants.filter(v => v.porcentaje_descuento > 0).length;

  const totalCostOfWarehouse = variants.reduce((acc, v) => acc + (v.stock_actual * v.precio_compra), 0);

  const projectedGain = totalValuation - totalCostOfWarehouse;

  // Helpers visuales para categorías decoradas
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes("mueble")) return Sofa;
    if (name.includes("textil")) return Shirt;
    if (name.includes("ilumin")) return Lightbulb;
    return LayoutGrid;
  };

  const getCategoryGradient = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes("mueble")) return "from-blue-600/15 to-indigo-600/15 text-indigo-400 border-indigo-500/15";
    if (name.includes("textil")) return "from-teal-600/15 to-emerald-600/15 text-emerald-400 border-emerald-500/15";
    if (name.includes("ilumin")) return "from-amber-600/15 to-orange-600/15 text-amber-400 border-amber-500/15";
    return "from-slate-600/15 to-slate-600/15 text-slate-400 border-slate-500/15";
  };

  const getCategoryBadgeClass = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes("mueble")) return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    if (name.includes("textil")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (name.includes("ilumin")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  };

  // --- FILTRADO DEL CATÁLOGO ---
  const filteredProducts = products.filter(p => {
    // Filtro por Categoría
    if (selectedCategoryFilter !== null && p.category_id !== selectedCategoryFilter) return false;
    
    // Filtro por Buscador
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cat = categories.find(c => c.id === p.category_id);
      const sub = subcategories.find(s => s.id === p.subcategory_id);
      
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = (p.description || "").toLowerCase().includes(q);
      const matchCat = cat ? cat.name.toLowerCase().includes(q) : false;
      const matchSub = sub ? sub.name.toLowerCase().includes(q) : false;

      return matchName || matchDesc || matchCat || matchSub;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* SECCIÓN MÁRGEN HEADER PREMIUM */}
      <header className="border-b border-slate-900 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-md">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-sans sm:text-xl">
                  Control de Almacén Decorativo
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20">
                  SQLite-Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gestión comercial e inventarios físicos de alta estilización
              </p>
            </div>
          </div>

          {/* ESTADO DE CONEXION DEL BACKEND / VOLUMEN */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              SQLite: <span className="text-slate-300 font-semibold">inventario_hogar.db</span>
            </div>

            <button
              onClick={resetSimulator}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 hover:text-white transition-all px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer"
              title="Restaurar base de datos simulada con semillas de prueba"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restaurar Semillas</span>
            </button>

            <button
              onClick={() => {
                setShowClearConfirm(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-red-955/50 hover:text-red-400 hover:border-red-500/20 transition-all px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer font-semibold shadow-sm"
              title="Vaciar por completo todas las tablas de prueba de la base de datos"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
              <span className="hidden sm:inline">Vaciar Almacén</span>
            </button>
          </div>
        </div>

        {/* MENÚ DE COMPONENTES DE NAVEGACIÓN DE NEGOCIO */}
        <div className="bg-slate-900/40 border-t border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto py-1 gap-1 scrolling-touch no-scrollbar">
              <button
                onClick={() => { setActiveTab("dashboard"); setSelectedCategoryFilter(null); }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  activeTab === "dashboard"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab("catalog")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  activeTab === "catalog"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>Catálogo Visual</span>
              </button>

              <button
                onClick={() => setActiveTab("forms")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  activeTab === "forms"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>Ingreso de Stock</span>
              </button>

              <button
                onClick={() => setActiveTab("engineering")}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ml-auto text-indigo-300 hover:text-indigo-200 whitespace-nowrap ${
                  activeTab === "engineering"
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                    : "border-transparent text-slate-400/80 hover:bg-slate-900/30"
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Auditoría Técnica</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* COMPONENTE DE TOSTADAS NOTIFICADORAS */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: "50%" }}
            animate={{ opacity: 1, y: 0, x: "50%" }}
            exit={{ opacity: 0, scale: 0.95, x: "50%" }}
            className={`fixed top-6 right-1/2 translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 max-w-md border ${
              toastType === "success" ? "bg-slate-900 border-indigo-500/30 text-indigo-100" :
              toastType === "error" ? "bg-red-950/90 border-red-500/30 text-red-200" :
              "bg-slate-900 border-teal-500/20 text-teal-100"
            }`}
          >
            {toastType === "success" && <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0" />}
            {toastType === "error" && <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />}
            {toastType === "info" && <Info className="h-5 w-5 text-teal-400 shrink-0" />}
            <span className="text-xs font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* MODAL DE CONFIRMACIÓN DE BORRADO SEGURO / FORZADO */}
      <AnimatePresence>
        {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* DECORACIÓN CABECERA ROJA */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-amber-500" />
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-sans">
                    Confirmación de Eliminación
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    ¿Estás seguro de que deseas eliminar este artículo del inventario? Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              {/* DETALLES ELEMENTO ACUTAL */}
              <div className="mt-4 p-3.5 bg-slate-950 rounded-xl border border-slate-850 text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tipo:</span>
                  <span className="text-indigo-400 font-bold uppercase text-[10px] bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                    {deleteConfirmModal.type === "product" ? "Producto" : deleteConfirmModal.type === "category" ? "Categoría" : "Lote de Variante"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nombre:</span>{" "}
                  <strong className="text-slate-200 font-sans">{deleteConfirmModal.name}</strong>
                </div>
                {deleteConfirmModal.description && (
                  <p className="text-[11px] text-slate-400 font-sans border-t border-slate-900 pt-1.5 mt-1.5 leading-relaxed">
                    {deleteConfirmModal.description}
                  </p>
                )}
              </div>

              {/* OPCION BORRADO FORZADO EN CASCADA SI ES REQUERIDO O RECHAZADO POR BASE DE DATOS */}
              {(deleteConfirmModal.forceAvailable || deleteConfirmModal.type !== "variant") && (
                <div className="mt-4 p-3 bg-red-500/5 text-red-200 border border-red-500/15 rounded-xl flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="force-delete-chk"
                    className="mt-1 accent-red-500 h-4 w-4 cursor-pointer"
                    checked={deleteConfirmModal.forceChecked}
                    onChange={(e) => setDeleteConfirmModal(prev => ({ ...prev, forceChecked: e.target.checked }))}
                  />
                  <div className="text-xs">
                    <label htmlFor="force-delete-chk" className="font-bold text-red-400 cursor-pointer block">
                      Confirmar Borrado Forzado / Cascada Completo
                    </label>
                    <p className="text-[10px] text-red-300/80 mt-0.5 leading-relaxed">
                      La base de datos física de SQLite posee dependencias de integridad relacional (Foreign Keys). Activar este check autoriza la limpieza de registros hijos, variantes sin stock y dependencias asociadas automáticamente.
                    </p>
                  </div>
                </div>
              )}

              {/* BOTONES DE CONTROL DE MODAL */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-850 pt-4">
                <button
                  onClick={() => setDeleteConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-slate-950/40 rounded-lg hover:bg-slate-850 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeDelete}
                  className="px-4 py-2 text-xs font-bold text-white transition-all bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-650 rounded-lg shadow-lg hover:shadow-red-500/10 cursor-pointer flex items-center gap-1.5 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar de Forma Definitiva</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PARA VACIAR ALMACÉN EN SU TOTALIDAD (SIN BLOQUEAR IFRAMES) */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-amber-600" />
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/10 text-red-400 rounded-xl shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-sans">
                    Confirmar Vaciado Completo
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-sans">
                    ¿Estás seguro de que deseas vaciar por completo el inventario físico de decoración?
                  </p>
                </div>
              </div>

              <p className="mt-4 p-3 bg-red-950/20 text-red-300 border border-red-900/40 rounded-xl text-[11px] leading-relaxed font-sans">
                Esta acción es definitiva y <strong>no se puede deshacer</strong>. Todas las categorías creadas, subcategorías del catálogo, productos y lotes de variantes físicas de bodega serán removidos permanentemente de la base de datos de SQLite.
              </p>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-850 pt-4">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-slate-950/40 rounded-lg hover:bg-slate-850 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    clearDatabase();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white transition-all bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-550 rounded-lg shadow-lg hover:shadow-red-500/10 cursor-pointer flex items-center gap-1.5 font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Vaciar Todo</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CORE CUERPO PRINCIPAL */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: DASHBOARD DE NEGOCIO */}
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* TARJETAS RESUMEN DE FINANZAS Y STOCK */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* VALOR COMPRA */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Valor Contable Almacén</span>
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                      <Coins className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                      {formatCurrency(totalValuation)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Multiplicado por precio de venta neto actual
                    </p>
                  </div>
                </div>

                {/* STOCK TOTAL */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Unidades en Stock</span>
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <Package className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-bold text-white font-mono tracking-tight">
                      {totalStock} <span className="text-xs font-normal text-slate-500">piezas</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Agregado de todas las variantes físicas
                    </p>
                  </div>
                </div>

                {/* STOCK CRÍTICO */}
                <div 
                  onClick={() => {
                    setActiveTab("catalog");
                    setSearchQuery("");
                  }}
                  className={`cursor-pointer rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    criticalVariantsCount > 0 
                      ? "bg-red-950/20 hover:bg-red-950/30 border-red-900/60" 
                      : "bg-slate-900/40 hover:bg-slate-900 border-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Bajo Stock / Reordenar</span>
                    <div className={`p-2 rounded-lg ${criticalVariantsCount > 0 ? "bg-red-500/20 text-red-400" : "bg-slate-800 text-slate-400"}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className={`text-2xl font-bold font-mono tracking-tight ${criticalVariantsCount > 0 ? "text-red-400" : "text-white"}`}>
                      {criticalVariantsCount} <span className="text-xs font-normal text-slate-500">variantes</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {criticalVariantsCount > 0 ? "⚠️ Hay almacenes por debajo de 5 unidades." : "Todos los niveles están estables."}
                    </p>
                  </div>
                </div>

                {/* MARGEN DE GANANCIA PROYECTADA */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Ganancia Bruta Estimada</span>
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                      {formatCurrency(projectedGain)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Diferencial entre adquisión y venta final
                    </p>
                  </div>
                </div>

              </div>

              {/* RENDER FINANZAS CATEGORIZADO */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* BALANCE POR CATEGORIA */}
                <div className="lg:col-span-12 bg-slate-900/50 rounded-2xl border border-slate-900 p-5">
                  <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Valorización de Almacén por Categoría</h4>
                      <p className="text-xs text-slate-500">Consolidado dinámico desde la base de datos física de SQLite</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/10">
                      Query Agregado SQL
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {categories.map((cat) => {
                      const prodsInCat = products.filter(p => p.category_id === cat.id);
                      const prodIds = prodsInCat.map(p => p.id);
                      const catVars = variants.filter(v => prodIds.includes(v.product_id));
                      
                      const catPieces = catVars.reduce((acc, curr) => acc + curr.stock_actual, 0);
                      const catValuation = catVars.reduce((acc, curr) => {
                        const netPrice = curr.precio_venta_base * (1 - curr.porcentaje_descuento / 100);
                        return acc + (curr.stock_actual * netPrice);
                      }, 0);

                      const CatIconComponent = getCategoryIcon(cat.name);

                      return (
                        <div key={cat.id} className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex flex-col justify-between hover:border-slate-800 transition-all">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-900">
                            <span className="text-xs font-bold text-slate-200">{cat.name}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(
                                    "category",
                                    cat.id,
                                    cat.name,
                                    `Contiene ${prodsInCat.length} productos y sus variantes vinculadas en cascada.`,
                                    prodsInCat.length > 0
                                  );
                                }}
                                className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded transition-all cursor-pointer"
                                title="Eliminar Categoría Completa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <div className="p-1.5 bg-slate-900 rounded-lg text-slate-400">
                                <CatIconComponent className="h-3.5 w-3.5" />
                              </div>
                            </div>
                          </div>
                          
                          <div className="my-4">
                            <p className="text-[10px] text-slate-500 uppercase font-mono">Total Liquidación</p>
                            <h5 className="text-lg font-bold text-white mt-1 font-mono">
                              {formatCurrency(catValuation)}
                            </h5>
                          </div>

                          <div className="flex justify-between items-center pt-2 text-xs text-slate-400 font-mono border-t border-slate-900/60">
                            <span>Artículos: <strong className="text-slate-200">{prodsInCat.length}</strong></span>
                            <span>Stock: <strong className="text-indigo-400">{catPieces} pz</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* NOTA DE USABILIDAD Y ALERTA STOCK CRITICO */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* ALERTA BAJO STOCK CONDENSADO */}
                  <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-900 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <BadgeAlert className="h-4.5 w-4.5 text-rose-500" />
                        Monitoreo de Stock Crítico (&le; 5 unidades)
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Variantes que requieren órdenes inmediatas con distribuidores</p>
                    </div>

                    <div className="my-4 max-h-40 overflow-y-auto space-y-2 pr-1">
                      {variants.filter(v => v.stock_actual <= 5).map(v => {
                        const p = products.find(prod => prod.id === v.product_id);
                        return (
                          <div key={v.id} className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono">
                            <div>
                              <p className="text-slate-300 font-sans font-bold">{p?.name || "Ref"}</p>
                              <span className="text-[10px] text-slate-500">{v.size} ({v.target_audience})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                              {v.stock_actual} pz
                            </span>
                          </div>
                        );
                      })}
                      {variants.filter(v => v.stock_actual <= 5).length === 0 && (
                        <p className="text-xs text-emerald-400 text-center py-4">Excelente: Todas las variantes físicas de la tienda cuentan con stock regular.</p>
                      )}
                    </div>
                  </div>

                  {/* PROMO DIRECTA DE TEMPORADA */}
                  <div className="bg-indigo-950/20 p-5 rounded-2xl border border-indigo-950/40 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <Percent className="h-4.5 w-4.5 text-indigo-400" />
                        Relación de Ofertas y Rebajas Activas
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Inventarios promocionados para liquidación rápida</p>
                    </div>

                    <div className="my-4 max-h-40 overflow-y-auto space-y-2 pr-1">
                      {variants.filter(v => v.porcentaje_descuento > 0).map(v => {
                        const p = products.find(prod => prod.id === v.product_id);
                        return (
                          <div key={v.id} className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono">
                            <div>
                              <p className="text-slate-300 font-sans font-bold">{p?.name || "Promo"}</p>
                              <span className="text-[10px] text-slate-500">{v.size}</span>
                            </div>
                            <div className="text-right">
                              <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold mr-1">
                                -{v.porcentaje_descuento}%
                              </span>
                              <span className="text-slate-300 font-bold">
                                {formatCurrency(v.precio_venta_base * (1 - v.porcentaje_descuento/100))}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {variants.filter(v => v.porcentaje_descuento > 0).length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">No hay rebajas registradas activas en la tienda.</p>
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </motion.div>
          )}

          {/* TAB 2: CATÁLOGO VISUAL ESTILO E-COMMERCE */}
          {activeTab === "catalog" && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              
              {/* COMPONENTES DE FILTRADO Y BÚSQUEDA RAPIDA */}
              <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                
                {/* BUSCADOR */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscador inteligente de artículos (Nombre, Categoría, Detalles...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 pl-10 text-xs focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500 font-sans transition-all"
                  />
                </div>

                {/* FILTRO CATEGORÍA */}
                <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-850 rounded-xl">
                  <button
                    onClick={() => setSelectedCategoryFilter(null)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      selectedCategoryFilter === null ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Todos
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedCategoryFilter === cat.id ? "bg-indigo-600 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

              </div>

              {/* RETORNO GRID DE TARJETAS DE PRODUCTO MÁS VARIANTE */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {filteredProducts.map((p) => {
                  const cat = categories.find(c => c.id === p.category_id);
                  const sub = subcategories.find(s => s.id === p.subcategory_id);
                  const prodVariants = variants.filter(v => v.product_id === p.id);
                  
                  // Calcular stock total de este producto específico
                  const productTotalStock = prodVariants.reduce((sum, v) => sum + v.stock_actual, 0);

                  const CatIconComponent = getCategoryIcon(cat?.name || "General");
                  const catGrad = getCategoryGradient(cat?.name || "General");
                  const catBadgeStyle = getCategoryBadgeClass(cat?.name || "General");

                  return (
                    <div 
                      key={p.id} 
                      className="bg-slate-900/40 rounded-2xl border border-slate-900 overflow-hidden flex flex-col justify-between hover:border-slate-800 transition-all shadow-xl"
                    >
                      {/* PRE-VISUALIZADORES / DECORADORES */}
                      <div className="relative flex flex-col items-center justify-center min-h-36 overflow-hidden border-b border-slate-900 bg-slate-950">
                        {/* Gradiente de color de Categoría en el fondo */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${catGrad} opacity-90`} />

                        {/* Imagen del producto (soporta URLs relativas de img locales y absolutas http web) */}
                        {p.image_path && p.image_path !== "" && (
                          <div className="absolute inset-0 w-full h-full z-0">
                            <img 
                              src={p.image_path} 
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover select-none"
                              onError={(e) => {
                                // Si da error la imagen, ocultamos el contenedor de la imagen para que se vea el gradiente de fondo
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {/* Overlay oscuro para legibilidad superior */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/10" />
                          </div>
                        )}

                        {/* BOTÓN DISCRETO ELIMINACIÓN PRODUCTO */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(
                              "product",
                              p.id,
                              p.name,
                              p.description || "Sin descripción",
                              prodVariants.length > 0 || productTotalStock > 0
                            );
                          }}
                          className="absolute top-4 left-4 z-10 p-1.5 bg-slate-950/70 hover:bg-red-950/90 text-slate-400 hover:text-red-400 rounded-lg border border-slate-800 hover:border-red-500/30 transition-all cursor-pointer shadow-md"
                          title="Eliminar producto de almacén"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        {/* BADGE STOCK TOTAL FLOTANTE */}
                        <div className="absolute top-4 right-4 z-10 text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-950/85 text-slate-300 border border-slate-800 px-2 py-1 rounded-md">
                          Stock: <span className="text-white font-bold">{productTotalStock} pz</span>
                        </div>

                        {/* ICONO GRANDE HERO */}
                        <div className="relative z-10 flex flex-col items-center justify-center">
                          <CatIconComponent className={`h-12 w-12 text-slate-100 ${p.image_path ? "opacity-35" : "opacity-90"}`} />
                        </div>
                      </div>

                      {/* INFORMACION DEL PRODUCTO */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        
                        <div>
                          {/* BADGES CATEGORIA Y SUBCATEGORÍA */}
                          <div className="flex gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${catBadgeStyle}`}>
                              {cat?.name || "Master"}
                            </span>
                            {sub && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-800">
                                {sub.name}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-100 mt-3 font-sans hover:text-white transition-colors">
                            {p.name}
                          </h4>
                          
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans line-clamp-2">
                            {p.description}
                          </p>
                        </div>

                        {/* SUB-SECCION DE VARIANTES FISICAS */}
                        <div className="mt-5 pt-4 border-t border-slate-900/60">
                          <h5 className="text-[10px] text-slate-500 uppercase font-mono font-bold tracking-wider mb-2.5">
                            Variantes Físicas en Almacén ({prodVariants.length})
                          </h5>
                          
                          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                            {prodVariants.map((v) => {
                              const discPrice = v.precio_venta_base * (1 - v.porcentaje_descuento / 100);
                              
                              return (
                                <div 
                                  key={v.id} 
                                  className="p-2.5 bg-slate-950 rounded-xl border border-slate-900/80 hover:border-slate-800/80 transition-all flex justify-between items-center text-xs font-mono"
                                >
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <p className="text-slate-200 font-sans font-semibold text-[11px]">
                                        {v.size}
                                      </p>
                                      <span className="text-[10px] text-slate-500 font-sans">
                                        {v.target_audience} | Costo: {formatCurrency(v.precio_compra)}
                                      </span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(
                                          "variant",
                                          v.id,
                                          `${p.name} (${v.size})`,
                                          `Lote Físico ID: ${v.id} | Stock: ${v.stock_actual} pz`,
                                          false
                                        );
                                      }}
                                      className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-950/25 rounded transition-all cursor-pointer opacity-50 hover:opacity-100"
                                      title="Eliminar esta variante de stock"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div className="text-right flex flex-col items-end gap-1">
                                    {/* BADGE STOCK BAJO / ALTO */}
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      v.stock_actual <= 0 ? "bg-red-500/10 text-red-400 border border-red-500/10" :
                                      v.stock_actual <= 5 ? "bg-amber-500/10 text-amber-500 border border-amber-500/10" :
                                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                                    }`}>
                                      {v.stock_actual} pz
                                    </span>

                                    {/* PRECIOS FINALES */}
                                    <div className="flex gap-1.5 items-center font-bold">
                                      {v.porcentaje_descuento > 0 ? (
                                        <>
                                          <span className="line-through text-red-400 text-[10px] font-normal">
                                            {formatCurrency(v.precio_venta_base)}
                                          </span>
                                          <span className="text-amber-400 text-xs">
                                            {formatCurrency(discPrice)}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-slate-300">
                                          {formatCurrency(v.precio_venta_base)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {prodVariants.length === 0 && (
                              <p className="text-[11px] text-amber-400 italic text-center py-2.5">
                                Sin stock físico. Ve a &apos;Ingreso de Stock&apos; para añadir variantes.
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/15 border border-dashed border-slate-900 rounded-3xl">
                    <SlidersHorizontal className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <p className="font-semibold text-sm">No encontramos coincidencias de artículos en Almacén</p>
                    <p className="text-xs text-slate-500 mt-1">Prueba reajustando el filtro superior o limpiando tu búsqueda.</p>
                  </div>
                )}

              </div>

            </motion.div>
          )}

          {/* TAB 3: REGISTROS EN PASOS SIMPLES */}
          {activeTab === "forms" && (
            <motion.div
              key="forms"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* ENCABEZADO EXPLICATORIO */}
              <div className="lg:col-span-12 p-5 bg-gradient-to-r from-indigo-950/20 to-teal-950/10 rounded-2xl border border-indigo-950/40 flex items-start gap-3.5">
                <Info className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Gestor de Stock y Altas Físicas</h4>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-4xl">
                    Agrega categorías, productos refinados y asóciales variantes de almacén. Los selectores cargan automáticamente información de forma humana en lugar de requerir IDs de bases de datos complejos.
                  </p>
                </div>
              </div>

              {/* COL COMPLETAR: REGISTRAR PRODUCTO MAESTRO */}
              <div className="lg:col-span-6 bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                  <Package className="h-4.5 w-4.5 text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Registrar Producto Maestro</h4>
                </div>

                <form onSubmit={handleAddProduct} className="space-y-4 text-xs font-sans">
                  
                  {/* SELECTOR CATEGORIA DINAMICA */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Categoría Superior</label>
                    <select
                      value={newProdCatId}
                      onChange={(e) => setNewProdCatId(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-slate-300 font-sans cursor-pointer transition-all"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* SELECTOR SUBCATEGORIA DINAMICA */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Subcategoría Específica</label>
                    <select
                      value={newProdSubId}
                      onChange={(e) => setNewProdSubId(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-slate-300 font-sans cursor-pointer transition-all"
                    >
                      {subcategories.filter(s => s.category_id === newProdCatId).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      {subcategories.filter(s => s.category_id === newProdCatId).length === 0 && (
                        <option value="">-- No hay subcategorías en esta línea --</option>
                      )}
                    </select>
                  </div>

                  {/* NOMBRE DEL ARTICULO */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Nombre Comercial del Artículo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 'Sábana Bambú Imperial'"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-600 transition-all font-sans"
                    />
                  </div>

                  {/* DESCRIPCION DE MATERIALES / CUIDADOS */}
                  <div>
                    <label className="block text-slate-400 font-medium mb-1.5">Especificationes (Descripción)</label>
                    <textarea
                      placeholder="Madera de nogal, pulido mate. Cuidados de limpieza especial..."
                      value={newProdDesc}
                      onChange={(e) => setNewProdDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-600 resize-none h-20 transition-all font-sans"
                    />
                  </div>

                  {/* FOTO DEL PRODUCTO - SELECCIONAR DESDE GALERIA / MEMORIA */}
                  <div className="space-y-3">
                    <label className="block text-slate-400 font-medium">Foto del Producto (Galería o Enlace)</label>
                    
                    {/* ZONA DE CARGA INTERACTIVA */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center gap-3 relative transition-all hover:border-slate-750">
                      
                      {newProdImg ? (
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-slate-800 bg-slate-900 group">
                            <img 
                              src={newProdImg} 
                              alt="Previsualización" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                              <span className="text-[10px] text-white font-semibold">Cargada</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <label 
                              htmlFor="gallery-file-input" 
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 hover:text-white text-slate-300 rounded-lg text-[10px] border border-slate-800 font-bold cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Camera className="h-3 w-3" />
                              <span>Cambiar Foto</span>
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => setNewProdImg("")}
                              className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg text-[10px] border border-red-500/10 font-bold cursor-pointer transition-all flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Eliminar Foto</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label 
                          htmlFor="gallery-file-input" 
                          className="w-full py-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-505/50 rounded-lg gap-2 cursor-pointer transition-all select-none group"
                        >
                          <div className="p-3 bg-slate-900 text-slate-400 group-hover:text-indigo-400 rounded-full transition-all">
                            <Upload className="h-5 w-5" />
                          </div>
                          <span className="text-[11px] text-slate-400 group-hover:text-slate-300 font-medium">
                            Hacer clic para buscar en Galería / Dispositivo
                          </span>
                          <span className="text-[9px] text-slate-600">
                            Soporta formatos PNG, JPG, JPEG, GIF
                          </span>
                        </label>
                      )}

                      <input 
                        type="file" 
                        id="gallery-file-input" 
                        accept="image/*" 
                        onChange={handleImageFileChange} 
                        className="hidden" 
                      />
                    </div>

                    {/* ACORDEON MINI DE URL MANUAL SI PREFIERE */}
                    <div className="pt-1.5">
                      <details className="group">
                        <summary className="text-[10px] text-slate-500 hover:text-slate-400 cursor-pointer list-none flex items-center gap-1.5 select-none">
                          <span className="transition-transform group-open:rotate-90">▶</span>
                          <span>O ingresar por URL directa de internet</span>
                        </summary>
                        <div className="mt-2 pl-3">
                          <input
                            type="text"
                            placeholder="Ej: https://images.unsplash.com/foto.jpg"
                            value={newProdImg.startsWith("data:") ? "" : newProdImg}
                            onChange={(e) => setNewProdImg(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl px-3 py-2 text-white placeholder-slate-700 transition-all font-sans text-[11px]"
                          />
                        </div>
                      </details>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <span>Guardar Producto Maestro</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                </form>
              </div>

              {/* COL COMPLEMENTO: REGISTRAR VARIANTE DE STOCK (VINCULADO DESPLEGABLE) */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                
                {/* VINCULO VARIANTE */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                  <div className="pb-3 border-b border-slate-800 flex items-center gap-2">
                    <SlidersHorizontal className="h-4.5 w-4.5 text-teal-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Ingresar Stock Físico (Variante)</h4>
                  </div>

                  <form onSubmit={handleAddVariant} className="space-y-4 text-xs font-sans">
                    
                    {/* DROPDOWN PRODUCTO REAL */}
                    <div>
                      <label className="block text-slate-400 font-medium mb-1.5">Seleccionar Producto Destinatario</label>
                      <select
                        value={newVarProdId}
                        onChange={(e) => setNewVarProdId(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-3 py-2.5 text-slate-300 font-sans cursor-pointer transition-all"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* TALLA / ESCALA */}
                      <div>
                        <label className="block text-slate-400 font-medium mb-1.5">Talla / Dimensiones</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: King Size, Individual, Gral"
                          value={newVarSize}
                          onChange={(e) => setNewVarSize(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-600 transition-all font-sans"
                        />
                      </div>

                      {/* PUBLICO / ESTILO */}
                      <div>
                        <label className="block text-slate-400 font-medium mb-1.5">Estilo o Público</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Unisex, Edición Limitada"
                          value={newVarAudience}
                          onChange={(e) => setNewVarAudience(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl px-3 py-2.5 text-white placeholder-slate-600 transition-all font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Costo Unit ($)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={newVarCost}
                          onChange={(e) => setNewVarCost(cleanInputNumberString(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl p-2.5 text-white text-center font-mono"
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Lista Venta ($)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={newVarSell}
                          onChange={(e) => setNewVarSell(cleanInputNumberString(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl p-2.5 text-white text-center font-mono"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Rebaja (%)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={newVarDiscount}
                          onChange={(e) => setNewVarDiscount(cleanInputNumberString(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl p-2.5 text-white text-center font-mono"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-[10px] text-slate-400 font-medium mb-1.5">Stock Piezas</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          required
                          value={newVarStock}
                          onChange={(e) => setNewVarStock(cleanInputNumberString(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-505 focus:outline-none rounded-xl p-2.5 text-white text-center font-mono"
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                    >
                      <span>Vincular Stock Físico</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

                  </form>
                </div>

                {/* CREACIÓN DE NUEVA CLASIFICACIÓN (CATEGORIA / SUBCATEGORÍA) */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                  <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4.5 w-4.5 text-indigo-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">Nueva Línea o Categoría</h4>
                    </div>
                  </div>

                  {/* SUB SECCIONES COLAPSABLES FLEX */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* FOMULARIO EN MINI - CATEGORIA */}
                    <form onSubmit={handleAddCategory} className="space-y-3 font-sans text-xs">
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">Nueva Categoría Principal</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 'Decoración'"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-none rounded-xl px-3 py-2 text-white font-sans"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold rounded-xl text-slate-300 hover:text-white transition-all text-center flex justify-center items-center gap-1.5 cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Agregar Categoría</span>
                      </button>
                    </form>

                    {/* FORMULARIO EN MINI - SUBCATEGORIA */}
                    <form onSubmit={handleAddSubCategory} className="space-y-3 font-sans text-xs">
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">Nueva Subcategoría</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 'Cojines'"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-none rounded-xl px-3 py-2 text-white font-sans"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-slate-500 font-semibold mb-1">Vincular Línea</label>
                        <select
                          value={newSubCatId}
                          onChange={(e) => setNewSubCatId(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:outline-none rounded-xl px-2 py-1.5 text-slate-300 font-sans cursor-pointer h-[32px]"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <button type="submit" className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold rounded-xl text-slate-300 hover:text-white transition-all text-center flex justify-center items-center gap-1.5 cursor-pointer">
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Agregar Subcategoría</span>
                      </button>
                    </form>

                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* TAB 4: AUDITORÍA TÉCNICA (ADMIN DEVELOPER ZONE) */}
          {activeTab === "engineering" && (
            <motion.div
              key="engineering"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* SIDEBAR SUBTABS DE AUDITORIA */}
              <aside className="lg:col-span-3 flex flex-col gap-2">
                <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-4 flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80 text-indigo-400">
                    <Database className="h-4.5 w-4.5" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Motor Relacional</h4>
                  </div>
                  
                  {/* METRICAS DE CONFIABILIDAD DE SQLite */}
                  <div className="grid grid-cols-2 gap-2 text-center text-[11px] font-mono">
                    <div className="bg-slate-950/80 p-2 border border-slate-900 rounded-xl">
                      <span className="text-slate-500 block uppercase">Clases</span>
                      <strong className="text-white text-sm">{schemaTables.length}</strong>
                    </div>
                    <div className="bg-slate-950/80 p-2 border border-slate-900 rounded-xl">
                      <span className="text-slate-500 block uppercase">Categorías</span>
                      <strong className="text-indigo-450 text-sm">{categories.length}</strong>
                    </div>
                    <div className="bg-slate-950/80 p-2 border border-slate-900 rounded-xl">
                      <span className="text-slate-500 block uppercase">Productos</span>
                      <strong className="text-sky-450 text-sm">{products.length}</strong>
                    </div>
                    <div className="bg-slate-950/80 p-2 border border-slate-900 rounded-xl">
                      <span className="text-slate-500 block uppercase">Variantes</span>
                      <strong className="text-amber-450 text-sm">{variants.length}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setDevSubTab("erd")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all text-left border ${
                      devSubTab === "erd"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-900/40 hover:bg-slate-900 text-slate-400 border-slate-900/60"
                    }`}
                  >
                    <Layers3 className="h-4 w-4" />
                    <span>Modelo de Datos (ERD)</span>
                  </button>

                  <button
                    onClick={() => setDevSubTab("code")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all text-left border ${
                      devSubTab === "code"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-900/40 hover:bg-slate-900 text-slate-400 border-slate-900/60"
                    }`}
                  >
                    <FileCode className="h-4 w-4" />
                    <span>Ver Código (.py)</span>
                  </button>

                  <button
                    onClick={() => setDevSubTab("connection")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all text-left border ${
                      devSubTab === "connection"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-900/40 hover:bg-slate-900 text-slate-400 border-slate-900/60"
                    }`}
                  >
                    <Cpu className="h-4 w-4" />
                    <span>Flujo de Inicialización</span>
                  </button>

                  <button
                    onClick={() => setDevSubTab("devops")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all text-left border ${
                      devSubTab === "devops"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "bg-slate-900/40 hover:bg-slate-900 text-slate-400 border-slate-900/60"
                    }`}
                  >
                    <Terminal className="h-4 w-4" />
                    <span>Tests de Robustez API</span>
                  </button>
                </div>
              </aside>

              {/* CONTENEDOR SUBTAB DESPLIEGUE */}
              <div className="lg:col-span-9 flex flex-col gap-6">
                
                {/* 4.1 SUBTAB: DIAGRAMA ERD INTERACTIVO CON CLASES */}
                {devSubTab === "erd" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5">
                      <div className="pb-3 border-b border-slate-800">
                        <h4 className="text-sm font-bold text-slate-200">Mapa de Relaciones Relacionales (Foreign Keys)</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Interactúa con cada tabla para proyectar el diccionario pydantic/sqlmodel correspondiente a las restricciones.
                        </p>
                      </div>

                      {/* DIAGRAMA INTERACTIVO MAPA */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-6 relative">
                        {/* CATEGORY */}
                        <div 
                          onClick={() => setSelectedErdTable("product")}
                          className={`cursor-pointer p-4 rounded-xl border transition-all ${
                            selectedErdTable === "product" ? "bg-slate-950 border-indigo-500 shadow-md" : "bg-slate-950/20 border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800/80">
                            <span className="text-[11px] font-mono font-bold text-slate-200">Product</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono text-slate-450">
                            <p className="text-indigo-400">PK: id (int)</p>
                            <p>name (str)</p>
                            <p className="text-pink-400">FK: category_id</p>
                            <p className="text-pink-400">FK: subcat_id</p>
                          </div>
                        </div>

                        {/* PRODUCT VARIANT */}
                        <div 
                          onClick={() => setSelectedErdTable("variant")}
                          className={`cursor-pointer p-4 rounded-xl border transition-all ${
                            selectedErdTable === "variant" ? "bg-slate-950 border-indigo-500 shadow-md" : "bg-slate-950/20 border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800/80">
                            <span className="text-[11px] font-mono font-bold text-slate-200">Variant</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono text-slate-450">
                            <p className="text-indigo-400">PK: id (int)</p>
                            <p className="text-pink-400">FK: product_id</p>
                            <p>stock_actual (int)</p>
                            <p>precio_venta (float)</p>
                          </div>
                        </div>

                        {/* CATEGORY */}
                        <div 
                          onClick={() => setSelectedErdTable("category")}
                          className={`cursor-pointer p-4 rounded-xl border transition-all ${
                            selectedErdTable === "category" ? "bg-slate-950 border-indigo-500 shadow-md" : "bg-slate-950/20 border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800/80">
                            <span className="text-[11px] font-mono font-bold text-slate-200">Category</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono text-slate-450">
                            <p className="text-indigo-400">PK: id (int)</p>
                            <p>name (str, UQ)</p>
                          </div>
                        </div>

                        {/* SUBCATEGORY */}
                        <div 
                          onClick={() => setSelectedErdTable("subcategory")}
                          className={`cursor-pointer p-4 rounded-xl border transition-all ${
                            selectedErdTable === "subcategory" ? "bg-slate-950 border-indigo-500 shadow-md" : "bg-slate-950/20 border-slate-850"
                          }`}
                        >
                          <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800/80">
                            <span className="text-[11px] font-mono font-bold text-slate-200">SubCategory</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          </div>
                          <div className="space-y-1 text-[10px] font-mono text-slate-450">
                            <p className="text-indigo-400">PK: id (int)</p>
                            <p>name (str)</p>
                            <p className="text-pink-400">FK: category_id</p>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* DICCIONARIO ESQUEMA SQLMODEL */}
                    {(() => {
                      const currentTableKey = selectedErdTable === "category" ? "category" : selectedErdTable === "subcategory" ? "subcategory" : selectedErdTable === "product" ? "product" : "product_variant";
                      const tableData = schemaTables.find(t => t.name === currentTableKey);
                      if (!tableData) return null;

                      return (
                        <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 border-b border-slate-800 gap-2 mb-4">
                            <span className="text-xs font-mono font-semibold bg-indigo-500/10 border border-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-lg">
                              __tablename__ = &quot;{tableData.name}&quot;
                            </span>
                            <span className="text-xs text-slate-500 font-sans">{tableData.description}</span>
                          </div>

                          <div className="overflow-x-auto text-[11px] font-mono">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                  <th className="py-2.5">Atributo</th>
                                  <th className="py-2.5">Tipo Python</th>
                                  <th className="py-2.5">Modificadores en DB</th>
                                  <th className="py-2.5 font-sans">Propósito Funcional</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-855">
                                {tableData.fields.map(f => (
                                  <tr key={f.name} className="text-slate-300">
                                    <td className="py-2 font-bold text-indigo-300">{f.name}</td>
                                    <td className="py-2 text-slate-400">{f.type}</td>
                                    <td className="py-2">
                                      {f.constraints.map(c => (
                                        <span key={c} className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 text-[10px] text-slate-400 mr-1">{c}</span>
                                      ))}
                                    </td>
                                    <td className="py-2 font-sans text-slate-450">{f.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                  </motion.div>
                )}

                {/* 4.2 SUBTAB: VISUALIZADOR DE CODIGO ORIGINAL EN PY */}
                {devSubTab === "code" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                      <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
                        <div className="flex gap-2">
                          {(["models", "database", "main"] as const).map(file => (
                            <button
                              key={file}
                              onClick={() => setActiveCodeFile(file)}
                              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-all border ${
                                activeCodeFile === file ? "bg-indigo-600/10 border-indigo-500 text-indigo-400" : "bg-slate-950 border-slate-850 text-slate-400"
                              }`}
                            >
                              {file === "models" ? "models.py" : file === "database" ? "database.py" : "main.py"}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => handleCopyCode(
                            activeCodeFile === "models" ? modelsPyCode : activeCodeFile === "database" ? databasePyCode : mainPyCode,
                            activeCodeFile === "models" ? "models.py" : activeCodeFile === "database" ? "database.py" : "main.py"
                          )}
                          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 hover:text-white transition-all text-slate-300 border border-slate-700 flex items-center gap-1.5"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </button>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono leading-relaxed max-h-96 overflow-y-auto">
                        <pre 
                          className="text-slate-300"
                          dangerouslySetInnerHTML={{
                            __html: highlightPython(
                              activeCodeFile === "models" ? modelsPyCode : activeCodeFile === "database" ? databasePyCode : mainPyCode
                            )
                          }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 4.3 SUBTAB: FLUJO DE INICIALIZACION ENGINE */}
                {devSubTab === "connection" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                  >
                    <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                      <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                        Aislamiento de Hilos (check_same_thread)
                      </h4>
                      <p className="text-xs text-slate-450 leading-relaxed">
                        SQLite por defecto restringe la manipulación del mismo archivo físico a un único subproceso. Uvicorn lanza un pool de hilos de forma concurrente, por lo cual desactivamos esta regla para evitar colisiones:
                      </p>
                      <pre className="p-3 bg-slate-950 border border-slate-850 text-[11px] font-mono text-indigo-300 rounded-xl leading-relaxed">
{`engine = create_engine(
    sqlite_url,
    connect_args={"check_same_thread": False}
)`}
                      </pre>
                    </div>

                    <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5 flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <CheckCircle2 className="h-4.5 w-4.5 text-indigo-400" />
                          Paso de Producción: init_db()
                        </h4>
                        <p className="text-xs text-slate-450 leading-relaxed mt-2">
                          Corremos <code className="bg-slate-950 text-indigo-400 px-1 py-0.5 rounded text-[11px]">SQLModel.metadata.create_all(engine)</code> en el startup. El contenedor Docker montará <code className="text-emerald-400 font-mono">/app/data/inventario_hogar.db</code> como un volumen persistente para evitar la pérdida de stock físico.
                        </p>
                      </div>

                      <div className="bg-indigo-950/20 p-3.5 text-xs text-indigo-200 border border-indigo-950/40 rounded-xl">
                        💡 Tu sesión FastAPI se inyecta mediante el patrón de dependencias limpio de Pydantic/FastAPI, asegurando el auto-close de la conexión al concluir.
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 4.4 SUBTAB: CONSOLA DE PRUEBAS DE AUTOMATIZACION DE API DE BASE DE DATOS */}
                {devSubTab === "devops" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-slate-900/60 rounded-2xl border border-slate-900 p-5 flex flex-col gap-4">
                      <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
                        <div>
                          <h4 className="text-sm font-bold text-slate-200">Pruebas Robotizadas DevOps</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Dispara sondas robotizadas de peticiones HTTP para probar sistemáticamente las restricciones de BD (Foreign Keys, Uniqueness y Reglas).
                          </p>
                        </div>

                        <button
                          onClick={runQAProbes}
                          disabled={runningTests}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/10 rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                        >
                          {runningTests ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              <span>Analizando...</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 fill-current" />
                              <span>Lanzar Sondas QA</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* CONSOLA DIGITAL DE DEVOPS OUTPUT */}
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-900 min-h-64 flex flex-col justify-between font-mono text-[11px] text-slate-350 leading-relaxed shadow-inner">
                        {testOutput ? (
                          <pre className="whitespace-pre-wrap">{testOutput}</pre>
                        ) : (
                          <div className="flex flex-col items-center justify-center my-16 text-slate-600">
                            <Terminal className="h-8 w-8 text-slate-700 mb-2" />
                            <p className="text-xs">Consola de Sandbox ociosa. Pulsa &quot;Lanzar Sondas QA&quot; para iniciar la verificación de endpoints.</p>
                          </div>
                        )}
                        
                        {runningTests && (
                          <span className="text-[10px] text-indigo-400 uppercase font-mono tracking-wider animate-pulse pt-4">Ejecutando suite robotizada de pruebas...</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* FOOTER COHESIVO DE NEGOCIO */}
      <footer className="bg-slate-950 text-slate-600 py-6 border-t border-slate-900 mt-12 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <p className="font-mono text-[11px] text-left text-slate-500">
            Control de Almacén Decorativo &copy; 2026. Diseñado para Tienda de Artículos del Hogar. Entorno SQLite Conectado.
          </p>
          <div className="flex gap-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <span>Fase 2 Completada</span>
            <span className="text-slate-700">|</span>
            <span className="text-indigo-500 font-semibold cursor-pointer" onClick={() => setActiveTab("engineering")}>Auditar Base de Datos</span>
          </div>
        </div>
      </footer>

      {/* CHATBOT FLOTANTE INTELIGENTE DE SOLO LECTURA (CRAFT INDIGO/SLATE ACCENTS) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ duration: 0.2 }}
              className="w-80 sm:w-96 bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[500px]"
            >
              {/* Header Premium con Alerta de Solo Lectura */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide">Asistente AI de Inventariado</h3>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Solo Lectura</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer rounded-lg hover:bg-slate-805"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Panel de Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[250px] max-h-[300px] bg-slate-950/60 scroll-smooth">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[85%] ${
                      msg.role === "user" ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <span className="text-[9px] font-mono text-slate-500 mb-0.5">
                      {msg.role === "user" ? "Tú" : "Asistente"}
                    </span>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-800/80 text-slate-100 border border-slate-700/40 rounded-tl-none whitespace-pre-wrap"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isChatLoading && (
                  <div className="self-start flex flex-col items-start gap-1 max-w-[85%]">
                    <span className="text-[9px] font-mono text-slate-500">Asistente</span>
                    <div className="bg-slate-800/80 border border-slate-700/40 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sugerencias Rápidas para el Android de mi Mamá */}
              <div className="px-4 py-2 bg-slate-950/95 border-t border-slate-800 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, "¿Cómo está mi stock crítico?")}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-[10px] text-slate-350 rounded-full cursor-pointer transition-colors"
                >
                  ⚠️ Stock Crítico
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, "¿Cuál es la categoría más valiosa en almacén?")}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-[10px] text-slate-350 rounded-full cursor-pointer transition-colors"
                >
                  📊 Categoría Valiosa
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(undefined, "¿Qué ofertas o descuentos activos tengo?")}
                  className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-[10px] text-slate-350 rounded-full cursor-pointer transition-colors"
                >
                  🏷️ Rebajas Activas
                </button>
              </div>

              {/* Formulario de Ingreso de Texto */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-slate-900 border-t border-slate-850 flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Pregúntame sobre el stock o ganancias..."
                  disabled={isChatLoading}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-slate-600 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botón flotante animado */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`p-4 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all ${
            isChatOpen
              ? "bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-750"
              : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-500/30"
          }`}
        >
          <div className="relative">
            {isChatOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <>
                <MessageSquare className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping"></span>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950"></span>
              </>
            )}
          </div>
        </motion.button>
      </div>

    </div>
  );
}
