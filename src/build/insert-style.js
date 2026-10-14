module.exports = styleElement => {
  const element = document.head || document.body || document.documentElement;
  element.insertBefore(styleElement, element.firstChild);
};
