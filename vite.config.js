import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub repository is named "flyway". Change this if you rename the repo.
  base: process.env.GITHUB_ACTIONS ? '/flyway/' : '/',
})
