# Guia de Deploy automatico (CI/CD) Azure - Docker - GitHub Actions
Este guia Documenta o processo de configuração de uma VM na Azure e a criação de um pipeline de CI/CD.

## Parte 1. Configuraçao da Máquina Virtual (VM)
---
1. [ ] atualize os pacotes de sistema:
```bash
sudo apt update

sudo apt upgrade -y
```
---
2. [ ] instale o `docker`:
```bash
curl -fsSL https://get.docker.com | sh
```
---
3. [ ] Adicione o seu usuário ao grupo Docker: Isso evita ter que usar `sudo` toda hora:
```bash
sudo usermod -aG docker $USER
newgrp docker
```
---
4. [ ] Após rodar o ultimo comando é necessário sair (`exit`) e entrar de novo(`ssh ...`).
---
## Parte 2. Teste manual do Nginx
---
5. [ ] Para saber se está rodando, execute o comando `docker ps` se não aparecer nenhum erro e retornar o cabeçalho abaixo, o procedimento rodou corretamente.
```bash
CONTAINER ID   IMAGE     COMMAND           CREATED         STATUS         PORTS                                     NAMES
```
---
6. [ ] Crie uma pasta e um arquivo docker-compose.yml
```
mkdir app-teste

cd app-teste

nano docker-compose.yml
```
---
7. [ ] Vai abrir a tela de ediçao. Cole o conteúdo abaixo:
```yaml
services:
    web:
        image: nginx:latest
        ports:
          - "80:80"
        restart: always
```
(Salve com `Ctrl+O`, `Enter` e saia com `Ctrl+X`)

---
8. [ ] Suba o container 
```
docker compose up -d
```
Acesse seu IP pelo navegador. Se aparecer **Welcome to Nginx** funcionou!

---
## Parte 3. Configuraçao do GitHub
---
9. [ ] Crie um repositorio público no github
---
10. [ ] Após criar o repo, Acesse: `Settings > Secrets and variables > Actions > New repository secret` e crie 3 repositorios secrets

|Name|Value|Como pegar|
|----|----|----|
|HOST|Digite o IP de sua VM|Painel Azure|
|USER|O nome do usuário da VM|Painel Azure|
|KEY|Coloque o Key (sem o .pub)*|No Mac/Windows (PowerShell): `cat ~/.ssh/id_ed25519`|

- *Para copiar o arquivo rode no iTerm local o comando no Mac: `cat ~/.ssh/id_ed25519 | pbcopy`.
- *No Windows (powershell): `cat ~/.ssh/id_ed25519 | clip` (cmd): `type ~/.ssh/id_ed25519 | clip`.

---
11. [ ] Crie uma pasta em seu pc e a abra com o VS Code e realize o pull do seu repositorio `git clone https://github.com/SEU_USER/SEU_REPO.git`
---
## Parte 4. Arquivos do Projeto
---
12. [ ] crie a pasta e o arquivo `.github/workflows/deploy.yml` e coloque o codigo abaixo:
```yaml
name: Deploy to Azure VM

on:
    push:
        branches: [ main ]
    
jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
          - name: Deploy via SSH
            uses: appleboy/ssh-action@master
            with:
                host: ${{ secrets.HOST }}
                username: ${{ secrets.USER }}
                key: ${{ secrets.KEY }}
                port: 22
                script: |
                    # 1. [ ] Garante que a pasta existe e entra nela
                    mkdir -p ~/app
                    cd ~/app

                    # 2. [ ] Limpeza brutal (Mata qualquer container antigo rodando)
                    docker rm -f $(docker ps -aq) || true
                    
                    # 3. [ ] LÓGICA DE OURO: Clona na 1ª vez, Atualiza nas próximas
                    if [ ! -d ".git" ]; then
                        echo "Clonando repositorio pela primeira vez..."
                        git clone https://github.com/SEU_USER/SEU_REPO.git .
                    else
                        echo "Atualizando repositorio existente..."
                        git pull origin main
                    fi

                    # 4. [ ] Sobe a nova versão
                    docker compose down
                    docker compose up -d --build
```
---
13. [ ] Crie o arquivo `docker-compose.yml` na raiz do projeto:
```yaml
version: '3.8'

services:
    web:
        build: .
        #Mapeia a porta 80 da VM para a 5000 do container
        ports:
          - "80:5000"
        restart: always
```
---
14. [ ] Crie o arquivo `app.py` na raiz do projeto:
```python
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return """<h1>Hello World!</h1><p>Se voce esta vendo isso o CI/CD funcionou!</p>"""

if __name__ == '__main__':
    app.run(host='0.0.0.0', port = 5000)
```
---
15. [ ] Crie o arquivo `requirements.txt` na raiz do projeto:
```txt
flask
```
---
16. [ ] Crie o arquivo `Dockerfile` na raiz do projeto:
```Dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```
---
## Parte 5. Passo Final
---

