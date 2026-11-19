
/**
 * TICO-TICO — CONTROLADOR PRINCIPAL
 *
 * Arquivo: js/app.js
 *
 * Responsabilidades:
 * - Inicializar os módulos
 * - Carregar o catálogo
 * - Controlar o carrossel da capa
 * - Controlar o menu mobile
 * - Navegar entre as etapas
 * - Respeitar as validações do kit
 * - Atualizar o indicador de progresso
 *
 * Não contém regras de negócio do carrinho.
 * Não renderiza os produtos diretamente.
 *
 * Dependências:
 * - catalog.js
 * - builder-state.js
 * - view-models.js
 * - view-categories.js
 * - view-products.js
 * - view-cart.js
 * - forms.js
 */

(() => {
    "use strict";
  
    const app = window.TicoTico =
      window.TicoTico || {};
  
    /* ==========================================
       1. CONFIGURAÇÃO DAS ETAPAS
    ========================================== */
  
    const STEPS = Object.freeze([
      {
        number: 1,
        elementId: "step-model"
      },
      {
        number: 2,
        elementId: "step-types"
      },
      {
        number: 3,
        elementId: "step-products"
      },
      {
        number: 4,
        elementId: "step-cart"
      },
      {
        number: 5,
        elementId: "step-notify"
      }
    ]);
  
    let currentStep = 1;
    let initialized = false;
    let catalogReady = false;
  
    /* ==========================================
       2. UTILITÁRIOS
    ========================================== */
  
    function byId(id) {
      return document.getElementById(id);
    }
  
    function onClick(id, handler) {
      const element = byId(id);
  
      if (!element) {
        console.warn(
          `[Tico-Tico] Elemento não encontrado: ${id}`
        );
  
        return;
      }
  
      element.addEventListener("click", handler);
    }
  
    function prefersReducedMotion() {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }
  
    /* ==========================================
       3. IMAGENS DO CARROSSEL
  
       Usamos as imagens aprovadas da marca.
  
       Os arquivos precisam existir na
       pasta assets/ com estes nomes.
    ========================================== */
  
    function initCarousel() {
      const slides = Array.from(document.querySelectorAll("[data-hero-slide]"));
      if (!slides.length) return;
      let current = 0;
      function changeSlide(direction) {
        slides[current].hidden = true;
        current = (current + direction + slides.length) % slides.length;
        slides[current].hidden = false;
        byId("carousel-current").textContent = `${current + 1} / ${slides.length}`;
        app.analytics?.track("campaign_view", {
          campaign_name: slides[current].dataset.campaign,
          click_direction: direction === 1 ? "proximo" : "anterior"
        });
      }
      onClick("carousel-prev", () => changeSlide(-1));
      onClick("carousel-next", () => changeSlide(1));
    }

    /* ==========================================
       4. MENU MOBILE
    ========================================== */
  
    function initMobileMenu() {
      const toggle = byId("mobile-menu-toggle");
      const links = byId("nav-links");
  
      if (!toggle || !links) {
        return;
      }
  
      function setMenuOpen(open) {
        links.classList.toggle("is-open", open);
  
        toggle.setAttribute(
          "aria-expanded",
          String(open)
        );
  
        toggle.setAttribute(
          "aria-label",
          open ? "Fechar menu" : "Abrir menu"
        );
  
        toggle.textContent = open ? "✕" : "☰";
      }
  
      toggle.addEventListener("click", () => {
        const currentlyOpen =
          toggle.getAttribute("aria-expanded") ===
          "true";
  
        setMenuOpen(!currentlyOpen);
      });
  
      // Fecha o menu depois de escolher um link.
      links.addEventListener("click", event => {
        if (event.target.closest("a")) {
          setMenuOpen(false);
        }
      });
  
      // Permite fechar com Escape.
      document.addEventListener(
        "keydown",
        event => {
          if (event.key === "Escape") {
            setMenuOpen(false);
          }
        }
      );
  
      // Ao voltar para desktop, limpa o menu.
      window.addEventListener("resize", () => {
        if (window.innerWidth > 780) {
          setMenuOpen(false);
        }
      });
    }
  
    /* ==========================================
       5. REGRAS DE ACESSO ÀS ETAPAS
  
       A navegação consulta o BuilderStore.
       Não duplica as regras de quantidade.
    ========================================== */
  
    function canEnterStep(stepNumber) {
      const store = app.store;
  
      if (!store) {
        return stepNumber === 1;
      }
  
      const snapshot = store.getSnapshot();
  
      switch (stepNumber) {
        case 1:
        case 2:
          return true;
  
        case 3:
          return (
            catalogReady &&
            snapshot.canChooseProducts
          );
  
        case 4:
        case 5:
          return (
            catalogReady &&
            snapshot.isKitComplete
          );
  
        default:
          return false;
      }
    }
  
    /* ==========================================
       6. INDICADOR DE PROGRESSO
    ========================================== */
  
    function updateProgress() {
      const indicators =
        document.querySelectorAll(
          "#builder-steps [data-progress]"
        );
  
      for (const indicator of indicators) {
        const stepNumber = Number(
          indicator.dataset.progress
        );
  
        const isActive =
          stepNumber === currentStep;
  
        const isComplete =
          stepNumber < currentStep;
  
        indicator.classList.toggle(
          "is-active",
          isActive
        );
  
        indicator.classList.toggle(
          "is-complete",
          isComplete
        );
  
        if (isActive) {
          indicator.setAttribute(
            "aria-current",
            "step"
          );
        } else {
          indicator.removeAttribute(
            "aria-current"
          );
        }
      }
    }
  
    /* ==========================================
       7. ATUALIZAR A TELA ATIVA
    ========================================== */
  
    function renderCurrentStep() {
      for (const step of STEPS) {
        const element = byId(step.elementId);
  
        if (!element) {
          continue;
        }
  
        const active =
          step.number === currentStep;
  
        element.hidden = !active;
  
        element.classList.toggle(
          "is-active",
          active
        );
  
        element.setAttribute(
          "aria-hidden",
          String(!active)
        );
      }
  
      updateProgress();
    }
  
    /* ==========================================
       8. ATUALIZAR A INTERFACE DA ETAPA
  
       Cada visualização continua responsável
       por apresentar seus próprios dados.
    ========================================== */
  
    function refreshStep(stepNumber) {
      const snapshot = app.store.getSnapshot();
  
      switch (stepNumber) {
        case 1:
          app.views.models.render(snapshot);
          break;
  
        case 2:
          if (catalogReady) {
            app.views.categories.render(snapshot);
          }
          break;
  
        case 3:
          if (catalogReady) {
            app.views.products.render(snapshot);
          }
          break;
  
        case 4:
          if (catalogReady) {
            app.views.cart.render(snapshot);
          }
          break;
  
        case 5:
          // O formulário já foi inicializado.
          break;
      }
    }
  
    /* ==========================================
       9. NAVEGAR ENTRE ETAPAS
  
       Os botões serão habilitados ou
       desabilitados pelas respectivas views.
  
       Esta função também valida o acesso
       para impedir avanços indevidos.
    ========================================== */
  
    function goToStep(
      stepNumber,
      options = {}
    ) {
      const {
        scroll = true,
        focus = true
      } = options;
  
      const validStep = STEPS.some(
        step => step.number === stepNumber
      );
  
      if (!validStep) {
        return false;
      }
  
      if (!canEnterStep(stepNumber)) {
        console.warn(
          "[Tico-Tico] Etapa indisponível:",
          stepNumber
        );
  
        return false;
      }
  
      const section = byId("monte");
      if (stepNumber > 1 && window.location.hash !== "#monte") {
        window.location.hash = "monte";
      }
      section.classList.toggle("in-progress", stepNumber > 1);
      const previousStep = currentStep;
      currentStep = stepNumber;
  
      renderCurrentStep();
      refreshStep(stepNumber);
  
      const activeStep = STEPS.find(
        step => step.number === stepNumber
      );
      if (previousStep !== stepNumber) {
        app.analytics?.track("kit_step_view", { kit_step: activeStep.elementId });
      }
  
      const stepElement = byId(
        activeStep.elementId
      );
  
      if (scroll && section) {
        section.scrollIntoView({
          behavior:
            prefersReducedMotion()
              ? "auto"
              : "smooth",
          block: "start"
        });
      }
  
      if (focus && stepElement) {
        stepElement.setAttribute(
          "tabindex",
          "-1"
        );
  
        stepElement.focus({
          preventScroll: true
        });
      }
  
      return true;
    }
  
    /* ==========================================
       10. EVENTOS DOS BOTÕES DE NAVEGAÇÃO
  
       Cada botão possui apenas uma tarefa:
       solicitar a transição de etapa.
    ========================================== */
  
    function initStepNavigation() {
      function exitKit() {
        app.analytics?.track("kit_exit", { kit_step: STEPS[currentStep - 1].elementId });
        app.store.reset();
        byId("notify-form").reset();
        byId("notify-feedback").textContent = "";
        goToStep(1);
      }

      for (const button of document.querySelectorAll("#monte .kit-exit")) {
        button.addEventListener("click", exitKit);
      }

      window.addEventListener("hashchange", () => {
        if (currentStep > 1 && window.location.hash !== "#monte") {
          goToStep(1, { scroll: false, focus: false });
        }
      });

      // Etapa 1 — Modelo
      onClick(
        "model-next",
        () => goToStep(2)
      );
  
      // Etapa 2 — Quantidade e tipos
      onClick(
        "types-back",
        () => goToStep(1)
      );
  
      onClick(
        "types-next",
        () => goToStep(3)
      );
  
      // Etapa 3 — Produtos
      onClick(
        "products-back",
        () => goToStep(2)
      );
  
      onClick(
        "products-next",
        () => goToStep(4)
      );
  
      // Etapa 4 — Carrinho
      onClick(
        "cart-back",
        () => goToStep(3)
      );
  
      onClick(
        "cart-next",
        () => goToStep(5)
      );
  
      // Etapa 5 — Avise-me
      onClick(
        "notify-back",
        () => goToStep(4)
      );
    }
  
    /* ==========================================
       11. MENSAGEM DE ERRO DO CATÁLOGO
  
       Se o arquivo JSON não carregar,
       a cliente verá uma mensagem clara.
  
       Oferecemos também um botão para
       tentar carregar novamente.
    ========================================== */
  
    function showCatalogError() {
      const container = byId("type-groups");
  
      if (!container) {
        return;
      }
  
      const wrapper =
        document.createElement("div");
  
      wrapper.className =
        "builder-alert builder-alert--purple";
  
      const message =
        document.createElement("p");
  
      message.textContent =
        "Não foi possível carregar os produtos " +
        "da Tico-Tico. Verifique se o catálogo " +
        "está disponível e tente novamente.";
  
      const retry =
        document.createElement("button");
  
      retry.type = "button";
      retry.className =
        "button button--outline";
  
      retry.textContent =
        "Tentar carregar novamente";
  
      retry.addEventListener(
        "click",
        initializeCatalog
      );
  
      wrapper.append(message, retry);
  
      container.replaceChildren(wrapper);
    }
  
    /* ==========================================
       12. INICIALIZAR CATÁLOGO E VITRINES
  
       A ordem é importante:
  
       1. Carregar os produtos do JSON
       2. Inicializar seleção de categorias
       3. Inicializar seleção de produtos
       4. Inicializar carrinho
  
       Se uma etapa falhar, não marcamos
       o catálogo como pronto.
    ========================================== */
  
    async function initializeCatalog() {
      if (catalogReady) {
        return true;
      }
  
      const container = byId("type-groups");
  
      if (container) {
        container.textContent =
          "Carregando nosso catálogo de minis...";
      }
  
      try {
        await app.catalog.load();
  
        const categoriesReady =
          app.views.categories.init();
  
        const productsReady =
          app.views.products.init();
  
        const cartReady =
          app.views.cart.init();
  
        if (
          !categoriesReady ||
          !productsReady ||
          !cartReady
        ) {
          throw new Error(
            "Falha ao inicializar as telas " +
            "do configurador."
          );
        }
  
        catalogReady = true;
  
        // Sincroniza a etapa atualmente aberta.
        refreshStep(currentStep);
  
        console.info(
          "[Tico-Tico] Catálogo carregado:",
          app.catalog.getStats()
        );
  
        return true;
      } catch (error) {
        catalogReady = false;
  
        console.error(
          "[Tico-Tico] Erro no catálogo:",
          error
        );
  
        showCatalogError();
  
        return false;
      }
    }
  
    /* ==========================================
       13. ANO DO RODAPÉ
    ========================================== */
  
    function updateFooterYear() {
      const year = byId("current-year");
  
      if (year) {
        year.textContent =
          String(new Date().getFullYear());
      }
    }
  
    /* ==========================================
       14. INICIALIZAÇÃO PRINCIPAL
    ========================================== */
  
    async function init() {
      if (initialized) {
        return;
      }
  
      initialized = true;
  
      if (
        !app.store ||
        !app.catalog ||
        !app.views?.models ||
        !app.views?.categories ||
        !app.views?.products ||
        !app.views?.cart ||
        !app.forms
      ) {
        console.error(
          "[Tico-Tico] Um ou mais módulos " +
          "não foram carregados. Verifique " +
          "a ordem dos scripts no index.html."
        );
  
        return;
      }
  
      // Componentes independentes do catálogo.
      initCarousel();
      initMobileMenu();
      updateFooterYear();
  
      // Primeira tela e formulários.
      app.views.models.init();
      app.forms.init();
  
      // Navegação entre as cinco etapas.
      initStepNavigation();
  
      // Exibe o primeiro passo.
      goToStep(1, {
        scroll: false,
        focus: false
      });
  
      // Carrega produtos e inicializa as telas.
      await initializeCatalog();
  
      console.info(
        "[Tico-Tico] Aplicação inicializada."
      );
    }
  
    /* ==========================================
       15. API PÚBLICA
    ========================================== */
  
    app.app = Object.freeze({
      init,
      goToStep,
  
      getCurrentStep() {
        return currentStep;
      },
  
      isCatalogReady() {
        return catalogReady;
      }
    });
  
    /* ==========================================
       16. INICIALIZAÇÃO AUTOMÁTICA
  
       Os scripts usam "defer" no HTML.
  
       Também mantemos suporte ao carregamento
       em situações onde o DOM ainda não
       esteja completamente construído.
    ========================================== */
  
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
      );
    } else {
      init();
    }
  
  })();
  