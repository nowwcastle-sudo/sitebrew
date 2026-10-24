[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [日本語](README.ja.md)

# launch-factory

Kit de lanzamiento que acompaña a web-factory (el repositorio de bloques de pantalla). Este repositorio se encarga de la parte de servidor: autenticación, datos, pagos, correo, medición y tareas. Cada producto empieza copiando `template/` y recibe los parches de seguridad con solo subir la versión de los paquetes `@launch-factory/*`.

Versión actual `v0.2.0` · web-factory fijado `v0.2.0` · bloques `f2174f6e` · contract `f2174f6e` (el commit de la etiqueta v0.2.0)

- Los bloques no conocen al proveedor: los adaptadores implementan los puertos de web-factory. Un mismo conjunto de pruebas de conformidad comprueba que cada adaptador reproduce los mismos escenarios que el mock.
- Cada paquete de funcionalidad (adaptador, acciones de servidor, rutas de webhook, esquema y migraciones) se agrupa en una sola entrada de `registry.json`. Las versiones fijadas se detallan en [`docs/versions.md`](docs/versions.md).
- La referencia del contrato es `registry/factory/contract/` de web-factory.

## Requisitos del entorno

`npm run setup` comprueba todo lo de la tabla y avisa de lo que falta junto con el comando de instalación para este sistema operativo. No instala software del sistema.

| Elemento | Versión | Obligatorio | Windows | macOS | Linux |
|---|---|---|---|---|---|
| Node | >=24.13.0 | Obligatorio | `winget install OpenJS.NodeJS.LTS --version 24.13.0` | `nvm install 24.13.0` | `nvm install 24.13.0` |
| npm | >=11.6.2 | Obligatorio | Se instala con Node | Se instala con Node | Se instala con Node |
| git | Última | Obligatorio | `winget install Git.Git` | `brew install git` | `sudo apt install git` |
| Copia de web-factory | Etiqueta `v0.0.12` | Opcional | `git clone` y la ruta en `LF_WF_REPO` | `git clone` y la ruta en `LF_WF_REPO` | `git clone` y la ruta en `LF_WF_REPO` |
| Chrome | Última | Opcional | `winget install Google.Chrome` | `brew install --cask google-chrome` | `sudo apt install chromium` |
| gh | Última | Opcional | `winget install GitHub.cli` | `brew install gh` | `sudo apt install gh` |
| vercel | Última | Opcional | `npm i -g vercel` | `npm i -g vercel` | `npm i -g vercel` |
| gitleaks | Fijada en CI: 8.30.1 | Opcional | `winget install Gitleaks.Gitleaks` | `brew install gitleaks` | [archivo de la versión](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) |
| actionlint | Fijada en CI: 1.7.12 | Opcional | `winget install rhysd.actionlint` | `brew install actionlint` | [archivo de la versión](https://github.com/rhysd/actionlint/releases/tag/v1.7.12) |
| zizmor | Fijada en CI: 1.30.1 | Opcional | `winget install zizmor.zizmor` | `brew install zizmor` | `pipx install zizmor` |
| osv-scanner | Fijada en CI: 2.6.0 | Opcional | `winget install Google.OSVScanner` | `brew install osv-scanner` | [archivo de la versión](https://github.com/google/osv-scanner/releases/tag/v2.6.0) |

Sin los elementos opcionales no funciona lo siguiente.

- Copia de web-factory: sin ella, las pruebas de conformidad se marcan como SKIP. Si existe, se lee la ruta a la que apunta `LF_WF_REPO`, y ahí tiene que estar el commit `v0.0.12`. Sin la variable de entorno se usa la ruta por defecto del código, así que en otro PC hay que definir siempre `LF_WF_REPO`.
- Chrome: sin él no se ejecuta `npm run template:screens`. Si está instalado fuera de la ruta por defecto, se indica la ruta del ejecutable en `CHROME_PATH`.
- Las cuatro herramientas de seguridad: `npm run ci:verify` marca los pasos correspondientes como SKIP. CI descarga y usa las versiones fijadas en `scripts/ci/tools.json`. Para que en local también cuente como fallo que falten, se define `LF_CI_REQUIRE_TOOLS=1`.
- gitleaks: el hook de revisión de secretos previo al commit solo muestra un aviso y deja pasar el commit.
- gh: sirve para clonar y hacer push en repositorios privados y para iniciar sesión en GitHub (`gh auth login`).
- vercel: hace falta para los despliegues de vista previa y para `npm run env:check -- --vercel`.

Otras condiciones:

- Memoria: la compilación y los controles de pantallas necesitan unos 3GB de memoria libre. Si no hay suficiente, `template:screens` espera (`LF_SCREENS_MIN_FREE_GB`).
- Fin de línea: `.gitattributes` fija LF, así que la configuración de `core.autocrlf` no influye.
- Shell: todos los scripts son de Node, así que PowerShell y bash se comportan igual. Argumentos como `--only /pricing` de `template:screens` los convierte Git Bash en una ruta, por lo que se pasan desde PowerShell.
- Base de datos: las pruebas usan PGlite en memoria, así que no hay nada que instalar. La conexión live usa el `DATABASE_URL` de Supabase.

### Variables de entorno

Los valores no se guardan en el repositorio. La lista de nombres está en [`.env.example`](.env.example), que es la referencia.

| Estado | Qué hace falta |
|---|---|
| mock (desarrollo por defecto) | Solo `LF_MODE=mock`. Arranca aunque no haya claves de proveedor. |
| live | `LF_MODE=live`, las claves de proveedor y `DATABASE_URL`. Los nombres que falten los avisan `npm run env:check` (sin conexión) y `npm run doctor -- --stage sandbox`. |
| Opcional | `INQUIRY_OWNER_EMAIL`, `POSTHOG_*` y `SENTRY_DSN`. Si faltan, solo se desactiva la función correspondiente. |
| Tienda (opcional) | `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET` y `PORTONE_WEBHOOK_SECRET`. En live hacen falta los cuatro; si falta uno, solo se desactiva la tienda. En mock la tienda funciona sin claves (con un paso de confirmación de pago simulado). |
| Rutas | `LF_WF_REPO` (la copia de web-factory que leen las pruebas de conformidad) · `WF_HOME` (la copia de web-factory que lee `template:screens`) · `CHROME_PATH` |

## Primeros pasos

Si el repositorio es privado, hay que iniciar sesión en GitHub antes de clonarlo.

```bash
git clone https://github.com/nowwcastle-sudo/sitebrew.git
cd sitebrew/launch-factory
npm run setup
npm run ci:verify
```

- `npm run setup`: comprueba el entorno y configura `.githooks` como `core.hooksPath`. Si falta `node_modules` o está desactualizado, ejecuta `npm ci`. Si falta algo obligatorio, termina con código de salida 1 y la última línea es `setup: FAIL`.
- `npm run ci:verify`: el mismo conjunto de comprobaciones que ejecuta CI. Muestra en una tabla PASS, FAIL o SKIP por cada paso y, si hay algún FAIL, termina con código de salida 1.

Para ejecutar la plantilla en modo mock:

```bash
LF_MODE=mock npm run dev -w template
```

```powershell
$env:LF_MODE = "mock"; npm run dev -w template
```

Se comprueba en http://localhost:3000.

## Tareas frecuentes

| Tarea | Comando |
|---|---|
| Pruebas unitarias | `npm test` |
| Comprobación previa a la ejecución (si las claves siguen vigentes) | `npm run doctor -- --stage dev` (también existen `sandbox` y `preview`) |
| Regenerar y comprobar el registro | `npm run registry:build` · `npm run registry:check` |
| Control de pantallas de la plantilla (compilación de unos 4 minutos) | `npm run template:screens` |
| Comprobar que el README está al día | `npm run readme:check` |

### Actualizar la versión fijada de web-factory

Cuando web-factory publica una etiqueta nueva `vX.Y.Z`, la versión fijada se actualiza en este orden.

```bash
npm run contract:sync -- --from <web-factory-path> --ref vX.Y.Z
node scripts/template-sync.mjs blocks --from <web-factory-path> --ref vX.Y.Z
git diff template/package.json
```

1. Si `git diff template/package.json` muestra dependencias que sync ha subido de versión, se revierten.
2. Se cambia `WF_CONFORMANCE_COMMIT` en `scripts/lib/wf-conformance.mjs` por el hash del commit de la etiqueta nueva.
3. Se cambian por la etiqueta nueva la fila de web-factory en `docs/versions.md` y la línea «web-factory fijado» de este README.
4. Se comprueba que `npm run ci:verify` devuelve 0.

### Publicar una versión nueva

Se siguen los pasos de [`docs/RELEASING.md`](docs/RELEASING.md). Actualizar el README y ejecutar `npm run readme:check -- --tag vX.Y.Z` son pasos obligatorios antes de crear la etiqueta.

## Cuando algo falla

| Lo que se ve | Causa | Solución |
|---|---|---|
| `setup: FAIL — 필수 누락 …` | Falta una herramienta obligatoria o su versión es inferior a la requerida | Se ejecuta el comando marcado con `→` en cada línea y se vuelve a ejecutar `npm run setup`. |
| `web-factory 체크아웃 없음` · `web-factory 커밋 … 을 찾지 못함` | La ruta de `LF_WF_REPO` no existe o no contiene el commit `v0.0.12` | Se clona web-factory, se ejecuta `git -C <path> fetch --tags` y se pone esa ruta en `LF_WF_REPO`. |
| `SKIP(도구 없음)` | Falta una herramienta de seguridad opcional | No es un fallo. Al instalarla, el paso se ejecuta. |
| `[pre-commit] gitleaks 가 설치돼 있지 않아 … 건너뛴다` | El hook está activo pero falta gitleaks | Se ejecuta el comando de gitleaks de la tabla de requisitos del entorno. |
| `--only /pricing` no encuentra ninguna página | Git Bash convierte `/pricing` en una ruta | Se ejecuta desde PowerShell. |

## Historial de versiones

| Etiqueta | Fecha | Contenido | Registro |
|---|---|---|---|
| `v0.2.0` | 2026-10-24 | launch-factory v0.2.1 (internal version) · Parche de seguridad: next 16.4.3, zod 4.6.7 y actualizaciones de body-parser, fast-uri y undici · web-factory fijado en `v0.2.0` | — |
