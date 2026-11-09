/* React island hydrator.
 *
 * A thin wrapper around React 18's hydrateRoot for islands of interactivity
 * in an otherwise static, prerendered page. React is loaded lazily from the
 * vendor directory, and if it fails, the existing DOM is left untouched.
 *
 *   import { mountIsland } from './island.js';
 *   mountIsland('explorer', ExplorerComponent, { routes: [...] });
 */

let React = null;
let ReactDOM = null;

const REACT_PATHS = {
  react: '/app/vendor/react/react.production.min.js',
  reactDOM: '/app/vendor/react/react-dom.production.min.js',
};

/** Load React UMD scripts on demand. */
async function loadReact() {
  if (React && ReactDOM) return true;
  try {
    const [reactModule, reactDOMModule] = await Promise.all([
      fetch(REACT_PATHS.react).then(r => r.text()),
      fetch(REACT_PATHS.reactDOM).then(r => r.text()),
    ]);
    // Create script elements and eval in a sandboxed way
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return false;

    // Create a script to evaluate the React bundles
    const reactScript = doc.createElement('script');
    reactScript.textContent = reactModule;
    doc.head.appendChild(reactScript);
    doc.head.removeChild(reactScript);

    const reactDOMScript = doc.createElement('script');
    reactDOMScript.textContent = reactDOMModule;
    doc.head.appendChild(reactDOMScript);
    doc.head.removeChild(reactDOMScript);

    // Access the globals now defined by the scripts
    React = globalThis.React;
    ReactDOM = globalThis.ReactDOM;
    return !!(React && ReactDOM);
  } catch {
    return false;
  }
}

/** Mount a React component into a container element. Returns cleanup function or null. */
export async function mountIsland(containerId, Component, props = {}) {
  // Skip in prerender mode
  if (typeof window !== 'undefined' && window.__NAARAD_PRERENDER__) return null;

  // Skip if reduced motion or Save-Data is set (conservative)
  if (typeof navigator !== 'undefined' && (navigator.connection?.saveData || window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    return null;
  }

  const container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
  if (!container) return null;

  // Ensure React is loaded
  if (!(await loadReact())) return null;

  try {
    const { hydrateRoot } = ReactDOM;
    const root = hydrateRoot(container, React.createElement(Component, props));
    return () => {
      root.unmount();
    };
  } catch {
    // On error, leave the pre-rendered content untouched
    return null;
  }
}

export { React, ReactDOM };