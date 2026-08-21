"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SETUP_SCHOOL_PARAM, routes } from "@/lib/navigation";

export interface AdminPerson {
  membershipId: string;
  email: string;
  name: string;
  status: "active" | "invited" | "suspended";
}

export interface AdminSchool {
  id: string;
  name: string;
  city: string;
  totalStaffCount: number;
  people: AdminPerson[];
}

/**
 * What each membership state means to the person reading the screen.
 *
 * `invited` is the one worth naming carefully: it does not mean an e-mail is in
 * flight — nothing was sent — it means the entitlement exists and nobody has
 * used it. An address that stays here is usually an address that was mistyped.
 */
const STATUS_LABEL: Record<AdminPerson["status"], string> = {
  active: "פעיל",
  invited: "הוזמן, טרם נכנס",
  suspended: "הגישה נשללה",
};

export function AdminConsole({
  schools,
  administrators,
  unattached,
}: {
  schools: AdminSchool[];
  administrators: { email: string; name: string; isSelf: boolean }[];
  unattached: { email: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(
    key: string,
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
  ) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "הפעולה נכשלה.");
        return false;
      }
      // The list is rendered on the server, so the server is what re-reads it.
      router.refresh();
      return true;
    } catch {
      setError("הפעולה נכשלה. בדקו את החיבור ונסו שוב.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-console" dir="rtl">
      {error ? (
        <p className="survey-submit-error" role="alert">
          {error}
        </p>
      ) : null}

      <NewSchoolForm
        busy={busy === "school"}
        onSubmit={(body) => send("school", "/api/admin/schools", "POST", body)}
      />

      <section className="admin-section">
        <h2>בתי ספר</h2>
        {schools.length === 0 ? (
          <p className="admin-empty">
            עדיין אין בתי ספר. הוסיפו את הראשון למעלה, ואז הזמינו אליו משתמש.
          </p>
        ) : null}

        {schools.map((school) => (
          <article key={school.id} className="admin-school">
            <header className="admin-school-header">
              <div>
                <h3>{school.name}</h3>
                <p>
                  {school.city} · {school.totalStaffCount} אנשי צוות
                </p>
              </div>
              <a
                className="secondary-button"
                href={`${routes.setup}?${SETUP_SCHOOL_PARAM}=${encodeURIComponent(school.id)}`}
              >
                פתיחת בית הספר
              </a>
            </header>

            <ul className="admin-people">
              {school.people.length === 0 ? (
                <li className="admin-empty">אין עדיין משתמש לבית הספר הזה.</li>
              ) : null}
              {school.people.map((person) => (
                <li key={person.membershipId}>
                  <span className="admin-person-identity">
                    <strong>{person.email}</strong>
                    <span className={`admin-status admin-status-${person.status}`}>
                      {STATUS_LABEL[person.status]}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={
                      person.status === "suspended"
                        ? "secondary-button"
                        : "primary-button primary-button-danger"
                    }
                    disabled={busy === person.membershipId}
                    onClick={() =>
                      send(
                        person.membershipId,
                        `/api/admin/memberships/${person.membershipId}`,
                        "PATCH",
                        {
                          organizationId: school.id,
                          status:
                            person.status === "suspended" ? "active" : "suspended",
                        },
                      )
                    }
                  >
                    {busy === person.membershipId ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : person.status === "suspended" ? (
                      "החזרת גישה"
                    ) : (
                      "שלילת גישה"
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {school.people.some(
              (person) => person.status !== "suspended",
            ) ? null : (
              <InviteForm
                key={`invite-${school.id}`}
                label="הזמנת משתמש לבית הספר"
                busy={busy === `invite-${school.id}`}
                onSubmit={(email) =>
                  send(`invite-${school.id}`, "/api/admin/people", "POST", {
                    email,
                    organizationId: school.id,
                  })
                }
              />
            )}
          </article>
        ))}
      </section>

      <section className="admin-section">
        <h2>מנהלי פלטפורמה</h2>
        <p className="admin-note">
          מנהל פלטפורמה אינו שייך לבית ספר, ורואה את כולם. כל כניסה שלו לבית ספר
          שאינו שלו נרשמת ביומן.
        </p>
        <ul className="admin-people">
          {administrators.map((administrator) => (
            <li key={administrator.email}>
              <span className="admin-person-identity">
                <strong>{administrator.email}</strong>
                {administrator.isSelf ? (
                  <span className="admin-status admin-status-active">אתם</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <InviteForm
          label="הזמנת מנהל פלטפורמה"
          busy={busy === "administrator"}
          onSubmit={(email) =>
            send("administrator", "/api/admin/people", "POST", { email })
          }
        />
      </section>

      {unattached.length > 0 ? (
        <section className="admin-section">
          <h2>ללא בית ספר</h2>
          <p className="admin-note">
            כתובות שיש להן רשומה ואין להן לאן להיכנס — הזמנה שנשללה, או בית ספר
            שנמחק. הן אינן יכולות להתחבר.
          </p>
          <ul className="admin-people">
            {unattached.map((manager) => (
              <li key={manager.email}>
                <span className="admin-person-identity">
                  <strong>{manager.email}</strong>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function InviteForm({
  label,
  busy,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  onSubmit: (email: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");

  return (
    <form
      className="admin-invite"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!email.trim() || busy) return;
        if (await onSubmit(email.trim())) setEmail("");
      }}
    >
      <label>
        <span>{label}</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@school.ac.il"
          dir="ltr"
        />
      </label>
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          "הזמנה"
        )}
      </button>
    </form>
  );
}

function NewSchoolForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: {
    name: string;
    city: string;
    schoolType: string;
    totalStaffCount: number;
  }) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [staff, setStaff] = useState("");

  const complete =
    name.trim() && city.trim() && schoolType.trim() && Number(staff) > 0;

  return (
    <form
      className="admin-new-school"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!complete || busy) return;
        const saved = await onSubmit({
          name: name.trim(),
          city: city.trim(),
          schoolType: schoolType.trim(),
          totalStaffCount: Number(staff),
        });
        if (saved) {
          setName("");
          setCity("");
          setSchoolType("");
          setStaff("");
        }
      }}
    >
      <h2>בית ספר חדש</h2>
      <p className="admin-note">
        מספר אנשי הצוות קובע את הרצפה של סף הפרטיות בכל סבב של בית הספר, ולכן הוא
        נקבע כאן ולא על ידי בית הספר עצמו. הסבב הראשון נפתח על ידי המשתמש שיוזמן.
      </p>
      <div className="admin-new-school-grid">
        <label>
          <span>שם בית הספר</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>עיר</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <label>
          <span>סוג</span>
          <input
            value={schoolType}
            onChange={(event) => setSchoolType(event.target.value)}
            placeholder="יסודי / חטיבה / תיכון"
          />
        </label>
        <label>
          <span>מספר אנשי צוות</span>
          <input
            type="number"
            min={1}
            value={staff}
            onChange={(event) => setStaff(event.target.value)}
          />
        </label>
      </div>
      <button type="submit" className="primary-button" disabled={!complete || busy}>
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          "פתיחת בית ספר"
        )}
      </button>
    </form>
  );
}
