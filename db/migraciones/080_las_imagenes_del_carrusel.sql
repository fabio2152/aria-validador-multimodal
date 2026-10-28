-- 080 · Las imágenes del carrusel.
--
-- Una pieza deja de ser UNA imagen: un post de Instagram es un carrusel de hasta 20 fotos, y una secuencia
-- de historias son varias imágenes consecutivas. Las imágenes pasan a su propia tabla, en orden, y cada
-- hallazgo puede decir en cuál está (`imagen`, desde 1; nulo si es del copy o de la pieza entera).
--
-- Los análisis anteriores se conservan: su imagen pasa a ser la número 1 de su carrusel.

create table validador.imagenes_del_analisis (
  id uuid primary key default gen_random_uuid(),
  analisis_id uuid not null references validador.analisis (id) on delete cascade,
  orden integer not null check (orden between 1 and 20),
  nombre_del_archivo text,
  ruta_del_archivo text,
  ancho integer not null,
  alto integer not null,
  peso_en_bytes integer not null,
  unique (analisis_id, orden)
);

insert into validador.imagenes_del_analisis (analisis_id, orden, nombre_del_archivo, ruta_del_archivo, ancho, alto, peso_en_bytes)
select id, 1, nombre_del_archivo, ruta_del_archivo, ancho, alto, peso_en_bytes
from validador.analisis
where ancho is not null and alto is not null and peso_en_bytes is not null;

alter table validador.analisis
  drop column nombre_del_archivo,
  drop column ruta_del_archivo,
  drop column ancho,
  drop column alto,
  drop column peso_en_bytes;

-- `carrusel`: más de una imagen en un post. Las historias consecutivas siguen siendo `imagen` con el formato
-- `historia`: el formato dice dónde se publica y el tipo, qué es la pieza.
alter table validador.analisis drop constraint analisis_tipo_de_pieza_check;
alter table validador.analisis
  add constraint analisis_tipo_de_pieza_check check (tipo_de_pieza in ('imagen', 'carrusel', 'texto', 'video'));

alter table validador.hallazgos add column imagen integer check (imagen between 1 and 20);
