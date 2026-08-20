import type {
  IManagerRepository,
  ISessionProvider,
} from "./domain-contract";
import type {
  ManagerRole,
  ManagerSession,
  OrganizationMembership,
} from "./types";

export class MembershipService {
  public static async switchActiveOrganization(
    sessionProvider: ISessionProvider,
    session: ManagerSession,
    newOrganizationId: string,
  ): Promise<{ token: string; session: ManagerSession } | null> {
    const targetMembership = session.memberships.find(
      (m) => m.organizationId === newOrganizationId && m.status === "active",
    );

    if (!targetMembership) {
      return null;
    }

    return sessionProvider.createSession(
      {
        id: session.managerId,
        email: session.email,
        name: session.email,
        isPlatformAdministrator: session.isPlatformAdministrator,
        createdAt: session.issuedAt,
      },
      newOrganizationId,
      session.memberships,
    );
  }

  public static async addMembership(
    managerRepo: IManagerRepository,
    actingSession: ManagerSession,
    targetManagerId: string,
    organizationId: string,
    role: ManagerRole,
  ): Promise<OrganizationMembership | null> {
    // Only admin of the organization can invite or assign memberships
    if (
      actingSession.activeOrganizationId !== organizationId ||
      actingSession.role !== "admin"
    ) {
      return null;
    }

    const membership: OrganizationMembership = {
      id: `mbs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      managerId: targetManagerId,
      organizationId,
      role,
      status: "active",
      createdAt: new Date(),
    };

    return managerRepo.saveMembership(membership);
  }
}
