import { Organization, UpdateOrganizationInput } from '../../types/backend';
import { IOrganizationRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

function toDomain(row: any): Organization {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    schoolType: row.schoolType,
    totalStaffCount: row.totalStaffCount,
    createdAt: new Date(row.createdAt),
  };
}

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private prisma: MinimalPrismaClient) {}

  public async create(org: Organization): Promise<Organization> {
    const created = await this.prisma.organization.create({
      data: {
        id: org.id,
        name: org.name,
        city: org.city,
        schoolType: org.schoolType,
        totalStaffCount: org.totalStaffCount,
        createdAt: org.createdAt,
      },
    });
    return toDomain(created);
  }

  public async findById(id: string): Promise<Organization | null> {
    const found = await this.prisma.organization.findUnique({
      where: { id },
    });
    return found ? toDomain(found) : null;
  }

  public async findAll(): Promise<Organization[]> {
    const list = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return list.map(toDomain);
  }

  public async findByIds(ids: readonly string[]): Promise<Organization[]> {
    // No ids, no query. `IN ()` is not a smaller question than `IN (x)` — it is
    // a different one, and a session with no memberships would otherwise pay a
    // round trip to be told what its own header already said.
    if (ids.length === 0) return [];

    const list = await this.prisma.organization.findMany({
      where: { id: { in: [...ids] } },
      orderBy: { createdAt: 'desc' },
    });
    return list.map(toDomain);
  }

  public async listIds(limit: number): Promise<string[]> {
    if (limit <= 0) return [];

    const list = await this.prisma.organization.findMany({
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return list.map((item) => item.id as string);
  }

  public async update(
    id: string,
    input: UpdateOrganizationInput
  ): Promise<Organization | null> {
    try {
      const updated = await this.prisma.organization.update({
        where: { id },
        data: input,
      });
      return toDomain(updated);
    } catch {
      return null;
    }
  }
}
