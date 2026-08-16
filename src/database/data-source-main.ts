import { DataSource, DataSourceOptions } from 'typeorm';
import { loadCliEnv } from './load-cli-env';
import { sqliteDataMainPathCollision } from '../config/env.validation';
import { parsePostgresUrl, resolveDatabaseType } from './database-url.util';

// Load environment variables with the app's precedence (mirrors data-source.ts / main.ts).
loadCliEnv();

const effectiveDbType = resolveDatabaseType(process.env);

// Same guard as data-source.ts: collision check only applies when using SQLite
if (effectiveDbType === 'sqlite') {
  const sqlitePathCollision = sqliteDataMainPathCollision(process.env);
  if (sqlitePathCollision) {
    throw new Error(sqlitePathCollision);
  }
}

const mainEntities = [
  __dirname + '/../modules/auth/**/*.entity{.ts,.js}',
  __dirname + '/../modules/audit/**/*.entity{.ts,.js}',
  __dirname + '/../modules/user/**/*.entity{.ts,.js}',
  __dirname + '/../modules/organization/**/*.entity{.ts,.js}',
  __dirname + '/../modules/plan/**/*.entity{.ts,.js}',
];
const mainMigrations = [__dirname + '/migrations-main/*{.ts,.js}'];

const mainUrl = process.env.MAIN_DATABASE_URL || process.env.DATABASE_URL;
const parsedUrl = mainUrl ? parsePostgresUrl(mainUrl) : null;
const schema = process.env.MAIN_POSTGRES_SCHEMA || process.env.POSTGRES_SCHEMA || 'public';
const useCustomSearchPath = schema && schema !== 'public';

const postgresMainOptions: DataSourceOptions = {
  type: 'postgres',
  ...(mainUrl ? { url: mainUrl } : {}),
  schema,
  host: parsedUrl?.host || process.env.DATABASE_HOST || 'localhost',
  port: parsedUrl?.port || parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: parsedUrl?.username || process.env.DATABASE_USERNAME,
  password: parsedUrl?.password || process.env.DATABASE_PASSWORD,
  database: parsedUrl?.database || process.env.DATABASE_NAME || 'openwa',
  entities: mainEntities,
  migrations: mainMigrations,
  migrationsTableName: 'migrations_main',
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  ssl:
    process.env.DATABASE_SSL === 'true' || (parsedUrl?.ssl !== undefined ? !!parsedUrl.ssl : false)
      ? {
          rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  extra: {
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...(useCustomSearchPath ? { options: `-c search_path=${schema},public` } : {}),
  },
};

const sqliteMainOptions: DataSourceOptions = {
  type: 'better-sqlite3',
  database: process.env.MAIN_DATABASE_NAME || './data/main.sqlite',
  entities: mainEntities,
  migrations: mainMigrations,
  migrationsTableName: 'migrations_main',
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
};

const mainDataSource = new DataSource(effectiveDbType === 'postgres' ? postgresMainOptions : sqliteMainOptions);

export default mainDataSource;
