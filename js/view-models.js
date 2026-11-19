
/**
 * TICO-TICO — VISUALIZAÇÃO DOS MODELOS
 *
 * Arquivo: js/view-models.js
 *
 * Responsabilidades:
 * - Exibir os modelos de nécessaire
 * - Atualizar imagem, nome e descrição
 * - Destacar a opção selecionada
 * - Enviar a escolha ao BuilderStore
 * - Exibir o modo manual como opção disponível
 *
 * Não controla a navegação entre etapas.
 * Não modifica quantidade nem carrinho.
 *
 * Dependência:
 * - js/builder-state.js
 *
 * API pública:
 * window.TicoTico.views.models
 */

(() => {
    "use strict";
  
    /* ==========================================
       1. CONFIGURAÇÃO DOS MODELOS
    ========================================== */
  
    const MODELS = Object.freeze({
      transparente: Object.freeze({
        id: "transparente",
  
        name: "Nécessaire Transparente",
  
        image:
          "assets/Necessaire Transparente Tico-Tico.png",
  
        alt:
          "Nécessaire transparente Tico-Tico",
  
        description:
          "Prática, leve e cheia de charme. " +
          "A nécessaire transparente deixa seus " +
          "pequenos essenciais sempre à vista, " +
          "facilitando a organização da bolsa. " +
          "Perfeita para quem gosta de encontrar " +
          "tudo rapidinho e levar seus cuidados " +
          "favoritos para qualquer lugar."
      }),
  
      tela: Object.freeze({
        id: "tela",
  
        name: "Nécessaire de Tela",
  
        image:
          "assets/Necessaire de Tela Tico-Tico.png",
  
        alt:
          "Nécessaire de tela Tico-Tico",
  
        description:
          "Levinha, delicada e cheia de personalidade. " +
          "A nécessaire de tela é uma companheira " +
          "versátil para organizar os pequenos " +
          "essenciais da rotina. Seu material permite " +
          "visualizar o que está dentro, enquanto " +
          "o detalhe roxo com a identidade Tico-Tico " +
          "deixa tudo ainda mais especial."
      }),
  
      tecido: Object.freeze({
        id: "tecido",
  
        name: "Nécessaire de Tecido",
  
        image:
          "assets/Necessaire-tecido.png",
  
        alt:
          "Nécessaire de tecido estampada Tico-Tico",
  
        description:
          "Aconchegante, charmosa e feita para " +
          "acompanhar você. Nossa nécessaire de " +
          "tecido traz a estampa botânica da " +
          "Tico-Tico, com seus raminhos coloridos " +
          "e detalhes delicados. Uma escolha " +
          "especial para quem ama organizar " +
          "os cuidados do dia a dia com estilo."
      })
    });
  
    /* ==========================================
       2. REFERÊNCIAS AOS ELEMENTOS HTML
    ========================================== */
  
    let elements = null;
  
    let unsubscribe = null;
  
    let initialized = false;
  
    function getElements() {
      return {
        options:
          document.getElementById("model-options"),
  
        image:
          document.getElementById(
            "selected-model-image"
          ),
  
        name:
          document.getElementById(
            "selected-model-name"
          ),
  
        description:
          document.getElementById(
            "selected-model-description"
          ),
  
        manualButton:
          document.getElementById("mode-manual"),
  
        aiButton:
          document.getElementById("mode-ai")
      };
    }
  
    /* ==========================================
       3. VALIDAÇÃO DA ESTRUTURA HTML
    ========================================== */
  
    function validateElements(references) {
      const missing = Object.entries(references)
        .filter(([, element]) => !element)
        .map(([name]) => name);
  
      if (missing.length > 0) {
        console.error(
          "[Tico-Tico] Elementos ausentes " +
          "na tela de modelos:",
          missing
        );
  
        return false;
      }
  
      return true;
    }
  
    /* ==========================================
       4. ATUALIZAR A FOTO E DESCRIÇÃO
    ========================================== */
  
    function getModel(modelId) {
      return MODELS[modelId] || MODELS.transparente;
    }

    function renderPreview(modelId) {
      if (!elements) {
        return;
      }
  
      const model = getModel(modelId);
  
      const currentSource =
        elements.image.getAttribute("src");
  
      /*
       * Só altera o caminho da imagem quando
       * o modelo realmente muda.
       *
       * Isso evita recarregar a foto
       * desnecessariamente.
       */
      if (currentSource !== model.image) {
        elements.image.src = model.image;
      }
  
      elements.image.alt = model.alt;
  
      elements.name.textContent = model.name;
  
      elements.description.textContent =
        model.description;
    }
  
    /* ==========================================
       5. DESTACAR O MODELO SELECIONADO
    ========================================== */
  
    function renderModelOptions(modelId) {
      if (!elements) {
        return;
      }
  
      const buttons =
        elements.options.querySelectorAll(
          "[data-model]"
        );
  
      for (const button of buttons) {
        const selected =
          button.dataset.model === modelId;
  
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
       6. EXIBIR O MODO DE MONTAGEM
    ========================================== */
  
    function renderAssemblyMode(mode) {
      if (!elements) {
        return;
      }
  
      const isManual = mode === "manual";
  
      elements.manualButton.classList.toggle(
        "is-selected",
        isManual
      );
  
      elements.manualButton.setAttribute(
        "aria-pressed",
        String(isManual)
      );
  
      /*
       * A integração com IA ainda não existe.
       *
       * Mantemos a opção visível para comunicar
       * a funcionalidade futura, mas impedimos
       * que ela seja selecionada.
       */
      elements.aiButton.disabled = true;
  
      elements.aiButton.setAttribute(
        "aria-disabled",
        "true"
      );
  
      elements.aiButton.setAttribute(
        "aria-pressed",
        "false"
      );
    }
  
    /* ==========================================
       7. RENDERIZAÇÃO COMPLETA
  
       Recebe os dados atuais do BuilderStore
       e sincroniza a interface.
    ========================================== */
  
    function render(snapshot) {
      if (!elements) {
        return;
      }
  
      const state =
        snapshot ||
        window.TicoTico.store.getSnapshot();
  
      renderPreview(state.model);
  
      renderModelOptions(state.model);
  
      renderAssemblyMode(state.mode);
    }
  
    /* ==========================================
       8. EVENTO DE ESCOLHA DO MODELO
  
       Usamos delegação de eventos:
       um único listener cuida dos três botões.
    ========================================== */
  
    function handleModelSelection(event) {
      const button = event.target.closest(
        "button[data-model]"
      );
  
      if (
        !button ||
        !elements.options.contains(button)
      ) {
        return;
      }
  
      const modelId = button.dataset.model;
  
      if (!Object.hasOwn(MODELS, modelId)) {
        console.warn(
          "[Tico-Tico] Modelo desconhecido:",
          modelId
        );
  
        return;
      }
  
      const result =
        window.TicoTico.store.setModel(modelId);
  
      if (!result.ok) {
        console.warn(
          "[Tico-Tico] Não foi possível " +
          "selecionar o modelo:",
          result.reason
        );
  
        return;
      }
  
      /*
       * Caso o modelo clicado já seja o
       * selecionado, setModel não dispara
       * uma nova notificação.
       *
       * Atualizamos a interface mesmo assim.
       */
      render();
    }
  
    /* ==========================================
       9. EVENTO DO MODO MANUAL
    ========================================== */
  
    function handleManualSelection() {
      const result =
        window.TicoTico.store.setMode("manual");
  
      if (!result.ok) {
        console.warn(
          "[Tico-Tico] Modo indisponível:",
          result.reason
        );
  
        return;
      }
  
      render();
    }
  
    /* ==========================================
       10. INICIALIZAÇÃO
  
       Este método será chamado pelo app.js.
  
       Pode ser chamado mais de uma vez sem
       duplicar os eventos.
    ========================================== */
  
    function init() {
      if (initialized) {
        return true;
      }
  
      if (!window.TicoTico?.store) {
        console.error(
          "[Tico-Tico] BuilderStore não encontrado. " +
          "Verifique se builder-state.js " +
          "foi carregado antes de view-models.js."
        );
  
        return false;
      }
  
      const references = getElements();
  
      if (!validateElements(references)) {
        return false;
      }
  
      elements = references;
  
      elements.options.addEventListener(
        "click",
        handleModelSelection
      );
  
      elements.manualButton.addEventListener(
        "click",
        handleManualSelection
      );
  
      /*
       * Inscreve a tela nas atualizações do
       * estado central.
       *
       * Se outro módulo alterar o modelo,
       * a imagem e os botões serão atualizados.
       */
      unsubscribe =
        window.TicoTico.store.subscribe(render);
  
      initialized = true;
  
      // Apresenta o modelo inicialmente selecionado.
      render(
        window.TicoTico.store.getSnapshot()
      );
  
      return true;
    }
  
    /* ==========================================
       11. LIMPEZA DOS EVENTOS
  
       Útil caso futuramente o configurador
       seja desmontado ou reinicializado.
    ========================================== */
  
    function destroy() {
      if (!initialized || !elements) {
        return;
      }
  
      elements.options.removeEventListener(
        "click",
        handleModelSelection
      );
  
      elements.manualButton.removeEventListener(
        "click",
        handleManualSelection
      );
  
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
  
      unsubscribe = null;
      elements = null;
      initialized = false;
    }
  
    /* ==========================================
       12. API PÚBLICA
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.views =
      window.TicoTico.views || {};
  
    window.TicoTico.views.models = Object.freeze({
      getModel,
      init,
      render,
      destroy
    });
  
  })();
  