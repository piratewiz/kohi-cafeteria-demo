/* Kōhi — utilidades compartidas. JS vanilla, sin dependencias. */

const TOKEN_KEY = 'kohi.token';

const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * Llama a la API y normaliza el resultado. Nunca lanza por un status de error:
 * devuelve { ok, status, data } para que cada página decida qué mensaje mostrar.
 */
async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, data: { error: 'No se pudo contactar con el servidor. ¿Está arrancado?' } };
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: 'Respuesta inesperada del servidor' };
  }

  return { ok: res.ok, status: res.status, data };
}

/** Pinta un mensaje de error o éxito en un <p class="message">. */
function flash(el, text, kind = 'error') {
  el.textContent = text;
  el.className = `message message--${kind}`;
  el.hidden = false;
}

function clearFlash(el) {
  el.hidden = true;
  el.textContent = '';
}

/** Bloquea el botón mientras la petición está en vuelo. */
function busy(button, isBusy, labelWhenIdle) {
  button.disabled = isBusy;
  button.textContent = isBusy ? 'Enviando…' : labelWhenIdle;
}

/** Código de invitación derivado de la posición en la lista. */
function passCode(position) {
  return `QR-KOHI-${String(position).padStart(4, '0')}`;
}

// --- QR ficticio en canvas --------------------------------------------------
// No es un QR real: es un patrón determinista a partir del código, dibujado a
// mano para no añadir ninguna dependencia al proyecto.

function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRandom(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function drawFakeQr(canvas, code) {
  const MODULES = 25;
  const QUIET = 2;
  const total = MODULES + QUIET * 2;
  const size = canvas.clientWidth || 208;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const unit = size / total;
  const dark = '#14110c';

  ctx.fillStyle = '#ece7e1';
  ctx.fillRect(0, 0, size, size);

  const cell = (col, row) => {
    ctx.fillStyle = dark;
    ctx.fillRect((col + QUIET) * unit, (row + QUIET) * unit, unit, unit);
  };

  // Los tres ojos de las esquinas, que son lo que hace que "parezca" un QR.
  const finders = [[0, 0], [MODULES - 7, 0], [0, MODULES - 7]];
  const inFinder = (col, row) =>
    finders.some(([fc, fr]) => col >= fc - 1 && col <= fc + 7 && row >= fr - 1 && row <= fr + 7);

  const random = makeRandom(seedFrom(code));

  for (let row = 0; row < MODULES; row += 1) {
    for (let col = 0; col < MODULES; col += 1) {
      if (inFinder(col, row)) continue;
      if (random() > 0.52) cell(col, row);
    }
  }

  for (const [fc, fr] of finders) {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const ring = row === 0 || row === 6 || col === 0 || col === 6;
        const core = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        if (ring || core) cell(fc + col, fr + row);
      }
    }
  }

  // Patrón de alineación abajo a la derecha.
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const ring = row === 0 || row === 4 || col === 0 || col === 4;
      const core = row === 2 && col === 2;
      if (ring || core) cell(MODULES - 7 + col, MODULES - 7 + row);
    }
  }

  // Etiqueta central con el código, al estilo de un QR con logotipo.
  const labelW = size * 0.56;
  const labelH = size * 0.13;
  const x = (size - labelW) / 2;
  const y = (size - labelH) / 2;

  ctx.fillStyle = '#ece7e1';
  ctx.fillRect(x - 4, y - 4, labelW + 8, labelH + 8);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y, labelW, labelH);

  ctx.fillStyle = '#ece7e1';
  ctx.font = `600 ${Math.round(labelH * 0.55)}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, size / 2, y + labelH / 2 + 1);
}
