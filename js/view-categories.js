
/**
 * TICO-TICO — QUANTIDADE E TIPOS DE PRODUTOS
 *
 * Arquivo: js/view-categories.js
 *
 * Responsabilidades:
 * - Exibir as quantidades 5, 7 e 10
 * - Construir os grupos de tipos a partir do catálogo
 * - Registrar as escolhas no BuilderStore
 * - Destacar os tipos selecionados
 * - Exibir o aviso roxo de limite atingido
 * - Habilitar o avanço conforme as regras
 *
 * Não controla a navegação entre etapas.
 * Não seleciona produtos individuais.
 *
 * Dependências:
 * - js/catalog.js
 * - js/builder-state.js
 *
 * API pública:
 * window.TicoTico.views.categories
 */

(() => {
    "use strict";
  
    /* ==========================================
       1. CONFIGURAÇÕES VISUAIS
    ========================================== */
  
    const CATEGORY_ICONS = Object.freeze({
      make: "✿",
      scent: "✧",
      care: "♡",
      hair: "☼"
    });
  
    /*
     * O protetor de calcanhar fica fora
     * das opções nesta primeira versão.
     *
     * A comparação ignora acentos e
     * diferenças entre maiúsculas e minúsculas.
     */
    function normalizeText(value) {
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    }
  
    function isTemporarilyUnavailable(type) {
      const name = normalizeText(type.label);
  
      return (
        name.includes("protetor") &&
        name.includes("calcanhar")
      );
    }
  
    /* ==========================================
       2. REFERÊNCIAS AO HTML
    ========================================== */
  
    let elements = null;
    let unsubscribe = null;
    let initialized = false;
  
    function getElements() {
      return {
        quantityOptions:
          document.getElementById("quantity-options"),
  
        typeCounter: document.getElementById("type-counter"),

        typeGroups:
          document.getElementById("type-groups"),
  
        limitMessage:
          document.getElementById("types-limit-message"),
  
        nextButton:
          document.getElementById("types-next")
      };
    }
  
    function validateElements(references) {
      const missing = Object.entries(references)
        .filter(([, element]) => !element)
        .map(([name]) => name);
  
      if (missing.length > 0) {
        console.error(
          "[Tico-Tico] Elementos ausentes " +
          "na tela de categorias:",
          missing
        );
  
        return false;
      }
  
      return true;
    }
  
    /* ==========================================
       3. CONSTRUÇÃO SEGURA DO HTML
  
       Usamos createElement e textContent,
       em vez de inserir dados do catálogo
       diretamente com innerHTML.
    ========================================== */
  
    function createElement(tag, className, text) {
      const element = document.createElement(tag);
  
      if (className) {
        element.className = className;
      }
  
      if (text !== undefined) {
        element.textContent = text;
      }
  
      return element;
    }
  
    /* ==========================================
       4. CRIAR UM BOTÃO DE TIPO
    ========================================== */
  
    function createTypeButton(type, categoryId) {
      const button = createElement(
        "button",
        "type-option"
      );
  
      button.type = "button";
      button.dataset.type = type.id;
      button.dataset.category = categoryId;
  
      button.setAttribute("aria-pressed", "false");
  
      button.setAttribute(
        "aria-label",
        `Selecionar ${type.label}`
      );
  
      const icon = createElement(
        "span",
        "type-option__icon",
        CATEGORY_ICONS[categoryId] || "✦"
      );
  
      icon.setAttribute("aria-hidden", "true");
  
      const label = createElement(
        "span",
        "type-option__label",
        type.label
      );
  
      button.append(icon, label);
  
      return button;
    }
  
    /* ==========================================
       5. CRIAR UM GRUPO DE CATEGORIA
    ========================================== */
  
    function createCategoryGroup(category) {
      const section = createElement(
        "section",
        "type-group"
      );
  
      const header = createElement(
        "div",
        "type-group__header"
      );
  
      const headingWrapper = createElement(
        "div",
        "type-group__heading"
      );
  
      const title = createElement(
        "h5",
        "type-group__title",
        category.label
      );
  
      const description = createElement(
        "p",
        "type-group__description",
        category.description
      );
  
      headingWrapper.append(title, description);
      header.appendChild(headingWrapper);
  
      const grid = createElement(
        "div",
        "type-grid"
      );
  
      const availableTypes = category.types.filter(
        type => !isTemporarilyUnavailable(type)
      );
  
      for (const type of availableTypes) {
        grid.appendChild(
          createTypeButton(type, category.id)
        );
      }
  
      section.append(header, grid);
  
      return section;
    }
  
    /* ==========================================
       6. CONSTRUIR OS GRUPOS DO CATÁLOGO
  
       Essa operação acontece uma única vez
       durante a inicialização.
  
       Nas atualizações seguintes, apenas
       os estados dos botões são alterados.
    ========================================== */
  
    function renderCategoryGroups() {
      const groups =
        window.TicoTico.catalog.getCategoryGroups();
  
      const fragment =
        document.createDocumentFragment();
  
      let visibleGroups = 0;
  
      for (const category of groups) {
        const availableTypes = category.types.filter(
          type => !isTemporarilyUnavailable(type)
        );
  
        if (availableTypes.length === 0) {
          continue;
        }
  
        fragment.appendChild(
          createCategoryGroup(category)
        );
  
        visibleGroups++;
      }
  
      elements.typeGroups.replaceChildren(fragment);
  
      if (visibleGroups === 0) {
        const message = createElement(
          "p",
          "builder-alert builder-alert--purple",
          "Nenhum tipo de produto está disponível."
        );
  
        elements.typeGroups.appendChild(message);
      }
    }
  
    /* ==========================================
       7. ATUALIZAR BOTÕES DE QUANTIDADE
    ========================================== */
  
    function renderQuantities(snapshot) {
      const buttons =
        elements.quantityOptions.querySelectorAll(
          "button[data-quantity]"
        );
  
      for (const button of buttons) {
        const selected =
          Number(button.dataset.quantity) ===
          snapshot.quantity;
  
        button.classList.toggle(
          "is-selected",
          selected
        );
  
        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
      }
    }
  
    /* ==========================================
       8. ATUALIZAR BOTÕES DE TIPO
  
       Quando o limite é alcançado:
       - Tipos selecionados continuam clicáveis.
       - Tipos não selecionados ficam bloqueados.
       - A pessoa pode desmarcar um para trocar.
    ========================================== */
  
    function renderTypes(snapshot) {
      const selectedTypes =
        new Set(snapshot.selectedTypes);
  
      const hasQuantity =
        snapshot.quantity !== null;
  
      const atLimit =
        hasQuantity &&
        snapshot.selectedTypeCount >=
          snapshot.quantity;
  
      const buttons =
        elements.typeGroups.querySelectorAll(
          "button[data-type]"
        );
  
      for (const button of buttons) {
        const selected =
          selectedTypes.has(button.dataset.type);
  
        const disabled =
          !hasQuantity ||
          (atLimit && !selected);
  
        button.classList.toggle(
          "is-selected",
          selected
        );
  
        button.setAttribute(
          "aria-pressed",
          String(selected)
        );
  
        button.disabled = disabled;
      }
    }
  
    /* ==========================================
       9. AVISO ROXO DE LIMITE
  
       Sempre visível quando a cliente
       alcança o número máximo de tipos.
    ========================================== */
  
    function renderLimitMessage(snapshot) {
      const hasQuantity =
        snapshot.quantity !== null;
  
      const atLimit =
        hasQuantity &&
        snapshot.selectedTypeCount >=
          snapshot.quantity;
  
      if (atLimit) {
        elements.limitMessage.textContent =
          `Você já selecionou o máximo de ` +
          `${snapshot.quantity} tipos de produtos ` +
          `para sua Tico-Tico. ` +
          `Se quiser escolher outro tipo, ` +
          `desmarque um dos anteriores.`;
  
        elements.limitMessage.hidden = false;
  
        return;
      }
  
      elements.limitMessage.hidden = true;
      elements.limitMessage.textContent = "";
    }
  
    /* ==========================================
       10. LIBERAR O BOTÃO DE AVANÇO
  
       Regras:
       - Quantidade escolhida
       - Pelo menos um tipo selecionado
       - Não precisa preencher todos os tipos
  
       A validação das unidades acontece
       na próxima etapa.
    ========================================== */
  
    function renderNextButton(snapshot) {
      elements.nextButton.disabled =
        !snapshot.canChooseProducts;
    }
  
    /* ==========================================
       11. RENDERIZAÇÃO COMPLETA
    ========================================== */
  
    function render(snapshot) {
      if (!elements) {
        return;
      }
  
      const state =
        snapshot ||
        window.TicoTico.store.getSnapshot();
  
      renderQuantities(state);
      renderTypes(state);
      const count = state.selectedTypeCount;
      const total = state.quantity === null ? "" : ` de ${state.quantity}`;
      const counterText = `${count}${total} tipos selecionados`;
      if (elements.typeCounter.textContent !== counterText) {
        const parts = [createElement("strong", "", String(count))];
        if (state.quantity !== null) {
          parts.push(" de ", createElement("strong", "", String(state.quantity)));
        }
        elements.typeCounter.replaceChildren(...parts, " tipos selecionados");
      }
      renderLimitMessage(state);
      renderNextButton(state);
    }
  
    /* ==========================================
       12. EVENTO DE ESCOLHA DE QUANTIDADE
    ========================================== */
  
    function handleQuantityClick(event) {
      const button = event.target.closest(
        "button[data-quantity]"
      );
  
      if (
        !button ||
        !elements.quantityOptions.contains(button)
      ) {
        return;
      }
  
      const quantity =
        Number(button.dataset.quantity);
  
      const result =
        window.TicoTico.store.setQuantity(quantity);
  
      if (!result.ok) {
        console.warn(
          "[Tico-Tico] Quantidade inválida:",
          result.reason
        );
      }
    }
  
    /* ==========================================
       13. EVENTO DE ESCOLHA DOS TIPOS
  
       Um listener atende todos os tipos,
       independentemente da categoria.
    ========================================== */
  
    function handleTypeClick(event) {
      const button = event.target.closest(
        "button[data-type]"
      );
  
      if (
        !button ||
        button.disabled ||
        !elements.typeGroups.contains(button)
      ) {
        return;
      }
  
      const typeId = button.dataset.type;
  
      const result =
        window.TicoTico.store.toggleType(typeId);
  
      if (!result.ok) {
        if (result.reason === "type-limit") {
          const snapshot =
            window.TicoTico.store.getSnapshot();
  
          renderLimitMessage(snapshot);
        } else {
          console.warn(
            "[Tico-Tico] Não foi possível " +
            "selecionar o tipo:",
            result.reason
          );
        }
      }
    }
  
    /* ==========================================
       14. INICIALIZAÇÃO
  
       IMPORTANTE:
       O catálogo precisa estar carregado.
  
       No app.js faremos:
         await catalog.load();
         views.categories.init();
    ========================================== */
  
    function init() {
      if (initialized) {
        return true;
      }
  
      if (
        !window.TicoTico?.store ||
        !window.TicoTico?.catalog
      ) {
        console.error(
          "[Tico-Tico] Dependências ausentes " +
          "para inicializar categorias."
        );
  
        return false;
      }
  
      if (!window.TicoTico.catalog.isLoaded()) {
        console.error(
          "[Tico-Tico] Carregue o catálogo " +
          "antes de inicializar as categorias."
        );
  
        return false;
      }
  
      const references = getElements();
  
      if (!validateElements(references)) {
        return false;
      }
  
      elements = references;
  
      try {
        renderCategoryGroups();
      } catch (error) {
        console.error(
          "[Tico-Tico] Erro ao construir categorias:",
          error
        );
  
        elements = null;
        return false;
      }
  
      elements.quantityOptions.addEventListener(
        "click",
        handleQuantityClick
      );
  
      elements.typeGroups.addEventListener(
        "click",
        handleTypeClick
      );
  
      unsubscribe =
        window.TicoTico.store.subscribe(render);
  
      initialized = true;
  
      render(
        window.TicoTico.store.getSnapshot()
      );
  
      return true;
    }
  
    /* ==========================================
       15. LIMPEZA
  
       Mantém o módulo preparado para
       futuras reinicializações.
    ========================================== */
  
    function destroy() {
      if (!initialized || !elements) {
        return;
      }
  
      elements.quantityOptions.removeEventListener(
        "click",
        handleQuantityClick
      );
  
      elements.typeGroups.removeEventListener(
        "click",
        handleTypeClick
      );
  
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
  
      unsubscribe = null;
      elements = null;
      initialized = false;
    }
  
    /* ==========================================
       16. API PÚBLICA
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.views =
      window.TicoTico.views || {};
  
    window.TicoTico.views.categories =
      Object.freeze({
        init,
        render,
        destroy
      });
  
  })();
  