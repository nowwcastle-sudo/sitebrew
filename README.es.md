[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# Sitebrew

**Responde unas pocas preguntas. Recibe tres sitios web terminados. Quédate con el que te guste.**

Sitebrew es un plugin para Claude Code y Codex. Describes tu sitio con palabras sencillas. Construye tres candidatos distintos, eliges uno, lo ajustas en la conversación y te llevas el código a tu propia carpeta. No necesitas saber programar ni una clave de API para empezar.

Versión actual `v0.2.0` · licencia MIT · Windows 10 y 11

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
npm create sitebrew@0.2.0 sitebrew
```

#### 2. npx

```powershell
npx create-sitebrew@0.2.0 sitebrew
```

Las dos aceptan las mismas opciones: `--dry-run` muestra el plan sin cambiar nada, `--yes` responde que sí a todas las preguntas y `--tool` elige `claude`, `codex` o `both`.

#### 3. PowerShell

```powershell
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.0/get.ps1 | iex
```

Para ver lo que haría sin instalar nada:

```powershell
$env:SITEBREW_WHATIF = '1'
irm https://raw.githubusercontent.com/nowwcastle-sudo/sitebrew/v0.2.0/get.ps1 | iex
Remove-Item Env:SITEBREW_WHATIF
```

#### 4. Plugin

En Claude Code:

```text
/plugin marketplace add nowwcastle-sudo/sitebrew#v0.2.0
/plugin install sitebrew@sitebrew
```

En Codex:

```powershell
codex plugin marketplace add nowwcastle-sudo/sitebrew --ref v0.2.0
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
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-default#v0.2.0 -y -o
npx shadcn@4.21.0 add nowwcastle-sudo/sitebrew/factory-base#v0.2.0 -y -o
```

## Contribuir

Las contribuciones son bienvenidas: reportes de errores, ideas, recetas o bloques nuevos y traducciones. Lee [CONTRIBUTING.md](CONTRIBUTING.md) para empezar. Es corto.

## Licencia

MIT. Consulta [LICENSE](LICENSE) y [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Historial de versiones

| Etiqueta | Fecha | Cambios | Registro |
|---|---|---|---|
| `v0.2.0` | 2026-10-24 | Módulos de back-end que funcionan en modo mock sin claves (tienda y pagos de Corea, reservas, avisos y push, reseñas, búsqueda, almacenamiento, boletín, mis solicitudes, administración) · enlaces de vista previa para compartir mediante un túnel rápido de Cloudflare · guías para el dueño y un runbook que aparecen cuando decides usar el sitio · el skill ahora distingue si está en un chatbot o en un agente, y un skill nuevo de instalación añade lo que falta · web-factory v0.0.14 + launch-factory v0.2.0 (versiones internas) | — |
| `v0.1.2` | 2026-10-16 | Revisión del directorio de plugins: doctor lee la dirección del clon desde compat.json, el README del plugin lista sus llamadas de red, la guía de versiones añade el paso de release de GitHub; lucide-react 1.53.0 en el kit de lanzamiento | — |
| `v0.1.1` | 2026-10-15 | Lista para el directorio de plugins de Claude: las reglas de fin de línea ya no tocan `plugins/sitebrew`, icono del plugin, aviso de doctor más claro, cinco formas de instalar, AGENT_INSTALL.md y CONTRIBUTING.md | — |
| `v0.1.0` | 2026-10-15 | Primera versión pública · web-factory v0.0.13 + launch-factory v0.1.2 (versiones internas) | — |
