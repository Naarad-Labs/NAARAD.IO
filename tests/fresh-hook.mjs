/* Resolve hook: a relative import inside a module loaded with ?copy=N gets the
   same ?copy=N, so a fresh store module also gets a fresh app/idb.js. */
export async function resolve(specifier, context, next) {
  const copy = context.parentURL && new URL(context.parentURL).searchParams.get('copy');
  if (copy !== null && copy !== undefined && /^\.\.?\//.test(specifier)) {
    const url = new URL(specifier, context.parentURL);
    url.searchParams.set('copy', copy);
    return next(url.href, context);
  }
  return next(specifier, context);
}
