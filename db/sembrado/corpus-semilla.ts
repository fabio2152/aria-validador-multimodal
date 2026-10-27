// El corpus semilla (versión 1) del validador, de la sección 10 de las instrucciones.
//
// Derivado de las entrevistas al área (Anexo B del informe) y de las categorías de las políticas
// publicitarias de Meta. ES UNA SEMILLA, no el corpus final: el proyecto contempla al menos 40 reglas
// validadas con el jefe del área.
//
// Las fuentes de Meta y los límites numéricos se verificaron el 27 de octubre de 2026 contra:
//   · Guía de anuncios de Meta, imagen en el feed: https://www.facebook.com/business/ads-guide/update/image
//     (JPG o PNG, hasta 30 MB, 4:5 con 3 % de tolerancia, texto principal de 50 a 150 caracteres).
//   · Normas publicitarias de Meta: https://transparency.meta.com/policies/ad-standards/
// El mínimo de 1080 px del lado corto es un criterio de calidad del área, más exigente que el mínimo
// de Meta (600 px de ancho), y se rotula así.

import type { Eje, Severidad, TipoDeVerificacion } from '../../lib/validador/esquema.ts';

export interface ReglaSemilla {
  codigo: string;
  eje: Eje;
  categoria: string;
  descripcion: string;
  criterio_verificable: string;
  ejemplo_cumple: string | null;
  ejemplo_incumple: string | null;
  severidad: Severidad;
  tipo_de_verificacion: TipoDeVerificacion;
  fuente: string;
}

const ENTREVISTAS = 'Entrevistas al área de marketing (Anexo B del informe)';
const NORMAS_DE_META = 'Normas publicitarias de Meta · https://transparency.meta.com/policies/ad-standards/';
const GUIA_DE_META = 'Guía de anuncios de Meta · https://www.facebook.com/business/ads-guide/update/image';

