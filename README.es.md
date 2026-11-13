[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**Responde unas pocas preguntas. Recibe tres sitios web terminados. Quédate con el que te guste.**

Sitebrew es un plugin para Claude Code y Codex. Describes tu sitio con palabras sencillas. Construye tres candidatos distintos, eliges uno, lo ajustas en la conversación y te llevas el código a tu propia carpeta. No necesitas saber programar ni una clave de API para empezar.

Versión actual `v0.2.7` · licencia MIT · Windows 10 y 11

## Por qué Sitebrew

- **Tres opciones reales, no una suposición.** Comparas tres candidatos terminados uno al lado del otro en lugar de reescribir el mismo prompt una y otra vez.
- **Código que es tuyo.** El resultado es un proyecto de Next.js y shadcn/ui en tu carpeta. No hay un constructor alojado ni dependencia de un proveedor.
- **Nada inventado.** Un dato que no diste, como un número de teléfono, queda como un hueco marcado. Las páginas legales siguen marcadas hasta que se revisan.
- **Funciona sin claves.** Sin claves, el sitio se crea en modo de vista previa. Las claves opcionales añaden fotos reales, páginas legales revisadas y enlaces de vista previa.
- **10 tipos de sitios.** Marca, negocio local, tienda en línea, detalle de producto, página de evento o lista de espera, portafolio, oficina pública, SaaS, app móvil (PWA) y panel de administración, en coreano o inglés.
- **Movimiento y 3D.** Las cabeceras pueden moverse, y la cabecera con objeto 3D parte de una sola imagen (imagen → modelo 3D). Sin las herramientas, pasa a una imagen 2.5D y después a un póster.
- **Un back end cuando lo necesites.** El kit launch-factory del mismo repositorio añade registro, pagos, correo y analítica.

## Cómo funciona

1. **Preguntar.** `/sitebrew:new` pregunta el nombre, el público, los datos de contacto y el estilo. Puedes saltarte lo que no sepas.
2. **Estampar.** La fábrica combina piezas probadas (bloques, ejes de estilo, recetas y arquetipos) en tres candidatos. Cada candidato pasa controles de calidad de diseño, accesibilidad y textos.
3. **Elegir.** El tablero muestra los tres candidatos uno al lado del otro, y eliges uno.
4. **Revisar.** `/sitebrew:revise` cambia una sección, los colores, la tipografía, el movimiento o un texto.
5. **Entregar.** `/sitebrew:deliver` copia el sitio elegido a tu carpeta con una lista de lo que debes completar antes de publicar.

## Instalación

### Qué necesitas

| Elemento | Versión | Obligatorio | Instalar en Windows |
|---|---|---|---|
| Claude Code o Codex | Última | Uno de los dos | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | Sí | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | Sí | Viene con Node |
| Git | Última | Sí | `winget install Git.Git` |
| Chrome | Última | No | `winget install Google.Chrome` |

Cada instalador de abajo detecta lo que falta y te lo dice. Pregunta antes de instalar cualquier cosa. Abre PowerShell como usuario normal, no como administrador.

### Elige una de cinco formas

| Forma | Úsala cuando |
|---|---|
| 1. npm | Ya tienes Node |
| 2. npx | Ya tienes Node y prefieres npx |
| 3. PowerShell | Quieres una sola línea que también revise Node y Git |
| 4. Plugin | Solo quieres añadir el plugin a Claude Code o Codex |
| 5. Tu agente de IA | Quieres que Claude Code o Codex haga la instalación por ti |

Las cinco terminan igual: Sitebrew en una carpeta `sitebrew` y el plugin en tu agente.

#### 1. npm

```powershell
npm create sitebrew@0.2.7 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.7 sitebrew
```

Las dos aceptan las mismas opciones: `--dry-run` muestra el plan sin cambiar nada, `--yes` responde que sí a todas las preguntas y `--tool` elige `claude`, `codex` o `both`.

#### 3. PowerShell

```powershell
$env:SITEBREW_COMMIT = '388fd8e557b4f087e011eab2748f7d8cf1efe2f5'; irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/388fd8e557b4f087e011eab2748f7d8cf1efe2f5/get.ps1 | iex; Remove-Item Env:SITEBREW_COMMIT
```

Para ver lo que haría sin instalar nada:

```powershell
$env:SITEBREW_WHATIF = '1'
$env:SITEBREW_COMMIT = '388fd8e557b4f087e011eab2748f7d8cf1efe2f5'; irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/388fd8e557b4f087e011eab2748f7d8cf1efe2f5/get.ps1 | iex; Remove-Item Env:SITEBREW_COMMIT
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. Plugin

En Claude Code:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.7
/plugin install sitebrew@sitebrew
```

En Codex:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.7
codex plugin add sitebrew@sitebrew
```

#### 5. Tu agente de IA

Pega esto en Claude Code o Codex. El agente sigue [AGENT_INSTALL.md](AGENT_INSTALL.md), una guía paso a paso escrita para agentes.

```text
Install Sitebrew for me. Read https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/main/AGENT_INSTALL.md and follow it step by step. Ask me before you install any program, and ask me which agent to use. At the end, show me the last lines of the installer output.
```

Si una instalación se detiene, su código de salida y lo que debes hacer están en [AGENT_INSTALL.md](AGENT_INSTALL.md).

## Crea tu primer sitio

Abre Claude Code en una carpeta vacía y ejecuta:

```text
/sitebrew:doctor
/sitebrew:new
```

`/sitebrew:doctor` muestra lo que falta, con una línea sobre cómo arreglar cada cosa. En Codex, di "crea un sitio con la skill sitebrew new". Las claves opcionales y la lista completa de skills están en la [guía del plugin](plugins/sitebrew/README.md).

## Para desarrolladores

El repositorio tiene tres partes: la fábrica de sitios (web-factory) en la raíz, el kit de back end en `launch-factory/` y el plugin en `plugins/sitebrew/`.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

La comprobación antes de una fusión es `npm run ci:verify`. La guía para agentes es [docs/agents/agent-guide.md](docs/agents/agent-guide.md), y el kit de lanzamiento se describe en [launch-factory/README.md](launch-factory/README.md).

También puedes añadir las piezas a otro proyecto de Next.js. Fija siempre la etiqueta:

```bash
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-default#v0.2.7 -y -o
npx shadcn@4.22.1 add nowwcastle-sudo/sitebrew/factory-base#v0.2.7 -y -o
```

## Contribuir

Las contribuciones son bienvenidas: reportes de errores, ideas, recetas o bloques nuevos y traducciones. Lee [CONTRIBUTING.md](CONTRIBUTING.md) para empezar. Es corto.

## Licencia

MIT. Consulta [LICENSE](LICENSE) y [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Historial de versiones

| Etiqueta | Fecha | Cambios | Registro |
|---|---|---|---|
| `v0.2.7` | 2026-11-13 | Versión de seguridad (revisión daybreak). web-factory: los procesos hijo ya no reciben variables de entorno secretas · npm, npx y vercel se ejecutan desde rutas absolutas de confianza sin shell · se comprueban las rutas de archivos locales (rutas de red, enlaces, salidas) · dependencias del registro fijadas a las versiones exactas del lock · descargas externas limitadas por host, tamaño y redirecciones · corregida la carrera al iniciar el túnel de vista previa y los servidores de QA solo escuchan en este equipo · los SVG de logotipo y favicon pasan una lista de permitidos · las claves de idempotencia de los formularios llegan a los puertos · la puerta del logotipo rechaza un logotipo oculto o transparente y la comprobación del color de marca ya no cuenta el color cubierto por imágenes. Kit de lanzamiento: confirmación del boletín por POST · carrera entre reembolso y envío · una oferta de retención se usa una sola vez · las direcciones de subida no se reutilizan · los cuerpos de las peticiones se leen solo hasta un límite · suscripciones push limitadas por cuenta · el registro ya no revela si un correo está registrado — **cambio de comportamiento: solo cuando existen los dos correos `verifyEmail` y `existingAccount`, el registro usa conceal por defecto y una cuenta nueva no puede iniciar sesión antes de verificar el correo (se desactiva con `signUpEnumeration: "reveal"`)**. Instalación: la línea de PowerShell puede fijar el commit de la versión y rechaza una etiqueta movida. Dependencias: next 16.4.5, hono 4.13.16 | — |
| `v0.2.6` | 2026-11-06 | Versión de funciones: compara los tres candidatos como sitios reales lado a lado (`npm run board:direction -- <run> --serve`) · el logo del brief aparece en la cabecera de los tres candidatos y, si no hay logo, se ofrecen 6 borradores · datos de ejemplo opcionales (`--sample-facts`) con una banda de ejemplo en cada página; `deliver` se detiene hasta que respuestas reales los sustituyan · el primer color de marca es el color principal · los candidatos se distinguen por familia de materiales, una regla de distancia y una pregunta opcional de posicionamiento · bucle de revisión final · nuevas comprobaciones del logo de la cabecera y de la presencia del color de marca · skills del plugin `new`, `deliver` y `revise` actualizados · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.5` | 2026-11-02 | Versión de parche: las tablas de administración siguen el idioma de pantalla y la zona horaria (fechas, números, orden y opciones de filtro de los bloques `data-table`) · la copia de la plantilla del kit de lanzamiento se actualiza igual · actualizaciones de dependencias (@hono/node-server 2.1.3, systeminformation 5.33.16, posthog-js 1.438.21, posthog-node 5.57.2, lucide-react 1.59.0, react-resizable-panels 4.14.8, playwright 1.64.1 y @axe-core/playwright 4.14.0, pglite 0.5.11 y pglite-tools 0.4.11, typescript-eslint 8.72.0) · el resto del kit y los skills del plugin no cambian · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.4` | 2026-10-26 | Versión de parche: solo actualizaciones de dependencias · react y react-dom 19.3.1 · @base-ui/react 1.9.0 · @tabler/icons-react 3.49.0 · react-resizable-panels 4.14.6 · drizzle-orm 0.45.4 · posthog-js 1.438.12 y posthog-node 5.55.2 · resend 6.32.1 · react-day-picker 10.0.2 · el kit y los skills del plugin no cambian · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.3` | 2026-10-26 | Versión de parche: se reelaboraron los ocho skills del plugin, con rutas y tablas de códigos de salida más claras · cada regla tiene un solo lugar · el skill de instalación tiene un camino para cuando falta Node.js · la guía de instalación comprueba la etiqueta de versión exacta y usa npm de forma segura en Windows · las comprobaciones del navegador coinciden con los lugares que lee el kit · new entrega de forma más segura · deliver tiene más motivos de omisión · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.2` | 2026-10-25 | Correcciones de la auditoría de skills: el skill doctor ya no instala nada por sí mismo y pasa al skill de instalación · deliver distingue el enlace de vista previa de Vercel de la dirección pública temporal · revise tiene una sola tabla de códigos de salida, runbook lee sus archivos de capítulos por secciones, new marca el tiempo de compilación como una sola medición · la guía del plugin lista los skills de instalación y de runbook · la página QA ya no muestra el nombre de una persona real · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.1` | 2026-10-25 | Versión de parche: shadcn 4.22.1 fijado en un solo lugar (elimina el aviso del zod anidado) · las páginas de campaña son noindex por defecto · las listas de productos incluyen ItemList y las páginas de eventos incluyen datos estructurados Event · la imagen para compartir muestra el logotipo de la marca · el brief de evento pregunta fecha y lugar · la comprobación de añadir receta sigue la guía · web-factory v0.0.16 + launch-factory v0.2.2 (versiones internas) | — |
| `v0.2.0` | 2026-10-24 | Módulos de back-end que funcionan en modo mock sin claves (tienda y pagos de Corea, reservas, avisos y push, reseñas, búsqueda, almacenamiento, boletín, mis solicitudes, administración) · enlaces de vista previa para compartir mediante un túnel rápido de Cloudflare · guías para el dueño y un runbook que aparecen cuando decides usar el sitio · el skill ahora distingue si está en un chatbot o en un agente, y un skill nuevo de instalación añade lo que falta · web-factory v0.0.14 + launch-factory v0.2.0 (versiones internas) | — |
| `v0.1.2` | 2026-10-16 | Revisión del directorio de plugins: doctor lee la dirección del clon desde compat.json, el README del plugin lista sus llamadas de red, la guía de versiones añade el paso de release de GitHub; lucide-react 1.53.0 en el kit de lanzamiento | — |
| `v0.1.1` | 2026-10-15 | Lista para el directorio de plugins de Claude: las reglas de fin de línea ya no tocan `plugins/sitebrew`, icono del plugin, aviso de doctor más claro, cinco formas de instalar, AGENT_INSTALL.md y CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | Primera versión pública · web-factory v0.0.13 + launch-factory v0.1.2 (versiones internas) | — |
