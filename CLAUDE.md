# KOTH Bot Project

## Project Overview
Discord bot with HTTP API server and React dashboard, designed to run on a Pterodactyl panel.

## Tech Stack
- **Backend**: Node.js, Discord.js v14, Express.js
- **Frontend**: Vite + React
- **Database**: MariaDB with Sequelize ORM
- **Auth**: Discord OAuth2 via Passport
- **Real-time**: Socket.IO

## Quick Start

```bash
# Install dependencies
npm install
cd dashboard && npm install && cd ..

# Configure environment
cp .env.example .env.development
# Edit .env.development with your Discord and database credentials

# Test database connection
npm run test:db

# Run database migrations
npm run db:migrate:dev

# Deploy Discord commands
npm run deploy:commands:dev

# Start development
npm run dev

# In another terminal, start dashboard
npm run dashboard:dev
```

## Project Structure

```
src/
  index.js              - Main entry point
  commands/             - Discord slash commands
  handlers/             - Event handlers (commands, permissions)
  services/             - Business logic
  database/
    index.js            - DatabaseManager singleton
    models/             - Sequelize models
  routes/               - Express API routes
  utils/
    environment.js      - Centralized env detection
    logger.js           - Winston logging
    messageHandler.js   - Discord response helpers
config/
  config.js             - Main config with validation
  roles.js              - Production role permissions
  roles.development.js  - Dev role permissions
  channels.js           - Discord channel IDs
migrations/             - Umzug database migrations
scripts/                - CLI utilities
dashboard/              - React frontend
```

## Key Patterns

### Environment Detection
Always use `src/utils/environment.js`:
```js
import { isDevelopment, getEnv, requireEnv } from './utils/environment.js';
```

### Logging
Use service loggers:
```js
import { createServiceLogger } from './utils/logger.js';
const logger = createServiceLogger('MyService');
logger.info('Message');
```

### Commands
Commands export `data` (SlashCommandBuilder) and `execute` (async function):
```js
export const data = new SlashCommandBuilder().setName('cmd');
export async function execute(interaction) { }
```

### Migrations
Naming: `001-description.js`, `002-next-thing.js`

## NPM Scripts

- `npm run dev` - Start backend with nodemon
- `npm run start` - Production start
- `npm run deploy:commands:dev` - Deploy to dev guild
- `npm run deploy:commands:prod` - Deploy globally
- `npm run db:migrate:dev` - Run migrations
- `npm run db:migrate:status:dev` - Check migration status
- `npm run db:migrate:rollback:dev` - Rollback last migration
- `npm run test:db` - Test database connection
- `npm run dashboard:dev` - Start React dev server
- `npm run dashboard:build` - Build dashboard

## Pterodactyl Notes
- Production startup uses `npm start` which sets `NODE_ENV=production`
- Ensure `.env` file contains `NODE_ENV=production` for Pterodactyl
- HTTP server binds to `HTTP_PORT` (default 3000)

## ESLint
Single quotes, semicolons required, 4-space indent.
