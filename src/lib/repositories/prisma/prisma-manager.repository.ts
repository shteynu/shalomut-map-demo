import type {
  Manager,
  ManagerRole,
  MembershipStatus,
  OrganizationMembership,
} from '../../auth/types';
import type { IManagerRepository } from '../../auth/domain-contract';
import { MinimalPrismaClient } from './prisma-client';

interface ManagerRow {
  id: string;
  email: string;
  name: string;
  isPlatformAdministrator: boolean;
  createdAt: Date | string;
}

interface MembershipRow {
  id: string;
  managerId: string;
  organizationId: string;
  role: string;
  status: string;
  createdAt: Date | string;
}

function toManager(row: ManagerRow): Manager {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isPlatformAdministrator: row.isPlatformAdministrator,
    createdAt: new Date(row.createdAt),
  };
}

function toMembership(row: MembershipRow): OrganizationMembership {
  return {
    id: row.id,
    managerId: row.managerId,
    organizationId: row.organizationId,
    role: row.role as ManagerRole,
    status: row.status as MembershipStatus,
    createdAt: new Date(row.createdAt),
  };
}

/**
 * The people who may sign in, and what each of them may reach.
 *
 * There is no password to read, because there is no password column: the
 * provider establishes the address and this repository decides whether that
 * address is anybody here.
 */
export class PrismaManagerRepository implements IManagerRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  private get managers() {
    const table = this.prisma.manager;
    if (!table) {
      throw new Error(
        'The Prisma client has no `manager` model, so identity cannot be read. ' +
          'Run `prisma generate` after the migration that creates it.',
      );
    }
    return table;
  }

  private get memberships() {
    const table = this.prisma.organizationMembership;
    if (!table) {
      throw new Error(
        'The Prisma client has no `organizationMembership` model, so nothing ' +
          'can say which schools a manager reaches. Run `prisma generate`.',
      );
    }
    return table;
  }

  public async findById(id: string): Promise<Manager | null> {
    const found = await this.managers.findUnique({ where: { id } });
    return found ? toManager(found) : null;
  }

  /**
   * The address is stored lowercased, so the lookup lowercases too. A provider
   * is free to hand back `Name@school.ac.il` today and `name@school.ac.il`
   * tomorrow, and those are one person.
   */
  public async findByEmail(email: string): Promise<Manager | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;

    const found = await this.managers.findUnique({
      where: { email: normalized },
    });
    return found ? toManager(found) : null;
  }

  public async findMembershipsByManagerId(
    managerId: string,
  ): Promise<OrganizationMembership[]> {
    const rows = await this.memberships.findMany({
      where: { managerId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMembership);
  }

  public async findMembershipsByOrganizationId(
    organizationId: string,
  ): Promise<OrganizationMembership[]> {
    const rows = await this.memberships.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMembership);
  }

  public async findMembershipsByOrganizationIds(
    organizationIds: readonly string[],
  ): Promise<OrganizationMembership[]> {
    if (organizationIds.length === 0) return [];

    const rows = await this.memberships.findMany({
      where: { organizationId: { in: [...organizationIds] } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toMembership);
  }

  public async findAllManagers(): Promise<Manager[]> {
    const rows = await this.managers.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toManager);
  }

  public async saveManager(manager: Manager): Promise<Manager> {
    const email = manager.email.trim().toLowerCase();
    const data = {
      email,
      name: manager.name,
      isPlatformAdministrator: manager.isPlatformAdministrator,
    };

    const saved = await this.managers.upsert({
      where: { id: manager.id },
      create: { id: manager.id, ...data, createdAt: manager.createdAt },
      update: data,
    });
    return toManager(saved);
  }

  public async saveMembership(
    membership: OrganizationMembership,
  ): Promise<OrganizationMembership> {
    const data = {
      managerId: membership.managerId,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
    };

    const saved = await this.memberships.upsert({
      where: { id: membership.id },
      create: { id: membership.id, ...data, createdAt: membership.createdAt },
      update: data,
    });
    return toMembership(saved);
  }

  public async countPlatformAdministrators(): Promise<number> {
    return this.managers.count({ where: { isPlatformAdministrator: true } });
  }
}
