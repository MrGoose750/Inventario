import { DbCategory, DbSubCategory, DbProduct, DbProductVariant, DbSchemaTable } from "./types";

export const modelsPyCode = `"""
Módulo de Modelos de Datos para el Sistema de Inventario de Artículos de Hogar.
Define el esquema relacional utilizando SQLModel (que unifica SQLAlchemy y Pydantic).
"""

from sqlmodel import SQLModel, Field, Relationship
from typing import List, Optional
from datetime import datetime

# --- 1. TABLA CATEGORÍA ---
class Category(SQLModel, table=True):
    """
    Representa las categorías principales de la tienda de artículos de hogar (ej. 'Muebles', 'Textiles', 'Iluminación').
    """
    __tablename__ = "category"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Identificador único de la categoría")
    name: str = Field(index=True, unique=True, max_length=100, description="Nombre único de la categoría")
    
    # Relaciones bidireccionales de SQLModel/SQLAlchemy
    subcategories: List["SubCategory"] = Relationship(back_populates="category", cascade_delete=True)
    products: List["Product"] = Relationship(back_populates="category")


# --- 2. TABLA SUBCATEGORÍA ---
class SubCategory(SQLModel, table=True):
    """
    Representa las subcategorías que pertenecen a una categoría principal.
    Ejemplo: Familia 'Muebles' -> Subcategorías 'Sofás', 'Mesas de Centro'.
    """
    __tablename__ = "subcategory"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Identificador único de la subcategoría")
    name: str = Field(index=True, max_length=100, description="Nombre de la subcategoría")
    category_id: int = Field(foreign_key="category.id", description="Clave foránea apuntando a la categoría padre")
    
    # Relaciones
    category: Optional[Category] = Relationship(back_populates="subcategories")
    products: List["Product"] = Relationship(back_populates="subcategory")


# --- 3. TABLA PRODUCTO ---
class Product(SQLModel, table=True):
    """
    Es la entidad del producto lógico. Agrupa las variantes físicas.
    Ejemplo: 'Sábana Premium Algodón', que luego tendrá variantes por tamaño de cama.
    """
    __tablename__ = "product"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Identificador único del producto")
    name: str = Field(index=True, max_length=150, description="Nombre comercial del producto")
    description: Optional[str] = Field(default=None, max_length=500, description="Descripción detallada del producto")
    category_id: int = Field(foreign_key="category.id", description="Categoría principal relacionada")
    subcategory_id: int = Field(foreign_key="subcategory.id", description="Subcategoría relacionada")
    image_path: Optional[str] = Field(default=None, max_length=255, description="Ruta local o URL de la foto del producto")
    date_added: datetime = Field(default_factory=datetime.utcnow, description="Fecha de registro en el inventario")
    
    # Relaciones
    category: Optional[Category] = Relationship(back_populates="products")
    subcategory: Optional[SubCategory] = Relationship(back_populates="products")
    variants: List["ProductVariant"] = Relationship(back_populates="product", cascade_delete=True)


# --- 4. TABLA VARIANTE DE PRODUCTO ---
class ProductVariant(SQLModel, table=True):
    """
    Maneja las dimensiones físicas específicas, el público y los valores económicos de forma independiente.
    Ejemplo: Un mismo sofá puede venir en talla '3 Plazas' o '2 Plazas' con diferentes costos y stock.
    """
    __tablename__ = "product_variant"
    
    id: Optional[int] = Field(default=None, primary_key=True, description="Identificador único de la variante")
    product_id: int = Field(foreign_key="product.id", description="Relación con el producto padre")
    size: Optional[str] = Field(default=None, max_length=50, description="Talla o medidas (ej. 'Matrimonial', 'King')")
    target_audience: Optional[str] = Field(default=None, max_length=50, description="Público objetivo o estilo (ej. 'Infantil', 'Unisex')")
    stock_actual: int = Field(default=0, description="Cantidad física en bodega de esta variante")
    precio_compra: float = Field(default=0.0, description="Precio de adquisición pagado al proveedor")
    precio_venta_base: float = Field(default=0.0, description="Precio de venta sugerido al público sin descuentos")
    porcentaje_descuento: float = Field(default=0.0, description="Porcentaje de descuento aplicable (0% a 100%)")
    
    # Relaciones
    product: Optional[Product] = Relationship(back_populates="variants")`;

