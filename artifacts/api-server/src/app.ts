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

// Disable ETags — API responses (especially /users/me) must always return
// fresh data. ETags cause 304 Not Modified when the score changes slightly,
// which makes customFetch return null and React Query lose the profile.
app.set("etag", false);

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

// Guard: intercept Clerk handshake 307 redirects for /api/* routes.
// The handshake is designed for browser/cookie auth flows; native mobile clients
// use Bearer tokens and cannot handle redirects. If clerkMiddleware tries to send
// a 307 (handshake redirect to Clerk FAPI), we intercept it and return 401 JSON
// so the mobile app gets a clean "Unauthorized" instead of following the redirect
// and receiving Clerk's raw {"status":"needs_client_trust"} response.
app.use(/^\/api\/(?!__clerk)/, (_req, res, next) => {
  const originalEnd = res.end.bind(res) as typeof res.end;
  (res.end as unknown) = function (
    this: typeof res,
    chunk?: unknown,
    encodingOrCb?: unknown,
    cb?: unknown,
  ) {
    if (res.statusCode === 307) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.removeHeader("location");
      return originalEnd.call(
        this,
        JSON.stringify({ error: "Unauthorized" }),
        "utf8" as BufferEncoding,
        cb as (() => void) | undefined,
      );
    }
    return originalEnd.call(
      this,
      chunk,
      encodingOrCb as BufferEncoding | (() => void) | undefined,
      cb as (() => void) | undefined,
    );
  };
  next();
});

// Canonical clerkMiddleware — resolves publishable key from the request host
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Auth diagnostics middleware — logs auth state after clerkMiddleware
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api/__clerk") && !req.url.startsWith("/api/healthz")) {
    const auth = getAuth(req);
    const token = req.headers.authorization;
    let bearerInfo: Record<string, unknown> | null = null;
    if (token?.startsWith("Bearer ")) {
      const jwt = token.slice(7);
      try {
        const parts = jwt.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
          bearerInfo = { iss: payload.iss, sub: payload.sub, exp: payload.exp, expired: payload.exp < Date.now() / 1000 };
        }
      } catch {}
    }
    if (!auth?.userId) {
      logger.warn({ url: req.url, bearerInfo, hasBearer: !!token, hasCookie: !!req.headers.cookie }, "clerkMiddleware: no userId");
    }
  }
  next();
});

// Decode a JWT without verifying — returns header+payload claims
function decodeJwtUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decode = (s: string) =>
      JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return { header: decode(parts[0]), payload: decode(parts[1]) };
  } catch {
    return null;
  }
}

// Temporary debug endpoint — logs auth state to diagnose production 401s
app.get("/api/debug-auth", (req, res) => {
  const auth = getAuth(req);
  const host = getClerkProxyHost(req);
  const pubKey = publishableKeyFromHost(host ?? "", process.env.CLERK_PUBLISHABLE_KEY);
  const cookieHeader = req.headers["cookie"] ?? "";
  const authHeader = req.headers["authorization"] ?? "(none)";

  // Parse all cookies into a map
  const cookieMap: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookieMap[k.trim()] = v.join("=");
  }

  // Decode ALL session cookies
  const sessionCookies: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cookieMap)) {
    if (k.startsWith("__session")) {
      sessionCookies[k] = v ? decodeJwtUnsafe(v) ?? `(not a jwt, len=${v.length})` : "(empty)";
    }
  }

  // Decode bearer token if present
  let bearerDecoded: Record<string, unknown> | null = null;
  if (authHeader.startsWith("Bearer ")) {
    bearerDecoded = decodeJwtUnsafe(authHeader.slice(7));
  }

  const result = {
    userId: auth?.userId ?? null,
    sessionId: auth?.sessionId ?? null,
    host,
    resolvedPubKeyPrefix: pubKey?.slice(0, 15),
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
    secretKeyPrefix: process.env.CLERK_SECRET_KEY?.slice(0, 10),
    cookieNames: Object.keys(cookieMap),
    sessionCookies,
    bearerDecoded,
    nodeEnv: process.env.NODE_ENV,
    fullPubKey: pubKey,
  };
  logger.info({ debugAuth: true, ...result }, "debug-auth");
  res.json(result);
});

app.use("/api", router);

export default app;