17. [ ] Faça o commit e o push no terminal
```bash
git add .
git commit -m "Configuração Inicial CI/CD"
git push origin main
```
---
18. [ ] Acompanhe o Deploy na aba Actions do repositorio. [ ] Assim que rodar, acesse o seu IP novamente pelo navegador e veja se a mensagem de que subiu corretamente está pronta.
---
## Parte 5. Apontamento de Domínio (DNS)
---
19. [ ] Acesse o Painel onde voce registrou o seu domínio (Registro.br, GoDaddy, Hostinger, Cloudflare, etc.).
---
20. [ ] Vá até a zona de **DNS** e crie um **Registro A** (A Record):
* **Nome/Host**: `@` (ou deixe em branco, representa a raiz do seu site, ex: `meusite.com`)
* **Valor/Destino/IP**: Cole o **IP da sua VM**.
---
21. [ ] (Opcional) Crie um registro `CNAME` para o `www`*(Dessa forma voce pode acessar o site tanto pelo meusite.com quanto pelo www.meusite.com)*
* **Nome/Host**: `www`
* **Valor/Destino**: meusite.com
    *Nota: A propagação do DNS pode levar de alguns minutos a algumas horas.*

---
## Parte 6. Configuração do HTTPS Automático (Usando Caddy)
Vamos usar o *Caddy Server* para interceptar o domínio e gerar o SSL/HTTPS automaticamente.
---
22. [ ] Modifique o seu `docker-compose.yml` na raiz do projeto para incluir o Caddy e esconder a porta do Flask:
```yaml
version: '3.8'

services:
    web:
        build: .
        # Retiramos as 'ports' da VM.
        #ports:
        #  - "80:5000"
        restart: always
    
    caddy:
        image: caddy:latest
        restart: always
    
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web

volumes:
    caddy_data:
    caddy_config:
```
---
23. [ ] Crie um arquivo chamado exatamente `Caddyfile` (sem extensão) na raiz do projeto:
```
meusite.com, www.meusite.com {
    reverse_proxy web:5000
}
```
---
## Parte 7. Deploy do Caddy
---
24. [ ] Faça o commit e o push no terminal para ativar a action e subir tudo:
```bash
git add .
git commit -m "feat: configuração de domínio e SSL via Caddy"
git push origin main
```
---
25. [ ] Acompanhe o Deploy na aba Actions do repositorio. [ ] Quando terminar acesse seu dominio pelo navegador.
---
## Parte 8. Adicionando Frontend (HTML, CSS, JS)
Para deixarmos o Flask servir páginas web reais, precisamos organizar nosso arquivos em pastas específicas.
26. [ ] No VSCode, crie as seguintes pastas na raíz do seu projeto:
* `templates` (para o HTML)
* `static/css` (para o CSS)
* `static/js` (para o JS)\
A estrutura vai ficar assim:
```
📦 seu-projeto
 ┣ 📂 static
 ┃ ┣ 📂 css
 ┃ ┃ ┗ 📜 style.css
 ┃ ┗ 📂 js
 ┃ ┃ ┗ 📜 main.js
 ┣ 📂 templates
 ┃ ┗ 📜 index.html
 ┣ 📜 app.py
 ┣ 📜 Dockerfile
 ┣ 📜 docker-compose.yml
 ┣ 📜 Caddyfile
 ┗ 📜 requirements.txt
```
---
27. [ ] Edite o `app.py` para usar o `render_template` do Flask:
```python
from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def hello():
    # Agora o Flask vai procurar o arquivo index.html dentro da pasta /templates
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```
---
28. [ ] Crie o arquivo `templates/index.html`:
```HTML
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipeline de Sucesso</title>
    <!-- O Flask usa o {{ url_for}} para achar arquivos na pasta static -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}?v=1.1"> 
</head>
<body>
    <div class="container">
        <div class="glow-box">
            <h1 class="glitch" data-text="Deploy Concluído!">Deploy Concluído!</h1>
            <span id="typewriter" class="status-text typewriter"></span>
            <div class="badges">
                <span class="badge azure">Azure VM</span>
                <span class="badge docker">Docker</span>
                <span class="badge github">GitHub Actions</span>
                <span class="badge caddy">Caddy SSL</span>
            </div>
            <button id="action-btn" class="cyber-btn">Testar Conexão</button>
        </div>
    </div>

    <script src="{{ url_for('static', filename='js/main.js') }}?v=1.1"></script>
</body>
</html>
```
---
29. [ ] Crie o arquivo `static/css/style.css`:
```CSS
@import url('[https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap](https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap)');

body {
    margin: 0;
    padding: 0;
    background-color: #0d1117;
    color: #c9d1d9;
    font-family: 'Fira Code', monospace;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    overflow: hidden;
}

.container {
    text-align: center;
    padding: 2rem;
}

.glow-box {
    background: #161b22;
    padding: 3rem;
    border-radius: 15px;
    box-shadow: 0 0 20px rgba(88, 166, 255, 0.2);
    border: 1px solid #30363d;
}

h1 {
    color: #58a6ff;
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

#typewriter {
    min-height: 24px;
    color: #8b949e;
    margin-bottom: 2rem;
}

.badges {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 2rem;
    flex-wrap: wrap;
}

.badge {
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
}

.azure { background: #0078D4; color: white; }
.docker { background: #2496ED; color: white; }
.github { background: #181717; color: white; }
.caddy { background: #00add8; color: white; }

.cyber-btn {
    background: transparent;
    color: #58a6ff;
    border: 2px solid #58a6ff;
    padding: 10px 20px;
    font-size: 1rem;
    font-family: inherit;
    cursor: pointer;
    border-radius: 5px;
    transition: all 0.3s ease;
}

.cyber-btn:hover {
    background: #58a6ff;
    color: #0d1117;
    box-shadow: 0 0 15px #58a6ff;
}
```
---
30. [ ] Crie o arquivo `static/js/main.js`:
```JS
// Efeito de digitação (Typewriter)
const text = "O CI/CD está rodando perfeitamente e seguro com HTTPS.";
const typewriterElement = document.getElementById("typewriter");
let i = 0;

function typeWriter() {
    if (i < text.length) {
        typewriterElement.innerHTML += text.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
    }
}

// Inicia o efeito quando a página carrega
window.onload = typeWriter;

// Botão interativo
document.getElementById('action-btn').addEventListener('click', () => {
    alert("Conexão estabelecida com sucesso! Seu pipeline é incrível. [ ] 🚀");
});
```
---
## Parte 9. [ ] Teste a pagina com o ambiente virtual isolado(venv)
31. [ ] Crie o ambiente virtual: `python -m venv .venv`
---
32. [ ] Ative o ambiente virtual: No Windows: `.venv\Scripts\activate`, No Mac:`source .venv/bin/activate`.
---
33. [ ] Instale as dependencias: `pip install -r requirements.txt`
---
34. [ ] Atualize os pacotes: `python.exe -mpip install --upgrade pip`
---
35. [ ] Inicie a aplicação: `python app.py` ou `flask run --debug` 
---
36. [ ] Acesse pelo navegador `http://127.0.0.1:5000`.
---
37. [ ] Se o site for exibido corretamente. [ ] Pare o run `Ctrl+c` e saia do venv `deactivate`.
---
38. [ ] Crie um arquivo na raiz do projeto chamado: `.gitignore`. Isso impedirá que os arquivos listados não seja enviados ao seu repositório.
```
venv/
.venv/
__pycache__/
.env/
*.pyc
```
39. [ ] Faça o commit e o push.
```BASH
git add .
git commit -m "feat: adiciona interface web com dark mode"
git push origin main
```
---
Verifique a aba de actions e veja seu site funcionando.
---
