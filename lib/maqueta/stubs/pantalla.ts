// MAQUETA: stub de `lib/agentes/pantalla.ts`. La caja «Pregúntale al cerebro» se DIBUJA —es parte de la
// carcasa— pero deshabilitada y diciendo por qué: el cerebro es de ARIA.
export interface EstadoDelCerebro {
  tipo: string;
}

export function rutaDeLaCaja(seccion: string | null): string | null {
  return seccion === null ? null : `/api/${seccion}/cerebro`;
}

export function textoDelEstado(_estado: EstadoDelCerebro, _zona: string, _ajustes: string): string | null {
  return 'El cerebro pertenece a la plataforma ARIA y no forma parte de esta maqueta.';
}

export function puedeIrAAjustes(_estado: EstadoDelCerebro): boolean {
  return false;
}
