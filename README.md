# Guia de Deploy automatico (CI/CD) Azure - Docker - GitHub Actions
Este guia Documenta o processo de configuração de uma VM na Azure e a criação de um pipeline de CI/CD.

## Parte 1. Configuraçao da Máquina Virtual (VM)
---
1. atualize os pacotes de sistema:
```bash
sudo apt update

sudo apt upgrade -y
```
---
2. instale o `docker`:
```bash
curl -fsSL https://get.docker.com | sh
```
---
3. Adicione o seu usuário ao grupo Docker: Isso evita ter que usar `sudo` toda hora:
```bash
sudo usermod -aG docker $USER
```
---
4. Após rodar o ultimo comando é necessário sair (`exit`) e entrar de novo(`ssh ...`).
---
## Parte 2. Teste manual do Nginx
---
5. Para saber se está rodando, execute o comando `docker ps` se não aparecer nenhum erro e retornar o cabeçalho abaixo, o procedimento rodou corretamente.
```bash
CONTAINER ID   IMAGE     COMMAND           CREATED         STATUS         PORTS                                     NAMES
```
---
6. Crie uma pasta e um arquivo docker-compose.yml
```
mkdir app-teste

cd app-teste

nano docker-compose.yml
```
---
7. Vai abrir a tela de ediçao. Cole o conteúdo abaixo:
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
8. Suba o container 
```
docker compose up -d
```
Acesse seu IP pelo navegador. Se aparecer **Welcome to Nginx** funcionou!

---
## Parte 3. Configuraçao do GitHub
---
9. Crie um repositorio público no github
---
10. Após criar o repo, Acesse: `Settings > Secrets and variables > Actions > New repository secret` e crie 3 repositorios secrets

|Name|Value|Como pegar|
|----|----|----|
|HOST|Digite o IP de sua VM|Painel Azure|
|USER|O nome do usuário da VM|Painel Azure|
|KEY|Coloque o Key (sem o .pub)*|No Mac/Windows (PowerShell): `cat ~/.ssh/id_ed25519`|

- *Para copiar o arquivo rode no iTerm local o comando no Mac: `cat ~/.ssh/id_ed25519 | pbcopy`. 
- *No Windows (powershell): `cat ~/.ssh/id_ed25519 | clip` (cmd): `type ~/.ssh/id_ed25519 | clip`.

---
11. Crie uma pasta em seu pc e a abra com o VS Code e realize o pull do seu repositorio `git clone https://github.com/SEU_USER/SEU_REPO.git`
---
## Parte 4. Arquivos do Projeto
---
12. crie a pasta e o arquivo `.github/workflows/deploy.yml` e coloque o codigo abaixo:
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
                    # 1. Garante que a pasta existe e entra nela
                    mkdir -p ~/app
                    cd ~/app

                    # 2. Limpeza brutal (Mata qualquer container antigo rodando)
                    docker rm -f $(docker ps -aq) || true
                    
                    # 3. LÓGICA DE OURO: Clona na 1ª vez, Atualiza nas próximas
                    if [ ! -d ".git" ]; then
                        echo "Clonando repositorio pela primeira vez..."
                        git clone https://github.com/SEU_USER/SEU_REPO.git .
                    else
                        echo "Atualizando repositorio existente..."
                        git pull origin main
                    fi

                    # 4. Sobe a nova versão
                    docker compose down
                    docker compose up -d --build
```
---
13. Crie o arquivo `docker-compose.yml` na raiz do projeto:
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
14. Crie o arquivo `app.py` na raiz do projeto:
```python
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return "<h1>Hello World!</h1><p>Se voce esta vendo isso o CI/CD funcionou!</p>"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port = 5000)
```
---
15. Crie o arquivo `requirements.txt` na raiz do projeto:
```txt
flask
```
---
16. Crie o arquivo `Dockerfile` na raiz do projeto:
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

17. Faça o commit e o push no terminal
```bash
git add .
git commit -m "Configuração Inicial CI/CD"
git push origin main
```
---
18. Acompanhe o Deploy na aba Actions do repositorio. Assim que rodar, acesse o seu IP novamente pelo navegador e veja se a mensagem de que subiu corretamente está pronta.
---
## Parte 5. Apontamento de Domínio (DNS)
---
19. Acesse o Painel onde voce registrou o seu domínio (Registro.br, GoDaddy, Hostinger, Cloudflare, etc.).
---
20. Vá até a zona de **DNS** e crie um **Registro A** (A Record):
* **Nome/Host**: `@` (ou deixe em branco, representa a raiz do seu site, ex: `meusite.com`)
* **Valor/Destino/IP**: Cle o **IP da sua VM**.
---
21. (Opcional) Crie um registro `CNAME` para o `www`*(Dessa forma voce pode acessar o site tanto pelo meusite.com quanto pelo www.meusite.com)*
* **Nome/Host**: `www`
* **Valor/Destino**: meusite.com
    *Nota: A propagação do DNS pode levar de alguns minutos a algumas horas.*

---
## Parte 6. Configuração do HTTPS Automático (Usando Caddy)
Vamos usar o *Caddy Server* para interceptar o domínio e gerar o SSL/HTTPS automaticamente.
---
22. Modifique o seu `docker-compose.yml` na raiz do projeto para incluir o Caddy e esconder a porta do Flask:
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
      -./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web

Volumes:
    caddy_data:
    caddy_config:
```
---
23. Crie um arquivo chamado exatamente `Caddyfile` (sem extensão) na raiz do projeto:
```
meusite.com, www.meusite.com {
    reverse_proxy web:5000
}
```
---
## Parte 7. Deploy do Caddy
---
24. Faça o commit e o push no terminal para ativar a action e subir tudo:
```bash
git add .
git commit -m "feat: configuração de domínio e SSL via Caddy"
git push origin main
```
---
25. Acompanhe o Deploy na aba Actions do repositorio. Quando terminar acesse seu dominio pelo navegador.