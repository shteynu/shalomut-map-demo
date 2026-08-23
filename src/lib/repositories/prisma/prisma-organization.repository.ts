import { Organization, UpdateOrganizationInput } from '../../types/backend';
import type {
  IOrganizationRepository,
  OrganizationPage,
  OrganizationPageQuery,
} from '../interfaces';
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

/**
 * A substring the database will read as a substring.
 *
 * Prisma's `contains` compiles to `ILIKE '%value%'` and does not escape the
 * pattern characters inside `value`. Left alone, an administrator typing `%`
 * into the search box matches every school and one typing `_` matches every
 * school whose name is one character longer than they expected — a search that
 * answers a different question than the one asked.
 *
 * This is the same reading of `ILIKE` that ADR-044 turned out to be a way past
 * the share code. Here it is not a way past anything — the caller is already a
 * platform administrator and every school is theirs to see — which is exactly
 * why it would have gone unnoticed as a wrong answer rather than a breach.
 */
function asLiteralSubstring(search: string): string {
  return search.replace(/[\\%_]/g, (character) => `\\${character}`);
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

  public async findPage(query: OrganizationPageQuery): Promise<OrganizationPage> {
    const search = query.search?.trim();
    const where = search
      ? {
          OR: [
            { name: { contains: asLiteralSubstring(search), mode: 'insensitive' } },
            { city: { contains: asLiteralSubstring(search), mode: 'insensitive' } },
          ],
        }
      : {};

    // The page and its total, together. Two queries rather than one, because
    // "how many schools match" is not answerable from a page of twenty.
    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        // `findAll`'s order, plus a tiebreak. Two schools created in the same
        // millisecond — which the seed does — would otherwise be free to swap
        // places between two page reads, and a school that swapped across a
        // page boundary would be shown twice or not at all.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { organizations: rows.map(toDomain), total };
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
