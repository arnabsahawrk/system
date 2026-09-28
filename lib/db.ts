import postgres from "postgres";

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

// Postgres `date` columns default to JS Date objects, which silently corrupt
// every date-key comparison in lib/rollover.ts (String(aDate) is a verbose
// "Fri Sep 26 2026 00:00:00 GMT+..." string, not "2026-09-26" — confirmed by
// actually exercising the rollover loop against a real database while
// building this). Every date-key in this app is a plain calendar day with
// no time-of-day meaning, so parsing it as a "YYYY-MM-DD" string everywhere
// removes the entire bug class instead of patching each call site.
// timestamp/timestamptz columns (oids 1114/1184) are untouched.
const types = {
  date: {
    to: 1082,
    from: [1082],
    serialize: (x: string) => x,
    parse: (x: string) => x,
  },
};

const sql =
  global.__sql ?? postgres(process.env.DATABASE_URL ?? "", { ssl: "require", max: 1, types });

global.__sql = sql;
export default sql;
