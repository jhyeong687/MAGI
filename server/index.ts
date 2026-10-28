import { createApp, attachFrontend } from './app.ts';
import { detectEnvironment } from './codex.ts';

const { app, orchestrator, login } = createApp();
const vite = await attachFrontend(app);
const port = Number(process.env.PORT || 5173);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(`MAGI ONLINE → http://127.0.0.1:${port}`),
);
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
void detectEnvironment().then((env) =>
  console.log(env.ready ? `${env.version} // ChatGPT authenticated` : env.issues.join('\n')),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  orchestrator.shutdown();
  login.cancel();
  server.close();
  server.closeAllConnections();
  void vite?.close();
  setTimeout(() => process.exit(0), 1800);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
