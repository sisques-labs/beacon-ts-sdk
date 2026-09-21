import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'nestjs/index': 'src/nestjs/index.ts' },
  // Shared chunks keep one BeaconClient class identity across '.' and './nestjs' (CJS included).
  splitting: true,
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['kafkajs', '@nestjs/common'],
});
