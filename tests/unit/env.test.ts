import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@host.pooler.supabase.com:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://u:p@host.pooler.supabase.com:5432/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_xxxxxxxxxxxxxxxxxxxxxx",
};

describe("parseServerEnv", () => {
  it("acepta variables válidas", () => {
    expect(parseServerEnv(valid).DATABASE_URL).toContain(":6543/");
  });

  it("lista las variables faltantes en el error", () => {
    expect(() => parseServerEnv({ ...valid, DIRECT_URL: undefined })).toThrow(/DIRECT_URL/);
  });

  it("rechaza URLs de base de datos que no son Postgres", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "https://example.com" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("no expone valores en el mensaje de error", () => {
    let message = "";
    try {
      parseServerEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: "valor-secreto" });
    } catch (e) {
      message = String(e);
    }
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(message).not.toContain("valor-secreto");
  });
});
