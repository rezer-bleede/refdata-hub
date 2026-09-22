import type React from 'react';

export interface DbProviderInfo {
  id: string;
  name: string;
  db_type: string;
  defaultPort: number;
  category: string;
  color: string;
}

export const DB_PROVIDERS: DbProviderInfo[] = [
  {
    id: 'postgres',
    name: 'PostgreSQL',
    db_type: 'postgres',
    defaultPort: 5432,
    category: 'Relational',
    color: '#336791',
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse',
    db_type: 'clickhouse',
    defaultPort: 8123,
    category: 'Analytical',
    color: '#ffcc00',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    db_type: 'mysql',
    defaultPort: 3306,
    category: 'Relational',
    color: '#00758f',
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    db_type: 'snowflake',
    defaultPort: 443,
    category: 'Data Warehouse',
    color: '#29b5e8',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    db_type: 'sqlite',
    defaultPort: 0,
    category: 'Embedded',
    color: '#003b57',
  },
  {
    id: 'oracle',
    name: 'Oracle DB',
    db_type: 'oracle',
    defaultPort: 1521,
    category: 'Enterprise',
    color: '#f80000',
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    db_type: 'sqlserver',
    defaultPort: 1433,
    category: 'Enterprise',
    color: '#cc292b',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    db_type: 'mongodb',
    defaultPort: 27017,
    category: 'NoSQL',
    color: '#13aa52',
  },
  {
    id: 'duckdb',
    name: 'DuckDB',
    db_type: 'duckdb',
    defaultPort: 0,
    category: 'Analytical',
    color: '#fff000',
  },
  {
    id: 'generic',
    name: 'Generic DB',
    db_type: 'generic',
    defaultPort: 5432,
    category: 'Custom JDBC/ODBC',
    color: '#6366f1',
  },
];

export const DbLogoIcon = ({ id, className = 'w-8 h-8' }: { id: string; className?: string }) => {
  switch (id) {
    case 'postgres':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#336791" fillOpacity="0.15" stroke="#336791" strokeWidth="2" />
          <path
            d="M32 14c-8.5 0-15 5.5-15 13 0 5 3.2 9.4 8 11.5v6.5l6-3.5 2 2 2-2 6 3.5v-6.5c4.8-2.1 8-6.5 8-11.5 0-7.5-6.5-13-15-13z"
            fill="#38bdf8"
          />
          <circle cx="26" cy="24" r="2.5" fill="#0f172a" />
          <circle cx="38" cy="24" r="2.5" fill="#0f172a" />
          <path d="M28 32c2 2 6 2 8 0" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'clickhouse':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#1e1e1e" />
          <rect x="12" y="14" width="8" height="36" fill="#ff4c4c" rx="2" />
          <rect x="22" y="14" width="8" height="36" fill="#ffcc00" rx="2" />
          <rect x="32" y="14" width="8" height="36" fill="#ffcc00" rx="2" />
          <rect x="42" y="14" width="8" height="36" fill="#ffcc00" rx="2" />
          <rect x="42" y="32" width="8" height="18" fill="#22c55e" rx="2" />
        </svg>
      );

    case 'mysql':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#00758f" fillOpacity="0.15" stroke="#00758f" strokeWidth="2" />
          <path
            d="M48 26c-2-4-7-6-12-5-4 .8-7.5 3.5-9 7.5-1.5 4-.5 8.5 2.5 11.5 3 3 7.5 4 11.5 2.5 3.5-1.3 6-4 7-7.5"
            stroke="#f29111"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path d="M18 42c3-8 8-16 16-20" stroke="#00758f" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );

    case 'snowflake':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#0284c7" fillOpacity="0.15" stroke="#29b5e8" strokeWidth="2" />
          <path d="M32 12v40M12 32h40M18 18l28 28M18 46l28-28" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 20l-4-4m8 0l-4 4M32 44l-4 4m8 0l-4-4M20 32l-4-4m0 8l4-4M44 32l4-4m0 8l-4-4" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'sqlite':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#003b57" fillOpacity="0.2" stroke="#003b57" strokeWidth="2" />
          <path d="M16 20h32v8H16zM16 28h32v8H16zM16 36h32v8H16z" fill="#38bdf8" opacity="0.6" />
          <path d="M16 20l16-8 16 8v24l-16 8-16-8V20z" stroke="#38bdf8" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      );

    case 'oracle':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#f80000" fillOpacity="0.15" stroke="#f80000" strokeWidth="2" />
          <rect x="16" y="22" width="32" height="20" rx="10" stroke="#f80000" strokeWidth="4" />
        </svg>
      );

    case 'sqlserver':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#cc292b" fillOpacity="0.15" stroke="#cc292b" strokeWidth="2" />
          <path d="M16 18l16-6 16 6v28l-16 6-16-6V18z" fill="#cc292b" opacity="0.3" stroke="#ef4444" strokeWidth="2" />
          <path d="M16 26l16 6 16-6M16 34l16 6 16-6" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );

    case 'mongodb':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#13aa52" fillOpacity="0.15" stroke="#13aa52" strokeWidth="2" />
          <path d="M32 12c-6 10-14 18-14 28 0 8 6 12 14 12s14-4 14-12c0-10-8-18-14-28z" fill="#13aa52" opacity="0.4" stroke="#22c55e" strokeWidth="2" />
          <path d="M32 12v40" stroke="#22c55e" strokeWidth="2" />
        </svg>
      );

    case 'duckdb':
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#eab308" fillOpacity="0.2" stroke="#eab308" strokeWidth="2" />
          <circle cx="32" cy="28" r="14" fill="#facc15" />
          <path d="M38 28h12l-6 6h-6z" fill="#f97316" />
          <circle cx="28" cy="24" r="2.5" fill="#0f172a" />
        </svg>
      );

    default:
      return (
        <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" rx="14" fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="2" />
          <ellipse cx="32" cy="20" rx="16" ry="6" stroke="#818cf8" strokeWidth="2" />
          <path d="M16 20v24c0 3.3 7.2 6 16 6s16-2.7 16-6V20" stroke="#818cf8" strokeWidth="2" />
          <path d="M16 32c0 3.3 7.2 6 16 6s16-2.7 16-6" stroke="#818cf8" strokeWidth="2" />
        </svg>
      );
  }
};
