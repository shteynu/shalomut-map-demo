import { Organization } from '../../types/backend';
import { IOrganizationRepository } from '../interfaces';
import { MinimalPrismaClient } from './prisma-client';

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
    return {
      id: created.id,
      name: created.name,
      city: created.city,
      schoolType: created.schoolType,
      totalStaffCount: created.totalStaffCount,
      createdAt: new Date(created.createdAt),
    };
  }

  public async findById(id: string): Promise<Organization | null> {
    const found = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!found) return null;
    return {
      id: found.id,
      name: found.name,
      city: found.city,
      schoolType: found.schoolType,
      totalStaffCount: found.totalStaffCount,
      createdAt: new Date(found.createdAt),
    };
  }

  public async findAll(): Promise<Organization[]> {
    const list = await this.prisma.organization.findMany({});
    return list.map((item) => ({
      id: item.id,
      name: item.name,
      city: item.city,
      schoolType: item.schoolType,
      totalStaffCount: item.totalStaffCount,
      createdAt: new Date(item.createdAt),
    }));
  }
}
