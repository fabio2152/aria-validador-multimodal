// El enlace de Google Drive de UNA imagen (Fase 6, opcional para la demo).
//
// Se extrae el identificador del archivo, se descarga por la URL pública de descarga y la pieza sigue el
// flujo normal. Si el archivo no es público, Drive responde con su página de acceso (HTML) en vez del
// archivo: eso, y cualquier cosa que no sea una imagen, termina en un error claro.

const ESPERA_MS = 30_000;
const PESO_MAXIMO = 30 * 1024 * 1024;

/** El identificador de un enlace de Drive, o `null` si el enlace no es de un archivo de Drive. */
export function identificadorDeDrive(enlace: string): string | null {
  let url: URL;
  try {
    url = new URL(enlace.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(url.hostname)) return null;
  const enRuta = url.pathname.match(/\/(?:file\/)?d\/([\w-]{10,})/);
  const id = enRuta?.[1] ?? url.searchParams.get('id');
  return id && /^[\w-]{10,}$/.test(id) ? id : null;
}

export type ArchivoDeDrive =
  | { tipo: 'archivo'; nombre: string; tipoMime: string; bytes: Uint8Array }
  | { tipo: 'error'; detalle: string };

function nombreDe(cabecera: string | null, id: string): string {
  const m = cabecera?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const crudo = m?.[1] ?? m?.[2];
  if (!crudo) return `drive-${id}`;
  try {
    return decodeURIComponent(crudo);
  } catch {
    return crudo;
  }
}

export async function descargarDeDrive(enlace: string): Promise<ArchivoDeDrive> {
  const id = identificadorDeDrive(enlace);
  if (!id) return { tipo: 'error', detalle: 'El enlace no es de un archivo de Google Drive (drive.google.com/file/d/…).' };

  let r: Response;
  try {
    r = await fetch(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    return { tipo: 'error', detalle: 'No se pudo conectar con Google Drive.' };
  }
  const tipoMime = (r.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (r.status === 404) return { tipo: 'error', detalle: 'El archivo de Drive no existe o fue borrado.' };
  if (!r.ok || tipoMime === 'text/html') {
    return { tipo: 'error', detalle: 'El archivo de Drive no es público: compártelo como «Cualquier persona con el enlace» y vuelve a intentar.' };
  }
  if (!tipoMime.startsWith('image/')) return { tipo: 'error', detalle: `El archivo de Drive no es una imagen (es ${tipoMime || 'de tipo desconocido'}).` };
  const largo = Number(r.headers.get('content-length') ?? 0);
  if (largo > PESO_MAXIMO) return { tipo: 'error', detalle: 'La imagen de Drive supera los 30 MB.' };
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.byteLength > PESO_MAXIMO) return { tipo: 'error', detalle: 'La imagen de Drive supera los 30 MB.' };
  return { tipo: 'archivo', nombre: nombreDe(r.headers.get('content-disposition'), id), tipoMime, bytes };
}
