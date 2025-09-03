module.exports = {
  apps: [{
    name: 'talent-scout-app',
    script: 'dist-server/index.js',
    cwd: '/home/ubuntu/apps/talent-scout',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DATABASE_URL: "postgresql://neondb_owner:npg_PrL2SYM7UbOj@ep-wild-glitter-a1umy0wc-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};

