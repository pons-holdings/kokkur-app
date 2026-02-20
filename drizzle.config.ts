import type { Config } from "drizzle-kit";

const isTurso = !!process.env.TURSO_DATABASE_URL;

export default (isTurso
  ? {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "turso",
      dbCredentials: {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      },
    }
  : {
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: {
        url: "file:kokkur.db",
      },
    }) satisfies Config;
