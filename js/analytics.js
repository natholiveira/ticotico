(() => {
  "use strict";

  const containerId = "GTM-MFGZD8KS";
  const measurementId = "G-CB3SSR9D09";
  const preferenceKey = "ticotico.analytics";
  const disableKey = `ga-disable-${measurementId}`;
  const production = location.protocol === "https:" &&
    ["ticoticoclub.com.br", "www.ticoticoclub.com.br"].includes(location.hostname);
  const sectionIds = ["inicio", "como-funciona", "monte", "clube", "presentes", "novidades"];
  const banner = document.getElementById("analytics-banner");
  const preferences = document.getElementById("analytics-preferences");
  const accept = document.getElementById("analytics-accept");
  const reject = document.getElementById("analytics-reject");

  const app = window.TicoTico = window.TicoTico || {};
  app.analytics = Object.freeze({ track });

  let allowed = false;
  let containerStarted = false;
  let openedFromFooter = false;
  let sectionObserver;
  const seenSections = new Set();
  const sectionTimers = new Map();

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }

  function consentSettings(analyticsStorage) {
    return {
      analytics_storage: analyticsStorage,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    };
  }

  function track(name, parameters = {}) {
    if (allowed && production) {
      gtag("event", name, { ...parameters, send_to: measurementId });
    }
  }

  function startContainer() {
    if (containerStarted || !production) return;

    const currentUrl = new URL(location.href);
    const pageUrl = new URL(currentUrl.origin);
    pageUrl.pathname = currentUrl.pathname;
    for (const [key, value] of currentUrl.searchParams) {
      if (["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_id"].includes(key) &&
          /^[a-z0-9_-]{1,100}$/i.test(value)) {
        pageUrl.searchParams.set(key, value);
      }
    }
    gtag("set", {
      page_location: pageUrl.href,
      page_referrer: document.referrer ? new URL(document.referrer).origin : "",
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    // Carrega o contêiner já vinculado ao GA4 após o aceite.
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
    containerStarted = true;
    document.head.append(script);
  }

  function observeSections() {
    if (!production || !("IntersectionObserver" in window) || sectionObserver) return;
    sectionObserver = new IntersectionObserver(entries => {
      if (!allowed || document.hidden) return;
      for (const { target, isIntersecting } of entries) {
        clearTimeout(sectionTimers.get(target));
        sectionTimers.delete(target);
        if (!isIntersecting || seenSections.has(target.id)) continue;
        sectionTimers.set(target, setTimeout(() => {
          sectionTimers.delete(target);
          if (!allowed || document.hidden) return;
          seenSections.add(target.id);
          sectionObserver.unobserve(target);
          track(`section_view_${target.id.replaceAll("-", "_")}`, { section_name: target.id });
        }, 400));
      }
    }, { rootMargin: "-20% 0px -35% 0px" });

    for (const id of sectionIds) {
      const section = document.getElementById(id);
      if (section && !seenSections.has(id)) sectionObserver.observe(section);
    }
  }

  function stopObservingSections() {
    sectionObserver?.disconnect();
    sectionObserver = undefined;
    for (const timer of sectionTimers.values()) clearTimeout(timer);
    sectionTimers.clear();
  }

  function clearAnalyticsCookies() {
    const names = document.cookie.split(";").map(cookie => cookie.trim().split("=")[0]);
    for (const name of names.filter(name => /^_ga(?:_[A-Z0-9]+)?$/i.test(name))) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Secure`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Secure; Domain=ticoticoclub.com.br`;
    }
  }

  function applyPreference(value) {
    allowed = value === "accepted";
    window[disableKey] = !allowed;
    gtag("consent", "update", consentSettings(allowed ? "granted" : "denied"));

    if (allowed) {
      startContainer();
      observeSections();
    } else {
      stopObservingSections();
      if (production) clearAnalyticsCookies();
    }
  }

  function readPreference() {
    try {
      return localStorage.getItem(preferenceKey);
    } catch {
      return null;
    }
  }

  function savePreference(value) {
    try {
      localStorage.setItem(preferenceKey, value);
    } catch {
      // A escolha continua valendo nesta página.
    }
    applyPreference(value);
    banner.hidden = true;
    preferences.setAttribute("aria-expanded", "false");
    if (openedFromFooter) preferences.focus();
    openedFromFooter = false;
  }

  document.addEventListener("click", event => {
    if (!allowed || !(event.target instanceof Element)) return;

    const link = event.target.closest('a[href^="#"]');
    const target = link?.getAttribute("href").slice(1);
    const origin = link?.closest("[data-analytics-origin]")?.dataset.analyticsOrigin;
    if (origin && sectionIds.includes(target)) {
      track("cta_click", { click_origin: origin, section_name: target });
    }

    const option = event.target.closest(
      "#step-model button[data-model], #quantity-options button[data-quantity], #type-groups button[data-type]"
    );
    if (option && !option.disabled) {
      const { model, quantity, type } = option.dataset;
      const optionType = model ? "modelo" : quantity ? "quantidade" : "tipo";
      track("kit_option_click", { option_type: optionType, option_value: model || quantity || type });
    }
  }, { capture: true });

  document.addEventListener("visibilitychange", () => {
    if (!allowed) return;
    if (document.hidden) stopObservingSections();
    else observeSections();
  });

  gtag("consent", "default", consentSettings("denied"));
  window[disableKey] = true;
  const savedPreference = readPreference();
  if (savedPreference === "accepted" || savedPreference === "rejected") {
    applyPreference(savedPreference);
  } else {
    banner.hidden = false;
    preferences.setAttribute("aria-expanded", "true");
  }

  accept.addEventListener("click", () => savePreference("accepted"));
  reject.addEventListener("click", () => savePreference("rejected"));
  preferences.addEventListener("click", () => {
    banner.hidden = false;
    preferences.setAttribute("aria-expanded", "true");
    openedFromFooter = true;
    reject.focus({ preventScroll: true });
  });
})();
