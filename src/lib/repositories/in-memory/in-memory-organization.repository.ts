import { Organization, UpdateOrganizationInput } from '../../types/backend';
import type {
  IOrganizationRepository,
  OrganizationPage,
  OrganizationPageQuery,
} from '../interfaces';

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

  /**
   * The same page the durable store returns, ordering and matching included.
   *
   * `findAll` above hands back insertion order because nothing depends on it;
   * this one cannot, because a pager that reorders between two page reads shows
   * a school twice or not at all. The match is a plain case-insensitive
   * substring, which is what `ILIKE` does once the pattern characters in the
   * search term are escaped rather than obeyed.
   */
  public async findPage(query: OrganizationPageQuery): Promise<OrganizationPage> {
    const search = query.search?.trim().toLocaleLowerCase();
    const matching = Array.from(this.organizations.values())
      .filter(
        (organization) =>
          !search ||
          organization.name.toLocaleLowerCase().includes(search) ||
          organization.city.toLocaleLowerCase().includes(search),
      )
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );

    return {
      organizations: matching
        .slice(query.skip, query.skip + query.take)
        .map((organization) => ({ ...organization })),
      total: matching.length,
    };
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
