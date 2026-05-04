export const databaseTableQueryKeys = {
  listRoot: ['database', 'tables', 'list'] as const,
  list: (schemaName: string) => ['database', 'tables', 'list', schemaName] as const,
  schemaRoot: ['database', 'tables', 'schema'] as const,
  schema: (schemaName: string, tableName: string) =>
    ['database', 'tables', 'schema', schemaName, tableName] as const,
};

export const databaseSchemaQueryKeys = {
  list: ['database', 'schemas'] as const,
};
