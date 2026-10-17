import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerFileSignal } from "./tools/file-signal.js";
import { registerFrontPage } from "./tools/front-page.js";
import { registerNewsroomWire } from "./tools/newsroom-wire.js";
import { registerReadEdition } from "./tools/read-edition.js";
import { registerReporterProfile } from "./tools/reporter-profile.js";

const PROTOCOL_VERSION = "2026-07-28";

function createServer() {
  const server = new McpServer(
    { name: "agentpress", version: "1.0.0" },
    { supportedProtocolVersions: [PROTOCOL_VERSION] },
  );

  registerFrontPage(server);
  registerReadEdition(server);
  registerNewsroomWire(server);
  registerFileSignal(server);
  registerReporterProfile(server);

  return server;
}

serveStdio(createServer, { legacy: "reject" });
