'use client';

import CommandCenter from '@/components/CommandCenter';
// MAQUETA: sin login ni `Guardia`: la sesión sale de `sesion-de-maqueta.ts`, con la misma forma que la
// que arma `app/api/auth/sesion/route.ts` en ARIA, y se entrega por el mismo proveedor.
import { ProveedorDeSesion } from './sesion-contexto.tsx';
import { SESION_DE_MAQUETA } from './sesion-de-maqueta.ts';

export default function Page() {
  return (
    <ProveedorDeSesion value={SESION_DE_MAQUETA}>
      <CommandCenter />
    </ProveedorDeSesion>
  );
}
