
/**
 * TICO-TICO — FORMULÁRIOS
 *
 * Arquivo: js/forms.js
 *
 * Responsabilidades:
 * - Controlar o formulário "Avise-me"
 * - Controlar o formulário de novidades
 * - Validar os campos
 * - Preparar os dados para envio
 * - Exibir mensagens de retorno
 *
 * Dependência:
 * - js/builder-state.js
 *
 * API pública:
 * window.TicoTico.forms
 */

(() => {
    "use strict";
  
    // URL /exec da implantação de integracoes/interesse.gs.
    const CONFIG = Object.freeze({
      endpoint: "https://script.google.com/macros/s/AKfycbz2426uAy_uBKF_0AvpzjtUPeXkgYLTnEe5uGTAAowf84lud-t0m8VFILNZkf1wbCMfIA/exec",
      timeoutMs: 30000
    });
  
    let initialized = false;
  
    let notifyForm = null;
    let newsletterForm = null;
  
    /* ==========================================
       2. UTILITÁRIOS
    ========================================== */
  
    function getElement(id) {
      return document.getElementById(id);
    }
  
    function cleanText(value, maxLength = 2000) {
      return String(value ?? "")
        .trim()
        .slice(0, maxLength);
    }
  
    function getField(form, name) {
      const data = new FormData(form);
  
      return cleanText(data.get(name));
    }
  
    /* ==========================================
       3. MENSAGENS DE RETORNO
  
       Usamos textContent para evitar inserir
       conteúdo do usuário como HTML.
    ========================================== */
  
    function showFeedback(
      element,
      message,
      status = "info"
    ) {
      if (!element) {
        return;
      }
  
      element.textContent = message;
  
      element.dataset.status = status;
  
      element.setAttribute(
        "role",
        status === "error" ? "alert" : "status"
      );
    }
  
    function clearFeedback(element) {
      if (!element) {
        return;
      }
  
      element.textContent = "";
      delete element.dataset.status;
    }
  
    /* ==========================================
       4. VALIDAÇÃO
  
       Os campos possuem validação nativa
       definida no index.html.
  
       Exemplos:
       - required
       - type="email"
    ========================================== */
  
    function validateForm(form) {
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }
  
      return true;
    }
  
    function buildPayload(form, type) {
      const payload = {
        formType: type,
  
        email: cleanText(
          getField(form, "email"),
          254
        ),
  
        suggestions: cleanText(
          getField(form, "suggestions"),
          2000
        )
      };
  
      if (type === "notify") {
        payload.name = cleanText(
          getField(form, "name"),
          100
        );
  

      }
  
      return payload;
    }
  
    async function sendPayload(payload) {
      if (!CONFIG.endpoint) {
        return {
          ok: false,
          reason: "not-configured"
        };
      }
  
      const controller = new AbortController();
  
      const timeout = setTimeout(() => {
        controller.abort();
      }, CONFIG.timeoutMs);
  
      try {
        const response = await fetch(CONFIG.endpoint, {
          method: "POST",
  
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            "Accept": "application/json"
          },
  
          body: JSON.stringify(payload),
  
          signal: controller.signal
        });
  
        if (!response.ok) {
          return {
            ok: false,
            reason: "server-error"
          };
        }
  
        const receipt = await response.json();
        return { ok: receipt.ok === true };
      } catch (error) {
        console.error(
          "[Tico-Tico] Erro ao enviar formulário:",
          error
        );
  
        return {
          ok: false,
          reason: "network-error"
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  
    /* ==========================================
       8. CONTROLAR O ESTADO DO BOTÃO
  
       Evita envios duplicados enquanto
       uma requisição está em andamento.
    ========================================== */
  
    function setSubmitting(form, submitting) {
      const button = form.querySelector(
        'button[type="submit"]'
      );
  
      if (!button) {
        return;
      }
  
      button.disabled = submitting;
  
      if (submitting) {
        button.dataset.originalText =
          button.textContent;
  
        button.textContent = "Enviando...";
      } else {
        if (button.dataset.originalText) {
          button.textContent =
            button.dataset.originalText;
        }
  
        delete button.dataset.originalText;
      }
    }
  
    /* ==========================================
       9. PROCESSAR ENVIO
  
       Esta função é compartilhada pelos
       dois formulários.
  
       Cada formulário recebe uma configuração
       com seu tipo e elemento de feedback.
    ========================================== */
  
    async function handleSubmit(
      event,
      type,
      feedbackId
    ) {
      event.preventDefault();
  
      const form = event.currentTarget;
      const feedback = getElement(feedbackId);
  
      if (form.querySelector('button[type="submit"]').disabled) return;
      clearFeedback(feedback);
  
      if (!validateForm(form)) {
        return;
      }
  
      if (!CONFIG.endpoint) {
        showFeedback(
          feedback,
          "O envio de interesse ainda não está disponível.",
          "info"
        );
  
        return;
      }
  
      const payload = buildPayload(form, type);
  
      setSubmitting(form, true);
  
      showFeedback(
        feedback,
        "Estamos enviando seu interesse...",
        "info"
      );
  
      try {
        const result = await sendPayload(payload);
  
        if (result.ok) {
          showFeedback(
            feedback,
            "Recebemos seu interesse! " +
            "Obrigada por acompanhar a Tico-Tico. " +
            "Vamos te avisar quando tivermos novidades.",
            "success"
          );
  
          window.TicoTico.analytics?.track("generate_lead", { form_type: type });
          form.reset();
        } else {
          showFeedback(
            feedback,
            "Não foi possível registrar " +
            "seu interesse agora. " +
            "Tente novamente mais tarde.",
            "error"
          );
        }
      } finally {
        setSubmitting(form, false);
      }
    }
  
    /* ==========================================
       10. FORMULÁRIO AVISE-ME
    ========================================== */
  
    function handleNotifySubmit(event) {
      return handleSubmit(
        event,
        "notify",
        "notify-feedback"
      );
    }
  
    /* ==========================================
       11. FORMULÁRIO DE NOVIDADES
    ========================================== */
  
    function handleNewsletterSubmit(event) {
      return handleSubmit(
        event,
        "newsletter",
        "newsletter-feedback"
      );
    }
  
    /* ==========================================
       12. INICIALIZAÇÃO
  
       Será chamada pelo app.js depois
       que o documento estiver carregado.
    ========================================== */
  
    function init() {
      if (initialized) {
        return true;
      }
  
      notifyForm = getElement("notify-form");
  
      newsletterForm = getElement(
        "newsletter-form"
      );
  
      if (!notifyForm || !newsletterForm) {
        console.error(
          "[Tico-Tico] Formulários não encontrados."
        );
  
        notifyForm = null;
        newsletterForm = null;
  
        return false;
      }
  
      notifyForm.addEventListener(
        "submit",
        handleNotifySubmit
      );
  
      newsletterForm.addEventListener(
        "submit",
        handleNewsletterSubmit
      );
  
      initialized = true;
  
      return true;
    }
  
    /* ==========================================
       13. LIMPEZA
    ========================================== */
  
    function destroy() {
      if (!initialized) {
        return;
      }
  
      notifyForm?.removeEventListener(
        "submit",
        handleNotifySubmit
      );
  
      newsletterForm?.removeEventListener(
        "submit",
        handleNewsletterSubmit
      );
  
      notifyForm = null;
      newsletterForm = null;
  
      initialized = false;
    }
  
    /* ==========================================
       14. API PÚBLICA
    ========================================== */
  
    window.TicoTico = window.TicoTico || {};
  
    window.TicoTico.forms = Object.freeze({
      init,
      destroy
    });
  
  })();
  