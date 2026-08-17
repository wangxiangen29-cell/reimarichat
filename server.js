const http = require('http');
const fs = require('fs');
const path = require('path');

const { config, setAutoChatHooks } = require('./lib/config');
const { state, resetConversationMemory } = require('./lib/state');
const {
  readBody,
  sendJSON,
  rateLimit,
  baseHeaders,
  handleChat,
  handleChatBatch,
  handleSummarize,
  handleModels,
  handleState,
  handleTopic,
  handleVote,
  handleAdmin,
  handleAdminVerify,
  handleManualPersonas,
  handleCanon,
  handleAutoPersonas,
  handleGetSummaries,
  handleUpdateSummary,
  handleDeleteSummary
} = require('./lib/routes');
const { handleGift } = require('./lib/ambient');
const { startAutoChat, stopAutoChat } = require('./lib/autochat');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// 注入自动闲聊开关钩子（避免 config -> autochat 的循环依赖）
setAutoChatHooks({ start: startAutoChat, stop: stopAutoChat });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, baseHeaders(req));
      return res.end();
    }

    const limited = rateLimit(req, pathname);
    if (limited) {
      res.writeHead(limited.status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, baseHeaders(req)));
      return res.end(JSON.stringify({ error: limited.error }));
    }

    if (req.method === 'POST' && pathname === '/api/chat/batch') {
      const body = await readBody(req);
      return await handleChatBatch(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readBody(req);
      return await handleChat(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/clear') {
      resetConversationMemory();
      return sendJSON(req, res, 200, { ok: true, clearedAt: Date.now() });
    }
    if (req.method === 'POST' && pathname === '/api/summarize') {
      const body = await readBody(req);
      return await handleSummarize(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/models') {
      const body = await readBody(req);
      return await handleModels(req, res, body);
    }

    if (req.method === 'POST' && pathname === '/api/topic') {
      const body = await readBody(req);
      const result = await handleTopic(body);
      return sendJSON(req, res, result.status, { error: result.error, candidates: result.candidates });
    }

    if (req.method === 'POST' && pathname === '/api/gift') {
      const body = await readBody(req);
      const result = handleGift(body);
      if (result.ok) return sendJSON(req, res, 200, { ok: true, cooldownMs: result.cooldownMs });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'POST' && pathname === '/api/vote') {
      const body = await readBody(req);
      const result = handleVote(body);
      return sendJSON(req, res, result.status, { error: result.error, candidates: result.candidates });
    }

    if (req.method === 'POST' && pathname === '/api/admin') {
      const body = await readBody(req);
      const result = await handleAdmin(body);
      if (result.ok) return sendJSON(req, res, 200, { ok: true });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'POST' && pathname === '/api/admin/verify') {
      const body = await readBody(req);
      const result = handleAdminVerify(body);
      if (result.ok) return sendJSON(req, res, 200, { ok: true });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      return handleState(req, res, url.searchParams.get('voter'));
    }

    if (req.method === 'GET' && pathname === '/api/personas/manual') {
      const result = handleManualPersonas();
      return sendJSON(req, res, 200, {
        base: result.base,
        rules: result.rules,
        full: result.full
      });
    }

    if (req.method === 'GET' && pathname === '/api/canon') {
      const result = handleCanon();
      return sendJSON(req, res, 200, {
        defaults: result.defaults,
        server: result.server,
        enabled: result.enabled
      });
    }

    if (req.method === 'POST' && pathname === '/api/personas/auto') {
      const body = await readBody(req);
      const result = handleAutoPersonas(body);
      if (result.personas) return sendJSON(req, res, 200, { personas: result.personas, defaults: result.defaults });
      return sendJSON(req, res, result.status, { error: result.error });
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJSON(req, res, 200, {
        ok: true,
        hasServerKey: !!config.deepseekApiKey,
        aiEnabled: config.aiEnabled,
        autoChatEnabled: config.autoChatEnabled
      });
    }

    if (req.method === 'GET' && pathname === '/api/summaries') {
      const result = handleGetSummaries();
      return sendJSON(req, res, 200, { current: result.current, history: result.history });
    }

    const summaryMatch = pathname.match(/^\/api\/summaries\/([\w-]+)$/);
    if (summaryMatch) {
      if (req.method === 'POST') {
        const body = await readBody(req);
        const result = handleUpdateSummary(summaryMatch[1], body);
        if (result.ok) return sendJSON(req, res, 200, { ok: true, current: result.current, history: result.history });
        return sendJSON(req, res, result.status, { error: result.error });
      }
      if (req.method === 'DELETE') {
        const result = handleDeleteSummary(summaryMatch[1]);
        if (result.ok) return sendJSON(req, res, 200, { ok: true, current: result.current, history: result.history });
        return sendJSON(req, res, result.status, { error: result.error });
      }
      return sendJSON(req, res, 405, { error: 'Method Not Allowed' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, baseHeaders(req)));
      return res.end('Method Not Allowed');
    }

    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403, baseHeaders(req));
      return res.end('Forbidden');
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, baseHeaders(req)));
        return res.end('404 Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, baseHeaders(req)));
      res.end(content);
    });
  } catch (err) {
    return sendJSON(req, res, 400, { error: err.message });
  }
});

function listen(port) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < PORT + 10) {
      listen(port + 1);
    } else {
      console.error('服务器启动失败：', err.message);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log('红白与黑白 · 茶话会已启动：');
    console.log(`  本机访问： http://localhost:${port}`);
    console.log(`  管理员口令：${config.adminToken}`);
    console.log(`  内置 AI：${config.aiEnabled ? '开' : '关'}（${config.deepseekApiKey ? config.model : '未配置 Key'}）`);
    console.log(`  自动闲聊：${config.autoChatEnabled ? '开' : '关'}`);
    console.log('  提示：config.json 含敏感信息，已加入 .gitignore，请勿公开。');
    if (config.autoChatEnabled) startAutoChat();
  });
}

listen(PORT);
