import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context);
  return {
    shortCircuit: true,
    url: pathToFileURL(resolvePath(process.cwd(), `${specifier.slice(2)}.ts`))
      .href,
  };
}
