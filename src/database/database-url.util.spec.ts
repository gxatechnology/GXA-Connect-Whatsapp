import {
  parsePostgresUrl,
  resolveDatabaseType,
  checkTableNameCollisions,
  MAIN_TABLE_NAMES,
  DATA_TABLE_NAMES,
} from './database-url.util';

describe('database-url.util', () => {
  describe('parsePostgresUrl', () => {
    it('parses standard postgresql URL', () => {
      const parsed = parsePostgresUrl('postgresql://myuser:mypassword@localhost:5432/mydb');
      expect(parsed).toEqual({
        host: 'localhost',
        port: 5432,
        username: 'myuser',
        password: 'mypassword',
        database: 'mydb',
        ssl: undefined,
      });
    });

    it('parses postgres URL with sslmode=require', () => {
      const parsed = parsePostgresUrl('postgres://neon_user:neon_pass@ep-cool.neon.tech:5432/gxa_db?sslmode=require');
      expect(parsed).toEqual({
        host: 'ep-cool.neon.tech',
        port: 5432,
        username: 'neon_user',
        password: 'neon_pass',
        database: 'gxa_db',
        ssl: { rejectUnauthorized: false },
      });
    });

    it('returns null for non-postgres URLs or invalid strings', () => {
      expect(parsePostgresUrl('./data/openwa.sqlite')).toBeNull();
      expect(parsePostgresUrl('http://localhost:3000')).toBeNull();
      expect(parsePostgresUrl('')).toBeNull();
    });
  });

  describe('resolveDatabaseType', () => {
    it('returns sqlite when no postgres vars set', () => {
      expect(resolveDatabaseType({})).toBe('sqlite');
    });

    it('returns postgres when DATABASE_URL is set', () => {
      expect(resolveDatabaseType({ DATABASE_URL: 'postgres://localhost/db' })).toBe('postgres');
    });

    it('returns postgres when DATABASE_TYPE is postgres', () => {
      expect(resolveDatabaseType({ DATABASE_TYPE: 'postgres' })).toBe('postgres');
    });
  });

  describe('checkTableNameCollisions', () => {
    it('confirms zero table name collisions between main and data connections', () => {
      const collisions = checkTableNameCollisions();
      expect(collisions).toEqual([]);
      expect(MAIN_TABLE_NAMES.length).toBeGreaterThan(0);
      expect(DATA_TABLE_NAMES.length).toBeGreaterThan(0);
    });
  });
});
