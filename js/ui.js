export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = options.value;
  if (options.name) node.name = options.name;
  if (options.id) node.id = options.id;
  if (options.disabled) node.disabled = true;
  if (options.hidden) node.hidden = true;
  if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { node.dataset[key] = value; });
  if (options.attrs) Object.entries(options.attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (options.on) Object.entries(options.on).forEach(([event, handler]) => node.addEventListener(event, handler));
  const childList = Array.isArray(children) ? children : [children];
  childList.filter((child) => child !== null && child !== undefined).forEach((child) => {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

export function avatar(profile, size = "") {
  const className = `avatar ${size}`.trim();
  const node = el("span", { className, attrs: { "aria-label": `Аватар ${profile.displayName}` } });
  if (profile.avatarDataUrl) {
    node.append(el("img", { attrs: { src: profile.avatarDataUrl, alt: "" } }));
  } else {
    node.textContent = profile.displayName.trim().charAt(0).toUpperCase() || "?";
  }
  return node;
}

export function sectionHeading(title, meta = "", level = "h2") {
  return el("div", { className: "section-heading" }, [
    el(level, { text: title }),
    meta ? el("span", { text: meta }) : null
  ]);
}

export function plural(number, forms) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return forms[1];
  return forms[2];
}

export function button(text, className = "button button-secondary", onClick = null) {
  return el("button", { className, type: "button", text, on: onClick ? { click: onClick } : undefined });
}
