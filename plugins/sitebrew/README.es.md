[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# sitebrew

sitebrew es un plugin de Claude Code con cinco skills. Te guían en el uso de web-factory (un registro de shadcn y un proceso para generar sitios) y de launch-factory (un kit de lanzamiento del lado servidor para autenticación, pagos, correo y analítica). Siempre usa las etiquetas de versión fijadas que aparecen abajo y nunca `main`. `compat.json` indica qué etiquetas de los kits fija cada versión de la guía.

## Versiones fijadas

| Parte | Etiqueta |
|---|---|
| web-factory | `v0.2.2` |
| launch-factory | `v0.2.2` |

## Instalación

Desde el marketplace de este repositorio:

```bash
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.2
/plugin install sitebrew@sitebrew
```

Para probarlo sin instalar, inicia Claude Code con `claude --plugin-dir <path>`, donde la ruta es la carpeta `plugins/sitebrew` de un clon de Sitebrew.

En Codex, añade primero el marketplace y después el plugin (`codex plugin --help` muestra ambos comandos):

```bash
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.2
codex plugin add sitebrew@sitebrew
```

El hook de sesión que copia las opciones del plugin al shell es solo para Claude Code (la instalación en Codex no carga ningún hook). En Codex define variables de entorno normales; la skill `doctor` explica cómo.

## Skills

| Skill | Para qué sirve |
|---|---|
| `new` | Respondes unas preguntas y obtienes tres candidatos de sitio para comparar y elegir. |
| `revise` | Cambia una sección, un eje de diseño o un texto de un sitio ya generado. |
| `deliver` | Copia el sitio elegido a tu propia carpeta, con un README que lista lo que falta corregir antes de publicar. |
| `doctor` | Muestra qué falta en tu equipo y cómo arreglarlo, en coreano y en inglés. No instala nada; instalar es tarea del skill `setup`. |
| `setup` | Instala lo que Sitebrew necesita (Node.js, Git, un navegador, la carpeta de Sitebrew), de uno en uno y solo después de que digas que sí a cada elemento. |
| `preview` | Abre un sitio entregado en una dirección pública temporal, sin cuenta, clave ni coste. |
| `runbook` | Cuando decides usar el sitio de verdad: en qué servicios externos registrarte, en qué orden, qué tipo de coste tiene cada uno y qué deja de funcionar si lo omites. |
| `guide` | Instala piezas de web-factory, arranca la plantilla de launch-factory y explica qué claves existen. |

Empieza con estas dos:

```text
/sitebrew:doctor
/sitebrew:new
```

## Las claves son opcionales

No hace falta ninguna clave para empezar. Sin claves, el kit genera los sitios en modo vista previa: los huecos de fotos de stock quedan como marcadores «imagen en preparación», las páginas legales quedan «sin revisar» y el resultado se marca como no publicable. Cada elemento que falta se indica con una línea que explica qué desactiva.

Al activar el plugin, Claude Code pide cuatro valores opcionales (`userConfig`). Déjalos vacíos para seguir en modo vista previa. La instalación desde la línea de comandos (`claude plugin install`) no pide estos valores; defínelos después con `/plugin configure sitebrew@sitebrew` dentro de Claude Code.

| Nombre | Sensible | Qué añade |
|---|---|---|
| `PEXELS_API_KEY` | sí | Fotos de stock reales en lugar de marcadores. |
| `LAW_API_OC` | sí | Páginas legales contrastadas con el texto de la ley. |
| `VERCEL_TOKEN` | sí | Enlaces de vista previa en línea. |
| `HIGGSFIELD_DIR` | no (una carpeta) | Tus propias imágenes generadas. |

Claude Code guarda las tres claves en su almacén seguro de credenciales, no en un archivo de configuración. El kit lee variables de entorno normales, así que al iniciar cada sesión un hook de este plugin copia cada opción que rellenaste al entorno de shell de esa sesión (reinicia Claude Code después de cambiar una opción). Una variable que definas tú mismo, por ejemplo con `setx`, siempre tiene prioridad. La copia es un archivo de texto plano en la carpeta `session-env` de tu perfil de Claude y no se elimina automáticamente; si no lo quieres, usa una variable de entorno normal. El plugin nunca imprime el valor de una clave: su doctor informa del nombre, de si está definida y de su longitud. La copia está en `~/.claude/session-env/<id de sesión>/` (borra esa carpeta para eliminarla); en Windows su acceso sigue los permisos de tu perfil de usuario.

El héroe de objeto 3D (`object-3d-orbit`) parte de una imagen: imagen → modelo GLB → se muestra. Sin las herramientas para ello, baja a 2.5D y después a un póster; si no hay ninguna imagen, el kit no elige este héroe.

## Llamadas de red

El plugin no envía nada a sus mantenedores. El kit que maneja llama a un servicio externo solo cuando configuras la clave correspondiente:

| Servicio | Cuándo | Qué se envía |
|---|---|---|
| Pexels | `PEXELS_API_KEY` está configurada (paso 05, medios) | palabras de búsqueda de fotos y vídeos de stock |
| API de leyes de Corea (law.go.kr) | `LAW_API_OC` está configurada (revisión legal) | los nombres de las leyes que se comprueban |
| Vercel | `VERCEL_TOKEN` está configurada y pasas `--deploy-preview` | los archivos del sitio construido |

Al preparar el kit se descarga el repositorio desde GitHub y los paquetes desde el registro de npm. El kit launch-factory funciona en modo simulado (mock) hasta que conectas tus propios servicios.

## Qué hace sitebrew

- Instala piezas de web-factory en un proyecto Next.js con `npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/<item>#v0.2.2 -y -o`.
- Te acompaña paso a paso con `npm run stamp`, que convierte un brief en candidatos de sitio.
- Arranca la plantilla de launch-factory en modo mock y después enumera lo que necesita el modo live.
- Te dice qué claves debes crear tú. Solo da nombres y nunca te pide un valor.

## Límites que conviene conocer

- Los repositorios públicos no incluyen las fotos de stock, los vídeos generados ni las texturas fotográficas del historial privado, porque no se confirmaron sus condiciones de redistribución.
- Sin `LAW_API_OC` las páginas legales no se pueden contrastar con la ley, así que el sitio queda marcado como no publicable hasta que la añadas.
- Las pruebas de conformidad de launch-factory leen la parte web-factory del mismo clon; ejecútalas dentro del clon de Sitebrew.

La lista completa de claves está en `skills/guide/references/keys.md`.

## Licencia

MIT. Consulta `LICENSE`.