export const databasePyCode = `"""
Módulo de Configuración de Base de Datos para el Sistema de Inventario.
Establece la conexión SQLite y define el ciclo de vida de las sesiones y la inicialización.
"""

from sqlmodel import SQLModel, create_engine, Session
from typing import Generator

# 1. Configuración de la base de datos local SQLite
sqlite_file_name = "inventario_hogar.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

# 2. Configuración del motor de Base de Datos (Engine)
# 'connect_args={"check_same_thread": False}' es una directiva específica de SQLite.
# Permite que múltiples hilos de servidor FastAPI asíncronos interactúen de forma segura con la base de datos.
# 'echo=True' habilita el registro de todo el SQL generado en la consola, ideal para depuración en desarrollo.
engine = create_engine(
    sqlite_url, 
    connect_args={"check_same_thread": False}, 
    echo=True
)

# 3. Inicialización física de la base de datos
def init_db() -> None:
    """
    Crea el archivo .db y todas las estructuras de tablas definidas en models.py si no existen.
    
    Esta función debe ser invocada durante el evento de inicio (startup) de la aplicación FastAPI.
    """
    from models import Category, SubCategory, Product, ProductVariant
    
    # Crea físicamente las tablas en la base de datos SQLite si aún no existen
    SQLModel.metadata.create_all(engine)
    print(f"[*] Base de datos '{sqlite_file_name}' inicializada con éxito y tablas validadas.")

# 4. Proveedor de sesión (Generador / Dependency Injector)
def get_session() -> Generator[Session, None, None]:
    """
    Genera y administra el ciclo de vida de una sesión de base de datos.
    
    Ideal para usar en FastAPI como una dependencia integrada mediante 'Depends(get_session)'.
    Asegura que cada solicitud reciba una conexión dedicada y que esta se cierre
    correctamente al procesar la respuesta, incluso si ocurren errores inesperados.
    """
    with Session(engine) as session:
        yield session`;

export const initialCategories: DbCategory[] = [
  { id: 1, name: "Muebles" },
  { id: 2, name: "Textiles de Hogar" },
  { id: 3, name: "Iluminación" }
];

export const initialSubCategories: DbSubCategory[] = [
  { id: 1, name: "Sofás y Sillones", category_id: 1 },
  { id: 2, name: "Mesas e Isletas", category_id: 1 },
  { id: 3, name: "Sábanas y Fundas", category_id: 2 },
  { id: 4, name: "Edredones y Mantas", category_id: 2 },
  { id: 5, name: "Lámparas de Mesa", category_id: 3 },
  { id: 6, name: "Lámparas Colgantes", category_id: 3 }
];

export const initialProducts: DbProduct[] = [
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
];

export const initialVariants: DbProductVariant[] = [
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
];

export const schemaTables: DbSchemaTable[] = [
  {
    name: "category",
    pythonClass: "Category",
    description: "Tabla principal que agrupa las líneas de productos del hogar.",
    fields: [
      { name: "id", type: "Optional[int]", constraints: ["Primary Key", "Autoincrement"], description: "Identificador único y auto incremental de categoría." },
      { name: "name", type: "str", constraints: ["Unique", "Indexed", "max_length=100"], description: "Nombre representador de la categoría." }
    ]
  },
  {
    name: "subcategory",
    pythonClass: "SubCategory",
    description: "Subdivisiones para clasificación fina en el catálogo.",
    fields: [
      { name: "id", type: "Optional[int]", constraints: ["Primary Key", "Autoincrement"], description: "Identificador de la subcategoría." },
      { name: "name", type: "str", constraints: ["Indexed", "max_length=100"], description: "Nombre descriptivo de la subcategoría." },
      { name: "category_id", type: "int", constraints: ["Foreign Key -> category.id"], description: "Relación foránea obligatoria con la categoría padre." }
    ]
  },
  {
    name: "product",
    pythonClass: "Product",
    description: "Tabla maestra que consolida los datos lógicos principales de un artículo.",
    fields: [
      { name: "id", type: "Optional[int]", constraints: ["Primary Key", "Autoincrement"], description: "Identificador del producto." },
      { name: "name", type: "str", constraints: ["Indexed", "max_length=150"], description: "Nombre comercial principal del producto." },
      { name: "description", type: "Optional[str]", constraints: ["Nullable", "max_length=500"], description: "Descripción detallada del material o uso." },
      { name: "category_id", type: "int", constraints: ["Foreign Key -> category.id"], description: "Clave foránea para indexar la categoría." },
      { name: "subcategory_id", type: "int", constraints: ["Foreign Key -> subcategory.id"], description: "Clave foránea para indexar la subcategoría." },
      { name: "image_path", type: "Optional[str]", constraints: ["Nullable", "max_length=255"], description: "Ruta física local o dirección web para previsualización." },
      { name: "date_added", type: "datetime", constraints: ["Default = datetime.utcnow"], description: "Estampa de tiempo del alta original en sistema." }
    ]
  },
  {
    name: "product_variant",
    pythonClass: "ProductVariant",
    description: "Estructura física independiente para manejar tallas, públicos, stocks y listas de precios independientes.",
    fields: [
      { name: "id", type: "Optional[int]", constraints: ["Primary Key", "Autoincrement"], description: "Identificador de la variante física." },
      { name: "product_id", type: "int", constraints: ["Foreign Key -> product.id"], description: "Clave foránea vinculando esta variante física con el producto maestro." },
      { name: "size", type: "Optional[str]", constraints: ["Nullable", "max_length=50"], description: "Talla física o escala dimensional (ej. Matrimonial, King, Grande)." },
      { name: "target_audience", type: "Optional[str]", constraints: ["Nullable", "max_length=50"], description: "Clasificación de público o estilo (ej. Juvenil, Infantil, Unisex)." },
      { name: "stock_actual", type: "int", constraints: ["Default = 0"], description: "Número de existencias físicas disponibles en almacén." },
      { name: "precio_compra", type: "float", constraints: ["Default = 0.0"], description: "Precio de costo bruto cobrado por el distribuidor." },
      { name: "precio_venta_base", type: "float", constraints: ["Default = 0.0"], description: "Precio de lista regular para el usuario final." },
      { name: "porcentaje_descuento", type: "float", constraints: ["Default = 0.0", "Range = [0, 100]"], description: "Porcentaje promocional aplicable al precio regular." }
    ]
  }
];

