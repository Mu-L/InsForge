import { DatabaseManager } from '@/infra/database/database.manager.js';
import type {
  DatabaseFunctionsResponse,
  DatabaseSchemasResponse,
  DatabaseIndexesResponse,
  DatabasePoliciesResponse,
  DatabaseTriggersResponse,
} from '@insforge/shared-schemas';
import {
  DASHBOARD_SUPPORTED_DATABASE_SCHEMAS,
  DEFAULT_DATABASE_SCHEMA,
  INSFORGE_MANAGED_DATABASE_SCHEMAS,
  isInsForgeManagedDatabaseSchema,
} from '@insforge/shared-schemas';

export class DatabaseService {
  private static instance: DatabaseService;
  private dbManager = DatabaseManager.getInstance();

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * List only the schemas currently supported by the dashboard: public plus
   * InsForge-managed protected schemas.
   */
  async getSchemas(): Promise<DatabaseSchemasResponse> {
    const pool = this.dbManager.getPool();

    const result = await pool.query(
      `
        WITH supported_schemas AS (
          SELECT name, ordinality
          FROM unnest($1::text[]) WITH ORDINALITY AS supported(name, ordinality)
        )
        SELECT
          supported.name,
          (supported.name = ANY($2::text[])) AS "isProtected"
        FROM supported_schemas supported
        JOIN pg_namespace n ON n.nspname = supported.name
        ORDER BY supported.ordinality
      `,
      [DASHBOARD_SUPPORTED_DATABASE_SCHEMAS, INSFORGE_MANAGED_DATABASE_SCHEMAS]
    );

    return {
      schemas: result.rows.map((row: { name: string; isProtected: boolean }) => ({
        name: row.name,
        isProtected:
          row.name !== DEFAULT_DATABASE_SCHEMA &&
          (row.isProtected || isInsForgeManagedDatabaseSchema(row.name)),
      })),
    };
  }

  /**
   * Get all database functions (excluding system and extension functions)
   */
  async getFunctions(schemaName: string): Promise<DatabaseFunctionsResponse> {
    const pool = this.dbManager.getPool();

    const result = await pool.query(
      `
        SELECT
          p.proname as "functionName",
          pg_get_functiondef(p.oid) as "functionDef",
          p.prokind as "kind"
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = $1
          AND p.prokind IN ('f', 'p', 'w')
          AND NOT EXISTS (
            SELECT 1 FROM pg_depend d
            JOIN pg_extension e ON d.refobjid = e.oid
            WHERE d.objid = p.oid
          )
        ORDER BY p.proname
      `,
      [schemaName]
    );

    return {
      functions: result.rows,
    };
  }

  /**
   * Get all indexes across all tables (excluding system tables)
   */
  async getIndexes(schemaName: string): Promise<DatabaseIndexesResponse> {
    const pool = this.dbManager.getPool();

    const result = await pool.query(
      `
        SELECT
          pi.tablename as "tableName",
          pi.indexname as "indexName",
          pi.indexdef as "indexDef",
          idx.indisunique as "isUnique",
          idx.indisprimary as "isPrimary"
        FROM pg_indexes pi
        JOIN pg_class cls ON cls.relname = pi.indexname
          AND cls.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = pi.schemaname)
        JOIN pg_index idx ON idx.indexrelid = cls.oid
        WHERE pi.schemaname = $1
          AND pi.tablename NOT LIKE '\\_%' ESCAPE '\\'
        ORDER BY pi.tablename, pi.indexname
      `,
      [schemaName]
    );

    return {
      indexes: result.rows,
    };
  }

  /**
   * Get all RLS policies across all tables (excluding system tables)
   */
  async getPolicies(schemaName: string): Promise<DatabasePoliciesResponse> {
    const pool = this.dbManager.getPool();

    const result = await pool.query(
      `
        SELECT
          tablename as "tableName",
          policyname as "policyName",
          cmd,
          roles,
          qual,
          with_check as "withCheck"
        FROM pg_policies
        WHERE schemaname = $1
          AND tablename NOT LIKE '\\_%' ESCAPE '\\'
        ORDER BY tablename, policyname
      `,
      [schemaName]
    );

    return {
      policies: result.rows,
    };
  }

  /**
   * Get all triggers across all tables (excluding system tables)
   */
  async getTriggers(schemaName: string): Promise<DatabaseTriggersResponse> {
    const pool = this.dbManager.getPool();

    const result = await pool.query(
      `
        SELECT
          event_object_table as "tableName",
          trigger_name as "triggerName",
          action_timing as "actionTiming",
          event_manipulation as "eventManipulation",
          action_orientation as "actionOrientation",
          action_condition as "actionCondition",
          action_statement as "actionStatement"
        FROM information_schema.triggers
        WHERE event_object_schema = $1
          AND event_object_table NOT LIKE '\\_%' ESCAPE '\\'
        ORDER BY event_object_table, trigger_name
      `,
      [schemaName]
    );

    return {
      triggers: result.rows,
    };
  }
}
