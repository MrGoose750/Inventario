"""
Módulo Backend Principal de FastAPI para el Sistema de Inventario de Artículos de Hogar.
Implementa el servidor API completo con operaciones CRUD y consultas avanzadas de almacén.
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, func
from typing import List, Dict, Any, Optional
from datetime import datetime

# Importación de módulos locales de base de datos y modelos
from database import init_db, get_session
from models import Category, SubCategory, Product, ProductVariant

app = FastAPI(
    title="Sistema de Inventario Hogar - API Backend",
    description="Servicios CRUD de alta robustez e informes agregados de inventario.",
    version="1.0.0"
)

# --- 1. CONFIGURACIÓN DE SEGURIDAD CORS ---
# Permite solicitudes de origen cruzado desde el puerto local de desarrollo de React u otros dominios autorizados.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, restringir a dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. CICLO DE VIDA DE LA APLICACIÓN (STARTUP EVENT) ---
@app.on_event("startup")
def on_startup():
    """
    Se ejecuta al iniciar el servidor FastAPI.
    Llama a la inicialización para garantizar que el archivo SQLite 'inventario_hogar.db'
    y las tablas se encuentren listos en el disco.
    """
    init_db()


# ==========================================
#              ENDPOINTS: CATEGORY
# ==========================================

@app.get("/category", response_model=List[Category], tags=["Categorías"])
def list_categories(session: Session = Depends(get_session)):
    """Obtiene la lista de todas las categorías registradas."""
    return session.exec(select(Category)).all()


@app.post("/category", response_model=Category, status_code=status.HTTP_201_CREATED, tags=["Categorías"])
def create_category(category: Category, session: Session = Depends(get_session)):
    """
    Crea una nueva categoría.
    Valida que el nombre sea único para evitar violaciones de clave única.
    """
    existing = session.exec(select(Category).where(Category.name == category.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La categoría '{category.name}' ya se encuentra registrada."
        )
    
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


@app.delete("/category/{category_id}", tags=["Categorías"])
def delete_category(category_id: int, force: bool = False, session: Session = Depends(get_session)):
    """
    Elimina una categoría.
    Si force=False y tiene productos asociados, arroja un error para evitar borrados accidentales.
    Si force=True o no tiene productos, limpia subcategorías y productos en cascada.
    """
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La categoría con ID {category_id} no existe."
        )
    
    # Validar productos dependientes si no se fuerza la cascada entera
    associated_products = session.exec(select(Product).where(Product.category_id == category_id)).all()
    if associated_products and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta categoría contiene artículos activos en catálogo. Use la confirmación avanzada (Borrado Completo/Forzado) si desea liquidarla con sus existencias correspondientes."
        )
    
    # Limpiar productos vinculados en cascada si force=True
    if associated_products:
        for prod in associated_products:
            session.delete(prod) # Esto limpiará también Variants por "cascade_delete=True" en la relación de Product
            
    session.delete(category) # Limpia subcategorías por "cascade_delete=True"
    session.commit()
    return {"status": "success", "message": f"Categoría {category_id} eliminada con éxito junto con sus relaciones.", "id": category_id}



# ==========================================
#            ENDPOINTS: SUBCATEGORY
# ==========================================

@app.get("/subcategory", response_model=List[SubCategory], tags=["Subcategorías"])
def list_subcategories(session: Session = Depends(get_session)):
    """Obtiene la lista de todas las subcategorías registradas."""
    return session.exec(select(SubCategory)).all()


@app.post("/subcategory", response_model=SubCategory, status_code=status.HTTP_201_CREATED, tags=["Subcategorías"])
def create_subcategory(subcategory: SubCategory, session: Session = Depends(get_session)):
    """
    Crea una nueva subcategoría vinculada a una categoría padre.
    Valida la existencia previa de la categoría (Foreign Key Check manual).
    """
    # Validar FK: category_id
    parent_category = session.get(Category, subcategory.category_id)
    if not parent_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: La categoría con ID {subcategory.category_id} no existe."
        )
    
    session.add(subcategory)
    session.commit()
    session.refresh(subcategory)
    return subcategory


# ==========================================
#              ENDPOINTS: PRODUCT
# ==========================================

@app.get("/product", response_model=List[Product], tags=["Productos"])
def list_products(session: Session = Depends(get_session)):
    """Obtiene la lista de todos los productos del catálogo."""
    return session.exec(select(Product)).all()


@app.post("/product", response_model=Product, status_code=status.HTTP_201_CREATED, tags=["Productos"])
def create_product(product: Product, session: Session = Depends(get_session)):
    """
    Inserta un nuevo producto maestro.
    Valida la existencia de las claves foráneas de Categoría y SubCategoría.
    """
    # Validar existencia de categoría
    cat = session.get(Category, product.category_id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: La categoría ID {product.category_id} no existe."
        )
        
    # Validar existencia de subcategoría
    sub = session.get(SubCategory, product.subcategory_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: La subcategoría ID {product.subcategory_id} no existe."
        )
        
    # Validar concurrencia lógica: que la subcategoría pertenezca a la categoría informada
    if sub.category_id != product.category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inconsistencia de Datos: La subcategoría '{sub.name}' no pertenece a la categoría '{cat.name}'."
        )

    # Establecer marca de tiempo de inserción
    product.date_added = datetime.utcnow()
    
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


@app.delete("/product/{product_id}", tags=["Productos"])
def delete_product(product_id: int, force: bool = False, session: Session = Depends(get_session)):
    """
    Elimina un producto maestro del catálogo.
    Si force=False y tiene stock físico activo o existen variantes, detiene el borrado.
    Si force=True o no tiene stock/variantes, se procede a la remoción segura en cascada.
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El producto con ID {product_id} no existe."
        )
        
    # Verificar si tiene variantes con stock
    has_stock = any(v.stock_actual > 0 for v in product.variants)
    if has_stock and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se permite eliminar este producto porque cuenta con stock físico registrado en bodega. Desactive las cantidades o use Borrado Forzado."
        )
        
    if product.variants and not force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El artículo posee sub-variantes físicas configuradas. Utilice el botón de confirmación definitiva (Forzado) para eliminarlas en cascada."
        )
        
    session.delete(product) # Esto cascada las variantes asociadas del producto
    session.commit()
    return {"status": "success", "message": f"Producto {product_id} removido del almacén junto con sus variantes.", "id": product_id}



