import { DatabaseInit } from '../src/database/database.init';
import { RecentLearningActivityService } from '../src/database/recent-learning-activity.service';

function repository(overrides: Record<string, jest.Mock> = {}) {
  return {
    count: jest.fn().mockResolvedValue(0),
    countBy: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn().mockResolvedValue(null),
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createInit(repositories: {
  roleRepository?: ReturnType<typeof repository>;
  permissionRepository?: ReturnType<typeof repository>;
  rolePermissionRepository?: ReturnType<typeof repository>;
  userRepository?: ReturnType<typeof repository>;
} = {}) {
  return new DatabaseInit(
    (repositories.roleRepository ?? repository()) as never,
    (repositories.permissionRepository ?? repository()) as never,
    (repositories.rolePermissionRepository ?? repository()) as never,
    (repositories.userRepository ?? repository()) as never,
  );
}

function createRecentActivity(repositories: {
  courseRepository?: ReturnType<typeof repository>;
  studentRepository?: ReturnType<typeof repository>;
  learningRecordRepository?: ReturnType<typeof repository>;
} = {}) {
  return new RecentLearningActivityService(
    (repositories.courseRepository ?? repository({ find: jest.fn().mockResolvedValue([]) })) as never,
    (repositories.studentRepository ?? repository({ find: jest.fn().mockResolvedValue([]) })) as never,
    (repositories.learningRecordRepository ?? repository()) as never,
  );
}

describe('DatabaseInit', () => {
  it('seeds system defaults only when the related tables are empty', async () => {
    const roleRepository = repository();
    const permissionRepository = repository();
    const rolePermissionRepository = repository();
    const userRepository = repository();

    const init = createInit({
      roleRepository,
      permissionRepository,
      rolePermissionRepository,
      userRepository,
    });

    await init.onModuleInit();

    expect(roleRepository.save).toHaveBeenCalled();
    expect(permissionRepository.save).toHaveBeenCalled();
    expect(rolePermissionRepository.insert).toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('does not seed business demo data from system default initialization', async () => {
    const roleRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });
    const permissionRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });
    const rolePermissionRepository = repository({ countBy: jest.fn().mockResolvedValue(1) });
    const userRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });

    const init = createInit({ roleRepository, permissionRepository, rolePermissionRepository, userRepository });

    await init.onModuleInit();

    expect(roleRepository.insert).not.toHaveBeenCalled();
    expect(permissionRepository.insert).not.toHaveBeenCalled();
    expect(userRepository.insert).not.toHaveBeenCalled();
  });

  it('fills missing system defaults without overwriting existing records', async () => {
    const roleRepository = repository({
      findOneBy: jest.fn()
        .mockResolvedValueOnce({ code: 'admin' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ code: 'student' }),
    });
    const permissionRepository = repository({
      findOneBy: jest.fn()
        .mockResolvedValueOnce({ code: 'dashboard:view' })
        .mockResolvedValue(null),
    });
    const rolePermissionRepository = repository({
      countBy: jest.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1),
    });
    const userRepository = repository({
      findOneBy: jest.fn()
        .mockResolvedValueOnce({ username: 'admin' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ username: 'student' }),
    });

    const init = createInit({ roleRepository, permissionRepository, rolePermissionRepository, userRepository });

    await init.onModuleInit();

    expect(roleRepository.save).toHaveBeenCalledTimes(1);
    expect(roleRepository.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'teacher' }));
    expect(permissionRepository.save).toHaveBeenCalled();
    expect(rolePermissionRepository.insert).toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ username: 'teacher' }));
  });

  it('does not restore manually removed permissions when a role already has mappings', async () => {
    const rolePermissionRepository = repository({
      countBy: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue(undefined),
    });

    const init = createInit({
      roleRepository: repository({ findOneBy: jest.fn().mockResolvedValue({}) }),
      permissionRepository: repository({ findOneBy: jest.fn().mockResolvedValue({}) }),
      rolePermissionRepository,
      userRepository: repository({ findOneBy: jest.fn().mockResolvedValue({}) }),
    });

    await init.onModuleInit();

    expect(rolePermissionRepository.insert).not.toHaveBeenCalled();
  });

  it('ignores duplicate-key races while filling system defaults', async () => {
    const duplicateKeyError = { code: 'ER_DUP_ENTRY' };
    const roleRepository = repository({
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockRejectedValue(duplicateKeyError),
    });
    const permissionRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });
    const rolePermissionRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });
    const userRepository = repository({ findOneBy: jest.fn().mockResolvedValue({}) });

    const init = createInit({ roleRepository, permissionRepository, rolePermissionRepository, userRepository });

    await expect(init.onModuleInit()).resolves.toBeUndefined();
  });

  it('fills recent learning activity once per missing date', async () => {
    const courseRepository = repository({ find: jest.fn().mockResolvedValue([{ id: 10 }]) });
    const studentRepository = repository({ find: jest.fn().mockResolvedValue([{ id: 20 }]) });
    const learningRecordRepository = repository({
      countBy: jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1),
      insert: jest.fn().mockResolvedValue(undefined),
    });

    const init = createRecentActivity({
      courseRepository,
      studentRepository,
      learningRecordRepository,
    });

    await init.onModuleInit();
    init.onModuleDestroy();

    expect(learningRecordRepository.countBy).toHaveBeenCalledTimes(7);
    expect(learningRecordRepository.insert).toHaveBeenCalledTimes(6);
  });

  it('uses local dates when filling recent learning activity', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-31T00:30:00+08:00'));

    const learningRecordRepository = repository({
      countBy: jest.fn().mockResolvedValue(1),
    });
    const init = createRecentActivity({
      courseRepository: repository({ find: jest.fn().mockResolvedValue([{ id: 10 }]) }),
      studentRepository: repository({ find: jest.fn().mockResolvedValue([{ id: 20 }]) }),
      learningRecordRepository,
    });

    await init.onModuleInit();
    init.onModuleDestroy();

    expect(learningRecordRepository.countBy).toHaveBeenLastCalledWith({ date: '2026-08-31' });
    jest.useRealTimers();
  });
});
