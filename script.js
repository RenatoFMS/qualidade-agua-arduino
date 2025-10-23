// URL da API do ThingSpeak, que fornece os dados do canal específico.
// Contém o Channel ID (3096254) e a chave de leitura (api_key=93VY3A5DJU3OR0E8).
// O parâmetro "results=8000" define que serão buscados os últimos 8000 registros.
const API_URL = "https://api.thingspeak.com/channels/3096254/feeds.json?api_key=93VY3A5DJU3OR0E8&results=8000";

// Variáveis globais que armazenam o gráfico e os dados obtidos da API.
// `chart` guardará o objeto do gráfico gerado pelo Chart.js.
// As demais armazenam as listas de valores lidos para cada parâmetro da água.
let chart;
let tdsValues = [], condValues = [], hardValues = [], labels = [];

// Função assíncrona que faz a requisição dos dados do ThingSpeak.
async function fetchData() {
    // Faz a requisição HTTP para o endpoint da API.
    const response = await fetch(API_URL);

    // Converte a resposta em formato JSON.
    const data = await response.json();

    // Extrai as datas e horários de cada leitura (campo "created_at").
    labels = data.feeds.map(feed => feed.created_at);

    // Extrai os valores de TDS, condutividade e dureza.
    // O operador "|| 0" garante que valores nulos sejam tratados como zero.
    tdsValues = data.feeds.map(feed => parseFloat(feed.field1 || 0));
    condValues = data.feeds.map(feed => parseFloat(feed.field2 || 0));
    hardValues = data.feeds.map(feed => parseFloat(feed.field3 || 0));

    // Atualiza o gráfico com os novos dados.
    updateChart();

    // Atualiza os indicadores de status com o valor mais recente.
    // `.at(-1)` pega o último elemento da lista.
    updateIndicators(tdsValues.at(-1), condValues.at(-1), hardValues.at(-1));
}

// Função que cria ou atualiza o gráfico dos dados medidos.
function updateChart() {
    // Obtém o contexto do elemento <canvas> onde o gráfico será desenhado.
    const ctx = document.getElementById("waterChart").getContext("2d");

    // Se já houver um gráfico existente, destrói-o antes de criar outro.
    if (chart) chart.destroy();

    // Cria um novo gráfico do tipo "linha" (line chart).
    chart = new Chart(ctx, {
        type: "line",
        data: {
            // As labels representam as datas e horas das medições.
            labels,
            // Define os três conjuntos de dados a serem exibidos no gráfico.
            datasets: [
                {
                    label: "TDS (ppm)", // Rótulo da linha
                    data: tdsValues, // Valores de TDS
                    borderColor: "#00bcd4", // Cor da linha
                    backgroundColor: "#00bcd4", // Cor dos pontos
                    pointRadius: 5, // Tamanho dos pontos
                    pointHoverRadius: 8, // Tamanho ao passar o mouse
                },
                {
                    label: "Condutividade (µS/cm)",
                    data: condValues,
                    borderColor: "#ffc107",
                    backgroundColor: "#ffc107",
                    pointRadius: 5,
                    pointHoverRadius: 8,
                },
                {
                    label: "Dureza (mg/L)",
                    data: hardValues,
                    borderColor: "#f44336",
                    backgroundColor: "#f44336",
                    pointRadius: 5,
                    pointHoverRadius: 8,
                }
            ]
        },
        options: {
            responsive: true, // Faz o gráfico se ajustar ao tamanho da tela
            interaction: {
                mode: "nearest", // Interage com o ponto mais próximo do clique
                intersect: true,
            },
            // Permite que o usuário clique em um ponto para atualizar os indicadores.
            onClick: (e) => {
                // Localiza o ponto do gráfico mais próximo do clique.
                const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (points.length) {
                    // Pega o índice do ponto clicado e usa para atualizar os dados mostrados.
                    const idx = points[0].index;
                    updateIndicators(tdsValues[idx], condValues[idx], hardValues[idx]);
                }
            },
            // Configura os eixos do gráfico (X e Y).
            scales: {
                y: { 
                    beginAtZero: true, // Começa do zero no eixo vertical
                    title: { display: true, text: "Valores Medidos" } // Título do eixo Y
                },
                x: { 
                    title: { display: true, text: "Data/Hora" } // Título do eixo X
                }
            }
        }
    });
}

// Função que atualiza os indicadores numéricos e o status geral da água.
function updateIndicators(tds, cond, hard) {
    // Atualiza os elementos HTML com os valores mais recentes.
    document.getElementById("tdsValue").innerText = `${tds} ppm`;
    document.getElementById("condValue").innerText = `${cond} µS/cm`;
    document.getElementById("hardValue").innerText = `${hard} mg/L`;

    // Referências aos elementos de status (caixa, texto e ícone).
    const statusBox = document.getElementById("statusBox");
    const statusText = document.getElementById("statusText");
    const statusIcon = document.getElementById("statusIcon");

    // Define a condição para considerar a água potável.
    // Se todos os valores estiverem abaixo dos limites definidos, é considerada segura.
    if (tds < 500 && cond < 2500 && hard < 1000) {
        // Adiciona a classe "safe" (que pode mudar a cor ou o estilo visual).
        statusBox.classList.add("safe");
        // Exibe mensagem e ícone de água potável.
        statusText.textContent = "Água potável 💧";
        statusIcon.textContent = "✅";
    } else {
        // Remove a classe "safe" para indicar alerta.
        statusBox.classList.remove("safe");
        // Mostra aviso de água não potável.
        statusText.textContent = "Água não potável ⚠️";
        statusIcon.textContent = "⚠️";
    }
}

// Executa a função principal assim que o script é carregado,
// iniciando o processo de busca e exibição dos dados.
fetchData();
