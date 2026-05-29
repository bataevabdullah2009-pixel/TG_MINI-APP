const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Change provider to sqlite
schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');
schema = schema.replace('url      = env("DATABASE_URL")', 'url      = "file:./dev.db"');

// Remove @db.Uuid, @db.Text, @db.VarChar(...)
schema = schema.replace(/@db\.\w+(\([^)]*\))?/g, '');

fs.writeFileSync(schemaPath, schema);
console.log("Successfully converted schema to SQLite!");
