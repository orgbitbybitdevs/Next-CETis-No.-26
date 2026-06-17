import cloudflare from '@astrojs/cloudflare';
import { defineConfig, sessionDrivers } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  session: {
    driver: sessionDrivers.lruCache()
  }
});
