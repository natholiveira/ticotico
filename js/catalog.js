
/**
 * TICO-TICO — CATÁLOGO DE PRODUTOS
 *
 * Arquivo: js/catalog.js
 *
 * Responsabilidades:
 * - Carregar data/catalogo.json
 * - Validar e organizar os produtos
 * - Disponibilizar categorias e tipos
 * - Filtrar produtos
 * - Paginar resultados
 * - Consultar produtos pelo ID
 *
 * Não manipula HTML.
 * Não altera o carrinho.
 *
 * API pública:
 * window.TicoTico.catalog
 */

(() => {
    "use strict";
  
    const DATA_URL = "data/catalogo.json";
  
    const PAGE_SIZE = 8;
  
    /*
     * IDs fixos das categorias.
     *
     * Devem corresponder ao campo "category"
     * do arquivo catalogo.json.
     */
    const CATEGORY_CONFIG = Object.freeze([
      {
        id: "make",
        label: "Maquiagem e rosto",
        description: "Beleza, cuidado e maquiagem."
      },
      {
        id: "scent",
        label: "Perfumaria e corpo",
        description: "Fragrâncias e hidratação."
      },
      {
        id: "care",
        label: "Higiene e proteção",
        description: "Essenciais para o dia a dia."
      },
      {
        id: "hair",
        label: "Cabelo e praticidade",
        description: "Cuidados e acessórios para levar."
      }
    ]);
  
    /*
     * Dados privados do módulo.
     *
     * Não podem ser modificados diretamente
     * por outros arquivos JavaScript.
     */
    let products = [];
    let productsById = new Map();
    let loadingPromise = null;
    let loaded = false;
  
    /* ==========================================
       1. NORMALIZAÇÃO DOS PRODUTOS
    ========================================== */
  
    function cleanTitle(title) {
      return String(title)
        .replace(/\bkit\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  
    function normalizeProduct(raw, index) {
      const requiredFields = [
        "id",
        "title",
        "category",
        "type",
        "image"
      ];
  
      for (const field of requiredFields) {
        if (
          typeof raw?.[field] !== "string" ||
          !raw[field].trim()
        ) {
          throw new Error(
            `Produto ${index + 1}: campo "${field}" inválido.`
          );
        }
      }
  
      return Object.freeze({
        id: raw.id.trim(),
        title: cleanTitle(raw.title),
        category: raw.category.trim(),
        type: raw.type.trim(),
        image: raw.image.trim(),
  
        imagePlaceholder:
          Boolean(raw.image_placeholder),
  
        originalImage:
          raw.original_image || null
      });
    }
  
    /* ==========================================
       2. CARREGAMENTO DO CATÁLOGO
  
       Uma única requisição por carregamento.
  
       Caso ocorra um erro, permitimos que
       uma nova tentativa seja realizada.
    ========================================== */
  
    async function readCatalog() {
      if (location.protocol === "file:") {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "data/catalogo-local.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Catálogo local indisponível."));
          document.head.append(script);
        });
        return window.TicoTico.localProducts;
      }

      const response = await fetch(DATA_URL, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Não foi possível carregar o catálogo. ` +
          `HTTP ${response.status}`
        );
      }

      return response.json();
    }

    async function load() {
      if (loaded) {
        return products;
      }
  
      if (loadingPromise) {
        return loadingPromise;
      }
  
      loadingPromise = (async () => {
        const data = await readCatalog();

        if (!Array.isArray(data)) {
          throw new Error(
            "O catálogo precisa ser uma lista de produtos."
          );
        }
  
        const normalized = data.map(normalizeProduct);
        const index = new Map();
  
        for (const product of normalized) {
          if (index.has(product.id)) {
            throw new Error(
              `ID de produto duplicado: ${product.id}`
            );
          }
  
          index.set(product.id, product);
        }
  
        products = normalized;
        productsById = index;
        loaded = true;
  
        return products;
      })();
  
      try {
        return await loadingPromise;
      } catch (error) {
        console.error(
          "[Tico-Tico] Falha ao carregar catálogo:",
          error
        );
  
        // Permite tentar carregar novamente.
        loadingPromise = null;
  
        throw error;
      }
    }
  
    /* ==========================================
       3. VERIFICAÇÃO DE CARREGAMENTO
    ========================================== */
  
    function ensureLoaded() {
      if (!loaded) {
        throw new Error(
          "O catálogo ainda não foi carregado. " +
          "Execute await TicoTico.catalog.load() primeiro."
        );
      }
    }
  
    function isLoaded() {
      return loaded;
    }
  
    /* ==========================================
       4. CONSULTAR TODOS OS PRODUTOS
    ========================================== */
  
    function getAllProducts() {
      ensureLoaded();
  
      return [...products];
    }
  
    /* ==========================================
       5. CONSULTAR PRODUTO PELO ID
    ========================================== */
  
    function getProductById(productId) {
      ensureLoaded();
  
      return productsById.get(productId) || null;
    }
  
    /* ==========================================
       6. CONSULTAR CATEGORIAS
  
       Retorna apenas categorias que possuem
       produtos cadastrados.
    ========================================== */
  
    function getCategories() {
      ensureLoaded();
  
      return CATEGORY_CONFIG
        .map(category => {
          const count = products.filter(
            product => product.category === category.id
          ).length;
  
          return {
            ...category,
            count
          };
        })
        .filter(category => category.count > 0);
    }
  
    function getCategoryLabel(categoryId) {
      const category = CATEGORY_CONFIG.find(
        item => item.id === categoryId
      );
  
      return category?.label || categoryId;
    }
  
    /* ==========================================
       7. CONSULTAR TIPOS DE PRODUTOS
  
       Exemplos:
       - Batom e lábios
       - Máscara de cílios
       - Paletas
       - Creme de mãos
       - Perfumes e body splash
  
       O ID do tipo é o próprio nome cadastrado
       no JSON, preservando sua identificação.
    ========================================== */
  
    function getTypesByCategory(categoryId) {
      ensureLoaded();
  
      const categoryProducts = products.filter(
        product => product.category === categoryId
      );
  
      const counts = new Map();
  
      for (const product of categoryProducts) {
        const current = counts.get(product.type) || 0;
  
        counts.set(product.type, current + 1);
      }
  
      return [...counts.entries()].map(
        ([type, count]) => ({
          id: type,
          label: type,
          categoryId,
          count
        })
      );
    }
  
    /* ==========================================
       8. CATEGORIAS COM SEUS TIPOS
  
       Usado para construir a etapa 2.
    ========================================== */
  
    function getCategoryGroups() {
      ensureLoaded();
  
      return getCategories().map(category => ({
        ...category,
        types: getTypesByCategory(category.id)
      }));
    }
  
    /* ==========================================
       9. DESCOBRIR CATEGORIAS SELECIONADAS
  
       Recebe os tipos escolhidos pela cliente
       e devolve as categorias correspondentes.
  
       A primeira categoria acompanha a ordem
       oficial definida em CATEGORY_CONFIG.
    ========================================== */
  
    function getSelectedCategories(selectedTypes) {
      ensureLoaded();
  
      const selected = new Set(selectedTypes);
  
      return getCategoryGroups()
        .filter(category =>
          category.types.some(
            type => selected.has(type.id)
          )
        );
    }
  
    /* ==========================================
       10. FILTRAR PRODUTOS
  
       Filtros opcionais:
       - category: ID da categoria
       - types: lista dos tipos escolhidos
  
       Quando types estiver vazio, não será
       aplicado filtro por tipo.
    ========================================== */
  
    function getProducts({
      category = null,
      types = []
    } = {}) {
      ensureLoaded();
  
      const selectedTypes = new Set(types);
  
      return products.filter(product => {
        if (
          category &&
          product.category !== category
        ) {
          return false;
        }
  
        if (
          selectedTypes.size > 0 &&
          !selectedTypes.has(product.type)
        ) {
          return false;
        }
  
        return true;
      });
    }
  
    /* ==========================================
       11. PAGINAÇÃO
  
       Exemplo:
       findProducts({
         category: "make",
         types: ["Batom e lábios"],
         page: 1
       });
  
       Retorna:
       {
         items: [...],
         page: 1,
         pageSize: 8,
         total: 5,
         totalPages: 1
       }
    ========================================== */
  
    function findProducts({
      category = null,
      types = [],
      page = 1,
      pageSize = PAGE_SIZE
    } = {}) {
      const filtered = getProducts({
        category,
        types
      });
  
      const safePageSize =
        Number.isInteger(Number(pageSize)) &&
        Number(pageSize) > 0
          ? Number(pageSize)
          : PAGE_SIZE;
  
      const total = filtered.length;
  
      const totalPages = Math.max(
        1,
        Math.ceil(total / safePageSize)
      );
  
      const requestedPage = Number(page);
  
      const safePage =
        Number.isInteger(requestedPage)
          ? Math.max(
              1,
              Math.min(requestedPage, totalPages)
            )
          : 1;
  
      const start = (safePage - 1) * safePageSize;
  
      const items = filtered.slice(
        start,
        start + safePageSize
      );
  
      return {
        items,
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages
      };
    }
  
    /* ==========================================
       12. ESTATÍSTICAS DO CATÁLOGO
    ========================================== */
  
    function getStats() {
      ensureLoaded();
  
      return {
        totalProducts: products.length,
        totalCategories: getCategories().length,
  
        totalTypes: getCategoryGroups().reduce(
          (total, category) =>
            total + category.types.length,
          0
        ),
  
        placeholderImages: products.filter(
          product => product.imagePlaceholder
        ).length
      };
    }
  
    /* ==========================================
       13. API PÚBLICA
  
       Os próximos arquivos poderão consultar
       o catálogo sem conhecer como ele
       foi carregado ou armazenado.
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.catalog = Object.freeze({
      load,
      isLoaded,
      getAllProducts,
      getProductById,
      getCategories,
      getCategoryLabel,
      getTypesByCategory,
      getCategoryGroups,
      getSelectedCategories,
      getProducts,
      findProducts,
      getStats
    });
  
  })();
  