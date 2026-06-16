import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Temporary debug endpoint — logs auth state to diagnose production 401s
app.get("/api/debug-auth", (req, res) => {
  const auth = getAuth(req);
  const host = getClerkProxyHost(req);
  const pubKey = publishableKeyFromHost(host ?? "", process.env.CLERK_PUBLISHABLE_KEY);
  const cookies = req.headers["cookie"] ?? "(none)";
  const authHeader = req.headers["authorization"] ?? "(none)";
  logger.info({
    debugAuth: true,
    host,
    resolvedPubKey: pubKey?.slice(0, 20) + "...",
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
    secretKeyPrefix: process.env.CLERK_SECRET_KEY?.slice(0, 10),
    authUserId: auth?.userId,
    authSessionId: auth?.sessionId,
    cookiePresent: cookies !== "(none)",
    authHeaderPresent: authHeader !== "(none)",
    nodeEnv: process.env.NODE_ENV,
  }, "debug-auth");
  res.json({
    userId: auth?.userId ?? null,
    sessionId: auth?.sessionId ?? null,
    host,
    resolvedPubKeyPrefix: pubKey?.slice(0, 15),
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
    secretKeyPrefix: process.env.CLERK_SECRET_KEY?.slice(0, 10),
    cookieNames: cookies === "(none)" ? [] : cookies.split(";").map(c => c.trim().split("=")[0]),
    authHeaderPresent: authHeader !== "(none)",
    nodeEnv: process.env.NODE_ENV,
  });
});

app.use("/api", router);

export default app;