# ==========================================
#           ENDPOINTS: PRODUCTVARIANT
# ==========================================

@app.get("/product-variant", response_model=List[ProductVariant], tags=["Variantes de Producto"])
def list_product_variants(session: Session = Depends(get_session)):
    """Obtiene el conjunto completo de variantes físicas (tallas/precios) en almacén."""
    return session.exec(select(ProductVariant)).all()


@app.post("/product-variant", response_model=ProductVariant, status_code=status.HTTP_201_CREATED, tags=["Variantes de Producto"])
def create_product_variant(variant: ProductVariant, session: Session = Depends(get_session)):
    """
    Registra una variante física nueva para un producto maestro.
    Valida la existencia del producto (Foreign Key check) y el rango de descuentos (0% - 100%).
    """
    # Validar producto master
    parent_product = session.get(Product, variant.product_id)
    if not parent_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: El producto padre con ID {variant.product_id} no existe."
        )
        
    # Validar rango de descuentos
    if not (0 <= variant.porcentaje_descuento <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validación de Negocio: El porcentaje de descuento debe estar estrictamente entre 0 y 100."
        )
        
    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


@app.delete("/product-variant/{variant_id}", tags=["Variantes de Producto"])
def delete_product_variant(variant_id: int, session: Session = Depends(get_session)):
    """
    Elimina una variante física específica de producto.
    """
    variant = session.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"La variante con ID {variant_id} no existe."
        )
        
    session.delete(variant)
    session.commit()
    return {"status": "success", "message": f"Variante de stock {variant_id} eliminada con éxito.", "id": variant_id}


@app.delete("/variants/{variant_id}", tags=["Variantes de Producto"])
def delete_variants_alias(variant_id: int, session: Session = Depends(get_session)):
    """Alias duplicado para compatibilidad flexible de rutas."""
    return delete_product_variant(variant_id, session)



# ==========================================
#         ENDPOINTS: QUERIES AVANZADAS
# ==========================================