export const mainPyCode = `"""
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. CICLO DE VIDA DE LA APLICACIÓN (STARTUP EVENT) ---
@app.on_event("startup")
def on_startup():
    init_db()


# ==========================================
#              ENDPOINTS: CATEGORY
# ==========================================

@app.get("/category", response_model=List[Category], tags=["Categorías"])
def list_categories(session: Session = Depends(get_session)):
    return session.exec(select(Category)).all()


@app.post("/category", response_model=Category, status_code=status.HTTP_201_CREATED, tags=["Categorías"])
def create_category(category: Category, session: Session = Depends(get_session)):
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


# ==========================================
#            ENDPOINTS: SUBCATEGORY
# ==========================================

@app.get("/subcategory", response_model=List[SubCategory], tags=["Subcategorías"])
def list_subcategories(session: Session = Depends(get_session)):
    return session.exec(select(SubCategory)).all()


@app.post("/subcategory", response_model=SubCategory, status_code=status.HTTP_201_CREATED, tags=["Subcategorías"])
def create_subcategory(subcategory: SubCategory, session: Session = Depends(get_session)):
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
    return session.exec(select(Product)).all()


@app.post("/product", response_model=Product, status_code=status.HTTP_201_CREATED, tags=["Productos"])
def create_product(product: Product, session: Session = Depends(get_session)):
    cat = session.get(Category, product.category_id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: La categoría ID {product.category_id} no existe."
        )
    sub = session.get(SubCategory, product.subcategory_id)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: La subcategoría ID {product.subcategory_id} no existe."
        )
    if sub.category_id != product.category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Inconsistencia de Datos: La subcategoría '{sub.name}' no pertenece a la categoría '{cat.name}'."
        )
    product.date_added = datetime.utcnow()
    session.add(product)
    session.commit()
    session.refresh(product)
    return product


# ==========================================
#           ENDPOINTS: PRODUCTVARIANT
# ==========================================

@app.get("/product-variant", response_model=List[ProductVariant], tags=["Variantes de Producto"])
def list_product_variants(session: Session = Depends(get_session)):
    return session.exec(select(ProductVariant)).all()


@app.post("/product-variant", response_model=ProductVariant, status_code=status.HTTP_201_CREATED, tags=["Variantes de Producto"])
def create_product_variant(variant: ProductVariant, session: Session = Depends(get_session)):
    parent_product = session.get(Product, variant.product_id)
    if not parent_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error de Integridad: El producto padre con ID {variant.product_id} no existe."
        )
    if not (0 <= variant.porcentaje_descuento <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validación de Negocio: El porcentaje de descuento debe estar estrictamente entre 0 y 100."
        )
    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


# ==========================================
#         ENDPOINTS: QUERIES AVANZADAS
# ==========================================

@app.get("/queries/stock-critico", tags=["Reportes Automatizados"])
def get_critical_stock(session: Session = Depends(get_session)):
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
`;

