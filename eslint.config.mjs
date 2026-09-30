import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This flags the ordinary "fetch on mount, setState when it
      // resolves" pattern used throughout (Dashboard, ManageTasks,
      // LiveClock) as a cascading-render risk. For data that must not
      // render during SSR (live clocks, per-tab lock checks, anything
      // fetched from an API), starting from null/undefined and filling it
      // in from an effect is the correct, standard fix for hydration
      // mismatches — not a performance bug to restructure away.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**"]),
]);
