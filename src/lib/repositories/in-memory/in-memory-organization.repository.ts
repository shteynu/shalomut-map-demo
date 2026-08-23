import { Organization, UpdateOrganizationInput } from '../../types/backend';
import { IOrganizationRepository } from '../interfaces';

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

  constructor(initialOrgs: Organization[] = []) {
    for (const org of initialOrgs) {
      this.organizations.set(org.id, { ...org });
    }
  }

  public async create(org: Organization): Promise<Organization> {
    const copy = { ...org };
    this.organizations.set(copy.id, copy);
    return copy;
  }

  public async findById(id: string): Promise<Organization | null> {
    const found = this.organizations.get(id);
    return found ? { ...found } : null;
  }

  public async findAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values()).map((o) => ({ ...o }));
  }

  public async findByIds(ids: readonly string[]): Promise<Organization[]> {
    if (ids.length === 0) return [];
    const wanted = new Set(ids);
    return Array.from(this.organizations.values())
      .filter((organization) => wanted.has(organization.id))
      .map((o) => ({ ...o }));
  }

  public async listIds(limit: number): Promise<string[]> {
    if (limit <= 0) return [];
    return Array.from(this.organizations.keys()).slice(0, limit);
  }

  public async update(
    id: string,
    input: UpdateOrganizationInput
  ): Promise<Organization | null> {
    const organization = this.organizations.get(id);
    if (!organization) return null;

    const updated = { ...organization, ...input };
    this.organizations.set(id, updated);
    return { ...updated };
  }

  public clear(): void {
    this.organizations.clear();
  }
}
