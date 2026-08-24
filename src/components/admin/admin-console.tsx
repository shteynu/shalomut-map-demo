"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  DASHBOARD_ROUND_PARAM,
  SETUP_SCHOOL_PARAM,
  routes,
  schoolActivityRoute,
} from "@/lib/navigation";
import type {
  AdministrationPage,
  CurrentRoundSummary,
} from "@/lib/auth/manager-administration-service";

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
  roundCount: number;
  currentRound: CurrentRoundSummary | null;
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

/**
 * What a round's state means, said from outside the school.
 *
 * The school's own screens say the same four words; this is not a second
 * vocabulary, it is the same one reaching a reader who is not in the school.
 */
const ROUND_STATUS_LABEL: Record<CurrentRoundSummary["status"], string> = {
  draft: "טיוטה",
  active: "פתוח למענה",
  closed: "סגור",
  archived: "בארכיון",
};

/** A list the server bounded, and whether the bound cut anything off. */
export interface AdminPeopleList<T> {
  people: T[];
  truncated: boolean;
}

export function AdminConsole({
  schools,
  page,
  administrators,
  unattached,
}: {
  schools: AdminSchool[];
  page: AdministrationPage;
  administrators: AdminPeopleList<{
    email: string;
    name: string;
    isSelf: boolean;
  }>;
  unattached: AdminPeopleList<{ email: string; name: string }>;
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
        {/*
         * How many schools is a cardinality and carries no privacy question —
         * it counts schools, not people, and says nothing about any of them.
         * It is the only platform-wide figure on this screen, and the only kind
         * there will be: a total of responses or a mean of scores across
         * schools is the object the k-anonymity limit refuses.
         *
         * The number is the total of what matched, not the length of this page.
         * A heading that counted the cards would say "20" on every page of a
         * platform with two hundred schools.
         */}
        <h2>בתי ספר {page.total > 0 ? `(${page.total})` : null}</h2>

        <SchoolSearch page={page} />

        {schools.length === 0 ? (
          <p className="admin-empty">
            {page.search
              ? `אין בית ספר שתואם ל“${page.search}”.`
              : "עדיין אין בתי ספר. הוסיפו את הראשון למעלה, ואז הזמינו אליו משתמש."}
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
              <div className="admin-school-actions">
                {school.currentRound ? (
                  <a
                    className="secondary-button"
                    href={`${routes.dashboard}?${SETUP_SCHOOL_PARAM}=${encodeURIComponent(
                      school.id,
                    )}&${DASHBOARD_ROUND_PARAM}=${encodeURIComponent(
                      school.currentRound.id,
                    )}`}
                  >
                    פתיחת המפה
                  </a>
                ) : null}
                <a
                  className="secondary-button"
                  href={`${routes.setup}?${SETUP_SCHOOL_PARAM}=${encodeURIComponent(school.id)}`}
                >
                  פתיחת בית הספר
                </a>
                {/* Reading the log is itself a visit to the school, recorded
                    like every other one — which is why this link goes through
                    the same `?school=` door as the two beside it rather than to
                    a page inside the administrator area. */}
                <a className="secondary-button" href={schoolActivityRoute(school.id)}>
                  יומן פעולות
                </a>
              </div>
            </header>

            <SchoolActivity school={school} />

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

        <SchoolPager page={page} />
      </section>

      <section className="admin-section">
        <h2>מנהלי פלטפורמה</h2>
        <p className="admin-note">
          מנהל פלטפורמה אינו שייך לבית ספר, ורואה את כולם. כל כניסה שלו לבית ספר
          שאינו שלו נרשמת ביומן.
        </p>
        <ul className="admin-people">
          {administrators.people.map((administrator) => (
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
        <TruncationNote truncated={administrators.truncated} />
        <InviteForm
          label="הזמנת מנהל פלטפורמה"
          busy={busy === "administrator"}
          onSubmit={(email) =>
            send("administrator", "/api/admin/people", "POST", { email })
          }
        />
      </section>

      {unattached.people.length > 0 ? (
        <section className="admin-section">
          <h2>ללא בית ספר</h2>
          <p className="admin-note">
            כתובות שיש להן רשומה ואין להן לאן להיכנס — הזמנה שנשללה, או בית ספר
            שנמחק. הן אינן יכולות להתחבר.
          </p>
          <ul className="admin-people">
            {unattached.people.map((manager) => (
              <li key={manager.email}>
                <span className="admin-person-identity">
                  <strong>{manager.email}</strong>
                </span>
              </li>
            ))}
          </ul>
          <TruncationNote truncated={unattached.truncated} />
        </section>
      ) : null}
    </div>
  );
}

/**
 * The search box, and it is a plain `GET` form on purpose.
 *
 * Submitting it replaces the query string with this one field, which drops
 * `page` — so a new search always starts at the first page instead of landing
 * on page four of a shorter list. It also means the search works with the
 * form's own navigation rather than through `router.push`, which is the same
 * reason the list itself is rendered on the server: what is being searched is
 * the database, not an array in this component.
 */
function SchoolSearch({ page }: { page: AdministrationPage }) {
  return (
    <form className="admin-search" method="get" role="search">
      <label>
        <span>חיפוש בית ספר</span>
        <input
          type="search"
          name="q"
          defaultValue={page.search}
          placeholder="שם או עיר"
        />
      </label>
      <button type="submit" className="secondary-button">
        חיפוש
      </button>
      {page.search ? (
        <a className="admin-search-clear" href="?">
          ניקוי
        </a>
      ) : null}
    </form>
  );
}

/** Where this page sits, and the two links out of it. */
function SchoolPager({ page }: { page: AdministrationPage }) {
  if (page.pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (page.search) params.set("q", page.search);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `?${query}` : "?";
  };

  return (
    <nav className="admin-pager" aria-label="דפדוף בין בתי ספר">
      {page.page > 1 ? (
        <a className="secondary-button" href={href(page.page - 1)}>
          הקודם
        </a>
      ) : (
        <span className="admin-pager-edge" aria-hidden="true" />
      )}
      <span className="admin-note">
        עמוד {page.page} מתוך {page.pageCount}
      </span>
      {page.page < page.pageCount ? (
        <a className="secondary-button" href={href(page.page + 1)}>
          הבא
        </a>
      ) : (
        <span className="admin-pager-edge" aria-hidden="true" />
      )}
    </nav>
  );
}

/**
 * What a bounded list says when it was cut short.
 *
 * Neither people list is paged, so this is the whole of the honesty about it:
 * a screen that silently showed the first fifty would read as a platform with
 * fifty of them.
 */
function TruncationNote({ truncated }: { truncated: boolean }) {
  if (!truncated) return null;

  return (
    <p className="admin-note">
      הרשימה נחתכה. מוצגים הראשונים בלבד — אם יש כאן יותר מכמה עשרות, זה סימן
      שמשהו דורש טיפול ולא שצריך עמוד נוסף.
    </p>
  );
}

/**
 * Whether anything is happening in this school, and nothing about what.
 *
 * The response count is here and no score ever will be. An administrator may
 * open each school's own map — the same suppressed view its own user sees — and
 * that is a different thing from a list of schools carrying a number each,
 * which is the beginning of a figure computed across them. The plan names this
 * as the one limit of phase 4 that had to be designed in rather than checked
 * afterwards, so it is stated here, next to the only numbers that could break
 * it.
 *
 * A locked round says the count and the threshold rather than hiding both: how
 * many people answered is what an administrator needs in order to help, and it
 * is exactly what the school's own user is already told.
 */
function SchoolActivity({ school }: { school: AdminSchool }) {
  if (!school.currentRound) {
    return (
      <p className="admin-school-activity admin-empty">
        בית הספר טרם פתח סבב אבחון.
      </p>
    );
  }

  const { currentRound: round, roundCount } = school;

  return (
    <div className="admin-school-activity">
      <p>
        <strong>{round.title}</strong>
        <span className={`admin-round-status admin-round-status-${round.status}`}>
          {ROUND_STATUS_LABEL[round.status]}
        </span>
      </p>
      {/*
       * Two sentences rather than one with a branch in it. A round that has
       * passed its threshold has no "out of" left to state — `21 מתוך 10`
       * reads as twenty-one out of a required ten, which is the sort of
       * sentence that makes a reader distrust the number beside it.
       */}
      <p className="admin-note">
        {round.isUnlocked
          ? `${round.responseCount} תשובות · התוצאות פתוחות`
          : `${round.responseCount} מתוך ${round.privacyThreshold} תשובות שנדרשות לפתיחת התוצאות`}
        {roundCount > 1 ? ` · ${roundCount} סבבים בסך הכול` : null}
      </p>
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
