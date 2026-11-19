
/**
 * TICO-TICO — VITRINE DE PRODUTOS
 *
 * Arquivo: js/view-products.js
 *
 * Responsabilidades:
 * - Exibir categorias selecionadas
 * - Filtrar produtos pelos tipos escolhidos
 * - Renderizar cards de produtos
 * - Controlar a paginação
 * - Adicionar e remover unidades
 * - Destacar produtos selecionados
 * - Mostrar o limite do kit
 * - Habilitar o botão de avanço
 *
 * Não controla a navegação entre etapas.
 * Não modifica diretamente o estado interno.
 *
 * Dependências:
 * - js/catalog.js
 * - js/builder-state.js
 *
 * API pública:
 * window.TicoTico.views.products
 */

(() => {
    "use strict";
  
    const PAGE_SIZE = 8;
  
    let elements = null;
    let unsubscribe = null;
    let initialized = false;
  
    /*
     * Estado exclusivamente visual.
     *
     * A categoria e a página atuais não fazem
     * parte das regras de negócio do kit.
     */
    let currentCategory = null;
    let currentPage = 1;
  
    /* ==========================================
       1. REFERÊNCIAS AO HTML
    ========================================== */
  
    function getElements() {
      return {
        categoryTabs:
          document.getElementById(
            "product-category-tabs"
          ),
  
        grid:
          document.getElementById(
            "products-grid"
          ),
  
        pagination:
          document.getElementById(
            "products-pagination"
          ),
  
        selectedCount:
          document.getElementById(
            "selected-units-count"
          ),
  
        selectedLimit:
          document.getElementById(
            "selected-units-limit"
          ),
  
        limitMessage:
          document.getElementById(
            "products-limit-message"
          ),
  
        nextButton:
          document.getElementById(
            "products-next"
          )
      };
    }
  
    function validateElements(references) {
      const missing = Object.entries(references)
        .filter(([, element]) => !element)
        .map(([name]) => name);
  
      if (missing.length > 0) {
        console.error(
          "[Tico-Tico] Elementos ausentes na vitrine:",
          missing
        );
  
        return false;
      }
  
      return true;
    }
  
    /* ==========================================
       2. UTILITÁRIOS DE DOM
  
       Criamos os elementos com createElement
       e textContent para evitar inserir dados
       do catálogo como HTML executável.
    ========================================== */
  
    function createElement(tag, className, text) {
      const element = document.createElement(tag);
  
      if (className) {
        element.className = className;
      }
  
      if (text !== undefined) {
        element.textContent = String(text);
      }
  
      return element;
    }
  
    function createButton(
      className,
      label,
      ariaLabel
    ) {
      const button = createElement(
        "button",
        className,
        label
      );
  
      button.type = "button";
  
      if (ariaLabel) {
        button.setAttribute(
          "aria-label",
          ariaLabel
        );
      }
  
      return button;
    }
  
    /* ==========================================
       3. IMAGEM SUBSTITUTA
  
       Caso uma fotografia esteja ausente,
       usamos uma imagem neutra local à página.
  
       Assim, um arquivo de imagem quebrado
       não compromete o card.
    ========================================== */
  
    const FALLBACK_IMAGE =
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 400 400"
        >
          <rect
            width="400"
            height="400"
            fill="#F1E1CC"
          />
          <circle
            cx="200"
            cy="155"
            r="65"
            fill="#E4D1E2"
          />
          <path
            d="M155 155 Q200 100 245 155
               Q200 210 155 155"
            fill="#6A3B66"
            opacity=".6"
          />
          <text
            x="200"
            y="275"
            text-anchor="middle"
            fill="#6A3B66"
            font-family="Arial,sans-serif"
            font-size="24"
            font-weight="bold"
          >
            Tico-Tico
          </text>
          <text
            x="200"
            y="310"
            text-anchor="middle"
            fill="#6A3B66"
            font-family="Arial,sans-serif"
            font-size="15"
          >
            Imagem em preparação
          </text>
        </svg>
      `);
  
    function createProductImage(product) {
      const image = document.createElement("img");
  
      image.src = product.image;
      image.alt = product.title;
  
      image.loading = "lazy";
      image.decoding = "async";
  
      image.addEventListener(
        "error",
        () => {
          if (image.src !== FALLBACK_IMAGE) {
            image.src = FALLBACK_IMAGE;
          }
        },
        { once: true }
      );
  
      return image;
    }
  
    /* ==========================================
       4. CATEGORIAS DISPONÍVEIS
  
       Só mostramos categorias que possuem
       pelo menos um tipo selecionado.
    ========================================== */
  
    function getAvailableCategories(snapshot) {
      return window.TicoTico.catalog
        .getSelectedCategories(
          snapshot.selectedTypes
        );
    }
  
    function syncCurrentCategory(categories) {
      if (categories.length === 0) {
        currentCategory = null;
        currentPage = 1;
        return;
      }
  
      const stillAvailable = categories.some(
        category =>
          category.id === currentCategory
      );
  
      if (!stillAvailable) {
        // Primeira categoria sempre selecionada.
        currentCategory = categories[0].id;
        currentPage = 1;
      }
    }
  
    /* ==========================================
       5. RENDERIZAR ABAS DE CATEGORIA
    ========================================== */
  
    function renderCategoryTabs(categories) {
      const fragment =
        document.createDocumentFragment();
  
      for (const category of categories) {
        const button = createButton(
          "category-tab",
          category.label,
          `Mostrar produtos de ${category.label}`
        );
  
        button.dataset.category = category.id;
  
        const active =
          category.id === currentCategory;
  
        button.classList.toggle(
          "is-active",
          active
        );
  
        button.setAttribute(
          "aria-pressed",
          String(active)
        );
  
        fragment.appendChild(button);
      }
  
      elements.categoryTabs.replaceChildren(
        fragment
      );
    }
  
    /* ==========================================
       6. FILTRAR PRODUTOS
  
       Regras:
       - Categoria atualmente selecionada
       - Tipos selecionados na etapa anterior
       - Protetor de calcanhar temporariamente
         indisponível
  
       O filtro também remove o protetor caso
       esteja dentro de um tipo genérico.
    ========================================== */
  
    function normalizeText(value) {
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    }
  
    function isTemporarilyUnavailable(product) {
      const description = normalizeText(
        `${product.title} ${product.type}`
      );
  
      return (
        description.includes("protetor") &&
        description.includes("calcanhar")
      );
    }
  
    function getVisibleProducts(snapshot) {
      if (!currentCategory) {
        return [];
      }
  
      return window.TicoTico.catalog
        .getProducts({
          category: currentCategory,
          types: snapshot.selectedTypes
        })
        .filter(
          product =>
            !isTemporarilyUnavailable(product)
        );
    }
  
    /* ==========================================
       7. CONTROLES DE QUANTIDADE
  
       Aparecem no card depois que o produto
       é selecionado pela primeira vez.
  
       - diminui uma unidade
       + adiciona uma unidade
    ========================================== */
  
    function createQuantityControls(
      product,
      quantity,
      remainingUnits
    ) {
      const wrapper = createElement(
        "div",
        "product-card__quantity"
      );
  
      wrapper.setAttribute(
        "role",
        "group"
      );
  
      wrapper.setAttribute(
        "aria-label",
        `Quantidade de ${product.title}`
      );
  
      const minus = createButton(
        "product-card__quantity-button",
        "−",
        `Remover uma unidade de ${product.title}`
      );
  
      minus.dataset.productAction = "remove";
      minus.dataset.productId = product.id;
  
      const value = createElement(
        "span",
        "product-card__quantity-value",
        quantity
      );
  
      value.setAttribute(
        "aria-label",
        `${quantity} unidades`
      );
  
      const plus = createButton(
        "product-card__quantity-button",
        "+",
        `Adicionar outra unidade de ${product.title}`
      );
  
      plus.dataset.productAction = "add";
      plus.dataset.productId = product.id;
  
      plus.disabled = remainingUnits === 0;
  
      wrapper.append(minus, value, plus);
  
      return wrapper;
    }
  
    /* ==========================================
       8. CRIAR CARD DE PRODUTO
  
       Todo o conteúdo é criado a partir
       dos dados reais do catálogo.
    ========================================== */
  
    function createProductCard(
      product,
      snapshot
    ) {
      const store = window.TicoTico.store;
  
      const quantity = store.getProductQuantity(
        product.id
      );
  
      const isSelected = quantity > 0;
      const canAdd = snapshot.remainingUnits > 0;
  
      const card = createElement(
        "article",
        "product-card"
      );
  
      card.dataset.productId = product.id;
  
      card.classList.toggle(
        "is-selected",
        isSelected
      );
  
      /* Imagem */
  
      const imageContainer = createElement(
        "div",
        "product-card__image"
      );
  
      imageContainer.appendChild(
        createProductImage(product)
      );
  
      /* Informações */
  
      const information = createElement(
        "div",
        "product-card__info"
      );
  
      const type = createElement(
        "span",
        "product-card__brand",
        product.type
      );
  
      const title = createElement(
        "h4",
        "product-card__title",
        product.title
      );
  
      information.append(type, title);
  
      /* Rodapé */
  
      const footer = createElement(
        "div",
        "product-card__footer"
      );
  
      if (isSelected) {
        footer.appendChild(
          createQuantityControls(product, quantity, snapshot.remainingUnits)
        );
      } else {
        const addButton = createButton(
          "product-card__add",
          "Adicionar",
          `Adicionar ${product.title} ao kit`
        );
  
        addButton.dataset.productAction = "add";
        addButton.dataset.productId = product.id;
  
        addButton.disabled = !canAdd;
  
        footer.appendChild(addButton);
      }
  
      information.appendChild(footer);
  
      card.append(
        imageContainer,
        information
      );
  
      return card;
    }
  
    /* ==========================================
       9. RENDERIZAR GRADE E PAGINAÇÃO
  
       Exibe 8 produtos por página.
       Preserva as unidades selecionadas ao
       trocar de página ou categoria.
    ========================================== */
  
    function renderProductGrid(snapshot) {
      const allProducts =
        getVisibleProducts(snapshot);
  
      const totalPages = Math.max(
        1,
        Math.ceil(allProducts.length / PAGE_SIZE)
      );
  
      currentPage = Math.max(
        1,
        Math.min(currentPage, totalPages)
      );
  
      const start = (currentPage - 1) * PAGE_SIZE;
  
      const pageProducts = allProducts.slice(
        start,
        start + PAGE_SIZE
      );
  
      const fragment =
        document.createDocumentFragment();
  
      if (pageProducts.length === 0) {
        const empty = createElement(
          "p",
          "builder-alert",
          "Não encontramos produtos disponíveis " +
          "para esta seleção. Volte à etapa " +
          "anterior e escolha outros tipos."
        );
  
        fragment.appendChild(empty);
      }
  
      for (const product of pageProducts) {
        fragment.appendChild(
          createProductCard(product, snapshot)
        );
      }
  
      elements.grid.replaceChildren(fragment);
  
      renderPagination(totalPages);
    }
  
    /* ==========================================
       10. PAGINAÇÃO
    ========================================== */
  
    function renderPagination(totalPages) {
      const fragment =
        document.createDocumentFragment();
  
      if (totalPages <= 1) {
        elements.pagination.replaceChildren();
        return;
      }
  
      const previous = createButton(
        "pagination-button",
        "←",
        "Página anterior"
      );
  
      previous.dataset.page =
        String(currentPage - 1);
  
      previous.disabled = currentPage === 1;
  
      fragment.appendChild(previous);
  
      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {
        const button = createButton(
          "pagination-button",
          String(page),
          `Ir para página ${page}`
        );
  
        button.dataset.page = String(page);
  
        if (page === currentPage) {
          button.classList.add("is-active");
  
          button.setAttribute(
            "aria-current",
            "page"
          );
        }
  
        fragment.appendChild(button);
      }
  
      const next = createButton(
        "pagination-button",
        "→",
        "Próxima página"
      );
  
      next.dataset.page =
        String(currentPage + 1);
  
      next.disabled =
        currentPage === totalPages;
  
      fragment.appendChild(next);
  
      elements.pagination.replaceChildren(
        fragment
      );
    }
  
    /* ==========================================
       11. CONTADOR DE UNIDADES
    ========================================== */
  
    function renderCounter(snapshot) {
      elements.selectedCount.textContent =
        String(snapshot.totalUnits);
  
      elements.selectedLimit.textContent =
        String(snapshot.quantity ?? 0);
    }
  
    /* ==========================================
       12. AVISO ROXO
  
       O alerta aparece quando o kit está
       completo e a cliente não pode adicionar
       novas unidades.
    ========================================== */
  
    function renderLimitMessage(snapshot) {
      const complete =
        snapshot.quantity !== null &&
        snapshot.totalUnits >= snapshot.quantity;
  
      if (complete) {
        elements.limitMessage.textContent =
          `Sua Tico-Tico está completa! ` +
          `Você selecionou ${snapshot.quantity} ` +
          `mini produtos, que é o limite do kit. ` +
          `Para trocar algum item, remova uma ` +
          `unidade antes de adicionar outra.`;
  
        elements.limitMessage.hidden = false;
      } else {
        elements.limitMessage.hidden = true;
        elements.limitMessage.textContent = "";
      }
    }
  
    /* ==========================================
       13. BOTÃO PARA AVANÇAR
  
       Só é habilitado quando:
       totalUnits === quantity
    ========================================== */
  
    function renderNextButton(snapshot) {
      elements.nextButton.disabled =
        !snapshot.isKitComplete;
    }
  
    /* ==========================================
       14. RENDERIZAÇÃO COMPLETA
    ========================================== */
  
    function render(snapshot) {
      if (!elements) {
        return;
      }
  
      const state =
        snapshot ||
        window.TicoTico.store.getSnapshot();
  
      const categories =
        getAvailableCategories(state);
  
      syncCurrentCategory(categories);
  
      renderCategoryTabs(categories);
  
      renderProductGrid(state);
  
      renderCounter(state);
  
      renderLimitMessage(state);
  
      renderNextButton(state);
    }
  
    /* ==========================================
       15. EVENTO DAS CATEGORIAS
    ========================================== */
  
    function handleCategoryClick(event) {
      const button = event.target.closest(
        "button[data-category]"
      );
  
      if (
        !button ||
        !elements.categoryTabs.contains(button)
      ) {
        return;
      }
  
      const categoryId =
        button.dataset.category;
  
      if (currentCategory === categoryId) {
        return;
      }
  
      currentCategory = categoryId;
      currentPage = 1;
  
      render();
    }
  
    /* ==========================================
       16. ADICIONAR OU REMOVER PRODUTO
  
       Toda operação passa pelo BuilderStore,
       que é o responsável por validar os limites.
    ========================================== */
  
    function changeProductQuantity(
      productId,
      action
    ) {
      const product =
        window.TicoTico.catalog.getProductById(
          productId
        );
  
      if (!product) {
        console.warn(
          "[Tico-Tico] Produto não encontrado:",
          productId
        );
  
        return;
      }
  
      const store = window.TicoTico.store;
  
      let result;
  
      if (action === "add") {
        result = store.addProduct(
          product.id,
          product.type
        );
      } else if (action === "remove") {
        result = store.removeProduct(product.id);
      } else {
        return;
      }
  
      if (!result.ok) {
        if (result.reason === "kit-limit") {
          renderLimitMessage(
            store.getSnapshot()
          );
        } else {
          console.warn(
            "[Tico-Tico] Operação não realizada:",
            result.reason
          );
        }
      }
    }
  
    /* ==========================================
       17. EVENTOS DA GRADE
  
       Delegação de eventos:
       um listener atende todos os produtos.
  
       A cliente pode:
       - Clicar em Adicionar
       - Clicar em +
       - Clicar em -
       - Clicar em uma área livre do card
         para adicionar uma unidade
    ========================================== */
  
    function handleProductClick(event) {
      const actionButton = event.target.closest(
        "button[data-product-action]"
      );
  
      if (
        actionButton &&
        elements.grid.contains(actionButton)
      ) {
        const action =
          actionButton.dataset.productAction;
  
        const productId =
          actionButton.dataset.productId;
  
        changeProductQuantity(
          productId,
          action
        );
  
        return;
      }
  
      const card = event.target.closest(
        ".product-card[data-product-id]"
      );
  
      if (
        !card ||
        !elements.grid.contains(card)
      ) {
        return;
      }
  
      changeProductQuantity(
        card.dataset.productId,
        "add"
      );
    }
  
    /* ==========================================
       18. EVENTOS DA PAGINAÇÃO
    ========================================== */
  
    function handlePaginationClick(event) {
      const button = event.target.closest(
        "button[data-page]"
      );
  
      if (
        !button ||
        button.disabled ||
        !elements.pagination.contains(button)
      ) {
        return;
      }
  
      const page = Number(
        button.dataset.page
      );
  
      if (!Number.isInteger(page) || page < 1) {
        return;
      }
  
      currentPage = page;
  
      render();
    }
  
    /* ==========================================
       19. INICIALIZAÇÃO
  
       O catálogo deve estar carregado.
  
       O app.js será responsável por chamar:
         views.products.init()
    ========================================== */
  
    function init() {
      if (initialized) {
        return true;
      }
  
      const app = window.TicoTico;
  
      if (!app?.store || !app?.catalog) {
        console.error(
          "[Tico-Tico] Dependências ausentes " +
          "para inicializar produtos."
        );
  
        return false;
      }
  
      if (!app.catalog.isLoaded()) {
        console.error(
          "[Tico-Tico] O catálogo precisa " +
          "ser carregado antes da vitrine."
        );
  
        return false;
      }
  
      const references = getElements();
  
      if (!validateElements(references)) {
        return false;
      }
  
      elements = references;
  
      elements.categoryTabs.addEventListener(
        "click",
        handleCategoryClick
      );
  
      elements.grid.addEventListener(
        "click",
        handleProductClick
      );
  
      elements.pagination.addEventListener(
        "click",
        handlePaginationClick
      );
  
      unsubscribe = app.store.subscribe(render);
  
      initialized = true;
  
      render(app.store.getSnapshot());
  
      return true;
    }
  
    /* ==========================================
       20. LIMPEZA
    ========================================== */
  
    function destroy() {
      if (!initialized || !elements) {
        return;
      }
  
      elements.categoryTabs.removeEventListener(
        "click",
        handleCategoryClick
      );
  
      elements.grid.removeEventListener(
        "click",
        handleProductClick
      );
  
      elements.pagination.removeEventListener(
        "click",
        handlePaginationClick
      );
  
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
  
      unsubscribe = null;
      elements = null;
  
      currentCategory = null;
      currentPage = 1;
  
      initialized = false;
    }
  
    /* ==========================================
       21. API PÚBLICA
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.views =
      window.TicoTico.views || {};
  
    window.TicoTico.views.products =
      Object.freeze({
        init,
        render,
        destroy
      });
  
  })();
  