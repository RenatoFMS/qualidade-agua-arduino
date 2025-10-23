#include <WiFi.h>
#include <ThingSpeak.h>

// Credenciais de acesso à rede Wi-Fi (Hotspot)
const char* REDE_WIFI = ""; 
const char* SENHA_WIFI = ""; 

// Informações do canal ThingSpeak
unsigned long CHANNEL_ID = 3096254; 
const char* API_KEY_ESCRITA = "D6PQHCYMK7JTVNWA"; 
WiFiClient client;

// Pino analógico em que o sensor TDS está ligado
#define PINO_TDS 34 

// Valores de TDS (ppm) para classificar a qualidade da água
const int TDS_LIMPA = 100;
const int TDS_MEDIA = 300;
const int TDS_SUJA = 500;

// Variáveis de referência para os cálculos e calibração
float VRef = 3.3; 
float SAMPLES_TDS = 10; 
float FATOR_TDS_CONDUTIVIDADE = 0.5; 
float FATOR_DUREZA = 0.3; 

// Função que classifica a qualidade da água com base no valor TDS
String classificarQualidade(float tds) {
  if (tds <= TDS_LIMPA) {
    return "AGUA LIMPA (Qualidade: Boa)";
  } else if (tds <= TDS_MEDIA) {
    return "AGUA MEDIA (Qualidade: Aceitavel)";
  } else if (tds <= TDS_SUJA) {
    return "AGUA SUJA (Qualidade: Ruim)";
  } else {
    return "AGUA MUITO SUJA (Qualidade: Pessima)";
  }
}

// Função de Leitura, Conversão e Cálculo dos valores de TDS/Condutividade/Dureza
void lerTDS_Completo(float *tds, float *condutividade, float *dureza) {
  float mediaTensao = 0;
  float temperatura = 25.0;

  // Realiza 10 amostras do pino analógico para obter um valor mais estável
  for (int i = 0; i < SAMPLES_TDS; i++) {
    mediaTensao += analogRead(PINO_TDS);
    delay(10);
  }
  mediaTensao = mediaTensao / SAMPLES_TDS;

  // Mostra o valor bruto lido do sensor TDS (0 a 4095)
  Serial.print("Leitura Bruta (0-4095): ");
  Serial.println(mediaTensao);

  // Converte a leitura ADC em Tensão e compensa a temperatura
  float tensao = mediaTensao * (VRef / 4095.0);
  float tensaoCompensada = tensao / (1.0 + 0.02 * (temperatura - 25.0));

  // Aplica a fórmula para converter Tensão compensada em TDS (ppm)
  if (tensaoCompensada < 1.5) {
      *tds = (610.1 * tensaoCompensada * tensaoCompensada) - (1216.5 * tensaoCompensada) + 574.67;
  } else {
      *tds = (622.7 * tensaoCompensada * tensaoCompensada) - (1190 * tensaoCompensada) + 577.2;
  }
  
  // Garante que o TDS não seja um valor negativo
  if (*tds < 0) {
    *tds = 0;
  }

  // Cálculos finais de Condutividade e Dureza
  *condutividade = *tds / FATOR_TDS_CONDUTIVIDADE; 
  *dureza = *condutividade * FATOR_DUREZA; 
}

// Rotina de inicialização do Serial, Pino e Conexão Wi-Fi
void setup() {
  Serial.begin(115200); 
  pinMode(PINO_TDS, INPUT);

  WiFi.begin(REDE_WIFI, SENHA_WIFI);
  Serial.println("Conectando a rede: " + String(REDE_WIFI));

  int tentativas = 0;
  // Verifica se o WiFi foi conectado corretamente com limite de 30s
  while (WiFi.status() != WL_CONNECTED && tentativas < 60) {
    delay(500); 
    Serial.print(".");
    tentativas++;
  }

  if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi conectado!");
      Serial.print("IP do ESP32: ");
      Serial.println(WiFi.localIP());
  } else {
      Serial.println("\nFalha ao conectar no WiFi. Verifique SSID/Senha.");
  }

  ThingSpeak.begin(client);
}

// Rotina principal: Leitura, Exibição e Envio de dados
void loop() {
  float tds = 0;
  float condutividade = 0;
  float dureza = 0;
  
  lerTDS_Completo(&tds, &condutividade, &dureza);
  
  String classificacao = classificarQualidade(tds);

  Serial.println("==========================================");
  Serial.print("TDS Estimado (ppm): ");
  Serial.println(tds);
  Serial.print("Condutividade (uS/cm): ");
  Serial.println(condutividade);
  Serial.print("Dureza (mg/L CaCO3): ");
  Serial.println(dureza);
  Serial.print("Classificacao: ");
  Serial.println(classificacao);
  Serial.println("==========================================");

  // Manda os valores para o ThingSpeak se o Wi-Fi estiver conectado
  if (WiFi.status() == WL_CONNECTED) {
    ThingSpeak.setField(1, tds); 
    ThingSpeak.setField(2, condutividade); 
    ThingSpeak.setField(3, dureza); 
    ThingSpeak.setStatus(classificacao);

    int codigo_resposta = ThingSpeak.writeFields(CHANNEL_ID, API_KEY_ESCRITA);

    // Mostra mensagem confirmando se os dados foram enviados
    if (codigo_resposta == 200) {
      Serial.println("Dados enviados ao ThingSpeak com sucesso.");
    } else {
      Serial.println("Erro ao enviar dados para o ThingSpeak. Codigo: " + String(codigo_resposta));
    }
  } else {
    Serial.println("WiFi desconectado. Tentando novamente...");
    WiFi.reconnect();
  }

  // Espera 60 segundos antes de realizar a próxima leitura e envio.
  delay(60000); 
}
