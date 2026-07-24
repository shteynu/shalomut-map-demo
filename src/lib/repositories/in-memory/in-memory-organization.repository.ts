import { Organization } from '../../types/backend';
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

  public clear(): void {
    this.organizations.clear();
  }
}
