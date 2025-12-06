import { resolve } from 'path';
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    // 1. Specifies that the output should be placed in the 'dist' folder.
    outDir: 'dist',
   
    // 2. Use Terser for maximum compression
    // 'terser' is used instead of 'esbuild' for Minification.
    minify: 'terser',
    // 3. Terser settings for aggressive compression
    terserOptions: {
      compress: {
        // Remove all console.* statements
        drop_console: true,
        // Remove all debugger statements
        drop_debugger: true,
        // Further optimization to remove unreachable code (e.g., in if/else)
        // This can slightly increase Build time, but gives a smaller output.
        // passes: 3,
      },
      format: {
        // Remove comments from the output
        comments: false,
      },
      // Remove all unnecessary variable and function names if possible
      mangle: true,
    },
   
    // 4. Library Mode settings
    lib: {
      entry: resolve(__dirname, 'src/zog.js'),
      name: 'ZogLibrary',
      fileName: (format) => `zog.${format}.js`
    },
  },
});
