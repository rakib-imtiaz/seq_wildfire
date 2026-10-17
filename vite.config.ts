import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { summary, validate } from "./api/_lib/proposal.js";

const log = (globalThis as unknown as { console: { info: (...a: unknown[]) => void } }).console;

/**
 * Import maps must come before any module script or modulepreload. Vite prepends its client and the React
 * refresh preamble in dev (and module preloads in build), so move the map to the top of <head> last.
 */
function hoistImportMap(): Plugin {
  return {
    name: "sequoia:hoist-importmap",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const m = html.match(/<script type="importmap">[\s\S]*?<\/script>/);
        if (!m) return html;
        return html.replace(m[0], "").replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${m[0]}`);
      },
    },
  };
}

/** Dev only: POST /api/proposal validates with the production schema and logs. It never sends email. */
function proposalDevApi(): Plugin {
  return {
    name: "sequoia:proposal-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/proposal", (rawReq, res) => {
        // @types/node is not installed; describe the bits of IncomingMessage used here
        const req = rawReq as unknown as {
          method?: string;
          socket?: { remoteAddress?: string };
          setEncoding(e: string): void;
          on(ev: "data" | "end", cb: (chunk: string) => void): void;
          destroy(): void;
        };
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(body));
        };
        if (req.method !== "POST") return send(405, { ok: false, error: "method_not_allowed" });
        let raw = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          raw += chunk;
          if (raw.length > 64_000) req.destroy();
        });
        req.on("end", () => {
          const v = validate(raw, String(req.socket?.remoteAddress ?? "dev"));
          if (v.kind === "error") {
            log.info("[proposal:dev] rejected", v.result.status, v.result.body);
            return send(v.result.status, v.result.body);
          }
          if (v.kind === "bot") {
            log.info("[proposal:dev] honeypot tripped, dropped");
            return send(200, { ok: true });
          }
          log.info(`[proposal:dev] received (validated and logged; dev never emails)\n${summary(v.data)}\n`);
          send(200, { ok: true });
        });
      });
    },
  };
}

/**
 * Dev only: POST /__still { name, dataUrl, dir } writes a rendered still from the command table. dir "media"
 * (default) → public/media/table/<name> (the site's lite and poster stills); dir "review" → review/table/<name>
 * (QA captures, gitignored). Names are restricted to [a-z0-9._-]; only image or JSON data URLs are accepted.
 */
function tableStillsDevApi(): Plugin {
  return {
    name: "sequoia:table-stills",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__still", (rawReq, res) => {
        const req = rawReq as unknown as { method?: string; setEncoding(e: string): void; on(ev: "data" | "end", cb: (chunk: string) => void): void; destroy(): void };
        const send = (status: number, body: string) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "text/plain");
          res.end(body);
        };
        if (req.method !== "POST") return send(405, "method not allowed");
        let raw = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          raw += chunk;
          if (raw.length > 24_000_000) req.destroy();
        });
        req.on("end", async () => {
          try {
            const { name, dataUrl, dir } = JSON.parse(raw) as { name: string; dataUrl: string; dir?: string };
            if (!/^[a-z0-9._-]+\.(webp|png|jpg|json)$/i.test(name)) return send(400, "bad name");
            const m = /^data:([a-z]+\/[a-z+]+);base64,(.*)$/i.exec(dataUrl);
            if (!m) return send(400, "bad data");
            // node:fs / node:path through a dynamic import: @types/node is not installed in this project
            const fs = (await import("node:" + "fs")) as unknown as { mkdirSync(p: string, o: unknown): void; writeFileSync(p: string, d: unknown): void };
            const path = (await import("node:" + "path")) as unknown as { resolve(...p: string[]): string };
            const B = (globalThis as unknown as { Buffer: { from(s: string, e: string): unknown } }).Buffer;
            const out = dir === "review" ? path.resolve("review", "table") : path.resolve("public", "media", "table");
            fs.mkdirSync(out, { recursive: true });
            fs.writeFileSync(path.resolve(out, name), B.from(m[2], "base64"));
            send(200, "ok " + name);
          } catch (e) {
            send(500, String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), hoistImportMap(), proposalDevApi(), tableStillsDevApi()],
  server: { port: 5210, strictPort: true },
  preview: { port: 5210, strictPort: true },
});
