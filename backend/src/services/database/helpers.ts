import { AppError } from '@/api/middlewares/error.js';
import { ERROR_CODES } from '@/types/error-constants.js';
import { validateIdentifier, validateSchemaName, validateTableName } from '@/utils/validations.js';
import {
  DEFAULT_DATABASE_SCHEMA,
  isDashboardSupportedDatabaseSchema,
  isInsForgeManagedDatabaseSchema,
} from '@insforge/shared-schemas';

export function normalizeDatabaseSchemaName(schemaName: unknown): string {
  if (typeof schemaName !== 'string' || schemaName.trim().length === 0) {
    return DEFAULT_DATABASE_SCHEMA;
  }

  const normalizedSchemaName = schemaName.trim();
  validateSchemaName(normalizedSchemaName);

  if (!isDashboardSupportedDatabaseSchema(normalizedSchemaName)) {
    throw new AppError(
      `Schema "${normalizedSchemaName}" is not supported in the dashboard.`,
      400,
      ERROR_CODES.INVALID_INPUT,
      'Only public and the built-in protected schemas are supported in the dashboard right now.'
    );
  }

  return normalizedSchemaName;
}

export function assertWritableDatabaseSchema(schemaName: string): void {
  if (isInsForgeManagedDatabaseSchema(schemaName)) {
    throw new AppError(
      `Schema "${schemaName}" is protected in the dashboard`,
      403,
      ERROR_CODES.DATABASE_FORBIDDEN,
      'Switch to public to create or modify tables and records.'
    );
  }
}

export function buildQualifiedTableKey(tableName: string, schemaName: string): string {
  return `${schemaName}.${tableName}`;
}

export function quoteIdentifier(identifier: string): string {
  validateIdentifier(identifier);
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteQualifiedName(schemaName: string, objectName: string): string {
  validateSchemaName(schemaName);
  validateIdentifier(objectName);
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`;
}

export function splitQualifiedTableReference(
  tableReference: string,
  defaultSchemaName: string = DEFAULT_DATABASE_SCHEMA
): { schemaName: string; tableName: string } {
  const parts = tableReference.split('.');

  if (parts.length === 1) {
    validateTableName(parts[0]);
    return {
      schemaName: defaultSchemaName,
      tableName: parts[0],
    };
  }

  if (parts.length !== 2) {
    throw new AppError(
      `Invalid table reference "${tableReference}"`,
      400,
      ERROR_CODES.INVALID_INPUT,
      'Use either "table" or "schema.table" when referencing a table.'
    );
  }

  const [schemaName, tableName] = parts;
  validateSchemaName(schemaName);
  validateTableName(tableName);

  return {
    schemaName,
    tableName,
  };
}
