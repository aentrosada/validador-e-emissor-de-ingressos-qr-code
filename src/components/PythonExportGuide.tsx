import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  Download,
  Server,
  FileCode,
  ShieldAlert,
  Rocket,
  Terminal,
  FileText,
} from 'lucide-react';

export const PythonExportGuide: React.FC = () => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (filename: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2500);
  };

  // 1. app.py code
  const appPyCode = `import os
import json
from datetime import datetime
from flask import Flask, render_template, request, jsonify
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import pandas as pd

app = Flask(__name__)

# Configuração de Conexão com Google Sheets via Variável de Ambiente
def get_google_sheet():
    # As credenciais do Google Service Account devem ser passadas como JSON em GOOGLE_CREDENTIALS_JSON
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    sheet_name = os.environ.get("GOOGLE_SHEET_NAME", "IngressosEvento")
    
    if not creds_json:
        raise ValueError("Variável de ambiente GOOGLE_CREDENTIALS_JSON não configurada.")
        
    creds_dict = json.loads(creds_json)
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    sheet = client.open(sheet_name).sheet1
    return sheet

@app.route("/")
def index():
    """ Renderiza a página do scanner da portaria """
    return render_template("index.html")

@app.route("/validar", methods=["POST"])
def validar():
    """ Rota de API chamada via Fetch API pelo scanner da portaria """
    data = request.get_json() or {}
    uuid_lido = data.get("uuid", "").strip()
    dia_evento = int(data.get("dia", 1)) # 1 = Sábado (Dia 1), 2 = Domingo (Dia 2)

    if not uuid_lido:
        return jsonify({"status": "erro", "mensagem": "UUID não fornecido."}), 400

    try:
        sheet = get_google_sheet()
        records = sheet.get_all_records()
        df = pd.DataFrame(records)

        # Mapeamento e busca do UUID na coluna ID_INGRESSO ou UUID
        col_uuid = "ID_INGRESSO" if "ID_INGRESSO" in df.columns else "UUID"
        
        # Filtra a linha correspondente ao UUID
        linha_index = df.index[df[col_uuid].astype(str).str.strip().str.lower() == uuid_lido.lower()].tolist()

        if not linha_index:
            return jsonify({
                "status": "erro",
                "mensagem": f"Erro: UUID {uuid_lido} não encontrado na planilha."
            }), 404

        idx = linha_index[0]
        row_data = df.iloc[idx]
        linha_planilha = idx + 2 # +2 por conta do cabeçalho de 1-index do gspread

        # Checar SITUAÇÃO (deve ser LIBERADO)
        situacao = str(row_data.get("SITUAÇÃO", row_data.get("SITUACAO", "LIBERADO"))).strip().upper()
        if situacao != "LIBERADO":
            return jsonify({
                "status": "erro",
                "mensagem": f"Erro: Ingresso não está LIBERADO (Situação: {situacao})."
            }), 400

        # Checar TIPO
        tipo = int(row_data.get("TIPO", 3))
        # tipo 1 = Sábado, 2 = Domingo, 3 = Passaporte (Sábado e Domingo)
        if dia_evento == 1 and tipo == 2:
            return jsonify({
                "status": "erro",
                "mensagem": "Erro: Ingresso do tipo 2 (DOMINGO) não é válido para a portaria de SÁBADO."
            }), 400

        if dia_evento == 2 and tipo == 1:
            return jsonify({
                "status": "erro",
                "mensagem": "Erro: Ingresso do tipo 1 (SÁBADO) não é válido para a portaria de DOMINGO."
            }), 400

        # Definir nomes das colunas de check-in
        col_checkin_nome = "CHECKIN_DIA_1" if "CHECKIN_DIA_1" in df.columns else "DIA 1"
        if dia_evento == 2:
            col_checkin_nome = "CHECKIN_DIA_2" if "CHECKIN_DIA_2" in df.columns else "DIA 2"

        val_checkin = str(row_data.get(col_checkin_nome, "")).strip()

        # Se já tiver dados, retorna Erro: Ingresso já utilizado
        if val_checkin and val_checkin.lower() != "none" and val_checkin != "nan":
            return jsonify({
                "status": "erro",
                "mensagem": f"Erro: Ingresso já utilizado no Dia {dia_evento}! (Check-in anterior: {val_checkin})"
            }), 400

        # Se estiver vazia, preenche com timestamp atual e retorna Sucesso
        timestamp_atual = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Identificar número da coluna para atualizar via gspread
        headers = sheet.row_values(1)
        col_num = headers.index(col_checkin_nome) + 1
        
        sheet.update_cell(linha_planilha, col_num, timestamp_atual)

        nome_participante = str(row_data.get("NOME", "Participante"))
        return jsonify({
            "status": "sucesso",
            "mensagem": f"Sucesso: Entrada Liberada para {nome_participante}!",
            "nome": nome_participante,
            "timestamp": timestamp_atual
        }), 200

    except Exception as e:
        return jsonify({
            "status": "erro",
            "mensagem": f"Erro de processamento no servidor: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
`;

  // 2. requirements.txt
  const requirementsTxtCode = `Flask==3.0.3
gspread==6.1.0
pandas==2.2.2
oauth2client==4.1.3
gunicorn==22.0.0
`;

  // 3. templates/index.html
  const indexHtmlCode = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portaria - Validador de Ingressos QR Code</title>
  <!-- Tailwind CSS via CDN para layout rápido e responsivo -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Biblioteca HTML5-QRCode para Leitura de Câmera -->
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
  
  <header class="bg-slate-900 border-b border-slate-800 py-4 px-6 shadow-md">
    <div class="max-w-md mx-auto flex items-center justify-between">
      <h1 class="text-base font-bold text-white flex items-center gap-2">
        🎟️ Portaria do Evento
      </h1>
      <select id="dia-select" class="bg-slate-950 text-slate-200 border border-slate-700 rounded-lg text-xs p-2">
        <option value="1">Portaria SÁBADO (Dia 1)</option>
        <option value="2">Portaria DOMINGO (Dia 2)</option>
      </select>
    </div>
  </header>

  <main class="max-w-md mx-auto w-full p-4 flex-1 flex flex-col gap-4">
    
    <!-- Caixas de Alerta (Sucesso / Erro) -->
    <div id="alert-container" class="hidden p-4 rounded-2xl border text-sm font-bold shadow-lg transition-all text-center"></div>

    <!-- Container da Câmera do Celular -->
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-center space-y-3">
      <h2 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Aproxime o QR Code do Ingresso</h2>
      
      <div id="reader" class="overflow-hidden rounded-xl border border-slate-800 bg-black min-h-[250px]"></div>

      <button id="btn-camera" onclick="iniciarCamera()" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all">
        Ativar Câmera do Celular
      </button>
    </div>

    <!-- Fallback Manual para Digitação de UUID -->
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
      <label class="block text-xs text-slate-400 font-semibold">Digitar UUID Manualmente:</label>
      <div class="flex gap-2">
        <input type="text" id="uuid-manual" placeholder="Ex: axd-gtl-yyu" class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white">
        <button onclick="validarManual()" class="bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold px-4 py-2 rounded-xl text-xs">Validar</button>
      </div>
    </div>
  </main>

  <script>
    let html5QrcodeScanner = null;

    function exibirAlerta(status, mensagem) {
      const alertContainer = document.getElementById('alert-container');
      alertContainer.classList.remove('hidden', 'bg-emerald-950/90', 'border-emerald-500', 'text-emerald-300', 'bg-rose-950/90', 'border-rose-500', 'text-rose-300');
      
      if (status === 'sucesso') {
        alertContainer.classList.add('bg-emerald-950/90', 'border-emerald-500', 'text-emerald-300');
      } else {
        alertContainer.classList.add('bg-rose-950/90', 'border-rose-500', 'text-rose-300');
      }

      alertContainer.innerHTML = mensagem;
    }

    async function validarUUID(uuid) {
      const diaSelect = document.getElementById('dia-select').value;

      try {
        const response = await fetch('/validar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid: uuid, dia: diaSelect })
        });

        const data = await response.json();
        exibirAlerta(data.status, data.mensagem);

      } catch (err) {
        exibirAlerta('erro', 'Erro de conexão ao comunicar com o servidor Flask.');
      }
    }

    function validarManual() {
      const input = document.getElementById('uuid-manual');
      if (input.value.trim()) {
        validarUUID(input.value.trim());
      }
    }

    function iniciarCamera() {
      if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
      }

      html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          validarUUID(decodedText);
        },
        (errorMessage) => {}
      ).catch(err => {
        alert("Erro ao acessar câmera: " + err);
      });
    }
  </script>
