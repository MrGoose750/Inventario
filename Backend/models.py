"""
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
    # Permite acceder de forma directa con `category.subcategories` y `category.products`
    subcategories: List["SubCategory"] = Relationship(
        back_populates="category", 
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    products: List["Product"] = Relationship(back_populates="category")


# --- 2. TABLA SUBCATEGORÍA ---
class SubCategory(SQLModel, table=True):
    """
    Representa las subcategorías que pertenecen a una categoría principal.
    Ejemplo: Familia 'Muebles' -> Subcategorías 'Sofás', 'Mesas de Centro', 'Libreros'.
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
    size: Optional[str] = Field(default=None, max_length=50, description="Talla, dimensión o medidas (ej. 'Matrimonial', '180x200', 'Grande')")
    target_audience: Optional[str] = Field(default=None, max_length=50, description="Público objetivo o estilo (ej. 'Infantil', 'Juvenil', 'Unisex')")
    stock_actual: int = Field(default=0, description="Cantidad física en bodega de esta variante")
    precio_compra: float = Field(default=0.0, description="Precio de adquisición pagado al proveedor")
    precio_venta_base: float = Field(default=0.0, description="Precio de venta sugerido al público sin descuentos")
    porcentaje_descuento: float = Field(default=0.0, description="Porcentaje de descuento aplicable directa a la variante (0% a 100%)")
    
    # Campo calculado de conveniencia (No guardado en DB pero útil en Pydantic si se añade propiedad @property)
    # Relaciones
    product: Optional[Product] = Relationship(back_populates="variants")
