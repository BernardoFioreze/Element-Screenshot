const btn = document.getElementById("toggle-btn");
const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");

// Chave usada para comunicação com o content script
const STORAGE_KEY = "ess_active_tab";

function setUI(isActive) {
  if (isActive) {
    btn.textContent = "Desativar seleção";
    btn.classList.add("active");
    statusText.textContent = "Modo de seleção ativo";
    statusText.classList.add("active");
    statusDot.classList.add("active");
  } else {
    btn.textContent = "Ativar seleção";
    btn.classList.remove("active");
    statusText.textContent = "Modo de seleção inativo";
    statusText.classList.remove("active");
    statusDot.classList.remove("active");
  }
}

// Lê o estado atual da aba ativa ao abrir o popup
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.tabs.sendMessage(tab.id, { type: "GET_STATE" }, (response) => {
    if (chrome.runtime.lastError) {
      // Content script ainda não respondeu (página sem suporte), ignora
      setUI(false);
      return;
    }
    setUI(response?.active ?? false);
  });
});

btn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Não foi possível comunicar com o content script.");
        return;
      }
      setUI(response?.active ?? false);
    });
  });
});
