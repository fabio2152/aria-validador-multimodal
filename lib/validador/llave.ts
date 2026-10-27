// La llave de Claude del validador. ÚNICO lugar que la lee.
//
// MAQUETA: en ARIA la llave es POR ORGANIZACIÓN, vive cifrada en
// `identidad.organizaciones_credenciales.ia_clave_cifrada` y la resuelve `lib/credenciales/`. Una llave
// general en el entorno factura el consumo de todas las organizaciones a una sola, y ARIA la quitó por
// eso. Acá sale de `.env.local` porque la maqueta no tiene ese almacén; al integrar, esta función se
// reemplaza por la lectura de la llave de la organización y nada más cambia.

/** La llave, o `null` si no está configurada. Nunca se registra ni viaja al navegador. */
export function llaveDeClaude(_organizacionId: string): string | null {
  const llave = process.env.ANTHROPIC_API_KEY?.trim();
  return llave ? llave : null;
}