@app.get("/queries/stock-critico", tags=["Reportes Automatizados"])
def get_critical_stock(session: Session = Depends(get_session)):
    """
    [Consulta Avanzada 1]
    Obtiene variantes cuyo stock_actual se encuentre en niveles críticos (menor o igual a 5 unidades).
    """
    statement = (
        select(
            ProductVariant.id.label("variant_id"),
            Product.name.label("product_name"),
            ProductVariant.size.label("size"),
            ProductVariant.stock_actual.label("stock_actual"),
            ProductVariant.precio_venta_base.label("precio_venta_base")
        )
        .join(Product, ProductVariant.product_id == Product.id)
        .where(ProductVariant.stock_actual <= 5)
        .order_by(ProductVariant.stock_actual.asc())
    )
    
    results = session.exec(statement).all()
    # Retornar estructura de lista diccionario limpia
    return [
        {
            "variant_id": r.variant_id,
            "product_name": r.product_name,
            "size": r.size,
            "stock_actual": r.stock_actual,
            "precio_venta_base": r.precio_venta_base
        }
        for r in results
    ]


@app.get("/queries/valor-categoria", tags=["Reportes Automatizados"])
def get_category_valuation(session: Session = Depends(get_session)):
    """
    [Consulta Avanzada 2]
    Calcula de forma agregada el valor contable en bodega de los artículos agrupado por categoría.
    Fórmula: SUM(stock_actual * precio_venta_base).
    """
    statement = (
        select(
            Category.id.label("category_id"),
            Category.name.label("category_name"),
            func.count(func.distinct(Product.id)).label("total_productos"),
            func.sum(ProductVariant.stock_actual).label("piezas_totales"),
            func.sum(ProductVariant.stock_actual * ProductVariant.precio_venta_base).label("valor_inventario")
        )
        .join(Product, Product.category_id == Category.id)
        .join(ProductVariant, ProductVariant.product_id == Product.id)
        .group_by(Category.id, Category.name)
    )
    
    results = session.exec(statement).all()
    return [
        {
            "category_id": r.category_id,
            "category_name": r.category_name,
            "total_productos": r.total_productos,
            "piezas_totales": r.piezas_totales or 0,
            "valor_inventario": round(r.valor_inventario or 0.0, 2)
        }
        for r in results
    ]


@app.get("/queries/rebajas-activas", tags=["Reportes Automatizados"])
def get_active_discounts(session: Session = Depends(get_session)):
    """
    [Consulta Avanzada 3]
    Retorna variantes de producto que cuentan con un descuento activo mayor a 0%.
    Calcula en caliente el precio final sugerido de oferta.
    """
    statement = (
        select(
            Product.name.label("product_name"),
            ProductVariant.size.label("size"),
            ProductVariant.precio_venta_base.label("precio_venta_base"),
            ProductVariant.porcentaje_descuento.label("porcentaje_descuento")
        )
        .join(Product, ProductVariant.product_id == Product.id)
        .where(ProductVariant.porcentaje_descuento > 0)
    )
    
    results = session.exec(statement).all()
    return [
        {
            "product_name": r.product_name,
            "size": r.size,
            "precio_venta_base": r.precio_venta_base,
            "porcentaje_descuento": r.porcentaje_descuento,
            "precio_oferta": round(r.precio_venta_base * (1.0 - (r.porcentaje_descuento / 100.0)), 2)
        }
        for r in results
    ]


# ==========================================
#         ENDPOINTS: CONFIGURACIÓN
# ==========================================

@app.post("/db/clear", tags=["Configuración"])
def clear_database(session: Session = Depends(get_session)):
    """Limpia todos los registros de la base de datos SQLite."""
    session.exec("DELETE FROM product_variant")
    session.exec("DELETE FROM product")
    session.exec("DELETE FROM subcategory")
    session.exec("DELETE FROM category")
    session.commit()
    return {"status": "success", "message": "Tablas vaciadas de forma segura."}


