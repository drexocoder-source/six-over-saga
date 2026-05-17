import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import postgrestRouter from "./routes/postgrest";
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
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Standard API routes at /api
app.use("/api", router);

// PostgREST-compatible routes (Supabase JS client uses these paths)
app.use("/rest", postgrestRouter);
app.use("/auth", postgrestRouter);
app.use("/functions", postgrestRouter);

export default app;
