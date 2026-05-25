"""
Módulo de Configuración de Base de Datos para el Sistema de Inventario.
Establece la conexión SQLite y define el ciclo de vida de las sesiones y la inicialización.
"""

import os
from sqlmodel import SQLModel, create_engine, Session
from typing import Generator

# 1. Configuración de base de datos dinámica (Soporta SQLite y PostgreSQL para Railway)
database_url = os.getenv("DATABASE_URL")

# Reparación dinámica del prefijo de conexión JDBC para PostgreSQL (Railway requiere postgresql://)
if database_url:
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    # Parámetros optimizados para motores robustos como PostgreSQL en la nube
    # pool_size y max_overflow previenen timeouts en múltiples pantallas/dispositivos Android concurrentes
    print("[*] Conexión detectada: Configurando PostgreSQL en la nube...")
    engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
else:
    # Fallback transparente a SQLite local para desarrollo o depuración
    sqlite_file_name = "inventario_hogar.db"
    sqlite_url = f"sqlite:///{sqlite_file_name}"
    print(f"[*] Base de datos local activa: SQLite ({sqlite_file_name})")
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
    # Importamos los modelos dentro de la función para evitar problemas de importación circular
    # y para asegurar que la metadata de SQLModel registre las tablas correctamente.
    from models import Category, SubCategory, Product, ProductVariant
    
    # Crea físicamente las tablas en la base de datos si aún no existen
    SQLModel.metadata.create_all(engine)
    db_name = os.getenv("DATABASE_URL") or "SQLite (inventario_hogar.db)"
    print(f"[*] Base de datos '{db_name}' inicializada con éxito y tablas validadas.")

# 4. Proveedor de sesión (Generador / Dependency Injector)
def get_session() -> Generator[Session, None, None]:
    """
    Genera y administra el ciclo de vida de una sesión de base de datos.
    
    Ideal para usar en FastAPI como una dependencia integrada mediante 'Depends(get_session)'.
    Asegura que cada solicitud reciba una conexión dedicada y que esta se cierre
    correctamente al procesar la respuesta, incluso si ocurren errores inesperados.
    """
    with Session(engine) as session:
        yield session
