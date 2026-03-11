module.exports = {
  apps: [{
    name:       'innovateit-backend',
    script:     'src/index.js',
    cwd: '/var/www/Innovateit/innovateit-backend',
    instances:  1,
    autorestart: true,
    watch:      false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production',
      PORT:     3001
    },
    error_file: '/var/log/innovateit/error.log',
    out_file:   '/var/log/innovateit/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
