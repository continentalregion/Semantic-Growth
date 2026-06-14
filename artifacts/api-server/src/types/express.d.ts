declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId?: string | null;
        sessionId?: string | null;
        orgId?: string | null;
        getToken: () => Promise<string | null>;
        [key: string]: unknown;
      };
    }
  }
}

export {};
