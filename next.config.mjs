/** @type {import('next').NextConfig} */
const nextConfig = {
  /* El indicador flotante de desarrollo tapa la esquina inferior izquierda,
     justo donde el diseño coloca contenido. */
  devIndicators: false,

  // MAQUETA: sin `outputFileTracingIncludes`: era de Fundaciones, que no viaja a la maqueta.
};

export default nextConfig;
