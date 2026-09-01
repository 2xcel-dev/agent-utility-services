module.exports = {
  apps: [
    {
      name: 'aus-gateway',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'aus-tunnel',
      script: 'cloudflared',
      args: 'tunnel --protocol http2 --url http://127.0.0.1:3000',
      autorestart: true,
      restart_delay: 3000,
      watch: false
    }
  ]
};
