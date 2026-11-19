
/**
 * TICO-TICO — ESTADO DO CONFIGURADOR
 *
 * Arquivo: js/builder-state.js
 *
 * Responsabilidade:
 * Controlar as escolhas da cliente e validar
 * as regras de montagem dos kits.
 *
 * Este módulo não manipula elementos HTML.
 *
 * Dependências externas: nenhuma.
 *
 * Interface pública:
 * window.TicoTico.store
 */

(() => {
    "use strict";
  
    const VALID_MODELS = [
      "transparente",
      "tela",
      "tecido"
    ];
  
    const VALID_QUANTITIES = [5, 7, 10];
  
    class BuilderStore {
      constructor() {
        this.model = "transparente";
        this.mode = "manual";
  
        // A quantidade será escolhida na etapa 2.
        this.quantity = null;
  
        // Tipos escolhidos: batom, perfume, pente etc.
        this.selectedTypes = new Set();
  
        /*
         * Carrinho:
         *
         * Map<productId, {
         *   productId: string,
         *   typeId: string,
         *   quantity: number
         * }>
         */
        this.cart = new Map();
  
        // Funções inscritas para receber alterações.
        this.listeners = new Set();
      }
  
      /* ==========================================
         1. LEITURA DO ESTADO
      ========================================== */
  
      getSnapshot() {
        return {
          model: this.model,
          mode: this.mode,
          quantity: this.quantity,
  
          selectedTypes: [...this.selectedTypes],
  
          cart: [...this.cart.values()].map(item => ({
            ...item
          })),
  
          totalUnits: this.getTotalUnits(),
          remainingUnits: this.getRemainingUnits(),
  
          selectedTypeCount: this.selectedTypes.size,
  
          canChooseProducts: this.canChooseProducts(),
          isKitComplete: this.isKitComplete()
        };
      }
  
      getTotalUnits() {
        let total = 0;
  
        for (const item of this.cart.values()) {
          total += item.quantity;
        }
  
        return total;
      }
  
      getRemainingUnits() {
        if (this.quantity === null) {
          return 0;
        }
  
        return Math.max(
          0,
          this.quantity - this.getTotalUnits()
        );
      }
  
      getProductQuantity(productId) {
        return this.cart.get(productId)?.quantity ?? 0;
      }
  
      getCartItems() {
        return [...this.cart.values()].map(item => ({
          ...item
        }));
      }
  
      hasType(typeId) {
        return this.selectedTypes.has(typeId);
      }
  
      isLimitReached() {
        return (
          this.quantity !== null &&
          this.getTotalUnits() >= this.quantity
        );
      }
  
      /* ==========================================
         2. INSCRIÇÃO EM MUDANÇAS
  
         As interfaces podem receber notificações
         sempre que o estado for alterado.
      ========================================== */
  
      subscribe(listener) {
        if (typeof listener !== "function") {
          throw new TypeError(
            "O listener precisa ser uma função."
          );
        }
  
        this.listeners.add(listener);
  
        // Permite cancelar a inscrição.
        return () => {
          this.listeners.delete(listener);
        };
      }
  
      notify() {
        const snapshot = this.getSnapshot();
  
        for (const listener of this.listeners) {
          listener(snapshot);
        }
      }
  
      /* ==========================================
         3. ESCOLHA DA NÉCESSAIRE
      ========================================== */
  
      setModel(model) {
        if (!VALID_MODELS.includes(model)) {
          return {
            ok: false,
            reason: "invalid-model"
          };
        }
  
        if (this.model === model) {
          return { ok: true };
        }
  
        this.model = model;
  
        this.notify();
  
        return { ok: true };
      }
  
      /* ==========================================
         4. MODO DE MONTAGEM
  
         A integração com IA será implementada
         futuramente. Por enquanto, apenas
         o modo manual está disponível.
      ========================================== */
  
      setMode(mode) {
        if (mode !== "manual") {
          return {
            ok: false,
            reason: "mode-unavailable"
          };
        }
  
        this.mode = mode;
  
        this.notify();
  
        return { ok: true };
      }
  
      /* ==========================================
         5. QUANTIDADE DO KIT
      ========================================== */
  
      setQuantity(quantity) {
        const value = Number(quantity);
  
        if (!VALID_QUANTITIES.includes(value)) {
          return {
            ok: false,
            reason: "invalid-quantity"
          };
        }
  
        this.quantity = value;
  
        /*
         * Se a cliente diminuir a quantidade do kit,
         * precisamos respeitar o novo limite.
         */
  
        const types = [...this.selectedTypes];
  
        if (types.length > value) {
          this.selectedTypes = new Set(
            types.slice(0, value)
          );
        }
  
        // Remove produtos de tipos não selecionados.
        this.removeUnselectedTypeProducts();
  
        /*
         * Se o carrinho já tiver mais unidades
         * do que o novo limite, reduzimos a
         * quantidade dos últimos itens.
         */
        this.trimCartToLimit();
  
        this.notify();
  
        return { ok: true };
      }
  
      trimCartToLimit() {
        if (this.quantity === null) {
          return;
        }
  
        let excess =
          this.getTotalUnits() - this.quantity;
  
        if (excess <= 0) {
          return;
        }
  
        const entries = [...this.cart.entries()];
  
        // Começa pelo último produto adicionado.
        for (
          let index = entries.length - 1;
          index >= 0 && excess > 0;
          index--
        ) {
          const [productId, item] = entries[index];
  
          const removeCount = Math.min(
            item.quantity,
            excess
          );
  
          const newQuantity =
            item.quantity - removeCount;
  
          if (newQuantity === 0) {
            this.cart.delete(productId);
          } else {
            this.cart.set(productId, {
              ...item,
              quantity: newQuantity
            });
          }
  
          excess -= removeCount;
        }
      }
  
      /* ==========================================
         6. ESCOLHA DOS TIPOS
  
         Exemplo:
         - Batom
         - Perfume
         - Pente
  
         A quantidade de tipos não pode ultrapassar
         o tamanho do kit.
  
         Porém, a cliente NÃO precisa selecionar
         um tipo para cada unidade.
      ========================================== */
  
      toggleType(typeId) {
        if (
          typeof typeId !== "string" ||
          !typeId.trim()
        ) {
          return {
            ok: false,
            reason: "invalid-type"
          };
        }
  
        if (this.quantity === null) {
          return {
            ok: false,
            reason: "quantity-required"
          };
        }
  
        // Desmarcar um tipo já escolhido.
        if (this.selectedTypes.has(typeId)) {
          this.selectedTypes.delete(typeId);
  
          // Remove os produtos desse tipo do carrinho.
          this.removeProductsByType(typeId);
  
          this.notify();
  
          return {
            ok: true,
            selected: false
          };
        }
  
        // Verificação do limite máximo de tipos.
        if (this.selectedTypes.size >= this.quantity) {
          return {
            ok: false,
            reason: "type-limit"
          };
        }
  
        this.selectedTypes.add(typeId);
  
        this.notify();
  
        return {
          ok: true,
          selected: true
        };
      }
  
      removeProductsByType(typeId) {
        for (const [productId, item] of this.cart) {
          if (item.typeId === typeId) {
            this.cart.delete(productId);
          }
        }
      }
  
      removeUnselectedTypeProducts() {
        for (const [productId, item] of this.cart) {
          if (!this.selectedTypes.has(item.typeId)) {
            this.cart.delete(productId);
          }
        }
      }
  
      canChooseProducts() {
        return (
          this.quantity !== null &&
          this.selectedTypes.size > 0 &&
          this.selectedTypes.size <= this.quantity
        );
      }
  
      /* ==========================================
         7. ADICIONAR PRODUTO
  
         Pode adicionar diferentes produtos
         ou várias unidades do mesmo produto.
  
         A soma nunca poderá ultrapassar
         o limite escolhido.
      ========================================== */
  
      addProduct(productId, typeId) {
        if (
          typeof productId !== "string" ||
          !productId.trim()
        ) {
          return {
            ok: false,
            reason: "invalid-product"
          };
        }
  
        if (!this.selectedTypes.has(typeId)) {
          return {
            ok: false,
            reason: "type-not-selected"
          };
        }
  
        if (this.isLimitReached()) {
          return {
            ok: false,
            reason: "kit-limit"
          };
        }
  
        const existing = this.cart.get(productId);
  
        if (existing && existing.typeId !== typeId) {
          return {
            ok: false,
            reason: "product-type-mismatch"
          };
        }
  
        if (existing) {
          this.cart.set(productId, {
            ...existing,
            quantity: existing.quantity + 1
          });
        } else {
          this.cart.set(productId, {
            productId,
            typeId,
            quantity: 1
          });
        }
  
        this.notify();
  
        return {
          ok: true,
          quantity: this.getProductQuantity(productId)
        };
      }
  
      /* ==========================================
         8. REMOVER UMA UNIDADE
      ========================================== */
  
      removeProduct(productId) {
        const existing = this.cart.get(productId);
  
        if (!existing) {
          return {
            ok: false,
            reason: "product-not-in-cart"
          };
        }
  
        if (existing.quantity > 1) {
          this.cart.set(productId, {
            ...existing,
            quantity: existing.quantity - 1
          });
        } else {
          this.cart.delete(productId);
        }
  
        this.notify();
  
        return {
          ok: true,
          quantity: this.getProductQuantity(productId)
        };
      }
  
      /* ==========================================
         9. ALTERAR QUANTIDADE DIRETAMENTE
  
         Útil para os controles + e - do carrinho.
      ========================================== */
  
      setProductQuantity(
        productId,
        typeId,
        requestedQuantity
      ) {
        const quantity = Number(requestedQuantity);
  
        if (
          !Number.isInteger(quantity) ||
          quantity < 0
        ) {
          return {
            ok: false,
            reason: "invalid-product-quantity"
          };
        }
  
        if (
          typeof productId !== "string" ||
          !productId.trim()
        ) {
          return {
            ok: false,
            reason: "invalid-product"
          };
        }
  
        const current =
          this.getProductQuantity(productId);
  
        // Quantidade zero remove o produto.
        if (quantity === 0) {
          if (this.cart.delete(productId)) {
            this.notify();
          }
  
          return { ok: true, quantity: 0 };
        }
  
        if (!this.selectedTypes.has(typeId)) {
          return {
            ok: false,
            reason: "type-not-selected"
          };
        }
  
        const existing = this.cart.get(productId);
  
        if (
          existing &&
          existing.typeId !== typeId
        ) {
          return {
            ok: false,
            reason: "product-type-mismatch"
          };
        }
  
        const projectedTotal =
          this.getTotalUnits() - current + quantity;
  
        if (
          this.quantity === null ||
          projectedTotal > this.quantity
        ) {
          return {
            ok: false,
            reason: "kit-limit"
          };
        }
  
        this.cart.set(productId, {
          productId,
          typeId,
          quantity
        });
  
        this.notify();
  
        return {
          ok: true,
          quantity
        };
      }
  
      /* ==========================================
         10. VALIDAÇÃO FINAL
  
         A etapa de produtos só pode avançar
         quando o total de unidades for exatamente
         igual à quantidade escolhida.
      ========================================== */
  
      isKitComplete() {
        return (
          this.quantity !== null &&
          this.canChooseProducts() &&
          this.getTotalUnits() === this.quantity
        );
      }
  
      /* ==========================================
         11. LIMPAR O CARRINHO
      ========================================== */
  
      clearCart() {
        this.cart.clear();
  
        this.notify();
  
        return { ok: true };
      }
  
      /* ==========================================
         12. REINICIAR O CONFIGURADOR
      ========================================== */
  
      reset() {
        this.model = "transparente";
        this.mode = "manual";
        this.quantity = null;
  
        this.selectedTypes.clear();
        this.cart.clear();
  
        this.notify();
  
        return { ok: true };
      }
    }
  
    /*
     * Namespace global da aplicação.
     *
     * Os próximos arquivos acessarão:
     *
     * window.TicoTico.store
     */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.store = new BuilderStore();
  
  })();
  