[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

Sitebrew responde a unas pocas preguntas con tres candidatos de sitio web. Comparas los tres uno al lado del otro y eliges uno. Lo ajustas y lo recibes en tu propia carpeta. Funciona como plugin dentro de Claude Code o Codex, y no hace falta saber programar.

Versión actual `v0.1.0`.

- Hace 10 tipos de sitios: marca, negocio local, tienda en línea, detalle de producto, página de evento o lista de espera, portafolio, oficina pública, SaaS, app móvil (PWA) y panel de administración.
- Hace sitios en coreano y en inglés. Los sitios de negocio local y de oficina pública son solo en coreano.
- Los servicios que necesitan registro y pagos se conectan al kit launch-factory del mismo repositorio.
- Está hecho y probado en Windows 10 y 11.

## Qué necesitas

| Elemento | Versión | Obligatorio | Instalar en Windows |
|---|---|---|---|
| Claude Code o Codex | Última | Uno de los dos | `winget install Anthropic.ClaudeCode` / `winget install OpenAI.Codex` |
| Node | >=24.13.0 | Sí | `winget install OpenJS.NodeJS.LTS` |
| npm | >=11.6.2 | Sí | Viene con Node |
| Git | Última | Sí | `winget install Git.Git` |
| Chrome | Última | No | `winget install Google.Chrome` |

- El instalador de abajo encuentra lo que falta y te lo dice. Pregunta antes de instalar cualquier cosa y no instala nada hasta que respondes.
- Claude Code y Codex requieren iniciar sesión con una cuenta de ese servicio.
- Sin Chrome solo se omiten algunas comprobaciones de pantalla. Los sitios se hacen igual.
- Para abrir PowerShell, busca "PowerShell" en el menú Inicio. No lo abras como administrador: el instalador se detiene en una ventana de administrador.

## Instalación

### Instalación en una línea (recomendada)

Pega la línea de abajo en PowerShell. El instalador descarga Sitebrew en una carpeta `sitebrew` dentro de la carpeta actual e instala el plugin en el agente que elijas.

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
```

Para ver qué haría sin instalar nada, ejecuta esto:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

Para elegir tú el agente o la carpeta, usa la forma que acepta opciones. `-Tool` es uno de `claude`, `codex` o `both`. `-Yes` responde sí a todas las preguntas. `-WhatIf` solo muestra una vista previa.

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.1.0/install.ps1).TrimStart([char]0xFEFF))) -Tool claude -Folder "$HOME\sitebrew"
```

### Instalar con npx

Si ya tienes Node, esto también funciona. Descarga el repositorio, muestra los dos comandos de instalación del plugin y los ejecuta cuando respondes sí.

```powershell
npx create-sitebrew@0.1.0 sitebrew
```

### Instalar solo el plugin

En Claude Code:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.1.0
/plugin install sitebrew@sitebrew
```

En Codex:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.1.0
codex plugin add sitebrew@sitebrew
```

Para comprobar la instalación, ejecuta `claude plugin list`.

## Haz tu primer sitio

1. Abre Claude Code en una carpeta vacía para los archivos del sitio.
2. Ejecuta `/sitebrew:doctor` para ver qué falta. Cada elemento que falta trae una línea con la forma de arreglarlo.
3. Ejecuta `/sitebrew:new` y responde las preguntas: nombre, público, datos de contacto, estilo, etc. Puedes dejar en blanco lo que no sepas.
4. Compara los tres candidatos y elige uno.
5. Para cambiar algo, usa `/sitebrew:revise` para una sección, los colores, la tipografía o el movimiento, o un texto.
6. Usa `/sitebrew:deliver` para recibir el sitio elegido en tu propia carpeta. La guía que lo acompaña indica qué completar antes de publicar.

```text
/sitebrew:doctor
/sitebrew:new
```

En Codex, di "haz un sitio con la skill new de sitebrew". Para un sitio en inglés, di "sitio en inglés" al principio.

## Modo de vista previa y espacios en blanco

Puedes empezar sin ninguna clave. Sin claves, el sitio se hace en modo de vista previa y se marca como "no publicable". Una línea explica qué falta en cada motivo.

- "Por confirmar": un dato que dejaste en blanco en las preguntas (teléfono, datos del negocio, etc.). Se deja en blanco, nunca se inventa. Lo completas tú.
- "Se necesita una foto real": un lugar donde solo cabe una foto real, como la tienda o la pantalla del producto. Pones tu foto.
- "Revisión legal pendiente": los borradores de términos y de política de privacidad aún no se han contrastado con la ley.

Todos los valores de abajo son opcionales. Claude Code los pide al activar el plugin. Si instalaste desde la línea de comandos no los pide, así que añádelos con `/plugin configure sitebrew@sitebrew`. Nunca pegues una clave en el chat.

| Nombre | Qué añade |
|---|---|
| `PEXELS_API_KEY` | Fotos de stock reales en lugar de huecos vacíos |
| `LAW_API_OC` | Páginas legales coreanas contrastadas con el texto legal vigente |
| `VERCEL_TOKEN` | Enlaces de vista previa en línea |
| `HIGGSFIELD_DIR` | Una carpeta con tus propias imágenes y modelos 3D |

```text
/plugin configure sitebrew@sitebrew
```

La portada con objeto 3D (`object-3d-orbit`) empieza con una imagen: imagen → GLB (modelo 3D) → se muestra en pantalla. Sin las herramientas, pasa a una imagen 2.5D y luego a un póster. Sin ninguna imagen, no se elige esta portada.

## Palabras usadas aquí

| Palabra | Significado |
|---|---|
| Candidato | Una versión del sitio hecha con las mismas respuestas. Tres a la vez |
| Tablero | La pantalla donde pones los candidatos uno al lado del otro y eliges |
| Estampar | Hacer un sitio a partir de tus respuestas (`npm run stamp`) |
| Modo de vista previa | Un sitio hecho mientras faltan claves o datos. Sirve para elegir, no para publicar |
| No publicable | Una marca de que hay que completar algo antes de publicar. Viene con el motivo |
| Doctor | Una comprobación que dice qué falta en tu equipo y cómo arreglarlo |
| Banco de inspección | Una pantalla para desarrolladores que muestra piezas y bloques uno por uno (`npm run dev`) |

## Cuando la instalación se detiene

El instalador deja su resultado en `$LASTEXITCODE`. Si se ejecuta fuera de una terminal, toma todas las preguntas como respondidas con "no".

| Código | Significado | Qué hacer |
|---|---|---|
| 0 | Terminado, o vista previa | Sigue el siguiente paso de la última línea |
| 1 | Falló una descarga, una clonación o un comando del plugin | Revisa la conexión a internet y ejecuta la misma línea otra vez |
| 2 | Una opción o carpeta incorrecta | Revisa la ruta de `-Folder`. Las carpetas dentro de Windows o Program Files se rechazan |
| 3 | Falta algo o hace falta tu respuesta | Ejecuta el comando de instalación que aparece, o vuelve a ejecutar con `-Yes` |
| 4 | Se negó a empezar | En una ventana de administrador, vuelve a ejecutar en una ventana normal de PowerShell |

Con `-Yes` también responde sí a guardar la carpeta de Sitebrew en la variable de entorno de usuario `SITEBREW_DIR`.

## Para desarrolladores

El repositorio tiene tres partes. `factory/` y `registry/` son la fábrica de sitios (web-factory), y `launch-factory/` es el kit de registro, pagos, correo y analítica. `plugins/sitebrew/` es el plugin y `packages/create-sitebrew/` es el instalador de npx.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew
npm run setup
npm run dev
```

- `npm run setup` revisa el entorno e instala las dependencias si hace falta. `npm run dev` abre el banco de inspección.
- La comprobación antes de fusionar es una línea: `npm run ci:verify`.
- La guía completa para agentes es [docs/agents/agent-guide.md](docs/agents/agent-guide.md).
- Cómo añadir una receta o un bloque está en [docs/guides/add-recipe.md](docs/guides/add-recipe.md).
- Cómo usar launch-factory está en [launch-factory/README.md](launch-factory/README.md).
- Los pasos de publicación están en [docs/RELEASING.md](docs/RELEASING.md). Las licencias de fuentes están en [docs/qa/font-licenses.md](docs/qa/font-licenses.md).

También puedes instalar solo las piezas en otro proyecto Next.js. Añade siempre la etiqueta a la dirección.

```bash
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.1.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/alert-dialog#v0.1.0 -y -o
```

## Licencia

MIT. Consulta [LICENSE](LICENSE) y [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Historial de versiones

| Etiqueta | Fecha | Cambios | Registro |
|---|---|---|---|
| `v0.1.0` | 2026-10-15 | Primera versión pública · web-factory v0.0.13 + launch-factory v0.1.2 (versiones internas) | — |