export const CORPUS_SEMILLA: readonly ReglaSemilla[] = [
  {
    codigo: 'MARCA-TONO-01',
    eje: 'marca',
    categoria: 'Tono',
    descripcion: 'El mensaje transmite autoridad: demuestra conocimiento de los problemas del cliente y posiciona a ARIA como el referente que el cliente busca.',
    criterio_verificable: 'La pieza nombra un problema concreto del cliente o muestra dominio del tema. Incumple si es genérica, insegura o se limita a pedir atención sin aportar criterio.',
    ejemplo_cumple: 'El 80 % de las agencias pierde clientes por no tener un proceso de cierre. Así lo resolvimos en 40 casos.',
    ejemplo_incumple: 'Somos una agencia más, ¡dale una oportunidad a nuestro servicio!',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-TONO-02',
    eje: 'marca',
    categoria: 'Tono',
    descripcion: 'No transmitir que la marca persigue o necesita clientes: urgencia artificial, súplica o escasez forzada.',
    criterio_verificable: 'Incumple si hay llamados urgentes («¡Escríbenos ya!»), súplica o escasez no sustentada («quedan pocos cupos»).',
    ejemplo_cumple: 'Si tu caso encaja, agenda una evaluación.',
    ejemplo_incumple: '¡Escríbenos ya, quedan pocos cupos!',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-TONO-03',
    eje: 'marca',
    categoria: 'Tono',
    descripcion: 'No usar los miedos del cliente como gancho principal; es un enfoque descartado por la marca.',
    criterio_verificable: 'Incumple si el gancho principal es una amenaza o un miedo («vas a quebrar», «te vas a quedar atrás»).',
    ejemplo_cumple: 'Cómo ordenamos el proceso comercial de una agencia de 12 personas.',
    ejemplo_incumple: 'Si no haces esto, tu negocio va a desaparecer este año.',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-POS-01',
    eje: 'marca',
    categoria: 'Posicionamiento',
    descripcion: 'Coherencia con el posicionamiento de alto valor: no usar descuentos ni precio bajo como argumento. Derivada de G7; validar con el jefe del área.',
    criterio_verificable: 'Incumple si el argumento es el precio, un descuento, una oferta o «barato».',
    ejemplo_cumple: 'Un programa para equipos que ya facturan y quieren escalar.',
    ejemplo_incumple: '50 % de descuento solo esta semana.',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: `${ENTREVISTAS} · derivada de G7`,
  },
  {
    codigo: 'MARCA-TEND-01',
    eje: 'marca',
    categoria: 'Tendencias',
    descripcion: 'No replicar tendencias, formatos ni estilos virales del momento.',
    criterio_verificable: 'Incumple si la pieza usa memes, frases o formatos virales reconocibles, o una estética de trend.',
    ejemplo_cumple: 'Una pieza sobria con un dato y una conclusión.',
    ejemplo_incumple: '«POV: tu cliente cuando ve tu propuesta 💀».',
    severidad: 'baja',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-FORM-01',
    eje: 'marca',
    categoria: 'Estilo',
    descripcion: 'Estilo formal y profesional en el texto y en la composición.',
    criterio_verificable: 'Incumple si hay jerga, groserías, exceso de emojis o mayúsculas, o una composición desordenada.',
    ejemplo_cumple: 'Te mostramos el proceso paso a paso.',
    ejemplo_incumple: 'BRO ESTO ES UNA LOCURA 🔥🔥🔥',
    severidad: 'baja',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-COPY-01',
    eje: 'marca',
    categoria: 'Copy',
    descripcion: 'El copy es coherente con el mensaje de la pieza (imagen o guion).',
    criterio_verificable: 'Incumple si el copy promete o habla de algo que la imagen o el guion no muestran, o los contradice. Solo aplica cuando hay copy y además imagen o guion.',
    ejemplo_cumple: 'Copy sobre un caso de cierre con una imagen del mismo caso.',
    ejemplo_incumple: 'Copy sobre un webinar gratuito con una imagen de un testimonio de ventas.',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: ENTREVISTAS,
  },
  {
    codigo: 'MARCA-ORT-01',
    eje: 'marca',
    categoria: 'Ortografía',
    descripcion: 'Ortografía y gramática en copy y guion (LanguageTool). El texto dentro de la imagen lo revisa el modelo.',
    criterio_verificable: 'Cada error de ortografía o gramática que LanguageTool detecta en español. En el texto de la imagen, cada error visible.',
    ejemplo_cumple: 'Así lo hicimos.',
    ejemplo_incumple: 'Haci lo hicimos.',
    severidad: 'baja',
    tipo_de_verificacion: 'deterministica',
    fuente: `${ENTREVISTAS} · LanguageTool (español)`,
  },
  {
    codigo: 'META-PUB-01',
    eje: 'plataforma',
    categoria: 'Promesas de ingresos',
    descripcion: 'Promesas de ingresos o resultados poco realistas.',
    criterio_verificable: 'Incumple si promete ganancias, facturación o resultados económicos rápidos, fáciles o garantizados («gana dinero rápido sin esfuerzo», «duplica tu facturación en 30 días»).',
    ejemplo_cumple: 'Un caso documentado: la agencia pasó de 3 a 7 cierres al mes en dos trimestres.',
    ejemplo_incumple: 'Gana dinero rápido sin esfuerzo.',
    severidad: 'alta',
    tipo_de_verificacion: 'modelo',
    fuente: `${NORMAS_DE_META} · Prácticas comerciales inaceptables / oportunidades de ingresos`,
  },
  {
    codigo: 'META-PUB-02',
    eje: 'plataforma',
    categoria: 'Atributos personales',
    descripcion: 'Afirmaciones que aluden a atributos personales del destinatario.',
    criterio_verificable: 'Incumple si el texto afirma o insinúa algo sobre la situación personal, financiera o de salud de quien lo lee («¿Tu agencia está quebrando?», «¿Estás endeudado?»).',
    ejemplo_cumple: 'Para agencias que quieren ordenar su proceso comercial.',
    ejemplo_incumple: '¿Tu agencia está quebrando?',
    severidad: 'alta',
    tipo_de_verificacion: 'modelo',
    fuente: `${NORMAS_DE_META} · Atributos personales`,
  },
  {
    codigo: 'META-PUB-03',
    eje: 'plataforma',
    categoria: 'Sensacionalismo',
    descripcion: 'Contenido sensacionalista o engañoso: afirmaciones exageradas o ganchos que no se corresponden con la oferta.',
    criterio_verificable: 'Incumple si hay exageraciones («el secreto que nadie te cuenta»), clickbait o un gancho que no se corresponde con lo que se ofrece.',
    ejemplo_cumple: 'Te explicamos el método que usamos con nuestros clientes.',
    ejemplo_incumple: 'El truco secreto que los millonarios no quieren que sepas.',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: `${NORMAS_DE_META} · Contenido sensacionalista / Prácticas engañosas`,
  },
  {
    codigo: 'META-PUB-04',
    eje: 'plataforma',
    categoria: 'Garantías',
    descripcion: 'Garantías absolutas o comparaciones de «antes y después» no sustentadas.',
    criterio_verificable: 'Incumple si garantiza un resultado («100 % garantizado», «resultados asegurados») o muestra un antes y después sin sustento.',
    ejemplo_cumple: 'Los resultados dependen de cada equipo; te mostramos casos reales.',
    ejemplo_incumple: 'Resultados 100 % garantizados o te devolvemos tu dinero.',
    severidad: 'media',
    tipo_de_verificacion: 'modelo',
    fuente: `${NORMAS_DE_META} · Afirmaciones engañosas`,
  },
  {
    codigo: 'META-PUB-05',
    eje: 'plataforma',
    categoria: 'Discriminación',
    descripcion: 'Lenguaje discriminatorio o que excluye a grupos de personas.',
    criterio_verificable: 'Incumple si excluye o desvaloriza por edad, género, origen, religión, discapacidad u otra característica protegida.',
    ejemplo_cumple: 'Para dueños de agencias que quieren escalar.',
    ejemplo_incumple: 'Solo para hombres jóvenes, nada de señoras.',
    severidad: 'alta',
    tipo_de_verificacion: 'modelo',
    fuente: `${NORMAS_DE_META} · Prácticas discriminatorias`,
  },
  {
    codigo: 'FMT-01',
    eje: 'plataforma',
    categoria: 'Formato',
    descripcion: 'Relación de aspecto según el formato destino: feed 1:1 o 4:5; historia y reel 9:16.',
    criterio_verificable: 'Ancho ÷ alto dentro del 3 % de tolerancia de Meta de 1:1 o 4:5 (feed) o de 9:16 (historia y reel).',
    ejemplo_cumple: '1080 × 1350 para feed.',
    ejemplo_incumple: '1920 × 1080 para historia.',
    severidad: 'media',
    tipo_de_verificacion: 'deterministica',
    fuente: GUIA_DE_META,
  },
  {
    codigo: 'FMT-02',
    eje: 'plataforma',
    categoria: 'Formato',
    descripcion: 'Resolución mínima: lado corto de al menos 1080 px.',
    criterio_verificable: 'min(ancho, alto) ≥ 1080 px. Criterio de calidad del área: Meta admite desde 600 px de ancho y recomienda 1440 × 1800.',
    ejemplo_cumple: '1080 × 1080.',
    ejemplo_incumple: '800 × 800.',
    severidad: 'baja',
    tipo_de_verificacion: 'deterministica',
    fuente: `${GUIA_DE_META} · mínimo del área`,
  },
  {
    codigo: 'FMT-03',
    eje: 'plataforma',
    categoria: 'Formato',
    descripcion: 'Peso de imagen dentro del máximo admitido por Meta (30 MB).',
    criterio_verificable: 'Peso del archivo ≤ 30 MB (31 457 280 bytes).',
    ejemplo_cumple: 'Un JPG de 2 MB.',
    ejemplo_incumple: 'Un PNG de 45 MB.',
    severidad: 'baja',
    tipo_de_verificacion: 'deterministica',
    fuente: GUIA_DE_META,
  },
  {
    codigo: 'FMT-04',
    eje: 'plataforma',
    categoria: 'Formato',
    descripcion: 'Texto principal recomendado dentro del largo visible antes de «Ver más» (Meta recomienda de 50 a 150 caracteres).',
    criterio_verificable: 'Largo del copy ≤ 150 caracteres.',
    ejemplo_cumple: 'Un copy de 120 caracteres.',
    ejemplo_incumple: 'Un copy de 400 caracteres.',
    severidad: 'baja',
    tipo_de_verificacion: 'deterministica',
    fuente: GUIA_DE_META,
  },
];
