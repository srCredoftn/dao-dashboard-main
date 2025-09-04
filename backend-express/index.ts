import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { logger, requestLogger } from "./utils/logger";
import { RateLimitDebugger } from "./utils/rate-limit-debug";
import { handleDemo } from "./routes/demo";
import daoRoutes from "./routes/dao-simple";
import authRoutes from "./routes/auth";
import commentRoutes from "./routes/comments";
import taskRoutes from "./routes/tasks";
import notificationRoutes from "./routes/notifications";

export function createServer() {
  const app = express();

  // Trust proxy for rate limiting in development
  app.set("trust proxy", 1);

  // Security middleware
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Allow embedding for development
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "production" ? 100 : 1000, // More permissive in development
    message: {
      error: "Too many requests from this IP, please try again later.",
      retryAfter: "15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Auth-specific rate limiting (adaptatif selon l'environnement)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "production" ? 20 : 100, // Plus permissif en développement
    message: {
      error: "Too many authentication attempts, please try again later.",
      retryAfter: "15 minutes",
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting pour certains cas en développement
    skip: (_req) => {
      if (process.env.NODE_ENV === "development") {
        // Plus de flexibilité en dev, mais garde une protection minimale
        return false;
      }
      return false;
    },
  });

  // CORS configuration - restrictive in production
  const corsOptions: cors.CorsOptions = {
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
  app.use(cors(corsOptions));

  // Body parsing middleware with size limits
  app.use(
    express.json({
      limit: "10mb",
      verify: (_req, _res, buf, encoding) => {
        // Basic JSON structure validation
        if (buf && buf.length) {
          try {
            JSON.parse(buf.toString((encoding as BufferEncoding) || "utf8"));
          } catch (err) {
            const error = new Error("Invalid JSON");
            (error as any).status = 400;
            throw error;
          }
        }
      },
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "10mb",
    }),
  );

  // Security headers
  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    next();
  });

  // Request logging avec le nouveau système
  app.use(requestLogger());

  // Debug rate limiting en développement
  if (process.env.NODE_ENV === "development") {
    app.use(RateLimitDebugger.autoLog());
    app.get("/api/debug/rate-limits", RateLimitDebugger.getDebugRoute());
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // SMTP health endpoint
  app.get("/api/health/smtp", async (_req, res) => {
    try {
      const { verifySmtp } = await import("./utils/mailer");
      const result = await verifySmtp();
      if (!result.ok) {
        return res.status(500).json({ ok: false, error: result.message });
      }
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong - secure";
    res.json({ message: ping, timestamp: new Date().toISOString() });
  });

  app.get("/api/demo", handleDemo);

  // Apply auth rate limiting to auth routes
  app.use("/api/auth", authLimiter);

  // API routes
  app.use("/api/dao", daoRoutes);
  app.use("/api/dao", taskRoutes); // Task routes are nested under /api/dao
  app.use("/api/auth", authRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/notifications", notificationRoutes);

  // 404 handler
  app.use("*", (req, res) => {
    res.status(404).json({
      error: "Route not found",
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error(
        "Unhandled error",
        "ERROR_HANDLER",
        {
          message: err.message,
          stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
          url: req.originalUrl,
          method: req.method,
        },
        (req as any).user?.id,
        req.ip,
      );

      // Don't expose sensitive error details in production
      const isDevelopment = process.env.NODE_ENV === "development";

      res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
        ...(isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString(),
      });
    },
  );

  return app;
}
