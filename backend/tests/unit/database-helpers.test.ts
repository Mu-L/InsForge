import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/api/middlewares/error';
import {
  assertWritableDatabaseSchema,
  buildQualifiedTableKey,
  normalizeDatabaseSchemaName,
  quoteQualifiedName,
  splitQualifiedTableReference,
} from '../../src/services/database/helpers';

describe('database helpers', () => {
  it('defaults missing schema names to public', () => {
    expect(normalizeDatabaseSchemaName(undefined)).toBe('public');
    expect(normalizeDatabaseSchemaName('   ')).toBe('public');
  });

  it('preserves explicit supported schema names', () => {
    expect(normalizeDatabaseSchemaName('auth')).toBe('auth');
  });

  it('rejects unsupported custom schema names for dashboard routes', () => {
    expect(() => normalizeDatabaseSchemaName('analytics')).toThrow(AppError);
  });

  it('splits qualified table references and falls back to public for bare names', () => {
    expect(splitQualifiedTableReference('orders')).toEqual({
      schemaName: 'public',
      tableName: 'orders',
    });

    expect(splitQualifiedTableReference('analytics.orders')).toEqual({
      schemaName: 'analytics',
      tableName: 'orders',
    });
  });

  it('rejects malformed qualified table references', () => {
    expect(() => splitQualifiedTableReference('too.many.parts')).toThrow(AppError);
  });

  it('marks insforge managed schemas as read only', () => {
    expect(() => assertWritableDatabaseSchema('auth')).toThrow(AppError);
    expect(() => assertWritableDatabaseSchema('public')).not.toThrow();
  });

  it('formats qualified names and cache keys consistently', () => {
    expect(quoteQualifiedName('analytics', 'orders')).toBe('"analytics"."orders"');
    expect(buildQualifiedTableKey('orders', 'analytics')).toBe('analytics.orders');
  });
});
