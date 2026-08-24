const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'kohi.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const statements = {
  insert: db.prepare(
    `INSERT INTO waitlist (name, email, password_hash, position)
     VALUES (@name, @email, @password_hash, @position)`
  ),
  nextPosition: db.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM waitlist'
  ),
  findByEmail: db.prepare(
    'SELECT id, name, email, password_hash, position FROM waitlist WHERE email = ?'
  ),
  findById: db.prepare(
    'SELECT id, name, email, position FROM waitlist WHERE id = ?'
  ),
  total: db.prepare('SELECT COUNT(*) AS total FROM waitlist'),
};

// MAX(position)+1 and the INSERT have to be one atomic unit, otherwise two
// concurrent registrations can read the same MAX and claim the same spot.
const insertAtNextPosition = db.transaction(({ name, email, password_hash }) => {
  const { next } = statements.nextPosition.get();
  const info = statements.insert.run({ name, email, password_hash, position: next });
  return { id: info.lastInsertRowid, position: next };
});

module.exports = {
  db,
  registerUser: (user) => insertAtNextPosition.immediate(user),
  findByEmail: (email) => statements.findByEmail.get(email),
  findById: (id) => statements.findById.get(id),
  countWaitlist: () => statements.total.get().total,
};
