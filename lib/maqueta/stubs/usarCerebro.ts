// MAQUETA: stub de `lib/agentes/usarCerebro.ts`. Misma forma de lo que devuelve, en un estado que no es
// `listo`: la caja queda deshabilitada y muestra el texto de `textoDelEstado`, sin pedir nada al servidor.
import type { EstadoDelCerebro } from './pantalla.ts';

export interface Cerebro {
  panel: { estado: EstadoDelCerebro; hilos: unknown[] } | null;
  causa: string | null;
  error: string | null;
  pendiente: string | null;
  turnos: unknown[];
  preguntar: (texto: string, periodo?: string | null) => Promise<boolean>;
}

const CEREBRO_DE_MAQUETA: Cerebro = {
  panel: { estado: { tipo: 'maqueta' }, hilos: [] },
  causa: null,
  error: null,
  pendiente: null,
  turnos: [],
  preguntar: async () => false,
};

export function usarCerebro(_ruta: string | null, _hilo?: string, _alCambiar?: () => void): Cerebro {
  return CEREBRO_DE_MAQUETA;
}
