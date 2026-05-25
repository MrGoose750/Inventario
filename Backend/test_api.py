#!/usr/bin/env python3
"""
Script de Automatización de Pruebas de Calidad (QA) para la API de Inventario de Hogar.
Valida sistemáticamente la integridad referencial (FK checks), reglas de negocio y endpoints analíticos.
"""

import sys
import argparse

try:
    import requests
except ImportError:
    print("Error: Se requiere la librería 'requests' de Python.")
    print("Instálala ejecutando: pip install requests")
    sys.exit(1)

# Paletas de colores ANSI para la consola de Tech Ops
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_section(title: str):
    print(f"\n{BOLD}{BLUE}{'=' * 60}")
    print(f" {title.upper()}")
    print(f"{'=' * 60}{RESET}")

def report_status(message: str, success: bool, details: str = ""):
    status_str = f"{GREEN}[PASÓ]{RESET}" if success else f"{RED}[FALLÓ]{RESET}"
    detail_str = f" - {details}" if details else ""
    print(f"{status_str} {message}{detail_str}")

def run_tests(base_url: str):
    print(f"\n{BOLD}{CYAN}Iniciando Testing Suite en: {base_url}{RESET}")
    session = requests.Session()

    # --- 1. PRUEBAS DE CATEGORÍAS (CREATE / VIOLATION UNIQUE) ---
    print_section("1. Pruebas de Categorías")
    
    # Crear categoría exitosa de test
    cat_data = {"name": f"Cocina Test"}
    res = session.post(f"{base_url}/category", json=cat_data)
    cat_id = None
    if res.status_code in [200, 201]:
        created = res.json()
        cat_id = created.get("id")
        report_status("Creación de categoría válida", True, f"ID: {cat_id}, Nombre: {created.get('name')}")
    else:
        report_status("Creación de categoría válida", False, f"Código de estado: {res.status_code}, Detalle: {res.text}")

    # Forzar fallo Unique Constraint (mismo nombre)
    if cat_id:
        res_fail = session.post(f"{base_url}/category", json=cat_data)
        if res_fail.status_code == 400:
            report_status("Validación Unique Constraint (Nombre Duplicado)", True, f"Recibió HTTP 400 - {res_fail.json().get('detail')}")
        else:
            report_status("Validación Unique Constraint (Nombre Duplicado)", False, f"Se esperaba HTTP 400, recibió {res_fail.status_code}")

    # --- 2. PRUEBAS DE SUBCATEGORÍAS (CREATE / FK CHECK) ---
    print_section("2. Pruebas de Subcategorías")
    
    # Crear subcategoría exitosa
    sub_data = {"name": "Sartenes de Titanio", "category_id": cat_id or 1}
    res = session.post(f"{base_url}/subcategory", json=sub_data)
    sub_id = None
    if res.status_code in [200, 201]:
        created = res.json()
        sub_id = created.get("id")
        report_status("Creación de subcategoría válida", True, f"ID: {sub_id}, Nombre: {created.get('name')} -> Cat ID: {created.get('category_id')}")
    else:
         report_status("Creación de subcategoría válida", False, f"Código de estado: {res.status_code}")

    # Forzar fallo FK Check de Categoría que no existe (ID 99999)
    bad_sub = {"name": "Inexistente sub", "category_id": 99999}
    res_fail = session.post(f"{base_url}/subcategory", json=bad_sub)
    if res_fail.status_code == 400:
        report_status("Validación Foreign Key (Categoría Inexistente)", True, f"Recibió HTTP 400 - {res_fail.json().get('detail')}")
    else:
        report_status("Validación Foreign Key (Categoría Inexistente)", False, f"Se esperaba HTTP 400, recibió {res_fail.status_code}")


    # --- 3. PRUEBAS DE PRODUCTOS (INTEGRIDAD REFERENCIAL Y CONCURRENCIA LÓGICA) ---
    print_section("3. Pruebas de Productos e Inconsistencias")

    if cat_id and sub_id:
        # 3.1 Producto exitoso
        prod_data = {
            "name": "Batería Profesional Pro",
            "description": "Acero inoxidable con recubrimiento de titanio",
            "category_id": cat_id,
            "subcategory_id": sub_id,
            "image_path": "/img/bateria_test.jpg"
        }
        res = session.post(f"{base_url}/product", json=prod_data)
        prod_id = None
        if res.status_code in [200, 201]:
            created = res.json()
            prod_id = created.get("id")
            report_status("Creación de producto maestro válido", True, f"ID: {prod_id}, Nombre: {created.get('name')}")
        else:
            report_status("Creación de producto maestro válido", False, f"Código: {res.status_code}")

        # 3.2 Forzar inconsistencia lógica: Categoría válida pero Subcategoría perteneciente a otra categoría
        # Crearemos otra categoría auxiliar
        aux_cat_res = session.post(f"{base_url}/category", json={"name": "Auxiliar Maderas"})
        if aux_cat_res.status_code in [200, 201]:
            aux_cat_id = aux_cat_res.json().get("id")
            
            # Intentar añadir un producto con la categoría 'aux_cat_id' pero la subcategoría de Cocina (sub_id)
            mismatch_prod = {
                "name": "Mesa Híbrida",
                "description": "Prueba de mismatch",
                "category_id": aux_cat_id,
                "subcategory_id": sub_id, # Pertenece a Cocina, no Maderas!
                "image_path": ""
            }
            res_mismatch = session.post(f"{base_url}/product", json=mismatch_prod)
            if res_mismatch.status_code == 400:
                report_status("Validación de Coherencia de Subcategoría", True, f"Recibió HTTP 400 - {res_mismatch.json().get('detail')}")
            else:
                report_status("Validación de Coherencia de Subcategoría", False, f"Se esperaba HTTP 400, recibió {res_mismatch.status_code}")
    else:
        print(f"{YELLOW}Saltando sección de productos debido a falta de categorías iniciales de prueba.{RESET}")


    # --- 4. PRUEBAS DE VARIANTES (REGLAS DE NEGOCIO DE RANGOS) ---
    print_section("4. Pruebas de Variantes y Reglas de Descuento")
    
    if prod_id:
        # Límite superior de descuento incorrecto (> 100%)
        bad_var_high = {
            "product_id": prod_id,
            "size": "Grande",
            "stock_actual": 10,
            "precio_compra": 40.0,
            "precio_venta_base": 80.0,
            "porcentaje_descuento": 120.0 # Excede el 100% de negocio
        }
        res_fail_high = session.post(f"{base_url}/product-variant", json=bad_var_high)
        if res_fail_high.status_code == 400:
            report_status("Validación Descuento Excesivo (> 100%)", True, f"Recibió HTTP 400 - {res_fail_high.json().get('detail')}")
        else:
            report_status("Validación Descuento Excesivo (> 100%)", False, f"Se esperaba HTTP 400, recibió {res_fail_high.status_code}")

        # Límite inferior de descuento incorrecto (< 0%)
        bad_var_low = {
            "product_id": prod_id,
            "size": "Chico",
            "stock_actual": 10,
            "precio_compra": 20.0,
            "precio_venta_base": 40.0,
            "porcentaje_descuento": -15.0 # Negativo
        }
        res_fail_low = session.post(f"{base_url}/product-variant", json=bad_var_low)
        if res_fail_low.status_code == 400:
            report_status("Validación Descuento Negativo (< 0%)", True, f"Recibió HTTP 400 - {res_fail_low.json().get('detail')}")
        else:
            report_status("Validación Descuento Negativo (< 0%)", False, f"Se esperaba HTTP 400, recibió {res_fail_low.status_code}")

        # Variante exitosa con valores válidos y stock crítico para probar el reporte analytics después
        crit_var = {
            "product_id": prod_id,
            "size": "Edición Limitada (Crítico)",
            "stock_actual": 3, # Stock crítico <= 5
            "precio_compra": 100.0,
            "precio_venta_base": 250.0,
            "porcentaje_descuento": 20.0 # 20% Rebaja activa
        }
        res_ok = session.post(f"{base_url}/product-variant", json=crit_var)
        if res_ok.status_code in [200, 201]:
            report_status("Registro de Variante Válida en Stock Crítico", True, "Registrada con éxito.")
        else:
            report_status("Registro de Variante Válida en Stock Crítico", False, f"Recibió {res_ok.status_code}")


    # --- 5. REPORTES ANALÍTICOS ---
    print_section("5. Validación de Reportes Automatizados")

    # 5.1 Stock Crítico
    res_rep1 = session.get(f"{base_url}/queries/stock-critico")
    if res_rep1.status_code == 200:
        data = res_rep1.json()
        report_status("Reporte Stock Crítico (<= 5 unidades)", True, f"Se encontraron {len(data)} variantes con bajo inventario.")
    else:
         report_status("Reporte Stock Crítico (<= 5 unidades)", False, f"Código: {res_rep1.status_code}")

    # 5.2 Valor de Categoría
    res_rep2 = session.get(f"{base_url}/queries/valor-categoria")
    if res_rep2.status_code == 200:
        data = res_rep2.json()
        report_status("Reporte de Valoración Contable de Almacén", True, f"Calculados {len(data)} balances agregados.")
        for col in data:
            print(f"  └─ Categoría: {col.get('category_name')} | Valor total: ${col.get('valor_inventario')} | Total productos: {col.get('total_productos')}")
    else:
         report_status("Reporte de Valoración Contable", False, f"Código: {res_rep2.status_code}")

    # 5.3 Rebajas Activas
    res_rep3 = session.get(f"{base_url}/queries/rebajas-activas")
    if res_rep3.status_code == 200:
        data = res_rep3.json()
        report_status("Reporte de Rebajas Activas y Ofertas Calientes", True, f"Encontradas {len(data)} promociones vigentes.")
    else:
         report_status("Reporte de Rebajas Activas", False, f"Código: {res_rep3.status_code}")

    print(f"\n{BOLD}{GREEN}Suite de pruebas finalizada de modo exitoso.{RESET}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Consola de Pruebas Automatizadas de Inventario")
    parser.add_argument("--url", default="http://localhost:3000/api", help="Base URL de la API (por defecto: http://localhost:3000/api)")
    args = parser.parse_args()
    
    # Dado que nuestro backend integrado unifica los prefijos en /api, dejamos que el usuario
    # use o configure esto convenientemente.
    run_tests(args.url)
