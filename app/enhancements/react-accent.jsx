import { createRoot } from 'react-dom/client';
import AnimatedContent from './react-bits/AnimatedContent.jsx';

// The host occupies no layout space. React owns only this aria-hidden accent;
// existing heading text, links and reading structure remain native DOM.
export function mountAccent(heading) {
  const host = document.createElement('span');
  host.dataset.reactBits = 'animated-content';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'display:inline-block;position:relative;width:0;height:0;pointer-events:none;vertical-align:middle';
  const inner = document.createElement('span');
  inner.style.cssText = 'display:block;position:absolute;left:10px;top:-2px;width:28px;height:3px';
  host.append(inner);
  heading.append(host);
  const root = createRoot(inner);
  root.render(<AnimatedContent distance={8} duration={0.2} direction="horizontal" initialOpacity={0.35}>
    <span style={{ display: 'block', width: 28, height: 3, borderRadius: 2, background: 'var(--orange, #df5c29)' }} />
  </AnimatedContent>);
  return () => { root.unmount(); host.remove(); };
}
