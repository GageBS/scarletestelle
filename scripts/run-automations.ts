// npm run automations:run — the daily sweep for time-based automations (also at /api/cron/automations).
import { runTimedAutomations } from "../src/lib/automations";
runTimedAutomations().then(
  (r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
