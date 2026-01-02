import './utils/environment.js'; // Load environment first
import { Client, GatewayIntentBits, Events } from 'discord.js';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import helmet from 'helmet';
import connectSessionSequelize from 'connect-session-sequelize';

import { discord as discordConfig, http as httpConfig } from '../config/config.js';
import databaseManager from './database/index.js';
import { initializeModels } from './database/models/index.js';
import { loadCommands, handleCommand } from './handlers/commandHandler.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import { createServiceLogger } from './utils/logger.js';
import { initGameServerConnector, disconnectAll as disconnectGameServers } from './services/gameServerConnector.js';

const logger = createServiceLogger('Main');

// ============================================
// Discord Client Setup
// ============================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================================
// Express Server Setup
// ============================================

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: httpConfig.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// ============================================
// Middleware
// ============================================

app.use(helmet({
    contentSecurityPolicy: false // Disable for development, configure properly for production
}));

app.use(cors({
    origin: httpConfig.corsOrigins,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// Session & Passport Setup
// ============================================

async function setupSession() {
    const SequelizeStore = connectSessionSequelize(session.Store);
    const sequelize = databaseManager.getSequelize();

    const sessionStore = new SequelizeStore({
        db: sequelize,
        tableName: 'sessions',
        checkExpirationInterval: 15 * 60 * 1000, // Clean up every 15 minutes
        expiration: httpConfig.session.maxAge
    });

    app.use(session({
        secret: httpConfig.session.secret,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: httpConfig.session.maxAge
        }
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    // Passport serialization
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const User = databaseManager.getModel('User');
            const user = await User.findByPk(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    // Discord OAuth2 Strategy
    passport.use(new DiscordStrategy({
        clientID: discordConfig.clientId,
        clientSecret: discordConfig.clientSecret,
        callbackURL: discordConfig.callbackUrl,
        scope: ['identify', 'email', 'guilds']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const User = databaseManager.getModel('User');

            let user = await User.findByPk(profile.id);

            if (user) {
                // Update existing user
                await user.updateFromDiscord(profile);
                user.accessToken = accessToken;
                user.refreshToken = refreshToken;
                await user.save();
            } else {
                // Create new user
                user = await User.create({
                    id: profile.id,
                    username: profile.username,
                    discriminator: profile.discriminator || null,
                    avatar: profile.avatar || null,
                    email: profile.email || null,
                    accessToken,
                    refreshToken,
                    lastLogin: new Date()
                });
            }

            return done(null, user);
        } catch (error) {
            logger.error('Discord OAuth error:', error.message);
            return done(error, null);
        }
    }));

    logger.info('Session and Passport configured');
}

// ============================================
// Routes
// ============================================

app.use('/api', apiRoutes);
app.use('/api/sync', syncRoutes);
app.use('/auth', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'KOTH Bot API',
        status: 'running',
        documentation: '/api'
    });
});

// ============================================
// Socket.IO Events
// ============================================

io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
    });
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// Discord Events
// ============================================

client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Discord bot logged in as ${readyClient.user.tag}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guild(s)`);
});

client.on(Events.InteractionCreate, handleCommand);

client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error.message);
});

// ============================================
// Startup
// ============================================

let isShuttingDown = false;

async function start() {
    try {
        logger.info('Starting application...');

        // Initialize database
        await databaseManager.initialize();
        await databaseManager.connect();

        // Run migrations
        await databaseManager.runMigrations();

        // Initialize models
        await initializeModels();

        // Setup session after database is ready
        await setupSession();

        // Load Discord commands
        await loadCommands(client);

        // Initialize game server connections (WebSocket client to game servers)
        await initGameServerConnector();

        // Start HTTP server with proper error handling and retry logic
        await new Promise((resolve, reject) => {
            let retries = 0;
            const maxRetries = 5;
            const retryDelay = 1000;

            const tryListen = () => {
                httpServer.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        retries++;
                        if (retries <= maxRetries) {
                            logger.warn(`Port ${httpConfig.port} in use, retry ${retries}/${maxRetries} in ${retryDelay}ms...`);
                            setTimeout(tryListen, retryDelay);
                        } else {
                            reject(new Error(`Port ${httpConfig.port} still in use after ${maxRetries} retries`));
                        }
                    } else {
                        reject(err);
                    }
                });

                httpServer.listen(httpConfig.port, () => {
                    logger.info(`HTTP server listening on port ${httpConfig.port}`);
                    resolve();
                });
            };

            tryListen();
        });

        // Login to Discord
        await client.login(discordConfig.token);

        logger.info('Application started successfully');
    } catch (error) {
        logger.error('Failed to start application:', error.message);
        logger.error(error.stack);
        process.exit(1);
    }
}

// ============================================
// Graceful Shutdown
// ============================================

async function shutdown(signal) {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress...');
        return;
    }
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Force exit after timeout to prevent hanging
    const forceExitTimeout = setTimeout(() => {
        logger.error('Forced exit after timeout');
        process.exit(1);
    }, 10000);

    try {
        // Close Socket.IO first (depends on HTTP server)
        await new Promise((resolve) => {
            io.close(() => {
                logger.info('Socket.IO server closed');
                resolve();
            });
        });

        // Close HTTP server and wait for it to fully release the port
        await new Promise((resolve) => {
            httpServer.close(() => {
                logger.info('HTTP server closed');
                resolve();
            });
        });

        // Destroy Discord client
        client.destroy();
        logger.info('Discord client destroyed');

        // Disconnect from game servers
        await disconnectGameServers();
        logger.info('Disconnected from game servers');

        // Close database connection
        await databaseManager.close();

        clearTimeout(forceExitTimeout);
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (error) {
        clearTimeout(forceExitTimeout);
        logger.error('Error during shutdown:', error.message);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle nodemon restart signal (SIGUSR2)
process.once('SIGUSR2', async () => {
    await shutdown('SIGUSR2');
    process.kill(process.pid, 'SIGUSR2');
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
start();

export { client, app, io };
