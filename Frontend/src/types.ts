/**
 * Interfaces y tipos para el Simulador Interactivo de Base de Datos SQLite.
 */

export interface DbCategory {
  id: number;
  name: string;
}

export interface DbSubCategory {
  id: number;
  name: string;
  category_id: number;
}

export interface DbProduct {
  id: number;
  name: string;
  description: string;
  category_id: number;
  subcategory_id: number;
  image_path: string;
  date_added: string;
}

export interface DbProductVariant {
  id: number;
  product_id: number;
  size: string;
  target_audience: string;
  stock_actual: number;
  precio_compra: number;
  precio_venta_base: number;
  porcentaje_descuento: number;
}

export interface DbSchemaField {
  name: string;
  type: string;
  constraints: string[];
  description: string;
}

export interface DbSchemaTable {
  name: string;
  pythonClass: string;
  description: string;
  fields: DbSchemaField[];
}
