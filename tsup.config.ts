import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['kafkajs', '@nestjs/common'],
});
