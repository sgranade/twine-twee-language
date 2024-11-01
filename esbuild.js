const esbuild = require('esbuild');
const fs = require('fs/promises');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['client/src/extension.ts', 'server/src/server.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outdir: 'dist',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      umdToEsmLoaderPlugin,
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin
    ]
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  }
};

/**
 * A bunch of VSCode-related client libraries have janky import issues. This was best detailed in the
 * [vscode-json-languageservice](https://github.com/microsoft/vscode-json-languageservice/issues/200)
 * repo: they include UMD versions that don't play nice with esbuild, and they also have faux ESM packages
 * that don't properly announce themselves as being ESM. The affected libraries that we use are:
 * 
 *   - vscode-css-languageservice
 *   - vscode-html-languageservice
 *   - vscode-json-languageservice
 *   - jsonc-parser
 * 
 * The full status of the files is captured at https://github.com/microsoft/vscode/issues/192144
 * 
 * Until this is fixed, we redirect load requests for the UMD version to the ESM version.
 * 
 * @type {import('esbuild').Plugin}
 */
const umdToEsmLoaderPlugin = {
  name: 'umd-to-esm-loader-plugin',
  setup(build) {
    build.onLoad({ filter: /(vscode-(json|css|html)-languageservice|jsonc-parser)[\/\\]lib[\/\\]umd/ }, async (args) => {
      // Load the "ESM" version instead of the UMD version
      const newPath = args.path.replace(/([\/\\])umd([\/\\])/, '$1esm$2');
      const contents = await fs.readFile(newPath, 'utf8');
      return { contents: contents };
    });
  },
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
