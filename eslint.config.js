import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setImmediate: 'readonly',
                clearImmediate: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly'
            }
        },
        rules: {
            // Enforce single quotes
            'quotes': ['error', 'single', { avoidEscape: true }],

            // Semicolons required
            'semi': ['error', 'always'],

            // Indentation
            'indent': ['error', 4, { SwitchCase: 1 }],

            // No unused variables (warn instead of error)
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

            // Allow console in Node.js
            'no-console': 'off',

            // Enforce consistent spacing
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'comma-spacing': ['error', { before: false, after: true }],

            // Trailing commas
            'comma-dangle': ['error', 'never'],

            // No trailing whitespace
            'no-trailing-spaces': 'error',

            // Consistent line endings
            'eol-last': ['error', 'always']
        }
    },
    {
        // Ignore patterns
        ignores: [
            'node_modules/**',
            'dist/**',
            'dashboard/**',
            'logs/**'
        ]
    }
];
