// PM2 process manifest for the Perturb Validator Dashboard.
// Start:   pm2 start ecosystem.config.js
// Logs:    pm2 logs dashboard-backend  |  pm2 logs dashboard-frontend
// Persist: pm2 save  (after pm2 startup has been configured once)

module.exports = {
  apps: [
    {
      name: 'dashboard-backend',
      cwd: '/home/dashboard/backend',
      script: 'venv/bin/uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000',
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      max_memory_restart: '1G',
      out_file: '/home/dashboard/logs/backend.out.log',
      error_file: '/home/dashboard/logs/backend.err.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'dashboard-frontend',
      cwd: '/home/dashboard/frontend',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 3000',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      out_file: '/home/dashboard/logs/frontend.out.log',
      error_file: '/home/dashboard/logs/frontend.err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
