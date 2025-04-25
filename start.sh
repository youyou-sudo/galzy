#!/bin/bash
npx prisma generate
npx prisma generate --schema=./prisma/schema2.prisma
node server.js