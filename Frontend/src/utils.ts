/**
 * Utilidades de formato y resaltado de sintaxis ligero para Python.
 */

export function highlightPython(code: string): string {
  // Escapa entidades HTML básicas primero
  let escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Almacenamiento temporal para comentarios y strings
  const placeholders: { [key: string]: string } = {};
  let placeholderCounter = 0;

  // 1. Extraer comentarios multilínea (comillas triples)
  escaped = escaped.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, (match) => {
    const key = `___TRIPLE_QUOTE_PLACEHOLDER_${placeholderCounter}___`;
    placeholderCounter++;
    placeholders[key] = `<span class="text-emerald-400 font-light italic">${match}</span>`;
    return key;
  });

  // 2. Extraer comentarios de una sola línea #
  escaped = escaped.replace(/(#[^\n]*)/g, (match) => {
    const key = `___COMMENT_PLACEHOLDER_${placeholderCounter}___`;
    placeholderCounter++;
    placeholders[key] = `<span class="text-slate-500 italic">${match}</span>`;
    return key;
  });

  // 3. Extraer strings con comilla doble y simple
  escaped = escaped.replace(/("[^"\r\n]*"|'[^'\r\n]*')/g, (match) => {
    const key = `___STRING_PLACEHOLDER_${placeholderCounter}___`;
    placeholderCounter++;
    placeholders[key] = `<span class="text-amber-300">${match}</span>`;
    return key;
  });

  // Palabras clave de Python
  const keywords = [
    "def", "class", "from", "import", "return", "yield", "with", "as", 
    "if", "else", "elif", "try", "except", "finally", "None", "True", "False", "print"
  ];
  
  // Tipos / Clases SQLModel importantes
  const typesAndDecorators = [
    "SQLModel", "Field", "Relationship", "List", "Optional", "datetime", 
    "str", "int", "float", "Session", "create_engine", "Generator"
  ];

  // Resaltar palabras clave (seguro porque no hay comillas ni tags HTML insertados aún)
  keywords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    escaped = escaped.replace(regex, `<span class="text-sky-400 font-semibold">${word}</span>`);
  });

  // Resaltar tipos y clases importantes
  typesAndDecorators.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, "g");
    escaped = escaped.replace(regex, `<span class="text-indigo-300 font-medium">${type}</span>`);
  });

  // Resaltar anotaciones / propiedades (ej: @property, @app.on_event)
  escaped = escaped.replace(/(@\w+)/g, '<span class="text-pink-400">$1</span>');

  // 4. Restaurar placeholders de vuelta (comentarios e hilos sanos originales)
  let replaced = true;
  while (replaced) {
    replaced = false;
    for (const key in placeholders) {
      if (escaped.includes(key)) {
        escaped = escaped.replace(key, placeholders[key]);
        replaced = true;
      }
    }
  }

  return escaped;
}

// Formateador de moneda simple
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(value);
}