@app.post("/db/reset", tags=["Configuración"])
def reset_database(session: Session = Depends(get_session)):
    """Restaura la base de datos a los valores sembrados iniciales."""
    # Primero vaciar
    session.exec("DELETE FROM product_variant")
    session.exec("DELETE FROM product")
    session.exec("DELETE FROM subcategory")
    session.exec("DELETE FROM category")
    session.commit()
    
    # Insertar semillas
    # Categorías
    c1 = Category(id=1, name="Muebles")
    c2 = Category(id=2, name="Textiles de Hogar")
    c3 = Category(id=3, name="Iluminación")
    session.add_all([c1, c2, c3])
    session.commit()
    
    # Subcategorías
    s1 = SubCategory(id=1, name="Sofás y Sillones", category_id=1)
    s2 = SubCategory(id=2, name="Mesas e Isletas", category_id=1)
    s3 = SubCategory(id=3, name="Sábanas y Fundas", category_id=2)
    s4 = SubCategory(id=4, name="Edredones y Mantas", category_id=2)
    s5 = SubCategory(id=5, name="Lámparas de Mesa", category_id=3)
    s6 = SubCategory(id=6, name="Lámparas Colgantes", category_id=3)
    session.add_all([s1, s2, s3, s4, s5, s6])
    session.commit()
    
    # Productos
    p1 = Product(
        id=1,
        name="Sofá Modular 'Hygge'",
        description="Sofá escandinavo minimalista con tela repelente a líquidos y soporte ergonómico.",
        category_id=1,
        subcategory_id=1,
        image_path="/img/sofa_hygge.jpg",
        date_added=datetime.utcnow()
    )
    p2 = Product(
        id=2,
        name="Juego Sábanas Algodón Egipcio",
        description="Sábanas de lujo de 400 hilos, hipoalergénicas y con tacto satinado ultrasuave.",
        category_id=2,
        subcategory_id=3,
        image_path="/img/sabanas_lux.jpg",
        date_added=datetime.utcnow()
    )
    p3 = Product(
        id=3,
        name="Lámpara Minimalista 'Aura'",
        description="Lámpara inteligente con luz cálida regulable y base de madera de encino natural.",
        category_id=3,
        subcategory_id=5,
        image_path="/img/lampara_aura.jpg",
        date_added=datetime.utcnow()
    )
    session.add_all([p1, p2, p3])
    session.commit()
    
    # Variantes
    v1 = ProductVariant(id=1, product_id=1, size="3 Plazas (220cm)", target_audience="Estándar / Familiar", stock_actual=8, precio_compra=320.0, precio_venta_base=599.99, porcentaje_descuento=10.0)
    v2 = ProductVariant(id=2, product_id=1, size="2 Plazas (160cm)", target_audience="Juvenil / Compacto", stock_actual=3, precio_compra=240.0, precio_venta_base=449.99, porcentaje_descuento=0.0)
    v3 = ProductVariant(id=3, product_id=2, size="King Size", target_audience="Residencial / Unisex", stock_actual=25, precio_compra=40.0, precio_venta_base=95.0, porcentaje_descuento=15.0)
    v4 = ProductVariant(id=4, product_id=2, size="Queen Size", target_audience="Residencial / Unisex", stock_actual=40, precio_compra=35.0, precio_venta_base=79.99, porcentaje_descuento=5.0)
    v5 = ProductVariant(id=5, product_id=3, size="Estándar (Alto: 45cm)", target_audience="Oficina / Dormitorio", stock_actual=14, precio_compra=15.0, precio_venta_base=45.0, porcentaje_descuento=0.0)
    v6 = ProductVariant(id=6, product_id=3, size="Mini (Alto: 25cm)", target_audience="Infantil / Infantil", stock_actual=1, precio_compra=10.0, precio_venta_base=29.99, porcentaje_descuento=20.0)
    session.add_all([v1, v2, v3, v4, v5, v6])
    session.commit()
    
    return {"status": "success", "message": "Tablas y semillas reiniciadas de forma relacional segura."}


# ==========================================
#          METRICAS AUTOMATIZADAS
# ==========================================

@app.get("/analytics/dashboard", tags=["Reportes Automatizados"])
@app.get("/api/analytics/dashboard", tags=["Reportes Automatizados"])
def get_analytics_dashboard(session: Session = Depends(get_session)):
    """
    [Consulta Avanzada]
    Calcula el capital invertido, valor neto, stock crítico y ganancias proyectadas.
    """
    variants = session.exec(select(ProductVariant)).all()
    total_stock = sum(v.stock_actual for v in variants)
    capital_invested = sum(v.stock_actual * v.precio_compra for v in variants)
    warehouse_value = sum(v.stock_actual * v.precio_venta_base * (1.0 - (v.porcentaje_descuento / 100.0)) for v in variants)
    critical_stock_count = sum(1 for v in variants if v.stock_actual <= 5)
    projected_gain = warehouse_value - capital_invested
    
    return {
        "total_stock": total_stock,
        "capital_invested": round(capital_invested, 2),
        "warehouse_value": round(warehouse_value, 2),
        "critical_variants_count": critical_stock_count,
        "projected_gain": round(projected_gain, 2)
    }


# ==========================================
#         INTEGRACIÓN CHATBOT GEMINI
# ==========================================