</body>
</html>
`;

  // 4. Instructions DEPLOY_RENDER.md
  const deployMdCode = `# Instruções de Deploy no Render (Flask + Google Sheets)

## 1. Estrutura de Arquivos do Repositório GitHub
Certifique-se que o repositório possui a seguinte estrutura:
\`\`\`
meu-evento-qr/
├── app.py
├── requirements.txt
└── templates/
    └── index.html
\`\`\`

## 2. Configurar o Render.com
1. Acesse o dashboard do [Render.com](https://render.com) e crie um **New Web Service**.
2. Conecte o repositório GitHub onde enviou o código.
3. Preencha as configurações do serviço:
   - **Name**: \`evento-qr-scanner\`
   - **Environment**: \`Python 3\`
   - **Build Command**: \`pip install -r requirements.txt\`
   - **Start Command**: \`gunicorn app:app\`

## 3. Configurar Variáveis de Ambiente (Environment Variables) no Render
Para manter as credenciais do Google Cloud seguras sem expor arquivos no GitHub público:

1. Acesse no GCP o **Service Account Key** e baixe o arquivo JSON de credenciais.
2. No Render, vá até a aba **Environment** do seu Web Service e adicione a seguinte variável:
   - **Key**: \`GOOGLE_CREDENTIALS_JSON\`
   - **Value**: Copie e cole **todo o conteúdo do arquivo JSON** baixado da Service Account (incluindo as chaves \`{\` e \`}\`).
3. (Opcional) Adicione o nome da sua planilha:
   - **Key**: \`GOOGLE_SHEET_NAME\`
   - **Value**: \`IngressosEvento\` (ou o nome exato da sua planilha no Google Drive).

## 4. Compartilhar a Planilha do Google Sheets
Certifique-se de compartilhar a planilha do Google Sheets com a **Service Account email** (ex: \`evento-service-account@meu-projeto.iam.gserviceaccount.com\`) concedendo permissão de **Editor** para que o Flask consiga atualizar os campos \`CHECKIN_DIA_1\` e \`CHECKIN_DIA_2\`.
`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* INTRO BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 border border-purple-500/20 shrink-0">
            <Code2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              Arquivos Gerados para Python, Flask, Google Sheets & Deploy no Render
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Aqui estão os arquivos completos em Python/Flask solicitados para a hospedagem do sistema no Render
              com integração direta com o Google Sheets via <code className="text-purple-300">gspread</code> e{' '}
              <code className="text-purple-300">pandas</code>.
            </p>
          </div>
        </div>
      </div>

      {/* FILE 1: app.py */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold font-mono text-white">1. app.py</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Python / Flask</span>
          </div>

          <button
            onClick={() => handleCopy('app.py', appPyCode)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            {copiedFile === 'app.py' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFile === 'app.py' ? 'Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-200 bg-slate-950 overflow-x-auto leading-relaxed max-h-96">
          {appPyCode}
        </pre>
      </div>

      {/* FILE 2: requirements.txt */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold font-mono text-white">2. requirements.txt</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Gunicorn, Pandas, gspread</span>
          </div>

          <button
            onClick={() => handleCopy('requirements.txt', requirementsTxtCode)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            {copiedFile === 'requirements.txt' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFile === 'requirements.txt' ? 'Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>

        <pre className="p-4 text-xs font-mono text-indigo-300 bg-slate-950 overflow-x-auto leading-relaxed">
          {requirementsTxtCode}
        </pre>
      </div>

      {/* FILE 3: templates/index.html */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold font-mono text-white">3. templates/index.html</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">HTML5 / QR Scanner</span>
          </div>

          <button
            onClick={() => handleCopy('templates/index.html', indexHtmlCode)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            {copiedFile === 'templates/index.html' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFile === 'templates/index.html' ? 'Copiado!' : 'Copiar Código'}</span>
          </button>
        </div>

        <pre className="p-4 text-xs font-mono text-slate-200 bg-slate-950 overflow-x-auto leading-relaxed max-h-80">
          {indexHtmlCode}
        </pre>
      </div>

      {/* FILE 4: DEPLOY INSTRUCTIONS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">4. Instruções de Deploy no Render</span>
          </div>

          <button
            onClick={() => handleCopy('DEPLOY_RENDER.md', deployMdCode)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-all"
          >
            {copiedFile === 'DEPLOY_RENDER.md' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFile === 'DEPLOY_RENDER.md' ? 'Copiado!' : 'Copiar Instruções'}</span>
          </button>
        </div>

        <div className="p-6 text-xs text-slate-300 leading-relaxed space-y-4 font-sans bg-slate-950">
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-sm">
              <Terminal className="w-4 h-4 text-indigo-400" /> Configuração no Render.com:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-2">
              <li>
                <strong className="text-slate-200">Start Command:</strong>{' '}
                <code className="bg-slate-900 px-2 py-0.5 rounded font-mono text-indigo-300">gunicorn app:app</code>
              </li>
              <li>
                <strong className="text-slate-200">Build Command:</strong>{' '}
                <code className="bg-slate-900 px-2 py-0.5 rounded font-mono text-indigo-300">pip install -r requirements.txt</code>
              </li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h4 className="font-bold text-white flex items-center gap-1.5 text-sm">
              <ShieldAlert className="w-4 h-4 text-emerald-400" /> Passar Credenciais do Google de Forma Segura:
            </h4>
            <p className="text-slate-400">
              Crie uma variável de ambiente no dashboard do Render com a chave{' '}
              <code className="text-emerald-300 font-mono">GOOGLE_CREDENTIALS_JSON</code> e cole o conteúdo bruto do seu
              arquivo de credenciais JSON retornado pelo Google Cloud Service Account. O Flask lerá a variável com{' '}
              <code className="text-slate-300 font-mono">os.environ.get("GOOGLE_CREDENTIALS_JSON")</code> sem que as chaves
              fiquem visíveis no repositório público do GitHub!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
