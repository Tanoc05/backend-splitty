import { createApp } from './app.js';
import { ENV } from './config/env.js';

const app = createApp();

app.listen(ENV.PORT, () => {
  console.log(`🚀 [Splitty Backend] Server attivo sulla porta ${ENV.PORT}`);
  console.log(`📡 Health check: http://localhost:${ENV.PORT}/api/health`);
  console.log(`🔗 Frontend consentito (CORS): ${ENV.FRONTEND_URL}`);
});
