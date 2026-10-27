// MAQUETA: stub de `lib/tools/scrapers.ts`. La barra lo consulta sólo si la persona ve Tools; en la
// maqueta no hay scrapings, así que nunca hay trabajos en vuelo.
export interface TrabajoEnVuelo {
  fuente: string;
}

export async function leerTrabajosEnVuelo(): Promise<TrabajoEnVuelo[]> {
  return [];
}

export function pestanaQueLoRetoma(fuente: string): 'espia' | 'scraper' {
  return fuente === 'espia' ? 'espia' : 'scraper';
}
