import type {
  Manager,
  ManagerRole,
  MembershipStatus,
  OrganizationMembership,
} from '../../auth/types';
import {
  SchoolAlreadyHasSomebodyError,
  type IManagerRepository,
} from '../../auth/domain-contract';
import { MinimalPrismaClient } from './prisma-client';

/**
 * The partial unique index a second standing membership collides with.
 *
 * Which constraint a `P2002` names depends on how the client reached the
 * database. The runtime here is adapter-backed (`@prisma/adapter-pg`), and that
 * path carries the detail under `meta.driverAdapterError.cause.constraint` and
 * leaves `meta.target` undefined; a non-adapter client reports `meta.target`
 * instead, as either the index name or the column list. All of them are read.
 *
 * The column list is checked against the index name too, because a partial
 * index on one column is indistinguishable by columns alone from the plain
 * `(organization_id)` index beside it — so an unrecognised constraint stays an
 * unhandled error rather than being answered with a reassuring refusal.
 */
const ONE_STANDING_MEMBERSHIP_INDEX =
  'organization_memberships_one_standing_per_organization';

function namesTheOneStandingMembershipIndex(candidate: unknown): boolean {
  if (typeof candidate === 'string') {
    return candidate.includes(ONE_STANDING_MEMBERSHIP_INDEX);
  }

  if (Array.isArray(candidate)) {
    return candidate.map(String).includes(ONE_STANDING_MEMBERSHIP_INDEX);
  }

  return false;
}

function violatesTheOneStandingMembershipIndex(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code !== 'P2002') return false;

  const meta = (error as { meta?: Record<string, any> }).meta;
  if (!meta) return false;

  if (namesTheOneStandingMembershipIndex(meta.target)) return true;

  const cause = meta.driverAdapterError?.cause;
  if (!cause) return false;

  return (
    namesTheOneStandingMembershipIndex(cause.originalMessage) ||
    namesTheOneStandingMembershipIndex(cause.constraint?.index) ||
    namesTheOneStandingMembershipIndex(cause.constraint?.fields)
  );
}

/**
 * The two statuses that mean a school is taken. The same pair
 * `ManagerAdministrationService.stands` uses, spelled again here because this
 * one has to reach the database as a value rather than a predicate.
 */
const STANDING_STATUSES = ['active', 'invited'] as const;

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

  public async findManagersByIds(ids: readonly string[]): Promise<Manager[]> {
    if (ids.length === 0) return [];

    const rows = await this.managers.findMany({
      where: { id: { in: [...ids] } },
    });
    return rows.map(toManager);
  }

  public async findPlatformAdministrators(limit: number): Promise<Manager[]> {
    if (limit <= 0) return [];

    const rows = await this.managers.findMany({
      where: { isPlatformAdministrator: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map(toManager);
  }

  public async findManagersWithoutStandingMembership(
    limit: number,
  ): Promise<Manager[]> {
    if (limit <= 0) return [];

    const rows = await this.managers.findMany({
      // `none` is the whole point of asking the database rather than the
      // screen: it is a `NOT EXISTS` over this person's memberships, and it
      // stays correct while the schools themselves arrive one page at a time.
      where: {
        isPlatformAdministrator: false,
        memberships: { none: { status: { in: STANDING_STATUSES } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
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

    try {
      const saved = await this.memberships.upsert({
        where: { id: membership.id },
        create: { id: membership.id, ...data, createdAt: membership.createdAt },
        update: data,
      });
      return toMembership(saved);
    } catch (error) {
      // The refusal both callers already know how to report, arriving from the
      // one place that can decide it atomically. Anything else is re-thrown:
      // answering an unrecognised constraint with "this school already has
      // somebody" would turn a real defect into a plausible message.
      if (violatesTheOneStandingMembershipIndex(error)) {
        throw new SchoolAlreadyHasSomebodyError(membership.organizationId);
      }
      throw error;
    }
  }

  public async countPlatformAdministrators(): Promise<number> {
    return this.managers.count({ where: { isPlatformAdministrator: true } });
  }
}
