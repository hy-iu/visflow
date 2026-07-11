import { defineConfig } from 'drizzle-kit'
import path from 'path'
import { app } from 'electron'

export default defineConfig({
  out: './drizzle',
  schema: './src/main/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: './visflow.db'
  }
})
