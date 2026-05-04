import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/api/middlewares/error';

const { poolQueryMock, connectMock } = vi.hoisted(() => ({
  poolQueryMock: vi.fn(),
  connectMock: vi.fn(),
}));

vi.mock('../../src/infra/database/database.manager', () => ({
  DatabaseManager: {
    getInstance: vi.fn(() => ({
      getPool: vi.fn(() => ({
        query: poolQueryMock,
        connect: connectMock,
      })),
    })),
  },
}));

import { AdminRecordService } from '../../src/services/database/admin-record.service';

describe('AdminRecordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads protected-schema records through direct SQL with search and sorting', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [
          { column_name: 'id', data_type: 'uuid', udt_name: 'uuid' },
          { column_name: 'email', data_type: 'text', udt_name: 'text' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: '1', email: 'demo-1@example.com' },
          { id: '2', email: 'demo-2@example.com' },
        ],
      });

    const service = AdminRecordService.getInstance();
    const result = await service.listRecords('auth', 'users', {
      limit: 10,
      offset: 0,
      search: 'demo',
      sort: [{ columnName: 'email', direction: 'asc' }],
    });

    expect(result.total).toBe(2);
    expect(result.records).toHaveLength(2);

    expect(poolQueryMock.mock.calls[1]?.[0]).toContain('FROM "auth"."users"');
    expect(poolQueryMock.mock.calls[1]?.[1]).toEqual(['%demo%']);
    expect(poolQueryMock.mock.calls[2]?.[0]).toContain('ORDER BY "email" ASC LIMIT $2 OFFSET $3');
    expect(poolQueryMock.mock.calls[2]?.[1]).toEqual(['%demo%', 10, 0]);
  });

  it('blocks writes on protected schemas before opening a transaction', async () => {
    const service = AdminRecordService.getInstance();

    await expect(
      service.createRecords('auth', 'users', [{ email: 'demo@example.com' }])
    ).rejects.toBeInstanceOf(AppError);

    expect(connectMock).not.toHaveBeenCalled();
  });

  it('updates public records and strips blank uuid values from the payload', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [
          { column_name: 'id', data_type: 'uuid', udt_name: 'uuid' },
          { column_name: 'owner_id', data_type: 'uuid', udt_name: 'uuid' },
          { column_name: 'name', data_type: 'text', udt_name: 'text' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'p1', owner_id: null, name: 'Renamed project' }],
      });

    const service = AdminRecordService.getInstance();
    const record = await service.updateRecord('public', 'projects', 'id', 'p1', {
      owner_id: '',
      name: 'Renamed project',
    });

    expect(record).toEqual({ id: 'p1', owner_id: null, name: 'Renamed project' });
    expect(poolQueryMock.mock.calls[1]?.[0]).toContain(
      'SET "name" = $1 WHERE "id" = $2 RETURNING *'
    );
    expect(poolQueryMock.mock.calls[1]?.[1]).toEqual(['Renamed project', 'p1']);
  });
});
