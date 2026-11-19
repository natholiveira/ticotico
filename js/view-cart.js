
/**
 * TICO-TICO — VISUALIZAÇÃO DO CARRINHO
 *
 * Arquivo: js/view-cart.js
 *
 * Responsabilidades:
 * - Exibir os produtos escolhidos
 * - Agrupar produtos por categoria
 * - Mostrar imagem, nome, tipo e quantidade
 * - Permitir aumentar ou diminuir unidades
 * - Atualizar o resumo do kit
 * - Validar o botão de avanço
 *
 * Não controla a navegação entre etapas.
 * Não altera diretamente os dados do catálogo.
 *
 * Dependências:
 * - js/catalog.js
 * - js/builder-state.js
 *
 * API pública:
 * window.TicoTico.views.cart
 */

(() => {
    "use strict";
  
    /* ==========================================
       1. CONFIGURAÇÕES
    ========================================== */
  
    const FALLBACK_IMAGE =
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 300 300"
        >
          <rect width="300" height="300" fill="#F1E1CC"/>
          <text
            x="150"
            y="140"
            text-anchor="middle"
            font-family="Arial,sans-serif"
            font-size="25"
            font-weight="bold"
            fill="#6A3B66"
          >Tico-Tico</text>
          <text
            x="150"
            y="175"
            text-anchor="middle"
            font-family="Arial,sans-serif"
            font-size="15"
            fill="#6A3B66"
          >Imagem indisponível</text>
        </svg>
      `);
  
    let elements = null;
    let unsubscribe = null;
    let initialized = false;
  
    /* ==========================================
       2. REFERÊNCIAS AO HTML
    ========================================== */
  
    function getElements() {
      return {
        items: document.getElementById(
          "cart-items"
        ),
  
        modelImage: document.getElementById("cart-model-image"),

        model: document.getElementById(
          "cart-model"
        ),
  
        limit: document.getElementById(
          "cart-limit"
        ),
  
        units: document.getElementById(
          "cart-units"
        ),
  
        nextButton: document.getElementById(
          "cart-next"
        )
      };
    }
  
    function validateElements(references) {
      const missing = Object.entries(references)
        .filter(([, element]) => !element)
        .map(([name]) => name);
  
      if (missing.length > 0) {
        console.error(
          "[Tico-Tico] Elementos ausentes no carrinho:",
          missing
        );
  
        return false;
      }
  
      return true;
    }
  
    /* ==========================================
       3. CRIAÇÃO SEGURA DE ELEMENTOS
  
       Não usamos innerHTML com os dados
       dos produtos.
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
  
    function createButton(className, text, label) {
      const button = createElement(
        "button",
        className,
        text
      );
  
      button.type = "button";
  
      if (label) {
        button.setAttribute("aria-label", label);
      }
  
      return button;
    }
  
    /* ==========================================
       4. IMAGENS DOS PRODUTOS
    ========================================== */
  
    function createProductImage(product) {
      const image = document.createElement("img");
  
      image.src = product.image || FALLBACK_IMAGE;
      image.alt = product.title;
      image.loading = "lazy";
      image.decoding = "async";
  
      image.addEventListener(
        "error",
        () => {
          image.src = FALLBACK_IMAGE;
        },
        { once: true }
      );
  
      return image;
    }
  
    /* ==========================================
       5. RECUPERAR OS PRODUTOS COMPLETOS
  
       O BuilderStore guarda apenas:
       - ID do produto
       - ID do tipo
       - Quantidade
  
       Consultamos o catálogo para recuperar
       nome, imagem e categoria.
    ========================================== */
  
    function getCartProducts() {
      const app = window.TicoTico;
  
      return app.store.getCartItems().map(item => {
        const product = app.catalog.getProductById(
          item.productId
        );
  
        if (!product) {
          console.warn(
            "[Tico-Tico] Produto não encontrado:",
            item.productId
          );
  
          return {
            id: item.productId,
            title: "Produto não encontrado no catálogo",
            category: "unknown",
            type: item.typeId,
            image: FALLBACK_IMAGE,
            quantity: item.quantity
          };
        }
  
        return {
          ...product,
          quantity: item.quantity
        };
      });
    }
  
    /* ==========================================
       6. AGRUPAR PRODUTOS POR CATEGORIA
    ========================================== */
  
    function groupProductsByCategory(products) {
      const groups = new Map();
  
      for (const product of products) {
        if (!groups.has(product.category)) {
          groups.set(product.category, []);
        }
  
        groups.get(product.category).push(product);
      }
  
      return groups;
    }
  
    /* ==========================================
       7. CRIAR CONTROLES DE QUANTIDADE
  
       Os botões chamam o BuilderStore.
       A validação do limite permanece
       centralizada nas regras de negócio.
    ========================================== */
  
    function createQuantityControl(product, snapshot) {
      const wrapper = createElement(
        "div",
        "quantity-control"
      );
  
      wrapper.setAttribute("role", "group");
  
      wrapper.setAttribute(
        "aria-label",
        `Quantidade de ${product.title}`
      );
  
      const minus = createButton(
        "quantity-control__button",
        "−",
        `Remover uma unidade de ${product.title}`
      );
  
      minus.dataset.cartAction = "remove";
      minus.dataset.productId = product.id;
  
      const value = createElement(
        "span",
        "quantity-control__value",
        product.quantity
      );
  
      value.setAttribute(
        "aria-label",
        `${product.quantity} unidades`
      );
  
      const plus = createButton(
        "quantity-control__button",
        "+",
        `Adicionar uma unidade de ${product.title}`
      );
  
      plus.dataset.cartAction = "add";
      plus.dataset.productId = product.id;
  
      plus.disabled = snapshot.remainingUnits === 0;
  
      wrapper.append(minus, value, plus);
  
      return wrapper;
    }
  
    /* ==========================================
       8. CRIAR LINHA DO PRODUTO
    ========================================== */
  
    function createCartItem(product, snapshot) {
      const article = createElement(
        "article",
        "cart-item"
      );
  
      article.dataset.productId = product.id;
  
      // Fotografia
      const imageWrapper = createElement(
        "div",
        "cart-item__image"
      );
  
      imageWrapper.appendChild(
        createProductImage(product)
      );
  
      // Informações
      const info = createElement(
        "div",
        "cart-item__info"
      );
  
      const type = createElement(
        "p",
        "cart-item__brand",
        product.type
      );
  
      const name = createElement(
        "h5",
        "cart-item__name",
        product.title
      );
  
      const quantityDescription = createElement(
        "p",
        "cart-item__type",
        `${product.quantity} ${
          product.quantity === 1
            ? "unidade selecionada"
            : "unidades selecionadas"
        }`
      );
  
      info.append(
        type,
        name,
        quantityDescription
      );
  
      // Controles
      const quantityWrapper = createElement(
        "div",
        "cart-item__quantity"
      );
  
      quantityWrapper.appendChild(
        createQuantityControl(product, snapshot)
      );
  
      article.append(
        imageWrapper,
        info,
        quantityWrapper
      );
  
      return article;
    }
  
    /* ==========================================
       9. CRIAR GRUPO DE CATEGORIA
    ========================================== */
  
    function createCategorySection(
      categoryId,
      products,
      snapshot
    ) {
      const section = createElement(
        "section",
        "cart-category"
      );
  
      const header = createElement(
        "div",
        "cart-category__header"
      );
  
      const categoryName =
        categoryId === "unknown"
          ? "Outros produtos"
          : window.TicoTico.catalog
              .getCategoryLabel(categoryId);
  
      const title = createElement(
        "h4",
        "",
        categoryName
      );
  
      const unitCount = products.reduce(
        (total, product) =>
          total + product.quantity,
        0
      );
  
      const count = createElement(
        "span",
        "",
        `${unitCount} ${
          unitCount === 1 ? "mini" : "minis"
        }`
      );
  
      header.append(title, count);
  
      const list = createElement(
        "div",
        "cart-category__items"
      );
  
      for (const product of products) {
        list.appendChild(
          createCartItem(product, snapshot)
        );
      }
  
      section.append(header, list);
  
      return section;
    }
  
    /* ==========================================
       10. RENDERIZAR PRODUTOS DO CARRINHO
  
       As categorias são mostradas na ordem
       oficial do catálogo.
    ========================================== */
  
    function renderCartItems(snapshot) {
      const products = getCartProducts();
  
      const fragment =
        document.createDocumentFragment();
  
      if (products.length === 0) {
        const empty = createElement(
          "p",
          "builder-alert",
          "Seu carrinho ainda está vazio. " +
          "Volte à etapa anterior e escolha " +
          "seus mini produtos favoritos."
        );
  
        fragment.appendChild(empty);
  
        elements.items.replaceChildren(fragment);
  
        return;
      }
  
      const groups =
        groupProductsByCategory(products);
  
      // Ordem oficial das categorias.
      const orderedCategories =
        window.TicoTico.catalog
          .getCategories()
          .map(category => category.id);
  
      /*
       * Se existir alguma categoria não
       * cadastrada, ela também será exibida.
       */
      for (const categoryId of groups.keys()) {
        if (!orderedCategories.includes(categoryId)) {
          orderedCategories.push(categoryId);
        }
      }
  
      for (const categoryId of orderedCategories) {
        const categoryProducts =
          groups.get(categoryId);
  
        if (!categoryProducts?.length) {
          continue;
        }
  
        fragment.appendChild(
          createCategorySection(
            categoryId,
            categoryProducts,
            snapshot
          )
        );
      }
  
      elements.items.replaceChildren(fragment);
    }
  
    /* ==========================================
       11. RENDERIZAR RESUMO DO KIT
    ========================================== */
  
    function renderSummary(snapshot) {
      const model = window.TicoTico.views.models.getModel(snapshot.model);
      elements.model.textContent = model.name;
      if (elements.modelImage.getAttribute("src") !== model.image) {
        elements.modelImage.src = model.image;
      }
  
      elements.limit.textContent = String(
        snapshot.quantity ?? 0
      );
  
      elements.units.textContent = String(
        snapshot.totalUnits
      );
    }
  
    /* ==========================================
       12. VALIDAR O BOTÃO DE AVANÇO
  
       Se a cliente remover um produto,
       o botão será desabilitado até que
       o kit esteja completo novamente.
    ========================================== */
  
    function renderNextButton(snapshot) {
      elements.nextButton.disabled =
        !snapshot.isKitComplete;
    }
  
    /* ==========================================
       13. RENDERIZAÇÃO COMPLETA
    ========================================== */
  
    function render(snapshot) {
      if (!elements) {
        return;
      }
  
      const state =
        snapshot ||
        window.TicoTico.store.getSnapshot();
  
      renderCartItems(state);
      renderSummary(state);
      renderNextButton(state);
    }
  
    /* ==========================================
       14. EVENTOS DOS CONTROLES + E -
  
       Um único listener atende todos
       os produtos exibidos no carrinho.
    ========================================== */
  
    function handleCartClick(event) {
      const button = event.target.closest(
        "button[data-cart-action]"
      );
  
      if (
        !button ||
        button.disabled ||
        !elements.items.contains(button)
      ) {
        return;
      }
  
      const action = button.dataset.cartAction;
      const productId = button.dataset.productId;
  
      const store = window.TicoTico.store;
  
      let result;
  
      if (action === "remove") {
        result = store.removeProduct(productId);
      } else if (action === "add") {
        const product = window.TicoTico.catalog
          .getProductById(productId);
  
        if (!product) {
          return;
        }
  
        result = store.addProduct(
          product.id,
          product.type
        );
      } else {
        return;
      }
  
      if (!result?.ok) {
        console.warn(
          "[Tico-Tico] Não foi possível " +
          "alterar a quantidade:",
          result?.reason
        );
      }
    }
  
    /* ==========================================
       15. INICIALIZAÇÃO
    ========================================== */
  
    function init() {
      if (initialized) {
        return true;
      }
  
      const app = window.TicoTico;
  
      if (!app?.store || !app?.catalog) {
        console.error(
          "[Tico-Tico] Dependências ausentes " +
          "para inicializar o carrinho."
        );
  
        return false;
      }
  
      if (!app.catalog.isLoaded()) {
        console.error(
          "[Tico-Tico] O catálogo precisa " +
          "ser carregado antes do carrinho."
        );
  
        return false;
      }
  
      const references = getElements();
  
      if (!validateElements(references)) {
        return false;
      }
  
      elements = references;
  
      elements.items.addEventListener(
        "click",
        handleCartClick
      );
  
      unsubscribe = app.store.subscribe(render);
  
      initialized = true;
  
      render(app.store.getSnapshot());
  
      return true;
    }
  
    /* ==========================================
       16. LIMPEZA
    ========================================== */
  
    function destroy() {
      if (!initialized || !elements) {
        return;
      }
  
      elements.items.removeEventListener(
        "click",
        handleCartClick
      );
  
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
  
      unsubscribe = null;
      elements = null;
      initialized = false;
    }
  
    /* ==========================================
       17. API PÚBLICA
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.views =
      window.TicoTico.views || {};
  
    window.TicoTico.views.cart = Object.freeze({
      init,
      render,
      destroy
    });
  
  })();
  