from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None

@app.post("/chat", tags=["Inteligencia Artificial"])
@app.post("/api/chat", tags=["Inteligencia Artificial"])
def chat_endpoint(request: ChatRequest, session: Session = Depends(get_session)):
    """
    Endpoint del Chatbot de Gemini para análisis de inventario de Solo Lectura.
    """
    import os
    import urllib.request
    import json
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Fallback amigable si falta la API Key
        # Contar productos de forma real para ser precisos
        product_count = session.exec(func.count(Product.id)).one()
        return {
            "response": f"¡Hola! Soy el asistente analítico de **Solo Lectura** de tu inventario. Actualmente detecto que la clave **GEMINI_API_KEY** no está provista en tus variables de entorno, pero puedo informarte amablemente desde mi base de datos integrada en tiempo real: hoy cuentas con **{product_count} productos registrados** en el catálogo. ¡Por favor, añade tu clave API de Gemini en la configuración para desbloquear mis capacidades de análisis de lenguaje e inteligencia de mercado completos!"
        }
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    
    system_instruction = "Eres un asistente analítico de inventario de Solo Lectura de Artículos de Hogar. Tienes estrictamente prohibido intentar crear, modificar, editar precios o eliminar registros. Si el usuario te pide una acción de escritura, borrado o reset, debes rechazarla amablemente e indicarle que use los formularios o los botones físicos de la interfaz del sistema. Tu labor es únicamente leer datos, filtrar elementos, responder dudas, hacer cálculos matemáticos de ganancias o stock, y dar recomendaciones operativas de reposición en un español cálido y profesional."
    
    contents = []
    if request.history:
        for turn in request.history:
            contents.append({
                "role": "model" if turn.get("role") == "assistant" else "user",
                "parts": [{"text": turn.get("content", "")}]
            })
            
    contents.append({
        "role": "user",
        "parts": [{"text": request.message}]
    })
    
    # Inyección inteligente de contexto en tiempo real
    variants = session.exec(select(ProductVariant)).all()
    total_stock = sum(v.stock_actual for v in variants)
    capital_invested = sum(v.stock_actual * v.precio_compra for v in variants)
    warehouse_value = sum(v.stock_actual * v.precio_venta_base * (1.0 - (v.porcentaje_descuento / 100.0)) for v in variants)
    critical_stock_count = sum(1 for v in variants if v.stock_actual <= 5)
    projected_gain = warehouse_value - capital_invested
    
    categories = session.exec(select(Category)).all()
    cat_names = ", ".join([c.name for c in categories])
    
    real_time_context = (
        f"\n[ESTADO INVENTARIO EN TIEMPO REAL]\n"
        f"- Categorías registradas: {cat_names}\n"
        f"- Total de piezas en stock: {total_stock}\n"
        f"- Capital total invertido: ${capital_invested:,.2f}\n"
        f"- Valor de venta en almacén (neto con descuentos): ${warehouse_value:,.2f}\n"
        f"- Ganancia proyectada: ${projected_gain:,.2f}\n"
        f"- Artículos con stock crítico (5 unidades o menos): {critical_stock_count}\n"
    )
    
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_instruction + real_time_context}]
        }
    }
      
    try:
        req_obj = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req_obj) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
            return {"response": text_response}
    except Exception as e:
        err_str = str(e).lower()
        err_body = ""
        if hasattr(e, "read"):
            try:
                err_body = e.read().decode("utf-8").lower()
            except Exception:
                pass
        
        is_quota = (
            "429" in err_str or 
            "resource_exhausted" in err_str or 
            "quota" in err_str or 
            "limit" in err_str or
            "429" in err_body or 
            "resource_exhausted" in err_body or 
            "quota" in err_body or 
            "limit" in err_body
        )
        if is_quota:
            return {
                "response": "⚠️ **Límite de Consultas Alcanzado (Gemini Free Tier)**\n\n¡Hola! He recibido tu consulta con éxito, pero el motor de inteligencia artificial de Gemini (en su plan gratuito de AI Studio) ha alcanzado el límite de consultas por minuto de forma temporal.\n\nPor favor, **espera unos 10 a 15 segundos** y vuelve a enviar tu mensaje. Esto restablecerá la cuota para que podamos seguir analizando el inventario juntos."
            }
        return {"response": f"Lo siento, ocurrió un error al comunicarme con el modelo de IA: {str(e)}"}

