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

function svgElement(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

export function activityMark(kind, className, label = "") {
  const mark = el("span", {
    className,
    attrs: label ? { "aria-label": label, title: label } : { "aria-hidden": "true" }
  });
  const svg = svgElement("svg", {
    class: "activity-mark-svg",
    viewBox: "0 0 24 24",
    focusable: "false",
    "aria-hidden": "true"
  });
  if (kind === "warmup") {
    svg.append(
      svgElement("circle", {
        cx: "12",
        cy: "4.2",
        r: "1.8",
        fill: "currentColor"
      }),
      svgElement("path", {
        d: "M12 6.8v5.9M12 8.3 7.4 5.9M12 8.3l4.6-2.4M12 12.7 8.2 20M12 12.7l3.8 7.3",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    );
  } else if (kind === "mfr") {
    svg.append(
      svgElement("path", {
        d: "M5 7.5h12c2.2 0 4 2 4 4.5s-1.8 4.5-4 4.5H5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linejoin": "round"
      }),
      svgElement("ellipse", {
        cx: "5",
        cy: "12",
        rx: "2.5",
        ry: "4.5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.8"
      }),
      svgElement("path", {
        d: "M17 7.5c-1.4 0-2.5 2-2.5 4.5s1.1 4.5 2.5 4.5",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1.4"
      })
    );
  } else if (kind === "workout") {
    svg.append(svgElement("path", {
      d: "M3 9v6M6 7.5v9M18 7.5v9M21 9v6M6 12h12",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "square"
    }));
  } else if (kind === "steps") {
    svg.append(
      svgElement("path", {
        d: "M8.2 11.6c1.8.3 3 2 2.7 3.8-.3 2-2.2 3.5-4.1 3.1-1.9-.4-3-2.4-2.4-4.2.5-1.7 2-3 3.8-2.7Z",
        fill: "currentColor"
      }),
      svgElement("circle", { cx: "4.8", cy: "10.3", r: ".95", fill: "currentColor" }),
      svgElement("circle", { cx: "6.8", cy: "9.3", r: "1.05", fill: "currentColor" }),
      svgElement("circle", { cx: "9", cy: "9.4", r: ".9", fill: "currentColor" }),
      svgElement("path", {
        d: "M15.8 5.5c1.8-.3 3.4.9 3.8 2.7.4 1.9-.8 3.8-2.7 4.1-1.9.3-3.7-1.1-3.8-3.1-.2-1.8.9-3.4 2.7-3.7Z",
        fill: "currentColor"
      }),
      svgElement("circle", { cx: "14", cy: "3.8", r: ".9", fill: "currentColor" }),
      svgElement("circle", { cx: "16", cy: "2.9", r: "1.05", fill: "currentColor" }),
      svgElement("circle", { cx: "18.2", cy: "3.2", r: ".95", fill: "currentColor" })
    );
  } else if (kind === "water") {
    svg.append(svgElement("path", {
      d: "M12 2.8S6.4 9.2 6.4 14a5.6 5.6 0 0 0 11.2 0C17.6 9.2 12 2.8 12 2.8Zm-2.7 11.5c.2 1.6 1.2 2.6 2.7 2.9",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
  } else if (kind === "sleep") {
    svg.append(svgElement("path", {
      d: "M18.8 15.3A8.2 8.2 0 0 1 8.7 5.2 8.2 8.2 0 1 0 18.8 15.3Z",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    }));
  }
  mark.append(svg);
  return mark;
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

function splitDisplayName(value) {
  const parts = String(value || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return { firstName: parts[0] || "Участник", surname: parts[1] || "" };
}

export function participantDisplayName(profile, profiles = []) {
  const { firstName, surname } = splitDisplayName(profile?.displayName);
  if (!surname) return firstName;
  const normalizedFirstName = firstName.toLocaleLowerCase("ru-RU");
  const namesakes = profiles.filter((candidate) => {
    if (candidate?.status && candidate.status !== "active") return false;
    return splitDisplayName(candidate?.displayName).firstName.toLocaleLowerCase("ru-RU") === normalizedFirstName;
  });
  if (namesakes.length < 2) return firstName;
  return `${firstName} ${Array.from(surname)[0].toLocaleUpperCase("ru-RU")}.`;
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
