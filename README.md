# Element Screenshot Saver

Extensão para o Google Chrome que permite selecionar qualquer elemento de uma página web — imagens, divs, seções inteiras — e salvá-lo como arquivo PNG, sem precisar tirar print da tela.

---

## Funcionalidades

- Destaque visual ao passar o mouse sobre qualquer elemento HTML
- Clique para salvar o elemento como PNG diretamente no seu computador
- Suporte a `<img>`, `<div>`, `<section>`, `<svg>` e qualquer outro elemento
- Estratégia de captura em múltiplas camadas para contornar restrições CORS
- Tecla `Esc` para desativar o modo de seleção rapidamente
- Cliques em links bloqueados enquanto o modo estiver ativo (sem redirecionamentos acidentais)

---

## Instalação

A extensão não está publicada na Chrome Web Store. Para usá-la, basta carregá-la manualmente no Chrome em modo desenvolvedor:

**1. Clone o repositório**

```bash
git clone git@github.com:JohnDoe/Element-Screenshot.git
```

**2. Abra a página de extensões do Chrome**

Na barra de endereço, digite:

```
chrome://extensions/
```

**3. Ative o Modo do desenvolvedor**

No canto superior direito da página, ative o toggle **"Modo do desenvolvedor"**.

**4. Carregue a extensão**

Clique em **"Carregar sem compactação"** e selecione a pasta do repositório clonado.

A extensão aparecerá na barra do Chrome pronta para uso.

---

## Como usar

1. Clique no ícone da extensão na barra do Chrome
2. Clique em **"Ativar seleção"**
3. Passe o mouse sobre qualquer elemento da página — ele ficará destacado com um brilho roxo e um label indicando a tag HTML
4. Clique no elemento desejado para salvá-lo como PNG
5. O download será iniciado automaticamente
6. Para sair do modo de seleção, clique em **"Desativar seleção"** no popup ou pressione `Esc`

---

## Como funciona a captura

A extensão tenta capturar a imagem em três etapas, na seguinte ordem:

| Estratégia | Quando é usada |
|---|---|
| `fetch` com CORS | Para a maioria das imagens com header `Access-Control-Allow-Origin` |
| `fetch` sem CORS | Para imagens em CDNs que bloqueiam CORS mas permitem download |
| Canvas nativo | Para imagens já carregadas no DOM, usando `drawImage()` diretamente |
| `html2canvas` | Exclusivamente para elementos não-imagem (divs, sections, etc.) |
| `XMLSerializer` | Para elementos `<svg>` inline |

---

## Limitações conhecidas

- **Imagens com taint cross-origin**: imagens servidas sem header CORS e sem suporte a `no-cors` podem não ser salvas com fidelidade total
- **Sites com CSP restritiva**: alguns sites (como o YouTube) bloqueiam renderização via iframe, por isso o html2canvas não é usado para `<img>` nesses casos
- **Vídeos**: apenas o frame atual do poster/src é capturado, não o vídeo em si
- **Elementos `position: fixed`**: podem aparecer deslocados na captura via html2canvas dependendo do scroll da página

---

## Tecnologias

- [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/) — arquitetura atual das extensões Chrome
- [html2canvas](https://html2canvas.hertzen.com/) v1.4.1 — renderização de elementos DOM como canvas
- JavaScript puro — sem frameworks ou dependências de build

---

## Estrutura do projeto

```
GoogleExt/
├── manifest.json        # Configuração da extensão (permissões, scripts)
├── popup.html           # Interface do popup (botão toggle)
├── popup.js             # Lógica do popup
├── content.js           # Script injetado nas páginas (captura e highlight)
├── html2canvas.min.js   # Biblioteca de captura (incluída localmente)
└── README.md            # Este arquivo
```
