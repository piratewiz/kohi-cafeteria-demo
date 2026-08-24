const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { registerUser, findByEmail, findById, countWaitlist } = require('./db');

const PORT = 3000;
const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = '7d';
const MIN_PASSWORD_LENGTH = 8;

const JWT_SECRET = process.env.JWT_SECRET || 'kohi-dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[kohi] JWT_SECRET no definido, usando secreto de desarrollo.');
}

const app = express();
app.use(express.json());

// Un cuerpo JSON malformado es un error del cliente, no del servidor.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }
  next(err);
});

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const str = (value) => (typeof value === 'string' ? value.trim() : '');

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// --- Middleware JWT --------------------------------------------------------

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token ausente o mal formado' });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    res.status(401).json({ error: expired ? 'Token expirado' : 'Token inválido' });
  }
}

// --- Rutas -----------------------------------------------------------------

app.post('/api/register', async (req, res) => {
  const name = str(req.body?.name);
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const missing = ['name', 'email', 'password'].filter(
    (field) => !({ name, email, password })[field]
  );
  if (missing.length) {
    return res.status(400).json({ error: 'Faltan campos obligatorios', missing });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'El email no tiene un formato válido' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    });
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { position } = registerUser({ name, email, password_hash });
    res.status(201).json({
      success: true,
      message: `Bienvenido a la lista de espera de Kōhi, ${name}.`,
      position,
      total: countWaitlist(),
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ese email ya está en la lista de espera' });
    }
    throw err;
  }
});

app.post('/api/login', async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  const user = findByEmail(email);

  // Se compara siempre contra un hash (real o ficticio) para no filtrar por
  // tiempo de respuesta si el email existe o no.
  const hash = user ? user.password_hash : '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  res.json({ success: true, token: signToken(user), position: user.position });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = findById(req.auth.sub);
  if (!user) {
    return res.status(401).json({ error: 'La cuenta ya no existe' });
  }

  res.json({
    name: user.name,
    email: user.email,
    position: user.position,
    total: countWaitlist(),
  });
});

// --- Estáticos y errores ---------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));

app.use((err, req, res, next) => {
  console.error('[kohi]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`[kohi] Servidor escuchando en http://localhost:${PORT}`);
});
