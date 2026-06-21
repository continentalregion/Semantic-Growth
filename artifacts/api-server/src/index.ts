import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDemoData } from "./lib/demoSeed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminPlans() {
  const ADMIN_EMAILS: { email: string; plan: "pro" | "premium" }[] = [
    { email: "francescoullo1@gmail.com", plan: "pro" },
  ];
  for (const { email, plan } of ADMIN_EMAILS) {
    try {
      const result = await db
        .update(users)
        .set({ plan })
        .where(eq(users.email, email))
        .returning({ id: users.id, email: users.email, plan: users.plan });
      if (result.length > 0) {
        logger.info({ email, plan }, "[seed] admin plan set");
      }
    } catch (err) {
      logger.error({ err, email }, "[seed] failed to set admin plan");
    }
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedAdminPlans();
  seedDemoData();
});
