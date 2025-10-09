module.exports = {
  apps: [{
    name: 'talent-scout-app',
      script: 'npx',
    args: 'tsx server/index.ts',
    cwd: '/home/ubuntu/apps/talent-scout',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: process.env.DATABASE_URL,
      APIFY_API_TOKEN: process.env.APIFY_API_TOKEN
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};

