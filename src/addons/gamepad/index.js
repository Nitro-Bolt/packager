import gamepadUserscript from './userscript.js';
import gamepadUserstyle from './style.css?raw'

const addStylesheet = (css) => {
  const stylesheet = document.createElement('style');
  stylesheet.textContent = css;
  document.head.appendChild(stylesheet);
};

const run = ({ scaffolding, options }) => {
  gamepadUserscript(scaffolding, options.pointerlock);
  addStylesheet(gamepadUserstyle);
};

export default run;
