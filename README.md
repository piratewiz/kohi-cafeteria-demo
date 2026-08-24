# Kōhi — landing de cafetería con lista de espera

Demo de una cafetería de especialidad ficticia. El visitante llega a la portada,
se apunta con nombre, email y contraseña, y recibe una posición en la cola.
Después puede entrar y ver su puesto en un panel, junto al total de apuntados.

El objetivo real del proyecto no es la aplicación, sino **encadenar varios
servidores MCP de principio a fin**: diseñar el esquema, implementar contra él,
verificarlo en un navegador real y publicarlo para revisión.

## Stack

Express 5 · SQLite (better-sqlite3) · bcrypt · JWT · frontend estático sin framework.

## Arrancar

```bash
npm install
npm start
```

Servidor en `http://localhost:3000`.

> `package-lock.json` no está versionado, así que `npm install` resolverá las
> versiones según los rangos de `package.json`.

En producción hay que definir `JWT_SECRET`; si falta, el servidor arranca con un
secreto de desarrollo y lo avisa por consola.

La base de datos `kohi.db` está en `.gitignore` (junto con sus archivos WAL/SHM,
que contienen datos reales). Necesitas crear la tabla antes del primer arranque:

```sql
CREATE TABLE waitlist (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  position      INTEGER NOT NULL
);
```

## API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/register` | Alta en la lista. Devuelve posición y total. |
| `POST` | `/api/login` | Autentica y devuelve un JWT (7 días). |
| `GET`  | `/api/me` | Datos del usuario y su posición. Requiere `Bearer`. |

## Detalles de implementación

**La posición no se puede duplicar.** `MAX(position) + 1` y el `INSERT` van
dentro de una transacción `IMMEDIATE` (`db.js`). Sin eso, dos registros
concurrentes leen el mismo máximo y reclaman el mismo puesto.

**El login no filtra qué emails existen.** Si el email no está en la base, se
compara igualmente contra un hash ficticio, de modo que el tiempo de respuesta
no revela si la cuenta existe.

**El QR del panel es un patrón dibujado a mano en canvas**, determinista a
partir del código de invitación. No es un QR legible: es deliberado, para no
añadir ninguna dependencia al proyecto.

## MCP usados

| Servidor | Para qué |
|---|---|
| **SQLite** | Crear el esquema `waitlist`, inspeccionar tablas y consultar los registros durante el desarrollo. |
| **Playwright** | Probar el flujo real en navegador: registro → login → panel. |
| **GitHub** | Crear la rama, subir los archivos y abrir el Pull Request. |

La configuración está en [`.mcp.json`](.mcp.json). El token de GitHub se lee de
la variable de entorno `GITHUB_PERSONAL_ACCESS_TOKEN`, nunca escrito en el
archivo.
