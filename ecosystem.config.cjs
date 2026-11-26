// pm2: chạy NGẦM runner AI viết bài + SEO Agent 24/7 (Claude CLI của Claude Desktop) cho website hulako-web-den. Log ở ./logs.
//   npm run ai:start   → bật (tự chạy lại khi lỗi)   ·   npm run ai:logs → xem log   ·   npm run ai:stop → tắt
// windowsHide + chạy thẳng node (không qua lớp vỏ tự spawn) → không bật cửa sổ console đen trên Windows.
module.exports = {
  apps: [
    {
      name: 'hulako-web-runner',
      script: 'tools/ai-runner.mjs',
      cwd: __dirname,
      interpreter: 'node',
      windowsHide: true,
      autorestart: true,
      max_restarts: 1000,
      restart_delay: 60000,
      exp_backoff_restart_delay: 5000,
      max_memory_restart: '300M',
      time: true,
      out_file: 'logs/runner.out.log',
      error_file: 'logs/runner.err.log',
      env: { NODE_ENV: 'production', TZ: 'Asia/Ho_Chi_Minh' },
    },
    {
      // SEO Agent 24/7: R&D từ khoá, xu hướng, decode bài top, spy đối thủ, kế hoạch bài/ngày, báo cáo Telegram theo giờ hẹn
      name: 'hulako-seo-agent',
      script: 'tools/seo-agent.mjs',
      cwd: __dirname,
      interpreter: 'node',
      windowsHide: true,
      autorestart: true,
      max_restarts: 1000,
      restart_delay: 60000,
      exp_backoff_restart_delay: 5000,
      max_memory_restart: '400M',
      time: true,
      out_file: 'logs/seo-agent.out.log',
      error_file: 'logs/seo-agent.err.log',
      env: { NODE_ENV: 'production', TZ: 'Asia/Ho_Chi_Minh' },
    },
  ],
};
