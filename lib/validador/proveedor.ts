// Dónde y con qué versión se habla con la API de Claude. Replica `lib/agentes/proveedor.ts` de ARIA:
// al integrar, este archivo se borra y se importan las de allá.

export const DIRECCION_DE_LA_API = 'https://api.anthropic.com/v1/messages';
export const VERSION_DE_LA_API = '2023-06-01';

/**
 * El respaldo del servidor ante un rechazo del modelo (`fallbacks: "default"`).
 *
 * Los modelos 5.5 tienen clasificadores de seguridad que pueden declinar una pieza —una promesa de
 * ingresos o un tema sensible son justo lo que el validador mira—. Con el respaldo, la API vuelve a correr
 * la misma petición en otro modelo dentro de la misma llamada, en vez de devolver `refusal`. Fuente:
 * Anthropic, «Refusals and fallback» (consultado el 27 de octubre de 2026). `false` lo apaga.
 */
export const CON_RESPALDO_ANTE_RECHAZO = true;
export const BETA_DEL_RESPALDO = 'server-side-fallback-2026-07-01';
